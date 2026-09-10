use chrono::{DateTime, Utc};
use rusqlite::Connection;

use crate::dto::{CommitTxInput, InputUom, OperationType, TxResult};
use crate::error::AppError;
use crate::repo;
use crate::services;
use crate::time;

const MAX_INPUT: i64 = 999_999;
const MAX_COUNT: i64 = 9_999_999;

fn validate(input: &CommitTxInput) -> Result<(), AppError> {
    uuid::Uuid::parse_str(&input.client_txn_id).map_err(|_| AppError::invalid("clientTxnId"))?;
    match input.operation {
        OperationType::Adjustment => {
            if input.input_uom != InputUom::Count {
                return Err(AppError::invalid("ADJUSTMENT uses COUNT"));
            }
            if !(0..=MAX_COUNT).contains(&input.input_quantity) {
                return Err(AppError::InvalidQuantity);
            }
            if input.reason_code.is_none() {
                return Err(AppError::invalid("reasonCode required"));
            }
        }
        OperationType::StockIn | OperationType::Sale | OperationType::Return => {
            if input.input_uom == InputUom::Count {
                return Err(AppError::invalid("COUNT only for ADJUSTMENT"));
            }
            if !(1..=MAX_INPUT).contains(&input.input_quantity) {
                return Err(AppError::InvalidQuantity);
            }
            if input.operation == OperationType::Return && input.return_disposition.is_none() {
                return Err(AppError::invalid("returnDisposition required"));
            }
        }
        _ => return Err(AppError::invalid("operation not allowed")),
    }
    Ok(())
}

pub fn commit(conn: &mut Connection, input: &CommitTxInput, now: DateTime<Utc>) -> Result<TxResult, AppError> {
    if let Some(existing) = repo::transactions::find_result_by_client_id(conn, &input.client_txn_id)? {
        return Ok(existing);
    }
    validate(input)?;
    crate::db::write(conn, |tx| {
        let operator = repo::employees::get(tx, input.operator_id)?.ok_or(AppError::NotFound("employee"))?;
        if !operator.is_active {
            return Err(AppError::OperatorInactive);
        }
        let settings = repo::load_settings(tx)?;
        let location_id = settings.active_location_id.ok_or(AppError::SetupIncomplete)?;
        let product = repo::products::get(tx, input.product_id)?.ok_or(AppError::NotFound("product"))?;
        let identifier = match &input.identifier_code {
            Some(code) => {
                let idf = repo::identifiers::find_active_by_code(tx, code.trim())?
                    .ok_or(AppError::NotFound("identifier"))?;
                if idf.product_id != product.id {
                    return Err(AppError::PreviewStale);
                }
                Some(idf)
            }
            None => None,
        };
        let (stock_before, _, _) = repo::inventory::get_balance(tx, location_id, product.id)?
            .ok_or(AppError::NotFound("balance"))?;
        let id_mult = identifier.as_ref().map(|i| i.unit_multiplier).unwrap_or(1);
        let unit_multiplier: i64 = match input.input_uom {
            InputUom::Pcs => id_mult,
            InputUom::Ctn => {
                if id_mult != 1 {
                    return Err(AppError::CartonBarcodeWithCtn);
                }
                product
                    .pack_size
                    .ok_or(AppError::PackSizeMissing { product_id: product.id })?
            }
            InputUom::Count => 1,
        };
        let units = input
            .input_quantity
            .checked_mul(unit_multiplier)
            .ok_or(AppError::QuantityTooLarge)?;
        if units > MAX_COUNT {
            return Err(AppError::QuantityTooLarge);
        }
        let quantity_change = match input.operation {
            OperationType::StockIn | OperationType::Return => units,
            OperationType::Sale => -units,
            OperationType::Adjustment => input.input_quantity - stock_before,
            _ => return Err(AppError::invalid("operation not allowed")),
        };
        if quantity_change == 0 {
            return Err(AppError::NoChange);
        }
        let stock_after = stock_before + quantity_change;
        let negative = quantity_change < 0 && stock_after < 0;
        if negative && !input.acknowledge_negative {
            return Err(AppError::NeedsAck {
                stock_before,
                stock_after,
            });
        }
        let session_id = services::sessions::ensure_open(tx, operator.id, location_id, &settings, now)?;
        let ts = time::utc_iso(now);
        tx.execute(
            "
            INSERT INTO transactions (
                client_txn_id, session_id, location_id, product_id, identifier_id, identifier_code,
                operation_type, input_quantity, input_uom, unit_multiplier, quantity_change,
                stock_before, stock_after, operator_id, negative_stock_warning, warning_acknowledged,
                return_disposition, reason_code, source, notes, created_at
            ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21)
            ",
            rusqlite::params![
                input.client_txn_id,
                session_id,
                location_id,
                product.id,
                identifier.as_ref().map(|i| i.id),
                identifier.as_ref().map(|i| i.code.clone()),
                input.operation.as_db(),
                input.input_quantity,
                input.input_uom.as_db(),
                unit_multiplier,
                quantity_change,
                stock_before,
                stock_after,
                operator.id,
                negative as i64,
                negative as i64,
                input.return_disposition.map(|d| d.as_db()),
                input.reason_code.map(|r| r.as_db()),
                input.source.as_db(),
                input.notes,
                ts,
            ],
        )?;
        let transaction_id = tx.last_insert_rowid();
        repo::inventory::set_current(tx, location_id, product.id, stock_after, stock_before, &ts)?;
        if negative {
            repo::exceptions::insert_negative(tx, transaction_id, product.id, stock_before, stock_after, &ts)?;
        }
        repo::sessions::touch(tx, session_id, &ts)?;
        let session = repo::sessions::summary(tx, session_id)?;
        Ok(TxResult {
            transaction_id,
            client_txn_id: input.client_txn_id.clone(),
            operation: input.operation,
            quantity_change,
            stock_before,
            stock_after,
            negative_warning: negative,
            session,
            created_at: ts,
            idempotent_replay: false,
            was_exported: false,
        })
    })
}

pub fn undo_last(
    conn: &mut Connection,
    operator_id: i64,
    client_txn_id: &str,
    now: DateTime<Utc>,
) -> Result<TxResult, AppError> {
    if let Some(existing) = repo::transactions::find_result_by_client_id(conn, client_txn_id)? {
        return Ok(existing);
    }
    uuid::Uuid::parse_str(client_txn_id).map_err(|_| AppError::invalid("clientTxnId"))?;
    crate::db::write(conn, |tx| {
        let session = repo::sessions::find_open(tx)?.ok_or(AppError::NothingToUndo)?;
        if session.operator_id != operator_id {
            return Err(AppError::NothingToUndo);
        }
        let original_id =
            repo::transactions::latest_undoable(tx, session.id, operator_id)?.ok_or(AppError::NothingToUndo)?;
        let o = repo::transactions::get(tx, original_id)?;
        let (before, _, _) = repo::inventory::get_balance(tx, o.location_id, o.product_id)?
            .ok_or(AppError::NotFound("balance"))?;
        let change = -o.quantity_change;
        let after = before + change;
        let negative = change < 0 && after < 0;
        let ts = time::utc_iso(now);
        tx.execute(
            "
            INSERT INTO transactions (
                client_txn_id, session_id, location_id, product_id, identifier_id, identifier_code,
                operation_type, input_quantity, input_uom, unit_multiplier, quantity_change,
                stock_before, stock_after, operator_id, negative_stock_warning, warning_acknowledged,
                reverses_transaction_id, source, created_at
            ) VALUES (?1,?2,?3,?4,?5,?6,'REVERSAL',?7,'SYSTEM',1,?8,?9,?10,?11,?12,?12,?13,'SYSTEM',?14)
            ",
            rusqlite::params![
                client_txn_id,
                session.id,
                o.location_id,
                o.product_id,
                o.identifier_id,
                o.identifier_code,
                o.input_quantity,
                change,
                before,
                after,
                operator_id,
                negative as i64,
                original_id,
                ts,
            ],
        )?;
        let transaction_id = tx.last_insert_rowid();
        repo::inventory::set_current(tx, o.location_id, o.product_id, after, before, &ts)?;
        if negative {
            repo::exceptions::insert_negative(tx, transaction_id, o.product_id, before, after, &ts)?;
        }
        repo::sessions::touch(tx, session.id, &ts)?;
        let summary = repo::sessions::summary(tx, session.id)?;
        Ok(TxResult {
            transaction_id,
            client_txn_id: client_txn_id.to_string(),
            operation: OperationType::Reversal,
            quantity_change: change,
            stock_before: before,
            stock_after: after,
            negative_warning: negative,
            session: summary,
            created_at: ts,
            idempotent_replay: false,
            was_exported: o.sync_status != "LOCAL",
        })
    })
}

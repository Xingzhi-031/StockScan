use chrono::{Duration, Utc};
use rusqlite::Connection;

use crate::dto::{
    CommitTxInput, InputUom, OperationType, ReasonCode, ReturnDisposition, TxSource,
};
use crate::error::AppError;
use crate::services;
use crate::test_support::{assert_invariants, test_db};

fn seed() -> (Connection, i64, i64, String) {
    let mut conn = test_db();
    crate::dev_seed::seed_demo_sized(&mut conn, Utc::now(), 4, 2).unwrap();
    let admin = crate::repo::employees::find_by_code(&conn, "1024")
        .unwrap()
        .unwrap();
    let product_id = 1i64;
    let code: String = conn
        .query_row(
            "SELECT code FROM identifiers WHERE product_id = ?1 AND is_active = 1",
            [product_id],
            |r| r.get(0),
        )
        .unwrap();
    (conn, admin.id, product_id, code)
}

fn set_qty(conn: &Connection, product_id: i64, qty: i64) {
    conn.execute(
        "UPDATE inventory_balances SET current_quantity = ?1, baseline_quantity = ?1 WHERE product_id = ?2",
        rusqlite::params![qty, product_id],
    )
    .unwrap();
}

fn cid() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn input(
    operator_id: i64,
    product_id: i64,
    code: Option<&str>,
    operation: OperationType,
    qty: i64,
    uom: InputUom,
) -> CommitTxInput {
    CommitTxInput {
        client_txn_id: cid(),
        operator_id,
        product_id,
        identifier_code: code.map(str::to_string),
        operation,
        input_quantity: qty,
        input_uom: uom,
        reason_code: if operation == OperationType::Adjustment {
            Some(ReasonCode::CountCorrection)
        } else {
            None
        },
        return_disposition: if operation == OperationType::Return {
            Some(ReturnDisposition::Sellable)
        } else {
            None
        },
        acknowledge_negative: false,
        source: TxSource::Scan,
        notes: None,
    }
}

fn qty_of(conn: &Connection, product_id: i64) -> i64 {
    conn.query_row(
        "SELECT current_quantity FROM inventory_balances WHERE product_id = ?1",
        [product_id],
        |r| r.get(0),
    )
    .unwrap()
}

fn tx_count(conn: &Connection) -> i64 {
    conn.query_row("SELECT COUNT(*) FROM transactions", [], |r| r.get(0))
        .unwrap()
}

#[test]
fn sale_three_pcs_drops_stock() {
    let (mut conn, op, pid, code) = seed();
    set_qty(&conn, pid, 50);
    let r = services::transactions::commit(
        &mut conn,
        &input(op, pid, Some(&code), OperationType::Sale, 3, InputUom::Pcs),
        Utc::now(),
    )
    .unwrap();
    assert_eq!(r.stock_before, 50);
    assert_eq!(r.stock_after, 47);
    assert_eq!(r.quantity_change, -3);
    assert!(!r.idempotent_replay);
    assert_eq!(qty_of(&conn, pid), 47);
    assert_invariants(&conn);
}

#[test]
fn sale_two_cartons_uses_pack_size() {
    let (mut conn, op, _, _) = seed();
    let pid = 4i64; // pack 100
    set_qty(&conn, pid, 250);
    let r = services::transactions::commit(
        &mut conn,
        &input(op, pid, None, OperationType::Sale, 2, InputUom::Ctn),
        Utc::now(),
    )
    .unwrap();
    assert_eq!(r.quantity_change, -200);
    assert_eq!(r.stock_after, 50);
    assert_invariants(&conn);
}

#[test]
fn carton_barcode_multiplies_and_rejects_ctn() {
    let (mut conn, op, pid, _) = seed();
    set_qty(&conn, pid, 200);
    crate::repo::identifiers::insert(
        &conn,
        pid,
        "CARTON-60",
        crate::dto::IdentifierType::Code128,
        60,
        op,
        &crate::time::utc_iso(Utc::now()),
    )
    .unwrap();
    let r = services::transactions::commit(
        &mut conn,
        &input(op, pid, Some("CARTON-60"), OperationType::Sale, 1, InputUom::Pcs),
        Utc::now(),
    )
    .unwrap();
    assert_eq!(r.quantity_change, -60);
    let err = services::transactions::commit(
        &mut conn,
        &input(op, pid, Some("CARTON-60"), OperationType::Sale, 1, InputUom::Ctn),
        Utc::now(),
    )
    .unwrap_err();
    assert!(matches!(err, AppError::CartonBarcodeWithCtn));
    assert_invariants(&conn);
}

#[test]
fn ctn_without_pack_size_fails() {
    let (mut conn, op, pid, _) = seed();
    conn.execute("UPDATE products SET pack_size = NULL WHERE id = ?1", [pid])
        .unwrap();
    let err = services::transactions::commit(
        &mut conn,
        &input(op, pid, None, OperationType::Sale, 1, InputUom::Ctn),
        Utc::now(),
    )
    .unwrap_err();
    assert!(matches!(err, AppError::PackSizeMissing { .. }));
}

#[test]
fn stock_in_and_return_increase_stock() {
    let (mut conn, op, pid, code) = seed();
    set_qty(&conn, pid, 10);
    let inn = services::transactions::commit(
        &mut conn,
        &input(op, pid, Some(&code), OperationType::StockIn, 5, InputUom::Pcs),
        Utc::now(),
    )
    .unwrap();
    assert_eq!(inn.stock_after, 15);
    let ret = services::transactions::commit(
        &mut conn,
        &input(op, pid, Some(&code), OperationType::Return, 2, InputUom::Pcs),
        Utc::now(),
    )
    .unwrap();
    assert_eq!(ret.stock_after, 17);
    assert_invariants(&conn);
}

#[test]
fn adjustment_sets_count_and_rejects_no_change() {
    let (mut conn, op, pid, _) = seed();
    set_qty(&conn, pid, 46);
    let r = services::transactions::commit(
        &mut conn,
        &input(op, pid, None, OperationType::Adjustment, 44, InputUom::Count),
        Utc::now(),
    )
    .unwrap();
    assert_eq!(r.quantity_change, -2);
    assert_eq!(r.stock_after, 44);
    let err = services::transactions::commit(
        &mut conn,
        &input(op, pid, None, OperationType::Adjustment, 44, InputUom::Count),
        Utc::now(),
    )
    .unwrap_err();
    assert!(matches!(err, AppError::NoChange));
    let mut missing = input(op, pid, None, OperationType::Adjustment, 40, InputUom::Count);
    missing.reason_code = None;
    let err = services::transactions::commit(&mut conn, &missing, Utc::now()).unwrap_err();
    assert!(matches!(err, AppError::InvalidInput(_)));
    assert_invariants(&conn);
}

#[test]
fn quantity_limits() {
    let (mut conn, op, pid, _) = seed();
    for qty in [0i64, -1, 1_000_000] {
        let err = services::transactions::commit(
            &mut conn,
            &input(op, pid, None, OperationType::Sale, qty, InputUom::Pcs),
            Utc::now(),
        )
        .unwrap_err();
        assert!(matches!(err, AppError::InvalidQuantity), "{qty} -> {err:?}");
    }
    conn.execute("UPDATE products SET pack_size = 450 WHERE id = ?1", [pid])
        .unwrap();
    set_qty(&conn, pid, 9_999_999);
    let err = services::transactions::commit(
        &mut conn,
        &input(op, pid, None, OperationType::Sale, 999_999, InputUom::Ctn),
        Utc::now(),
    )
    .unwrap_err();
    assert!(matches!(err, AppError::QuantityTooLarge));
}

#[test]
fn negative_stock_requires_ack_and_does_not_write() {
    let (mut conn, op, pid, code) = seed();
    set_qty(&conn, pid, 2);
    let before = tx_count(&conn);
    let mut sale = input(op, pid, Some(&code), OperationType::Sale, 5, InputUom::Pcs);
    let err = services::transactions::commit(&mut conn, &sale, Utc::now()).unwrap_err();
    match err {
        AppError::NeedsAck {
            stock_before,
            stock_after,
        } => {
            assert_eq!(stock_before, 2);
            assert_eq!(stock_after, -3);
        }
        other => panic!("{other:?}"),
    }
    assert_eq!(tx_count(&conn), before);
    assert_eq!(qty_of(&conn, pid), 2);
    sale.acknowledge_negative = true;
    let r = services::transactions::commit(&mut conn, &sale, Utc::now()).unwrap();
    assert_eq!(r.stock_after, -3);
    assert!(r.negative_warning);
    let open: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM exceptions WHERE type = 'NEGATIVE_STOCK' AND status = 'OPEN'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(open, 1);
    assert_invariants(&conn);
}

#[test]
fn same_client_txn_id_is_idempotent() {
    let (mut conn, op, pid, code) = seed();
    set_qty(&conn, pid, 50);
    let mut sale = input(op, pid, Some(&code), OperationType::Sale, 3, InputUom::Pcs);
    let first = services::transactions::commit(&mut conn, &sale, Utc::now()).unwrap();
    let second = services::transactions::commit(&mut conn, &sale, Utc::now()).unwrap();
    assert!(!first.idempotent_replay);
    assert!(second.idempotent_replay);
    assert_eq!(first.transaction_id, second.transaction_id);
    assert_eq!(tx_count(&conn), 1);
    sale.client_txn_id = cid();
    let _ = services::transactions::commit(&mut conn, &sale, Utc::now()).unwrap();
    assert_eq!(tx_count(&conn), 2);
    assert_invariants(&conn);
}

#[test]
fn rebound_barcode_is_preview_stale() {
    let (mut conn, op, pid, code) = seed();
    set_qty(&conn, pid, 20);
    let other = 3i64;
    conn.execute("UPDATE identifiers SET product_id = ?1 WHERE code = ?2", rusqlite::params![other, code])
        .unwrap();
    let err = services::transactions::commit(
        &mut conn,
        &input(op, pid, Some(&code), OperationType::Sale, 1, InputUom::Pcs),
        Utc::now(),
    )
    .unwrap_err();
    assert!(matches!(err, AppError::PreviewStale));
}

#[test]
fn transactions_are_append_only() {
    let (mut conn, op, pid, code) = seed();
    services::transactions::commit(
        &mut conn,
        &input(op, pid, Some(&code), OperationType::Sale, 1, InputUom::Pcs),
        Utc::now(),
    )
    .unwrap();
    let del = conn.execute("DELETE FROM transactions", []);
    assert!(del.is_err());
    let upd = conn.execute("UPDATE transactions SET quantity_change = 99", []);
    assert!(upd.is_err());
}

#[test]
fn session_reused_until_idle_then_new_number() {
    let (mut conn, op, pid, code) = seed();
    let t0 = Utc::now();
    let a = services::transactions::commit(
        &mut conn,
        &input(op, pid, Some(&code), OperationType::Sale, 1, InputUom::Pcs),
        t0,
    )
    .unwrap();
    let b = services::transactions::commit(
        &mut conn,
        &input(op, pid, Some(&code), OperationType::Sale, 1, InputUom::Pcs),
        t0 + Duration::minutes(10),
    )
    .unwrap();
    assert_eq!(a.session.id, b.session.id);
    assert_eq!(a.session.session_number, 1);
    let c = services::transactions::commit(
        &mut conn,
        &input(op, pid, Some(&code), OperationType::Sale, 1, InputUom::Pcs),
        t0 + Duration::minutes(41),
    )
    .unwrap();
    assert_ne!(c.session.id, a.session.id);
    assert_eq!(c.session.session_number, 2);
    let reason: String = conn
        .query_row(
            "SELECT close_reason FROM sessions WHERE id = ?1",
            [a.session.id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(reason, "IDLE_TIMEOUT");
    assert_invariants(&conn);
}

#[test]
fn switching_operator_closes_session() {
    let (mut conn, admin, pid, code) = seed();
    let amy = crate::repo::employees::find_by_code(&conn, "1031")
        .unwrap()
        .unwrap();
    let t0 = Utc::now();
    let a = services::transactions::commit(
        &mut conn,
        &input(admin, pid, Some(&code), OperationType::Sale, 1, InputUom::Pcs),
        t0,
    )
    .unwrap();
    let b = services::transactions::commit(
        &mut conn,
        &input(amy.id, pid, Some(&code), OperationType::Sale, 1, InputUom::Pcs),
        t0 + Duration::minutes(1),
    )
    .unwrap();
    assert_ne!(a.session.id, b.session.id);
    let reason: String = conn
        .query_row(
            "SELECT close_reason FROM sessions WHERE id = ?1",
            [a.session.id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(reason, "OPERATOR_SWITCH");
}

#[test]
fn undo_walks_back_and_cannot_undo_empty() {
    let (mut conn, op, pid, code) = seed();
    set_qty(&conn, pid, 50);
    let t0 = Utc::now();
    services::transactions::commit(
        &mut conn,
        &input(op, pid, Some(&code), OperationType::Sale, 3, InputUom::Pcs),
        t0,
    )
    .unwrap();
    services::transactions::commit(
        &mut conn,
        &input(op, pid, Some(&code), OperationType::StockIn, 1, InputUom::Pcs),
        t0,
    )
    .unwrap();
    assert_eq!(qty_of(&conn, pid), 48);
    let u1 = services::transactions::undo_last(&mut conn, op, &cid(), t0).unwrap();
    assert_eq!(u1.operation, OperationType::Reversal);
    assert_eq!(qty_of(&conn, pid), 47);
    let u2 = services::transactions::undo_last(&mut conn, op, &cid(), t0).unwrap();
    assert_eq!(qty_of(&conn, pid), 50);
    let err = services::transactions::undo_last(&mut conn, op, &cid(), t0).unwrap_err();
    assert!(matches!(err, AppError::NothingToUndo));
    let replay = services::transactions::undo_last(&mut conn, op, &u2.client_txn_id, t0).unwrap();
    assert!(replay.idempotent_replay);
    assert_invariants(&conn);
}

#[test]
fn undo_cannot_cross_session_or_other_operator() {
    let (mut conn, admin, pid, code) = seed();
    let amy = crate::repo::employees::find_by_code(&conn, "1031")
        .unwrap()
        .unwrap();
    let t0 = Utc::now();
    services::transactions::commit(
        &mut conn,
        &input(admin, pid, Some(&code), OperationType::Sale, 1, InputUom::Pcs),
        t0,
    )
    .unwrap();
    let err = services::transactions::undo_last(&mut conn, amy.id, &cid(), t0).unwrap_err();
    assert!(matches!(err, AppError::NothingToUndo));
}

#[test]
fn undo_of_exported_sets_flag() {
    let (mut conn, op, pid, code) = seed();
    let t0 = Utc::now();
    let sale = services::transactions::commit(
        &mut conn,
        &input(op, pid, Some(&code), OperationType::Sale, 1, InputUom::Pcs),
        t0,
    )
    .unwrap();
    conn.execute(
        "UPDATE transactions SET sync_status = 'EXPORTED' WHERE id = ?1",
        [sale.transaction_id],
    )
    .unwrap();
    let undo = services::transactions::undo_last(&mut conn, op, &cid(), t0).unwrap();
    assert!(undo.was_exported);
}

#[test]
fn undo_stock_in_into_negative_records_exception() {
    let (mut conn, op, pid, code) = seed();
    set_qty(&conn, pid, 2);
    let t0 = Utc::now();
    let mut sale = input(op, pid, Some(&code), OperationType::Sale, 5, InputUom::Pcs);
    sale.acknowledge_negative = true;
    services::transactions::commit(&mut conn, &sale, t0).unwrap();
    services::transactions::commit(
        &mut conn,
        &input(op, pid, Some(&code), OperationType::StockIn, 5, InputUom::Pcs),
        t0,
    )
    .unwrap();
    let undo = services::transactions::undo_last(&mut conn, op, &cid(), t0).unwrap();
    assert_eq!(undo.stock_after, -3);
    assert!(undo.negative_warning);
    assert_invariants(&conn);
}

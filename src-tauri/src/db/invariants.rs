use rusqlite::Connection;

use crate::error::AppError;

#[derive(Debug, Clone, Default)]
pub struct InvariantReport {
    pub violations: i64,
    pub details: Vec<String>,
}

pub fn check(conn: &Connection) -> Result<InvariantReport, AppError> {
    let mut report = InvariantReport::default();

    let i1: Vec<(i64, i64)> = {
        let mut stmt = conn.prepare(
            "
            SELECT b.location_id, b.product_id
            FROM inventory_balances b
            LEFT JOIN transactions t
              ON t.location_id = b.location_id
             AND t.product_id  = b.product_id
             AND t.absorbed_by_import_id IS NULL
            GROUP BY b.location_id, b.product_id
            HAVING b.current_quantity <> b.baseline_quantity + COALESCE(SUM(t.quantity_change), 0)
            ",
        )?;
        let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    for (location_id, product_id) in &i1 {
        report.details.push(format!(
            "I1 balance mismatch location={location_id} product={product_id}"
        ));
    }

    let i3: Vec<i64> = {
        let mut stmt = conn.prepare(
            "
            SELECT r.id FROM transactions r
            JOIN transactions o ON o.id = r.reverses_transaction_id
            WHERE r.quantity_change <> -o.quantity_change
            ",
        )?;
        let rows = stmt.query_map([], |row| row.get(0))?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    for id in &i3 {
        report.details.push(format!("I3 reversal amount mismatch id={id}"));
    }

    let i4: Vec<i64> = {
        let mut stmt = conn.prepare(
            "
            SELECT id FROM transactions
            WHERE (sync_status = 'LOCAL'    AND export_batch_id IS NOT NULL)
               OR (sync_status <> 'LOCAL'   AND export_batch_id IS NULL)
               OR (sync_status = 'SYNCED'   AND synced_at IS NULL)
            ",
        )?;
        let rows = stmt.query_map([], |row| row.get(0))?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    for id in &i4 {
        report.details.push(format!("I4 sync status mismatch id={id}"));
    }

    report.violations = report.details.len() as i64;
    if report.violations > 0 {
        log::error!(
            "invariant check failed: {} violation(s): {:?}",
            report.violations,
            report.details
        );
    }
    Ok(report)
}

use chrono::{DateTime, Utc};
use rusqlite::{Connection, Transaction};

use crate::dto::{EmployeeInput, Language, LocationType, Role, SetupInput};
use crate::error::AppError;
use crate::repo;
use crate::services;
use crate::time;

const DEMO_PRODUCTS: usize = 2000;
const DEMO_BARCODES: usize = 1500;

pub fn seed_demo(conn: &mut Connection, now: DateTime<Utc>) -> Result<(), AppError> {
    seed_demo_sized(conn, now, DEMO_PRODUCTS, DEMO_BARCODES)
}

pub fn seed_demo_sized(
    conn: &mut Connection,
    now: DateTime<Utc>,
    product_count: usize,
    barcode_count: usize,
) -> Result<(), AppError> {
    if repo::company_count(conn)? > 0 {
        return Ok(());
    }

    let input = SetupInput {
        language: Language::En,
        company_name: "PT. CHANG PING INDONESIA".into(),
        admin: EmployeeInput {
            id: None,
            employee_code: "1024".into(),
            name: "Alex".into(),
            role: Role::Admin,
        },
        employees: vec![
            EmployeeInput {
                id: None,
                employee_code: "1031".into(),
                name: "Amy".into(),
                role: Role::Operator,
            },
            EmployeeInput {
                id: None,
                employee_code: "1068".into(),
                name: "John".into(),
                role: Role::Operator,
            },
        ],
        location: crate::dto::SetupLocationInput {
            code: "GS8-21".into(),
            name: "GS 8A NO 21".into(),
            location_type: LocationType::Warehouse,
        },
    };
    services::setup::complete_setup(conn, &input, now)?;

    let settings = repo::load_settings(conn)?;
    let company_id = settings.company_id.ok_or(AppError::SetupIncomplete)?;
    let location_id = settings.active_location_id.ok_or(AppError::SetupIncomplete)?;
    let admin = repo::employees::find_by_code(conn, "1024")?
        .ok_or(AppError::NotFound("employee"))?;
    let now_iso = time::utc_iso(now);
    repo::employees::touch_last_used(conn, admin.id, &now_iso)?;

    let tx = conn.transaction()?;
    let import_id = insert_baseline_import(&tx, location_id, admin.id, product_count, &now_iso)?;
    insert_catalog(
        &tx,
        company_id,
        location_id,
        import_id,
        product_count,
        barcode_count,
        admin.id,
        &now_iso,
    )?;
    tx.commit()?;
    Ok(())
}

fn insert_baseline_import(
    tx: &Transaction<'_>,
    location_id: i64,
    imported_by: i64,
    row_count: usize,
    now_iso: &str,
) -> Result<i64, AppError> {
    tx.execute(
        "
        INSERT INTO imports (
            import_type, status, file_name, file_sha256, file_format, source_system,
            source_report_name, company_name, source_location_name, location_id,
            report_as_of_date, row_count, imported_by, imported_at, applied_at
        ) VALUES (
            'BASELINE', 'APPLIED', 'seed-demo.xls',
            '0000000000000000000000000000000000000000000000000000000000000000',
            'XLS', 'ACCURATE5',
            'Kuantitas Barang GS 8 No.21', 'PT. CHANG PING INDONESIA', 'GS 8A NO 21',
            ?1, '2026-09-10', ?2, ?3, ?4, ?4
        )
        ",
        rusqlite::params![location_id, row_count as i64, imported_by, now_iso],
    )?;
    Ok(tx.last_insert_rowid())
}

fn insert_catalog(
    tx: &Transaction<'_>,
    company_id: i64,
    location_id: i64,
    import_id: i64,
    product_count: usize,
    barcode_count: usize,
    created_by: i64,
    now_iso: &str,
) -> Result<(), AppError> {
    let pack_sizes = [12_i64, 24, 60, 100, 450];
    for i in 1..=product_count {
        let name = format!("DEMO ITEM {i:04}");
        let name_key = name.to_lowercase();
        let model = format!("DM-{i:04}");
        let pack = pack_sizes[(i - 1) % pack_sizes.len()];
        let price = 10_000 + (i as i64 % 50) * 500;
        tx.execute(
            "
            INSERT INTO products (
                company_id, name, name_key, model_code, pack_size, reference_price,
                currency, is_active, created_import_id, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'IDR', 1, ?7, ?8, ?8)
            ",
            rusqlite::params![company_id, name, name_key, model, pack, price, import_id, now_iso],
        )?;
        let product_id = tx.last_insert_rowid();
        let qty = 10 + (i as i64 % 500);
        tx.execute(
            "
            INSERT INTO inventory_balances (
                location_id, product_id, baseline_quantity, baseline_import_id,
                current_quantity, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?3, ?5)
            ",
            rusqlite::params![location_id, product_id, qty, import_id, now_iso],
        )?;
        if i <= barcode_count {
            let code = format!("{:013}", 8_000_000_000_000i64 + i as i64);
            tx.execute(
                "
                INSERT INTO identifiers (
                    product_id, code, identifier_type, unit_multiplier, is_active,
                    created_by, created_at
                ) VALUES (?1, ?2, 'EAN13', 1, 1, ?3, ?4)
                ",
                rusqlite::params![product_id, code, created_by, now_iso],
            )?;
        }
    }
    Ok(())
}

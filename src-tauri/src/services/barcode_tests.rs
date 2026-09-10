use chrono::Utc;

use crate::dto::{BarcodeKind, IdentifierType, LinkBarcodeInput, ResolveResult};
use crate::error::AppError;
use crate::services;
use crate::test_support::{assert_invariants, test_db};

fn seed() -> rusqlite::Connection {
    let mut conn = test_db();
    crate::dev_seed::seed_demo_sized(&mut conn, Utc::now(), 4, 2).unwrap();
    conn
}

fn admin_id(conn: &rusqlite::Connection) -> i64 {
    crate::repo::employees::find_by_code(conn, "1024")
        .unwrap()
        .unwrap()
        .id
}

#[test]
fn leading_zeros_and_crlf_are_preserved_or_stripped() {
    let mut conn = seed();
    let op = admin_id(&conn);
    let linked = services::barcode::link(
        &mut conn,
        &LinkBarcodeInput {
            product_id: 3,
            code: "0012345678905".into(),
            kind: BarcodeKind::Unit,
            unit_multiplier: None,
            operator_id: op,
        },
        Utc::now(),
    )
    .unwrap();
    assert_eq!(linked.code, "0012345678905");
    match services::barcode::resolve(&mut conn, "0012345678905", Utc::now()).unwrap() {
        ResolveResult::Found { identifier, .. } => assert_eq!(identifier.code, "0012345678905"),
        other => panic!("{other:?}"),
    }
    match services::barcode::resolve(&mut conn, "ABC-123\r\n", Utc::now()).unwrap() {
        ResolveResult::Unknown { code } => assert_eq!(code, "ABC-123"),
        other => panic!("{other:?}"),
    }
    let long = "A".repeat(64);
    services::barcode::link(
        &mut conn,
        &LinkBarcodeInput {
            product_id: 3,
            code: long.clone(),
            kind: BarcodeKind::Unit,
            unit_multiplier: None,
            operator_id: op,
        },
        Utc::now(),
    )
    .unwrap();
    let too_long = "A".repeat(65);
    let err = services::barcode::link(
        &mut conn,
        &LinkBarcodeInput {
            product_id: 3,
            code: too_long,
            kind: BarcodeKind::Unit,
            unit_multiplier: None,
            operator_id: op,
        },
        Utc::now(),
    )
    .unwrap_err();
    assert!(matches!(err, AppError::InvalidInput(_)));
    assert_invariants(&conn);
}

#[test]
fn barcode_in_use_on_second_product() {
    let mut conn = seed();
    let op = admin_id(&conn);
    let code: String = conn
        .query_row(
            "SELECT code FROM identifiers WHERE product_id = 1",
            [],
            |r| r.get(0),
        )
        .unwrap();
    let err = services::barcode::link(
        &mut conn,
        &LinkBarcodeInput {
            product_id: 3,
            code,
            kind: BarcodeKind::Unit,
            unit_multiplier: None,
            operator_id: op,
        },
        Utc::now(),
    )
    .unwrap_err();
    assert!(matches!(err, AppError::BarcodeInUse { .. }));
}

#[test]
fn ean13_check_digit_detection() {
    let conn = seed();
    let ok = services::barcode::check(&conn, "4006381333931").unwrap();
    assert_eq!(ok.detected_type, IdentifierType::Ean13);
    assert_eq!(ok.check_digit_valid, Some(true));
    let bad = services::barcode::check(&conn, "4006381333932").unwrap();
    assert_eq!(bad.detected_type, IdentifierType::Other);
    assert_eq!(bad.check_digit_valid, Some(false));
}

#[test]
fn unknown_barcode_dedups_occurrences() {
    let mut conn = seed();
    let now = Utc::now();
    for _ in 0..3 {
        let r = services::barcode::resolve(&mut conn, "UNKNOWN-99", now).unwrap();
        assert!(matches!(r, ResolveResult::Unknown { .. }));
    }
    let (n, occ): (i64, i64) = conn
        .query_row(
            "
            SELECT COUNT(*), MAX(occurrences)
              FROM exceptions
             WHERE type = 'UNKNOWN_BARCODE' AND status = 'OPEN'
               AND identifier_code = 'UNKNOWN-99'
            ",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(n, 1);
    assert_eq!(occ, 3);
    assert_invariants(&conn);
}

#[cfg(test)]
mod tests {
    use crate::dto::{EmployeeInput, Role};
    use crate::repo;
    use crate::services;
    use crate::test_support::{assert_invariants, test_db};
    use chrono::Utc;

    #[test]
    fn empty_database_has_no_invariant_violations() {
        let conn = test_db();
        assert_invariants(&conn);
    }

    #[test]
    fn settings_defaults_when_table_empty() {
        let conn = test_db();
        let s = repo::load_settings(&conn).unwrap();
        assert!(s.setup_completed_at.is_none());
        assert_eq!(s.language, crate::dto::Language::En);
        assert_eq!(s.scanner.max_gap_ms, 35);
        assert_eq!(s.session.idle_minutes, 30);
    }

    #[test]
    fn close_stale_sessions_on_empty_db() {
        let mut conn = test_db();
        services::sessions::close_stale_on_startup(&mut conn, Utc::now()).unwrap();
        assert_invariants(&conn);
    }

    #[test]
    fn complete_setup_is_idempotent_guarded() {
        let mut conn = test_db();
        let now = Utc::now();
        let input = crate::dto::SetupInput {
            language: crate::dto::Language::En,
            company_name: "PT. CHANG PING INDONESIA".into(),
            admin: EmployeeInput {
                id: None,
                employee_code: "1024".into(),
                name: "Alex".into(),
                role: Role::Admin,
            },
            employees: vec![],
            location: crate::dto::SetupLocationInput {
                code: "GS8-21".into(),
                name: "GS 8A NO 21".into(),
                location_type: crate::dto::LocationType::Warehouse,
            },
        };
        services::setup::complete_setup(&mut conn, &input, now).unwrap();
        let err = services::setup::complete_setup(&mut conn, &input, now).unwrap_err();
        match err {
            crate::error::AppError::InvalidInput(reason) => {
                assert_eq!(reason, "SETUP_ALREADY_DONE")
            }
            other => panic!("{other:?}"),
        }
        assert_eq!(services::employees::list(&conn, false).unwrap().len(), 1);
        assert_invariants(&conn);
    }

    #[test]
    fn complete_setup_then_seed_small_catalog() {
        let mut conn = test_db();
        crate::dev_seed::seed_demo_sized(&mut conn, Utc::now(), 4, 2).unwrap();
        let employees = services::employees::list(&conn, false).unwrap();
        assert_eq!(employees.len(), 3);
        assert_eq!(employees[0].employee_code, "1024");
        assert!(employees[0].last_used_at.is_some());
        let settings = repo::load_settings(&conn).unwrap();
        assert!(settings.setup_completed_at.is_some());
        assert_eq!(settings.company_id, Some(1));
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM products", [], |row| row.get(0))
            .unwrap();
        assert_eq!(n, 4);
        let b: i64 = conn
            .query_row("SELECT COUNT(*) FROM identifiers", [], |row| row.get(0))
            .unwrap();
        assert_eq!(b, 2);
        crate::dev_seed::seed_demo_sized(&mut conn, Utc::now(), 4, 2).unwrap();
        let n2: i64 = conn
            .query_row("SELECT COUNT(*) FROM products", [], |row| row.get(0))
            .unwrap();
        assert_eq!(n2, 4);
        assert_invariants(&conn);
    }

    #[test]
    fn switching_operator_closes_the_open_session() {
        let mut conn = test_db();
        let now = Utc::now();
        crate::dev_seed::seed_demo_sized(&mut conn, now, 2, 0).unwrap();
        let alex = repo::employees::find_by_code(&conn, "1024").unwrap().unwrap();
        let amy = repo::employees::find_by_code(&conn, "1031").unwrap().unwrap();
        let location_id = repo::load_settings(&conn).unwrap().active_location_id.unwrap();
        let now_iso = crate::time::utc_iso(now);
        conn.execute(
            "
            INSERT INTO sessions (
                session_number, location_id, operator_id, status,
                started_at, last_activity_at
            ) VALUES (1, ?1, ?2, 'OPEN', ?3, ?3)
            ",
            rusqlite::params![location_id, amy.id, now_iso],
        )
        .unwrap();

        services::employees::select_operator(&conn, alex.id, now).unwrap();

        let (status, reason, operator_id): (String, Option<String>, i64) = conn
            .query_row(
                "SELECT status, close_reason, operator_id FROM sessions WHERE session_number = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(status, "CLOSED");
        assert_eq!(reason.as_deref(), Some("OPERATOR_SWITCH"));
        assert_eq!(operator_id, amy.id);
        assert_invariants(&conn);
    }

    #[test]
    fn preview_and_apply_baseline_from_xlsx() {
        let mut conn = test_db();
        let now = Utc::now();
        let input = crate::dto::SetupInput {
            language: crate::dto::Language::En,
            company_name: "PT. CHANG PING INDONESIA".into(),
            admin: crate::dto::EmployeeInput {
                id: None,
                employee_code: "1024".into(),
                name: "Alex".into(),
                role: crate::dto::Role::Admin,
            },
            employees: vec![],
            location: crate::dto::SetupLocationInput {
                code: "GS8-21".into(),
                name: "GS 8A NO 21".into(),
                location_type: crate::dto::LocationType::Warehouse,
            },
        };
        crate::services::setup::complete_setup(&mut conn, &input, now).unwrap();
        let admin = crate::repo::employees::find_by_code(&conn, "1024")
            .unwrap()
            .unwrap();
        let dir = std::env::temp_dir().join(format!("stockscan-apply-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("full.xlsx");
        crate::importers::synthetic::write_xlsx_catalog(&path, 1284).unwrap();
        let preview = crate::services::import::preview_stock_report(
            &mut conn,
            &path,
            admin.id,
            crate::dto::ImportPurpose::Baseline,
            None,
            now,
        )
        .unwrap();
        assert_eq!(preview.counts.data_rows, 1284);
        assert!(preview.can_apply);
        let applied = crate::services::import::apply_baseline(&mut conn, preview.import_id, admin.id, now)
            .unwrap();
        assert_eq!(applied.balances, 1284);
        let inventory = crate::services::inventory::list(&conn).unwrap();
        assert_eq!(inventory.len(), 1284);
        let expected = crate::importers::synthetic::catalog_1284();
        for (row, (name, pack, qty)) in inventory.iter().zip(expected) {
            assert_eq!(row.name, name);
            assert_eq!(row.pack_size, Some(pack));
            assert_eq!(row.baseline_quantity, qty);
            assert_eq!(row.current_quantity, qty);
        }
        let err = crate::services::import::apply_baseline(&mut conn, preview.import_id, admin.id, now)
            .unwrap_err();
        assert_eq!(err.code(), "BASELINE_EXISTS");
        assert_invariants(&conn);
    }
}

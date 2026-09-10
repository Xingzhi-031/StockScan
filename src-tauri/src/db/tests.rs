#[cfg(test)]
mod tests {
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
}

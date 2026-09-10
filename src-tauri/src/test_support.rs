use rusqlite::Connection;

use crate::db;

pub fn test_db() -> Connection {
    let mut c = Connection::open_in_memory().unwrap();
    c.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    db::migrate(&mut c).unwrap();
    c
}

pub fn assert_invariants(conn: &Connection) {
    assert_eq!(crate::db::invariants::check(conn).unwrap().violations, 0);
}

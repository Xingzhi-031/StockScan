use chrono::{DateTime, Utc};
use rusqlite::Connection;

use crate::error::AppError;
use crate::time;

pub fn close_stale_on_startup(conn: &mut Connection, now: DateTime<Utc>) -> Result<(), AppError> {
    let now_iso = time::utc_iso(now);
    conn.execute(
        "
        UPDATE sessions
           SET status = 'CLOSED',
               completed_at = ?1,
               close_reason = 'APP_RESTART'
         WHERE status = 'OPEN'
        ",
        [now_iso],
    )?;
    Ok(())
}

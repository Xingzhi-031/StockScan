use rusqlite::{Connection, OptionalExtension};

use crate::dto::{EmployeeDto, Role};
use crate::error::AppError;

fn row_to_employee(row: &rusqlite::Row<'_>) -> rusqlite::Result<EmployeeDto> {
    let role_raw: String = row.get(3)?;
    let is_active: i64 = row.get(4)?;
    Ok(EmployeeDto {
        id: row.get(0)?,
        employee_code: row.get(1)?,
        name: row.get(2)?,
        role: Role::from_db(&role_raw).unwrap_or(Role::Operator),
        is_active: is_active == 1,
        last_used_at: row.get(5)?,
    })
}

const SELECT: &str = "
    SELECT id, employee_code, name, role, is_active, last_used_at
    FROM employees
";

pub fn get(conn: &Connection, id: i64) -> Result<Option<EmployeeDto>, AppError> {
    conn.query_row(
        &format!("{SELECT} WHERE id = ?1"),
        [id],
        row_to_employee,
    )
    .optional()
    .map_err(AppError::from)
}

pub fn find_by_code(conn: &Connection, code: &str) -> Result<Option<EmployeeDto>, AppError> {
    conn.query_row(
        &format!("{SELECT} WHERE employee_code = ?1"),
        [code],
        row_to_employee,
    )
    .optional()
    .map_err(AppError::from)
}

pub fn list(conn: &Connection, include_inactive: bool) -> Result<Vec<EmployeeDto>, AppError> {
    let sql = if include_inactive {
        format!(
            "{SELECT}
             ORDER BY last_used_at IS NULL, last_used_at DESC, name COLLATE NOCASE"
        )
    } else {
        format!(
            "{SELECT}
             WHERE is_active = 1
             ORDER BY last_used_at IS NULL, last_used_at DESC, name COLLATE NOCASE"
        )
    };
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], row_to_employee)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn insert(
    conn: &Connection,
    code: &str,
    name: &str,
    role: Role,
    now_iso: &str,
) -> Result<i64, AppError> {
    conn.execute(
        "
        INSERT INTO employees (employee_code, name, role, is_active, created_at, updated_at)
        VALUES (?1, ?2, ?3, 1, ?4, ?4)
        ",
        rusqlite::params![code, name, role.as_db(), now_iso],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update(
    conn: &Connection,
    id: i64,
    code: &str,
    name: &str,
    role: Role,
    now_iso: &str,
) -> Result<(), AppError> {
    let n = conn.execute(
        "
        UPDATE employees
           SET employee_code = ?1,
               name = ?2,
               role = ?3,
               updated_at = ?4
         WHERE id = ?5
        ",
        rusqlite::params![code, name, role.as_db(), now_iso, id],
    )?;
    if n == 0 {
        return Err(AppError::NotFound("employee"));
    }
    Ok(())
}

pub fn set_active(conn: &Connection, id: i64, active: bool, now_iso: &str) -> Result<(), AppError> {
    let n = conn.execute(
        "UPDATE employees SET is_active = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![if active { 1 } else { 0 }, now_iso, id],
    )?;
    if n == 0 {
        return Err(AppError::NotFound("employee"));
    }
    Ok(())
}

pub fn touch_last_used(conn: &Connection, id: i64, now_iso: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE employees SET last_used_at = ?1, updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now_iso, id],
    )?;
    Ok(())
}

pub fn count_active(conn: &Connection) -> Result<i64, AppError> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM employees WHERE is_active = 1",
        [],
        |row| row.get(0),
    )?;
    Ok(n)
}

pub fn count_active_admins(conn: &Connection) -> Result<i64, AppError> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM employees WHERE is_active = 1 AND role = 'ADMIN'",
        [],
        |row| row.get(0),
    )?;
    Ok(n)
}

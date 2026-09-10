use chrono::{DateTime, Utc};

use crate::dto::{EmployeeDto, EmployeeInput, OperatorContext, Role};
use crate::error::AppError;
use crate::repo;
use crate::time;

fn normalize_code(raw: &str) -> Result<String, AppError> {
    let code = raw.trim().trim_start_matches('#').trim().to_string();
    if code.is_empty() || code.len() > 16 {
        return Err(AppError::invalid("EMPLOYEE_CODE_INVALID"));
    }
    let ok = code
        .chars()
        .enumerate()
        .all(|(i, c)| c.is_ascii_alphanumeric() || (i > 0 && c == '-'));
    if !ok {
        return Err(AppError::invalid("EMPLOYEE_CODE_INVALID"));
    }
    Ok(code)
}

fn normalize_name(raw: &str) -> Result<String, AppError> {
    let name = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    if name.is_empty() || name.chars().count() > 80 {
        return Err(AppError::invalid("EMPLOYEE_NAME_INVALID"));
    }
    Ok(name)
}

pub fn list(conn: &rusqlite::Connection, include_inactive: bool) -> Result<Vec<EmployeeDto>, AppError> {
    repo::employees::list(conn, include_inactive)
}

pub fn upsert(
    conn: &rusqlite::Connection,
    input: &EmployeeInput,
    now: DateTime<Utc>,
) -> Result<EmployeeDto, AppError> {
    let code = normalize_code(&input.employee_code)?;
    let name = normalize_name(&input.name)?;
    let now_iso = time::utc_iso(now);

    if let Some(existing) = repo::employees::find_by_code(conn, &code)? {
        if input.id.is_none() || existing.id != input.id.unwrap() {
            return Err(AppError::invalid("EMPLOYEE_CODE_IN_USE"));
        }
    }

    let id = match input.id {
        Some(id) => {
            let current = repo::employees::get(conn, id)?.ok_or(AppError::NotFound("employee"))?;
            if current.role == Role::Admin
                && input.role != Role::Admin
                && current.is_active
                && repo::employees::count_active_admins(conn)? <= 1
            {
                return Err(AppError::invalid("LAST_ADMIN"));
            }
            repo::employees::update(conn, id, &code, &name, input.role, &now_iso)?;
            id
        }
        None => repo::employees::insert(conn, &code, &name, input.role, &now_iso)?,
    };
    repo::employees::get(conn, id)?.ok_or(AppError::NotFound("employee"))
}

pub fn set_active(
    conn: &rusqlite::Connection,
    id: i64,
    active: bool,
    now: DateTime<Utc>,
) -> Result<EmployeeDto, AppError> {
    let current = repo::employees::get(conn, id)?.ok_or(AppError::NotFound("employee"))?;
    if current.is_active && !active {
        if repo::employees::count_active(conn)? <= 1 {
            return Err(AppError::invalid("LAST_ACTIVE_EMPLOYEE"));
        }
        if current.role == Role::Admin && repo::employees::count_active_admins(conn)? <= 1 {
            return Err(AppError::invalid("LAST_ADMIN"));
        }
    }
    repo::employees::set_active(conn, id, active, &time::utc_iso(now))?;
    repo::employees::get(conn, id)?.ok_or(AppError::NotFound("employee"))
}

pub fn select_operator(
    conn: &rusqlite::Connection,
    employee_id: i64,
    now: DateTime<Utc>,
) -> Result<OperatorContext, AppError> {
    let employee = repo::employees::get(conn, employee_id)?.ok_or(AppError::NotFound("employee"))?;
    if !employee.is_active {
        return Err(AppError::OperatorInactive);
    }
    crate::services::sessions::close_on_operator_switch(conn, employee_id, now)?;
    repo::employees::touch_last_used(conn, employee_id, &time::utc_iso(now))?;
    let employee = repo::employees::get(conn, employee_id)?.ok_or(AppError::NotFound("employee"))?;
    Ok(OperatorContext { employee })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dto::EmployeeInput;
    use crate::test_support::{assert_invariants, test_db};

    fn input(code: &str, name: &str, role: Role) -> EmployeeInput {
        EmployeeInput {
            id: None,
            employee_code: code.into(),
            name: name.into(),
            role,
        }
    }

    #[test]
    fn strips_hash_and_collapses_name() {
        let conn = test_db();
        let row = upsert(&conn, &input("#1024", "  Alex   Chen ", Role::Admin), Utc::now()).unwrap();
        assert_eq!(row.employee_code, "1024");
        assert_eq!(row.name, "Alex Chen");
    }

    #[test]
    fn rejects_empty_and_illegal_codes() {
        let conn = test_db();
        let now = Utc::now();
        assert_eq!(
            upsert(&conn, &input("  ", "Alex", Role::Admin), now)
                .unwrap_err()
                .code(),
            "INVALID_INPUT"
        );
        assert_eq!(
            upsert(&conn, &input("id 24", "Alex", Role::Admin), now)
                .unwrap_err()
                .code(),
            "INVALID_INPUT"
        );
        assert_eq!(
            upsert(&conn, &input("1024", "   ", Role::Admin), now)
                .unwrap_err()
                .code(),
            "INVALID_INPUT"
        );
    }

    #[test]
    fn duplicate_code_is_rejected_with_stable_reason() {
        let conn = test_db();
        let now = Utc::now();
        upsert(&conn, &input("1024", "Alex", Role::Admin), now).unwrap();
        let err = upsert(&conn, &input("#1024", "Amy", Role::Operator), now).unwrap_err();
        match err {
            AppError::InvalidInput(reason) => assert_eq!(reason, "EMPLOYEE_CODE_IN_USE"),
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn update_renames_without_changing_id() {
        let conn = test_db();
        let now = Utc::now();
        let alex = upsert(&conn, &input("1024", "Alex", Role::Admin), now).unwrap();
        let updated = upsert(
            &conn,
            &EmployeeInput {
                id: Some(alex.id),
                employee_code: "1024".into(),
                name: "Alexander".into(),
                role: Role::Admin,
            },
            now,
        )
        .unwrap();
        assert_eq!(updated.id, alex.id);
        assert_eq!(updated.name, "Alexander");
        assert_eq!(list(&conn, false).unwrap().len(), 1);
    }

    #[test]
    fn inactive_hidden_unless_requested() {
        let conn = test_db();
        let now = Utc::now();
        upsert(&conn, &input("1024", "Alex", Role::Admin), now).unwrap();
        let amy = upsert(&conn, &input("1031", "Amy", Role::Operator), now).unwrap();
        set_active(&conn, amy.id, false, now).unwrap();
        assert_eq!(list(&conn, false).unwrap().len(), 1);
        assert_eq!(list(&conn, true).unwrap().len(), 2);
    }

    #[test]
    fn cannot_deactivate_last_active_or_last_admin() {
        let conn = test_db();
        let now = Utc::now();
        let alex = upsert(&conn, &input("1024", "Alex", Role::Admin), now).unwrap();
        let err = set_active(&conn, alex.id, false, now).unwrap_err();
        match err {
            AppError::InvalidInput(reason) => assert_eq!(reason, "LAST_ACTIVE_EMPLOYEE"),
            other => panic!("{other:?}"),
        }
        let amy = upsert(&conn, &input("1031", "Amy", Role::Operator), now).unwrap();
        let err = set_active(&conn, alex.id, false, now).unwrap_err();
        match err {
            AppError::InvalidInput(reason) => assert_eq!(reason, "LAST_ADMIN"),
            other => panic!("{other:?}"),
        }
        set_active(&conn, amy.id, false, now).unwrap();
        let amy_row = list(&conn, true)
            .unwrap()
            .into_iter()
            .find(|e| e.id == amy.id)
            .unwrap();
        assert!(!amy_row.is_active);
        assert_invariants(&conn);
    }

    #[test]
    fn cannot_demote_last_admin() {
        let conn = test_db();
        let now = Utc::now();
        let alex = upsert(&conn, &input("1024", "Alex", Role::Admin), now).unwrap();
        upsert(&conn, &input("1031", "Amy", Role::Operator), now).unwrap();
        let err = upsert(
            &conn,
            &EmployeeInput {
                id: Some(alex.id),
                employee_code: "1024".into(),
                name: "Alex".into(),
                role: Role::Operator,
            },
            now,
        )
        .unwrap_err();
        match err {
            AppError::InvalidInput(reason) => assert_eq!(reason, "LAST_ADMIN"),
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn select_operator_updates_last_used_and_rejects_inactive() {
        let conn = test_db();
        let now = Utc::now();
        let alex = upsert(&conn, &input("1024", "Alex", Role::Admin), now).unwrap();
        let amy = upsert(&conn, &input("1031", "Amy", Role::Operator), now).unwrap();
        let ctx = select_operator(&conn, alex.id, now).unwrap();
        assert!(ctx.employee.last_used_at.is_some());
        set_active(&conn, amy.id, false, now).unwrap();
        assert_eq!(
            select_operator(&conn, amy.id, now).unwrap_err().code(),
            "OPERATOR_INACTIVE"
        );
        let listed = list(&conn, false).unwrap();
        assert_eq!(listed[0].id, alex.id);
        assert_invariants(&conn);
    }

    #[test]
    fn missing_employee_is_not_found() {
        let conn = test_db();
        assert_eq!(
            set_active(&conn, 99, false, Utc::now()).unwrap_err().code(),
            "NOT_FOUND"
        );
        assert_eq!(
            select_operator(&conn, 99, Utc::now()).unwrap_err().code(),
            "NOT_FOUND"
        );
    }
}

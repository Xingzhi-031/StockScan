use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::Role;

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct EmployeeDto {
    #[ts(type = "number")]
    pub id: i64,
    pub employee_code: String,
    pub name: String,
    pub role: Role,
    pub is_active: bool,
    pub last_used_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct EmployeeInput {
    #[ts(type = "number | null")]
    pub id: Option<i64>,
    pub employee_code: String,
    pub name: String,
    pub role: Role,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct OperatorContext {
    pub employee: EmployeeDto,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SetupInput {
    pub language: super::Language,
    pub company_name: String,
    pub admin: EmployeeInput,
    pub employees: Vec<EmployeeInput>,
    pub location: SetupLocationInput,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SetupLocationInput {
    pub code: String,
    pub name: String,
    pub location_type: super::LocationType,
}

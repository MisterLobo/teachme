use sea_orm::prelude::DateTimeWithTimeZone;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::models::{_entities::sea_orm_active_enums, users};

#[derive(Debug, Deserialize, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub pid: String,
    pub name: String,
    pub is_verified: bool,
}

impl LoginResponse {
    #[must_use]
    pub fn new(user: &users::Model, token: &String) -> Self {
        Self {
            token: token.to_string(),
            pid: user.pid.to_string(),
            name: user.name.clone(),
            is_verified: user.email_verified_at.is_some(),
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CurrentResponse {
    pub pid: String,
    pub name: String,
    pub email: String,
    pub cal_user_id: Option<i32>,
    pub role: sea_orm_active_enums::UserRole,
    pub phone: Option<String>,
    pub phone_verified_at: Option<DateTimeWithTimeZone>,
    pub email_verified_at: Option<DateTimeWithTimeZone>,
    pub profile: Option<Value>,
}

impl CurrentResponse {
    #[must_use]
    pub fn new(user: &users::Model) -> Self {
        Self {
            pid: user.pid.to_string(),
            name: user.name.clone(),
            email: user.email.clone(),
            cal_user_id: user.cal_user_id,
            role: user.role,
            phone: user.phone.clone(),
            phone_verified_at: user.phone_verified_at.clone(),
            email_verified_at: user.email_verified_at.clone(),
            profile: None,
        }
    }
}

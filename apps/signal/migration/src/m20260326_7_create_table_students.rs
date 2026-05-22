use loco_rs::schema::{ColType, create_table, drop_table};
use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        create_table(
            m,
            "students",
            &[
                ("id", ColType::PkUuid),
                ("first_name", ColType::String),
                ("last_name", ColType::String),
                ("dob", ColType::DateNull),
                ("gender", ColType::StringNull),
                ("parent_id", ColType::UuidNull),
                ("customer_id", ColType::UuidNull),
                ("default_calendar", ColType::StringNull),
                ("calendars", ColType::JsonBinaryNull),
                ("country", ColType::StringNull),
                ("currency", ColType::StringNull),
                ("language", ColType::StringNull),
                ("locale", ColType::StringNull),
                ("timezone", ColType::StringNull),
            ],
            &[
                ("parents", "parent_id"),
                ("customers", "customer_id"),
            ],
        ).await
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        drop_table(m, "students").await
    }
}

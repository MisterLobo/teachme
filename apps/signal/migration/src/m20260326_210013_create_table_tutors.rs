use loco_rs::schema::{ColType, create_table, drop_table};
use sea_orm_migration::{prelude::*, schema::*, sea_orm::prelude::PgVector};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        create_table(
            m,
            "tutors",
            &[
                ("id", ColType::PkUuid),
                ("first_name", ColType::String),
                ("last_name", ColType::String),
                ("country", ColType::String),
                ("city", ColType::StringNull),
                ("currency", ColType::String),
                ("title", ColType::String),
                ("organization_id", ColType::UuidNull),
                ("dob", ColType::DateNull),
                ("primary_language", ColType::String),
                ("other_languages", ColType::JsonBinaryNull),
                ("bio", ColType::StringNull),
                ("categories_subjects", ColType::JsonBinaryNull),
                ("availability_schedules", ColType::JsonBinary),
                ("event_types", ColType::JsonBinary),
                ("code", ColType::StringNull),
                ("stripe_connect_id", ColType::StringNull),
                ("status", ColType::String),
                ("default_calendar", ColType::StringNull),
                ("calendars", ColType::JsonBinaryNull),
                ("tenant_id", ColType::Uuid),
                ("session_duration", ColType::Integer),
                ("session_price", ColType::MoneyNull),
                ("embedding", ColType::ArrayNull(ColumnType::Vector(Some(384)))),
            ],
            &[],
        ).await
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        drop_table(m, "tutors").await
    }
}


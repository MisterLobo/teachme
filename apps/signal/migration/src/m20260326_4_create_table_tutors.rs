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
                ("timezone", ColType::StringNull),
                ("currency", ColType::String),
                ("title", ColType::StringNull),
                ("organization_id", ColType::UuidNull),
                ("dob", ColType::DateNull),
                ("primary_language", ColType::StringNull),
                ("other_languages", ColType::JsonBinaryNull),
                ("languages", ColType::TextNull),
                ("bio", ColType::TextNull),
                ("categories", ColType::TextNull),
                ("subjects", ColType::TextNull),
                ("availability_schedules", ColType::JsonBinaryNull),
                ("event_types", ColType::JsonBinaryNull),
                ("code", ColType::StringNull),
                ("stripe_connect_id", ColType::StringNull),
                ("status", ColType::String),
                ("default_calendar", ColType::StringNull),
                ("calendars", ColType::JsonBinaryNull),
                ("tenant_id", ColType::Uuid),
                ("session_duration", ColType::IntegerWithDefault(30)),
                ("session_price", ColType::DecimalNull),
                ("cal_metadata", ColType::JsonBinaryNull),
                ("average_rating", ColType::FloatNull),
            ],
            &[
                ("tenants", "tenant_id"),
                ("organizations", "organization_id"),
            ],
        ).await
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        drop_table(m, "tutors").await
    }
}


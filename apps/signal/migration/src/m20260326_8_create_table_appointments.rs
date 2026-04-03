use loco_rs::schema::{ColType, create_table, drop_table};
use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        create_table(
            m,
            "appointments",
            &[
                ("id", ColType::PkUuid),
                ("tenant_id", ColType::Uuid),
                ("host_id", ColType::Uuid),
                ("attendee_id", ColType::Uuid),
                ("start_at", ColType::TimestampWithTimeZone),
                ("duration", ColType::Integer),
                ("cal_booking_id", ColType::IntegerNull),
                ("cal_metadata", ColType::JsonBinaryNull),
                ("status", ColType::EnumNullWithDefault(
                    "appointment_status".into(),
                    vec![
                        "pending".into(),
                        "ongoing".into(),
                        "cancelled".into(),
                        "completed".into()],
                        "pending".into(),
                    ),
                ),
                ("cancel_reason", ColType::TextNull),
                ("cancelled_at", ColType::TimestampWithTimeZoneNull),
            ],
            &[
                ("tenants", "tenant_id"),
                ("tutors", "host_id"),
                ("students", "attendee_id"),
            ],
        ).await
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        drop_table(m, "appointments").await
    }
}

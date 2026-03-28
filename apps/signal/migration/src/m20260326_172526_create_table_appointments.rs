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
                ("cal_booking_id", ColType::StringNull),
            ],
            &[],
        ).await
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        drop_table(m, "appointments").await
    }
}


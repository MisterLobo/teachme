use loco_rs::schema::{ColType, create_table, drop_table};
use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        create_table(
            m,
            "transactions",
            &[
                ("id", ColType::PkUuid),
                ("initiated_at", ColType::TimestampWithTimeZoneNull),
                ("completed_at", ColType::TimestampWithTimeZoneNull),
                ("status", ColType::StringNull),
                ("appointment_id", ColType::UuidNull),
                ("purpose", ColType::StringNull),
                ("stripe_payment_intent_id", ColType::StringNull),
                ("stripe_invoice_id", ColType::StringNull),
                ("tenant_id", ColType::UuidNull),
                ("biller", ColType::UuidNull),
                ("billed_to", ColType::UuidNull),
            ],
            &[],
        ).await
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        drop_table(m, "transactions").await
    }
}


use loco_rs::schema::{ColType, create_table};
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        create_table(
            m,
            "purchases",
            &[
                ("id", ColType::PkUuid),
                ("unit_amount", ColType::DecimalNull),
                ("qty", ColType::IntegerNull),
                ("total", ColType::DecimalNull),
                ("service_fee", ColType::DecimalNull),
                ("transaction_id", ColType::UuidNull),
                ("tenant_id", ColType::Uuid),
            ],
            &[
                ("transactions", "transaction_id"),
                ("tenants", "tenant_id"),
            ],
        ).await
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }
}


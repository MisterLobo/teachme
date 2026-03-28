use loco_rs::schema::{ColType, create_table};
use sea_orm_migration::{prelude::*, schema::*};

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
                ("transaction_id", ColType::UuidNull),
                ("tenant_id", ColType::Uuid),
            ],
            &[],
        ).await
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }
}


use loco_rs::schema::{ColType, create_table, drop_table};
use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;


#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        create_table(
            m,
            "tenants",
            &[
                ("id", ColType::PkUuid),
                ("owner_id", ColType::Uuid),
                ("tenant_type", ColType::Enum("tenant_type".into(), vec!["individual".into(), "organization".into()])),
                ("name", ColType::String),
            ],
            &[],
        ).await
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        drop_table(m, "tenants").await
    }
}


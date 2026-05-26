use loco_rs::schema::*;
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        create_table(m, "credit_usages",
            &[
                ("id", ColType::PkUuid),
                ("user", ColType::Uuid),
                ("amount", ColType::Integer),
                ("purpose", ColType::StringNull),
                ("status", ColType::Enum("credit_status".into(), vec![
                    "success".into(),
                    "pending".into(),
                    "cancelled".into(),
                    "refunded".into(),
                ]))
            ],
            &[
            ]
        ).await
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        drop_table(m, "credit_usages").await
    }
}

use loco_rs::schema::*;
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        create_table(m, "parents",
            &[
                ("id", ColType::PkUuid),
                
                ("first_name", ColType::String),
                ("last_name", ColType::String),
                ("dob", ColType::DateNull),
                ("sex", ColType::StringNull),
                ("num_child", ColType::IntegerNull),
                ("customer_id", ColType::UuidNull),
                ("country", ColType::StringNull),
                ("currency", ColType::StringNull),
                ("language", ColType::StringNull),
                ("locale", ColType::StringNull),
            ],
            &[
                ("customers", "customer_id")
            ]
        ).await
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        drop_table(m, "parents").await
    }
}

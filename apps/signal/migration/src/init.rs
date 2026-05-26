use sea_orm_migration::{prelude::*, DbErr, MigrationTrait, SchemaManager, sea_orm::DeriveMigrationName};


#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        m.get_connection()
            .execute_unprepared("CREATE EXTENSION IF NOT EXISTS vector;")
            .await?;
        Ok(())
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }
}


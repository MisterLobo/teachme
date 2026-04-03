use loco_rs::schema::*;
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        let table = table_auto("tutor_embeddings")
            .col(pk_uuid("id"))
            .col(ColumnDef::new("embedding").array(ColumnType::Vector(Some(384))).not_null())
            .to_owned();
        m.create_table(table).await
        /* create_table(m, "tutor_embeddings",
            &[
                ("id", ColType::PkUuid),
                ("embedding", ColType::Array(ColumnType::Vector(Some(384)))),
            ],
            &[
            ]
        ).await */
        // Ok(())
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        drop_table(m, "tutor_embeddings").await
    }
}

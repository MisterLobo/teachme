use loco_rs::schema::*;
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        /* create_table(m, "search_prompts",
            &[
                ("id", ColType::PkUuid),
                ("owner_id", ColType::UuidNull),
                ("owner_type", ColType::EnumNull("owner_type".into(), vec!["student_learner".into(), "parent_guardian".into()])),
                ("prompt_text", ColType::TextNull),
                ("prompt_embedding", ColType::ArrayNull(ColumnType::Vector(Some(384)))),
            ],
            &[
            ]
        ).await */
        let table = table_auto("search_prompts")
            .col(pk_uuid("id"))
            .col(enum_type_null("owner_type", "customer_type"))
            .col(text_null("prompt_text"))
            .col(ColumnDef::new("prompt_embedding").vector(Some(384)).not_null())
            .to_owned();
        m.create_table(table).await
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        drop_table(m, "search_prompts").await
    }
}

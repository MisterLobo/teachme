use loco_rs::schema::*;
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        create_table(m, "search_prompts",
            &[
                ("id", ColType::PkUuid),
                ("owner_id", ColType::UuidNull),
                ("owner_type", ColType::EnumNull("owner_type".into(), vec!["student_learner".into(), "parent_guardian".into()])),
                ("prompt_text", ColType::TextNull),
                ("prompt_embedding", ColType::ArrayNull(ColumnType::Vector(Some(384)))),
            ],
            &[
            ]
        ).await
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        drop_table(m, "search_prompts").await
    }
}

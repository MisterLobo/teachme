use loco_rs::schema::{ColType, create_table, drop_table};
use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        create_table(
            m,
            "tutorial_session",
            &[
                ("id", ColType::PkUuid),
                ("tutor_id", ColType::Uuid),
                ("student_id", ColType::Uuid),
                ("status", ColType::StringNull),
                ("progress", ColType::StringNull),
                ("appointment_id", ColType::Uuid),
                ("session_id", ColType::StringNull),
                ("session_link", ColType::StringNull),
                ("session_length_secs", ColType::IntegerNull),
                ("tenant_id", ColType::Uuid),
                ("secret", ColType::String),
            ],
            &[
                ("tutors", "tutor_id"),
                ("students", "student_id"),
                ("appointments", "appointment_id"),
                ("tenants", "tenant_id"),
            ],
        ).await
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        drop_table(m, "tutorial_sessions").await
    }
}


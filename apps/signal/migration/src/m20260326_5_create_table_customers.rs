use loco_rs::schema::{ColType, create_table, drop_table};
use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        create_table(
            m,
            "customers",
            &[
                ("id", ColType::PkUuid),
                ("user_id", ColType::UuidNull),
                ("customer_type", ColType::Enum(
                    "customer_type".into(),
                    vec![
                        "student_learner".into(),
                        "parent_guardian".into(),
                        "tutor_single".into(),
                        "tutor_organization".into(),
                    ],
                )),
                ("reference_id", ColType::Uuid),
                ("plan", ColType::StringNull),
                ("stripe_customer_id", ColType::StringNull),
                ("stripe_subscription_id", ColType::StringNull),
                ("status", ColType::String),
                ("trial_ends_at", ColType::TimestampWithTimeZoneNull),
            ],
            &[
                ("users", "user_id"),
            ],
        ).await
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        drop_table(m, "customers").await
    }
}


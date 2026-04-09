use loco_rs::schema::*;
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        create_table(m, "subscriptions",
            &[
                ("id", ColType::PkUuid),
                ("plan", ColType::StringNull),
                ("stripe_product_id", ColType::StringNull),
                ("stripe_price_id", ColType::StringNull),
                ("stripe_customer_id", ColType::StringNull),
                ("stripe_subscription_id", ColType::StringNull),
                ("period_start", ColType::TimestampWithTimeZoneNull),
                ("period_end", ColType::TimestampWithTimeZoneNull),
                ("next_billing_at", ColType::TimestampWithTimeZoneNull),
                ("trial_active", ColType::BooleanNull),
                ("trial_starts_at", ColType::TimestampWithTimeZoneNull),
                ("trial_ends_at", ColType::TimestampWithTimeZoneNull),
                ("trial_duration", ColType::IntegerNull),
                ("unlocked_features", ColType::JsonBinaryNull),
                ("status", ColType::StringNull),
            ],
            &[
            ]
        ).await
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        drop_table(m, "subscriptions").await
    }
}

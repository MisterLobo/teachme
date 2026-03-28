use loco_rs::schema::{ColType, create_table, drop_table};
use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        /* let table = table_auto("users")
            .col(pk_uuid("id"))
            .col(uuid("pid"))
            .col(string("email"))
            .col(string("password"))
            .col(string("api_key"))
            .col(string("name"))
            .col(string("reset_token"))
            .col(timestamp_with_time_zone_null("reset_sent_at"))
            .col(string_null("email_verification_token"))
            .col(timestamp_with_time_zone_null("email_verification_sent_at"))
            .col(string_null("magic_link_token"))
            .col(timestamp_with_time_zone_null("magic_link_expiration"))
            .col(string_null("cal_user_id"))
            .col(string_uniq("phone"))
            .col(timestamp_with_time_zone_null("phone_verified_at"))
            .to_owned();
        m.create_table(table).await */
        
        create_table(
            m,
            "users",
            &[
                ("id", ColType::PkUuid),
                ("pid", ColType::Uuid),
                ("email", ColType::StringUniq),
                ("password", ColType::String),
                ("api_key", ColType::Text),
                ("name", ColType::String),
                ("email_verified_at", ColType::TimestampWithTimeZoneNull),
                ("reset_token", ColType::TextNull),
                ("reset_sent_at", ColType::TimestampWithTimeZoneNull),
                ("email_verification_token", ColType::StringNull),
                ("email_verification_sent_at", ColType::TimestampWithTimeZoneNull),
                ("magic_link_token", ColType::StringNull),
                ("magic_link_expiration", ColType::TimestampWithTimeZoneNull),
                ("cal_user_id", ColType::IntegerNull),
                ("phone", ColType::StringNull),
                ("phone_verified_at", ColType::TimestampWithTimeZoneNull),
            ],
            &[],
        ).await
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        drop_table(m, "users").await
    }
}

#![allow(elided_lifetimes_in_paths)]
#![allow(clippy::wildcard_imports)]
pub use sea_orm_migration::prelude::*;

mod m20260326_1_create_table_users;
mod m20260326_2_create_table_tenants;
mod m20260326_3_create_table_organizations;
mod m20260326_8_create_table_appointments;
mod m20260326_5_create_table_customers;
mod m20260326_10_create_table_purchases;
mod m20260326_7_create_table_students;
mod m20260326_9_create_table_transactions;
mod m20260326_210002_create_table_tutorial_sessions;
mod m20260326_4_create_table_tutors;
mod m20260326_6_create_table_parents;
mod m20260326_225507_create_search_prompts_table;
mod m20260328_200138_create_tutor_embeddings_table;
mod m20260328_200646_tutor_reviews;
mod m20260328_200903_tutor_boosts;
mod init;
mod m20260409_103416_credits;
mod m20260409_125329_credit_usages;
mod m20260409_130711_subscriptions;
pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        /* let mut conn = PgConnection::connect(&std::env::var("DATABASE_URL").unwrap_or_default());
        raw_sql("create extension if not exists vector;").execute(&mut conn); */
        vec![
            Box::new(init::Migration),
            Box::new(m20260326_1_create_table_users::Migration),
            Box::new(m20260326_2_create_table_tenants::Migration),
            Box::new(m20260326_3_create_table_organizations::Migration),
            Box::new(m20260326_4_create_table_tutors::Migration),
            Box::new(m20260326_5_create_table_customers::Migration),
            Box::new(m20260326_6_create_table_parents::Migration),
            Box::new(m20260326_7_create_table_students::Migration),
            Box::new(m20260326_8_create_table_appointments::Migration),
            Box::new(m20260326_9_create_table_transactions::Migration),
            Box::new(m20260326_10_create_table_purchases::Migration),
            Box::new(m20260326_210002_create_table_tutorial_sessions::Migration),
            Box::new(m20260326_225507_create_search_prompts_table::Migration),
            Box::new(m20260328_200138_create_tutor_embeddings_table::Migration),
            Box::new(m20260328_200646_tutor_reviews::Migration),
            Box::new(m20260328_200903_tutor_boosts::Migration),
            Box::new(m20260409_103416_credits::Migration),
            Box::new(m20260409_125329_credit_usages::Migration),
            Box::new(m20260409_130711_subscriptions::Migration),
            // inject-above (do not remove this comment)
        ]
    }
}
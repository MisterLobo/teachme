#![allow(elided_lifetimes_in_paths)]
#![allow(clippy::wildcard_imports)]
pub use sea_orm_migration::prelude::*;
use sea_orm_migration::sea_orm::sqlx::{Connection, PgConnection, raw_sql};

mod m20260326_165831_create_table_users;
mod m20260326_171222_create_table_tenants;
mod m20260326_172217_create_table_organizations;
mod m20260326_172526_create_table_appointments;
mod m20260326_205116_create_table_customers;
mod m20260326_205409_create_table_purchases;
mod m20260326_205624_create_table_students;
mod m20260326_205945_create_table_transactions;
mod m20260326_210002_create_table_tutorial_sessions;
mod m20260326_210013_create_table_tutors;
mod m20260326_213138_create_table_parents;
mod m20260326_225507_create_search_prompts_table;
pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        /* let mut conn = PgConnection::connect(&std::env::var("DATABASE_URL").unwrap_or_default());
        raw_sql("create extension if not exists vector;").execute(&mut conn); */
        vec![
            Box::new(m20260326_165831_create_table_users::Migration),
            Box::new(m20260326_171222_create_table_tenants::Migration),
            Box::new(m20260326_172217_create_table_organizations::Migration),
            Box::new(m20260326_172526_create_table_appointments::Migration),
            Box::new(m20260326_205116_create_table_customers::Migration),
            Box::new(m20260326_205409_create_table_purchases::Migration),
            Box::new(m20260326_205624_create_table_students::Migration),
            Box::new(m20260326_205945_create_table_transactions::Migration),
            Box::new(m20260326_210002_create_table_tutorial_sessions::Migration),
            Box::new(m20260326_210013_create_table_tutors::Migration),
            Box::new(m20260326_213138_create_table_parents::Migration),
            Box::new(m20260326_225507_create_search_prompts_table::Migration),
            // inject-above (do not remove this comment)
        ]
    }
}
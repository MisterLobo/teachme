use async_trait::async_trait;
use loco_rs::{app::Initializer};
use sea_orm::sqlx::raw_sql;

pub struct DbInitializer;

#[async_trait]
impl Initializer for DbInitializer {
  async fn before_run(&self, app_context: &loco_rs::prelude::AppContext) ->  loco_rs::Result<()>  {
    raw_sql("CREATE EXTENSION IF NOT EXISTS vector;");
    Ok(())
  }

  fn name(&self) -> String {
    "initialize_db".into()
  }
}
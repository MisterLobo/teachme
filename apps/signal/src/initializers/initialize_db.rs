use async_trait::async_trait;
use loco_rs::{app::Initializer};
use sea_orm::{ConnectionTrait, Statement};

pub struct DbInitializer;

#[async_trait]
impl Initializer for DbInitializer {
  async fn before_run(&self, app_context: &loco_rs::prelude::AppContext) ->  loco_rs::Result<()>  {
    app_context.db.query_one(Statement::from_string(app_context.db.get_database_backend(), "CREATE EXTENSION IF NOT EXISTS vector;")).await?;
    Ok(())
  }

  fn name(&self) -> String {
    "initialize_db".into()
  }
}
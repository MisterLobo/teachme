use async_trait::async_trait;
use loco_rs::{app::Initializer, prelude::*};
use sea_orm::{ConnectionTrait, Statement};
use axum::Router as AxumRouter;
use mongodb::options::{ClientOptions, Tls};
use mongodb::Client;
use serde::{Deserialize, Serialize};

pub struct DbInitializer;

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Record {
  id: uuid::Uuid,
}

#[async_trait]
impl Initializer for DbInitializer {
  async fn before_run(&self, app_context: &AppContext) ->  loco_rs::Result<()>  {
    app_context.db.query_one(Statement::from_string(app_context.db.get_database_backend(), "CREATE EXTENSION IF NOT EXISTS vector;")).await?;
    Ok(())
  }

  fn name(&self) -> String {
    "initialize_db".into()
  }

  async fn after_routes(&self, router: AxumRouter, ctx: &AppContext) -> Result<AxumRouter> {
    
    
    Ok(router)
  }
}
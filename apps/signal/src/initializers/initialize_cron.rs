use loco_rs::app::Initializer;
use loco_rs::doctor::{Check, CheckStatus};
use loco_rs::prelude::*;

pub struct CronInitializer;

#[async_trait]
impl Initializer for CronInitializer {
  fn name(&self) -> String {
    "cron".to_string()
  }

  async fn before_run(&self, ctx: &AppContext) -> Result<()> {
    Ok(())
  }

  async fn check(&self, ctx: &loco_rs::prelude::AppContext) -> Result<Option<Check>> {
    Ok(Some(Check {
      status: CheckStatus::Ok,
      message: "ok".into(),
      description: None,
    }))
  }
}
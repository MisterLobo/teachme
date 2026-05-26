use loco_rs::app::Initializer;
use loco_rs::doctor::{Check, CheckStatus};
use loco_rs::prelude::*;
use tokio_cron_scheduler::{Job, JobScheduler};

pub struct CronInitializer;

#[async_trait]
impl Initializer for CronInitializer {
  fn name(&self) -> String {
    "cron".to_string()
  }

  async fn before_run(&self, ctx: &AppContext) -> Result<()> {
    let mut sched = JobScheduler::new().await.expect("Error initializing scheduler");

    sched.add(
      Job::new_async("every 10 minutes", |uid, l| {
        Box::pin(async move {
          tracing::debug!("running job: {uid}");
        })
      }).expect("Job error"),
    ).await.expect("Error adding job to scheduler");

    sched.start().await.expect("Error starting scheduler");

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
use async_trait::async_trait;
use loco_rs::{
    app::{AppContext, Hooks, Initializer},
    bgworker::{BackgroundWorker, Queue},
    boot::{create_app, BootResult, StartMode},
    config::Config,
    controller::AppRoutes,
    db::{self, truncate_table},
    environment::Environment,
    task::Tasks,
    Result,
};
use migration::Migrator;
use std::path::Path;
use crate::{initializers::{initialize_chat, initialize_db, initialize_realtime}, services::StripeService};
#[allow(unused_imports)]
use crate::{controllers, models::_entities::users, tasks, workers::downloader::DownloadWorker};

pub struct App;
#[async_trait]
impl Hooks for App {
    fn app_name() -> &'static str {
        env!("CARGO_CRATE_NAME")
    }

    fn app_version() -> String {
        format!(
            "{} ({})",
            env!("CARGO_PKG_VERSION"),
            option_env!("BUILD_SHA")
                .or(option_env!("GITHUB_SHA"))
                .unwrap_or("dev")
        )
    }

    async fn boot(
        mode: StartMode,
        environment: &Environment,
        config: Config,
    ) -> Result<BootResult> {
        create_app::<Self, Migrator>(mode, environment, config).await
    }

    async fn initializers(_ctx: &AppContext) -> Result<Vec<Box<dyn Initializer>>> {
        Ok(vec![
            Box::new(initialize_db::DbInitializer),
            Box::new(initialize_chat::ChatInitializer),
            Box::new(initialize_realtime::RealtimeInitializer),
        ])
    }

    fn routes(_ctx: &AppContext) -> AppRoutes {
        AppRoutes::with_default_routes() // controller routes below
            .add_route(controllers::stripe::routes())
            .add_route(controllers::profiles::routes())
            .add_route(controllers::users::routes())
            .add_route(controllers::students::routes())
            .add_route(controllers::appointments::routes())
            .add_route(controllers::tutors::routes())
            .add_route(controllers::auth::routes())
    }
    async fn connect_workers(ctx: &AppContext, queue: &Queue) -> Result<()> {
        queue.register(crate::workers::create_stripe_payment::Worker::build(ctx)).await?;
        queue.register(crate::workers::create_stripe_customer::Worker::build(ctx)).await?;
        queue.register(crate::workers::create_stripe_connect::Worker::build(ctx)).await?;
        queue.register(crate::workers::create_tutor_embedding::Worker::build(ctx)).await?;
        queue.register(crate::workers::semantic_search::Worker::build(ctx)).await?;
        queue.register(DownloadWorker::build(ctx)).await?;
        Ok(())
    }

    #[allow(unused_variables)]
    fn register_tasks(tasks: &mut Tasks) {
        tasks.register(tasks::send_payment::SendPayment);
        // tasks-inject (do not remove)
    }
    async fn truncate(ctx: &AppContext) -> Result<()> {
        truncate_table(&ctx.db, users::Entity).await?;
        Ok(())
    }
    async fn seed(ctx: &AppContext, base: &Path) -> Result<()> {
        db::seed::<users::ActiveModel>(&ctx.db, &base.join("users.yaml").display().to_string())
            .await?;
        Ok(())
    }

    async fn after_context(ctx: AppContext) -> Result<AppContext> {
        ctx.shared_store.insert(StripeService {
            publishable_key: Some(std::env::var("STRIPE_PUBLISHABLE_KEY").unwrap_or_default()),
            secret_key: Some(std::env::var("STRIPE_SECRET_KEY").unwrap_or_default()),
        });
        Ok(ctx)
    }
}
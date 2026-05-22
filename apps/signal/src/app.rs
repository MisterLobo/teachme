use apalis::prelude::*;
use apalis_redis::{RedisContext, RedisStorage};
use async_trait::async_trait;
use futures::StreamExt;
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
use redis::{AsyncCommands, Commands, TlsCertificates};
use rustls_pemfile::pkcs8_private_keys;
use serde::{Deserialize, Serialize};
use tonic::transport::{ClientTlsConfig, Server, ServerTlsConfig};
use tower::{BoxError, service_fn, Service, ServiceExt};
use std::{collections::HashMap, env, fs::File, io::{BufReader, Read}, net::SocketAddr, path::Path};
use crate::{initializers::{initialize_chat, initialize_consumers, initialize_cron, initialize_db, initialize_realtime, initialize_server}, services::{EventService, MongoService, RedisService, StripeService, VaultService}};
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
        let br = create_app::<Self, Migrator>(mode, environment, config).await.unwrap();

        Ok(br)
    }

    async fn initializers(_ctx: &AppContext) -> Result<Vec<Box<dyn Initializer>>> {
        Ok(vec![
            Box::new(initialize_db::DbInitializer),
            Box::new(initialize_cron::CronInitializer),
            Box::new(initialize_chat::ChatInitializer),
            Box::new(initialize_realtime::RealtimeInitializer),
            Box::new(initialize_consumers::ConsumerInitializer),
            Box::new(initialize_server::ServerInitializer),
        ])
    }

    fn routes(_ctx: &AppContext) -> AppRoutes {
        let routes = AppRoutes::with_default_routes(); // controller routes below
            /* .add_route(controllers::stripe::routes())
            .add_route(controllers::profiles::routes())
            .add_route(controllers::users::routes())
            .add_route(controllers::students::routes())
            .add_route(controllers::appointments::routes())
            .add_route(controllers::tutors::routes())
            .add_route(controllers::auth::routes()); */

        // let addr = SocketAddr::from(([127, 0, 0, 1], 30000));

        routes
    }
    async fn connect_workers(ctx: &AppContext, queue: &Queue) -> Result<()> {
        /* queue.register(crate::workers::create_stripe_subscription::Worker::build(ctx)).await?;
        queue.register(crate::workers::create_stripe_payment::Worker::build(ctx)).await?;
        queue.register(crate::workers::create_stripe_customer::Worker::build(ctx)).await?;
        queue.register(crate::workers::create_stripe_connect::Worker::build(ctx)).await?;
        queue.register(crate::workers::create_tutor_embedding::Worker::build(ctx)).await?;
        queue.register(crate::workers::semantic_search::Worker::build(ctx)).await?; */
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
        let vs = VaultService::new();
        vs.kvv2_set("secret".into(), "abc".into(), "def".into(), "xyz".into()).await.unwrap();

        ctx.shared_store.insert(VaultService::new());

        ctx.shared_store.insert(StripeService {
            publishable_key: Some(std::env::var("STRIPE_PUBLISHABLE_KEY").unwrap_or_default()),
            secret_key: Some(std::env::var("STRIPE_SECRET_KEY").unwrap_or_default()),
        });
        let root_cert = File::open("certs/new/ca.pem").unwrap();
        let mut root_cert_vec = Vec::new();
        BufReader::new(root_cert).read_to_end(&mut root_cert_vec).expect("error reading cert file");
        let client_cert = File::open("certs/new/localhost.san.pem").unwrap();
        let mut client_cert_vec = Vec::new();
        BufReader::new(client_cert).read_to_end(&mut client_cert_vec).expect("error reading cert file");
        let client_key = File::open("certs/new/san-key.pem").unwrap();
        let mut client_key_vec = Vec::new();
        BufReader::new(client_key).read_to_end(&mut client_key_vec).expect("error reading key file");
        
        let redis_client = apalis_redis::Client::build_with_tls(env::var("REDISS_URL").unwrap(), TlsCertificates {
            root_cert: Some(root_cert_vec),
            client_tls: Some(redis::ClientTlsConfig {
                client_cert: client_cert_vec,
                client_key: client_key_vec,
            }),
        }).unwrap();
        let mut conn = redis_client.get_connection_manager().await.expect("could not retrieve connection manager");

        // let _:() = conn.set("key3", "value3").await.unwrap();

        let cc = conn.clone();
        tokio::spawn(async move {
            let storage: RedisStorage<String> = RedisStorage::new(cc);
            let worker = WorkerBuilder::new("test-worker")
                .backend(storage)
                .concurrency(5)
                .data(0usize)
                .build(send_email);

            let _ = worker.run().await;
        });

        ctx.shared_store.insert(RedisService {
            client: redis_client,
            connection_manager: conn,
        });

        ctx.shared_store.insert(EventService::new().await);

        ctx.shared_store.insert(MongoService::new().await?);

        Ok(ctx)
    }
}

async fn send_email<T, I>(_: T, task_id: TaskId<I>, ctx: WorkerContext) -> Result<(), BoxError> {
    ctx.stop().unwrap();
    Ok(())
}

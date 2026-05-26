use std::env;

use futures::StreamExt;
use loco_rs::{app::{AppContext, Initializer}, doctor::{Check, CheckStatus}};
use loco_rs::prelude::*;

use crate::services::EventService;

pub struct ConsumerInitializer;

#[async_trait]
impl Initializer for ConsumerInitializer {
  fn name(&self) -> String {
    "consumers".to_string()
  }

  async fn before_run(&self, ctx: &AppContext) -> Result<()> {
    let nats_url = env::var("NATS_URL").unwrap_or_else(|_| "nats://localhost:4222".to_string());
    // let client = async_nats::connect(nats_url).await.expect("NATS server unreachable");
    // let jetstream = async_nats::jetstream::new(client);

    let EventService { jetstream, client: _, worker: _ } = ctx.shared_store.get::<EventService>().unwrap();

    let js = jetstream.clone();
    tokio::spawn(async move {
      let jstream = js
        .get_or_create_stream(async_nats::jetstream::stream::Config {
          name: "test".to_string(),
          max_messages: 10_000,
          ..Default::default()
        })
        .await
        .expect("err");

      let consumer = jstream
        .get_or_create_consumer(
          "cons",
          async_nats::jetstream::consumer::pull::Config {
            durable_name: Some("cons".to_string()),
            ..Default::default()
        })
        .await
        .expect("err");
      
      while let Some(Ok(message)) = consumer
        .messages()
        .await
        .expect("consumer error")
        .next()
        .await {
          message.ack().await.expect("ack error");
          let msg = String::from_utf8(message.payload.to_vec()).unwrap();
          tracing::debug!("[test#cons] message: {msg}");
        }
    });

    let js = jetstream.clone();
    tokio::spawn(async move {
      let jstream = js
        .get_or_create_stream(async_nats::jetstream::stream::Config {
          name: "foo".to_string(),
          max_messages: 10_000,
          ..Default::default()
        })
        .await
        .expect("err");

      let consumer = jstream
        .get_or_create_consumer(
          "bar",
          async_nats::jetstream::consumer::pull::Config {
            durable_name: Some("bar".to_string()),
            ..Default::default()
        })
        .await
        .expect("err");
      
      while let Some(Ok(message)) = consumer
        .messages()
        .await
        .expect("consumer error")
        .next()
        .await {
          message.ack().await.expect("ack error");
          let msg = String::from_utf8(message.payload.to_vec()).unwrap();
          tracing::debug!("[foo#bar] message: {msg}");
        }
    });
    jetstream.publish("test", "bar".into()).await.expect("failed to publish");
    jetstream.publish("foo", "bar".into()).await.expect("failed to publish");

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
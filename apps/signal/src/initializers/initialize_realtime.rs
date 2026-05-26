use async_trait::async_trait;
use loco_rs::app::Initializer;
use loco_rs::auth::jwt::{JWT, UserClaims};
use loco_rs::prelude::*;
use loco_rs::doctor::{Check, CheckStatus};
use serde::{Deserialize, Serialize};
use socketioxide::SocketIo;
use axum::Router as AxumRouter;
use socketioxide::extract::SocketRef;
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;

use crate::services::RealtimeService;

pub struct RealtimeInitializer;

#[derive(Deserialize, Serialize, Debug, Clone)]
struct SocketId(String);

#[derive(Clone)]
pub struct RtState {
  ctx: AppContext,
}
impl RtState {
  pub fn new(ctx: AppContext) -> Self {
    Self {
      ctx,
    }
  }
}

fn verify_jwt(token: &str) -> Result<UserClaims, jsonwebtoken::errors::Error> {
  let secret = std::env::var("JWT_SECRET")
    .expect("JWT_SECRET must be set");

  let jwt = JWT::new(&secret);
  let token_data = jwt.validate(token).expect("validation failed");
  Ok(token_data.claims)
}

#[async_trait]
impl Initializer for RealtimeInitializer {
  fn name(&self) -> String {
    "realtime-initializer".to_string()
  }

  async fn check(&self, _ctx: &AppContext) -> Result<Option<Check>> {
    Ok(Some(Check {
      status: CheckStatus::Ok,
      message: "ok".into(),
      description: None,
    }))
  }

  async fn after_routes(&self, router: AxumRouter, ctx: &AppContext) -> Result<AxumRouter> {
    let io = ctx.shared_store.get::<RealtimeService>();

    let Some(io) = io else {
      tracing::warn!("socket ref not set");
      return Ok(router);
    };
    
    let sock = io.socket;
    sock.ns("/rt", async |socket: SocketRef| {
      let socket_id = socket.id.to_string();
      socket.extensions.insert(SocketId(socket_id));

      let headers = &socket.req_parts().headers;
      let cookies = headers.get("cookie").and_then(|v| v.to_str().ok()).unwrap_or("default");
      let tok = cookies.split(";")
        .find_map(|c| {
          let c = c.trim();
          if c.starts_with("access-token=") {
            Some(c.trim_start_matches("access-token="))
          } else {
            None
          }
        });

      match tok {
        Some(t) => {
          match verify_jwt(t) {
            Ok(c) => {
              tracing::info!("authenticating user with pid: {}", &c.pid);
              socket.emit("welcome", "welcome user").expect("error sending message");
            },
            Err(err) => {
              tracing::error!("Error authenticating connection: {err}");
              let _ = socket.emit("error", "Authentication failed");
              socket.disconnect().ok();
              return;
            },
          }
        },
        None => {
          tracing::error!("Unauthorized connection");
          let _ = socket.emit("error", "Unauthorized");
          socket.disconnect().ok();
          return;
        },
      }
    });

    Ok(router)
  }
}
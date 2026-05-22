use std::{collections::HashMap, env, io::{BufReader, Read}, net::SocketAddr, num::{NonZeroU8, NonZeroU32}, str::FromStr, sync::{Arc, atomic::{AtomicUsize, Ordering}}};
use async_lock::Mutex;
use axum::Router as AxumRouter;
use async_trait::async_trait;
use axum_server::tls_rustls::RustlsConfig;
use jsonwebtoken::{Algorithm, DecodingKey};
use loco_rs::{auth::jwt::{JWT, UserClaims}, prelude::*};
use loco_rs::doctor::{Check, CheckStatus};
use mediasoup::prelude::{Consumer, ConsumerId, ConsumerOptions, MimeTypeAudio, MimeTypeVideo, Producer, ProducerId, ProducerOptions, RtcpFeedback, RtpCodecCapability, RtpCodecParametersParameters, Transport, WebRtcTransportRemoteParameters, WorkerManager};
use serde::{Deserialize, Serialize};
use socketioxide::{
  SocketIo, SocketIoConfig, extract::{Data, Extension, SocketRef, State}
};

use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;

use crate::{initializers::initialize_chat::{participant::{ParticipantConnection, ParticipantId, messages::{ClientMessage, InternalMessage, PeerMessage, RoomMessage, ServerMessage}}, room::RoomId, rooms_registry::RoomsRegistry}, models::{_entities::sea_orm_active_enums::{CustomerType, TenantType}, appointments, students, tutors, users::{self, RoleWithId, UserRole, UserType}}, services::RealtimeService};
use tonic::{metadata::MetadataValue, transport::{Certificate, Channel, ClientTlsConfig, Identity}};
use signal_proto::v1::appointment::{AppointmentRetrieve, appointment_response, appointment_service_client::AppointmentServiceClient};

#[allow(clippy::module_name_repetitions)]
pub struct ChatInitializer;

#[derive(Deserialize, Serialize, Debug, Clone)]
struct Username(String);

#[derive(Deserialize, Serialize, Debug, Clone)]
struct SocketId(String);

#[derive(Deserialize, Serialize, Debug, Clone)]
enum Res {
  Login {
    num_users: usize,
  },
  UserEvent {
    num_users: usize,
    username: Username,
  },
  Message {
    username: Username,
    message: String,
  },
  Username {
    username: Username,
  },
}

#[derive(Clone)]
struct ChatRoomState {
  count: Arc<AtomicUsize>,
  ctx: AppContext,
  worker_manager: Arc<WorkerManager>,
  rooms_registry: Arc<RoomsRegistry>,
  participants: Arc<Mutex<Participants>>,
}

#[derive(Clone, Debug)]
struct RoomChannel {
  pub tx: UnboundedSender<RoomMessage>,
}

#[derive(Clone, Debug)]
struct PeerChannel {
  pub tx: UnboundedSender<PeerMessage>,
}

#[derive(Clone, Debug)]
struct InternalChannel {
  pub tx: UnboundedSender<InternalMessage>,
}

#[derive(Clone, Debug)]
struct ServerChannel {
  pub tx: UnboundedSender<ServerMessage>,
}

#[derive(Debug, Copy, Clone, Eq, PartialEq, Hash, Ord, PartialOrd, Deserialize, Serialize)]
struct AppointmentId(pub Uuid);

#[derive(Deserialize, Serialize, Debug, Clone)]
struct Pid(String);

#[derive(Deserialize, Serialize, Debug, Clone)]
struct HostId(Uuid);

#[derive(Deserialize, Serialize, Debug, Clone)]
struct AttendeeId(Uuid);

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct ChatData {
  appt_id: Option<AppointmentId>,
  room_id: Option<RoomId>,
  username: String,
  passcode: String,
}

#[derive(Debug, Default, Clone)]
struct Participants {
  inner: HashMap<ParticipantId, ParticipantConnection>,
}
impl Participants {
  pub fn new() -> Self {
    Self {
      inner: HashMap::new(),
    }
  }
  pub fn add(&mut self, v: ParticipantConnection) {
    self.inner.insert(v.id, v);
  }
  pub fn remove(&mut self, id: &ParticipantId) {
    self.inner.remove(id);
  }
  pub fn get_mut(&mut self, id: &ParticipantId) -> Option<&mut ParticipantConnection> {
    self.inner.get_mut(id)
  }
  pub fn count(&self) -> usize {
    self.inner.len()
  }
  pub fn empty(&self) -> bool {
    self.inner.is_empty()
  }
}

impl ChatRoomState {
  pub fn new(ctx: AppContext) -> Self {
    let wm = WorkerManager::new();
    let rr = RoomsRegistry::default();

    Self {
      count: Arc::new(AtomicUsize::new(0)),
      ctx,
      worker_manager: Arc::new(wm),
      rooms_registry: Arc::new(rr),
      participants: Arc::new(Mutex::new(Participants::new())),
    }
  }
  pub fn add_user(&self) -> usize {
    self.count.fetch_add(1, Ordering::SeqCst) + 1
  }
  pub fn remove_user(&self) -> usize {
    self.count.fetch_sub(1, Ordering::SeqCst) - 1
  }
  pub async fn add_participant(&mut self, part: ParticipantConnection) {
    let mut lock = self.participants.lock().await;
    lock.add(part);
  }
  pub async fn remove_participant(&mut self, part_id: &ParticipantId) {
    let mut lock = self.participants.lock().await;
    lock.remove(part_id);
  }
}

use gstreamer::{self as gst, glib};
use gstreamer::prelude::*;
pub struct SessionRecorder {
  pipelines: Arc<Mutex<HashMap<String, gst::Pipeline>>>,
  use_gpu: bool,
}
impl SessionRecorder {
  pub fn new() -> Self {
    gst::init().unwrap();

    let use_gpu = gst::Registry::get()
      .features(glib::types::Type::from_name("nvh264enc").unwrap())
      .iter()
      .any(|f| f.name().contains("nvh264enc"));

    Self {
      pipelines: Arc::new(Mutex::new(HashMap::new())),
      use_gpu,
    }      
  }

  pub fn start(
    &self,
    session_id: &str,
    video_ports: &[u16],
    audio_ports: &[u16],
    output_file: &str,
  ) {
    let encoder = if self.use_gpu { "nvh264enc bitrate=2000" } else { "x264 bitrate=2000" };

    let mut pipeline_desc = String::new();

    for (i, port) in video_ports.iter().enumerate() {
      pipeline_desc += &format!(
        "udpsrc port={0} caps=\"application/x-rtp,media=video,encoding-name=VP8\" ! \
         rtpvp8depay ! decodebin ! videoconvert ! queue ! ",
        port,
      );
    }

    pipeline_desc += &format!("{} ! queue ! mp4mux name=mux", encoder);

    for port in audio_ports.iter() {
      pipeline_desc += &format!(
        "udpsrc port={0} caps=\"application/x-rtp,media=audio,encoding-name=OPUS\" ! \
         rtpopusdepay ! opusdec ! audioconvert ! queue ! voaacenc ! mux. ",
        port,
      );
    }

    pipeline_desc += &format!("filesink location={}", output_file);

    
  }
}

async fn handle_client_messages(
  sock: SocketRef,
  Data(message): Data::<ClientMessage>,
  Extension(rid): Extension::<RoomId>,
  Extension(pid): Extension::<ParticipantId>,
  State(state): State::<ChatRoomState>,
) {
  {
    let parts = state.participants.lock().await.count();
    tracing::debug!("participants: {parts}");
  }
  tracing::debug!("message: {:?}", &message);
  match message {
    ClientMessage::Init { rtp_capabilities } => {
      tracing::debug!("message: Init");
      let mut lock = state.participants.lock().await;
      let conn = lock.get_mut(&pid).unwrap();
      conn.client_rtp_capabilities.replace(rtp_capabilities);
    },
    ClientMessage::ConnectProducerTransport { dtls_parameters } => {
      tracing::debug!("message: ConnectProducerTransport");
      let mut lock = state.participants.lock().await;
      let conn = lock.get_mut(&pid).unwrap();
      let participant_id = conn.id;
      let itx = conn.internal_channel.tx.clone();
      let stx = conn.server_channel.tx.clone();
      let transport = conn.transports.producer.clone();

      tokio::spawn(async move {
        tracing::info!("connecting to RTC transport");
        match transport.connect(WebRtcTransportRemoteParameters { dtls_parameters }).await {
          Ok(_) => {
            tracing::debug!("participant {participant_id}: Producer transport connected");
            let _ = stx.send(ServerMessage::ConnectedProducerTransport);
          },
          Err(err) => {
            tracing::error!("Failed to connect producer transport: {err}");
            let _ = itx.send(InternalMessage::Stop);
          },
        }
      });
    },
    ClientMessage::Produce { kind, rtp_parameters } => {
      tracing::debug!("message: Produce");
      tokio::spawn(async move {
        let mut lock = state.participants.lock().await;
        let conn = lock.get_mut(&pid).unwrap();
        let part_id = conn.id;
        let stx = conn.server_channel.tx.clone();
        let itx = conn.internal_channel.tx.clone();
        let transport = conn.transports.producer.clone();
        let room = conn.room.clone();
        let cid = conn.id.clone();
        tracing::info!("[participant_id={part_id}]: producing RTP transport");
        match transport.produce(ProducerOptions::new(kind, rtp_parameters)).await {
          Ok(producer) => {
            let id = producer.id();
            let _ = sock.emit("servermessage", &ServerMessage::Produced { id });
            tracing::info!("there are {} existing producers", &room.get_all_producers().len());
            let _ = stx.send(ServerMessage::Produced { id });
            room.add_producer(cid, producer.clone());
            let _ = itx.send(InternalMessage::SaveProducer(producer));
            tracing::info!("there are {} existing producers", &room.get_all_producers().len());
            let peers = room.get_peer_producers(&cid);
            tracing::info!("there are {} existing peers", &peers.len());
            // &conn.notify_peers().await;
            conn.consume_peers().await;
          },
          Err(err) => {
            tracing::error!("[participant_id={part_id}]: Failed to create {kind:?} producer: {err}");
            let _ = itx.send(InternalMessage::Stop);
          },
        }
      });
    },
    ClientMessage::ConnectConsumerTransport { dtls_parameters } => {
      tracing::debug!("message: ConnectConsumerTransport");
      let mut lock = state.participants.lock().await;
      let conn = lock.get_mut(&pid).unwrap();
      let part_id = conn.id;
      let stx = conn.server_channel.tx.clone();
      let itx = conn.internal_channel.tx.clone();
      let transport = conn.transports.consumer.clone();

      tokio::spawn(async move {
        match transport.connect(WebRtcTransportRemoteParameters { dtls_parameters }).await {
          Ok(_) => {
            let _ = stx.send(ServerMessage::ConnectedConsumerTransport);
            tracing::info!("[participant {part_id}]: Consumer transport connected");
          },
          Err(err) => {
            tracing::error!("[participant {part_id}]: Failed to connect consumer transport: {err}");
            let _ = itx.send(InternalMessage::Stop);
          },
        }
      });
    },
    ClientMessage::Consume { producer_id } => {
      tracing::debug!("message: Consume");
      // let mut ss = state.clone();
      let mut lock = state.participants.lock().await;
      let conn = lock.get_mut(&pid).unwrap();
      let part_id = conn.id;
      let stx = conn.server_channel.tx.clone();
      let itx = conn.internal_channel.tx.clone();
      let transport = conn.transports.consumer.clone();
      let rtp_capabilities = match conn.client_rtp_capabilities.clone() {
        Some(cap) => cap,
        None => {
          tracing::error!("[participant {part_id}]: Client should send RTP capabilities before consuming");
          return;
        },
      };
      let can_consume = conn.room.router().can_consume(&producer_id, &rtp_capabilities);
      tracing::debug!("router can consume: {can_consume}");
      if !can_consume {
        let _ = sock.emit("error", "cannot consume");
      }

      tokio::spawn(async move {
        let mut opts = ConsumerOptions::new(producer_id, rtp_capabilities);
        opts.paused = true;

        match transport.consume(opts).await {
          Ok(consumer) => {
            let id = consumer.id();
            let kind = consumer.kind();
            let rtp_parameters = consumer.rtp_parameters().clone();
            let _ = stx.send(ServerMessage::Consumed {
              id,
              producer_id,
              kind,
              rtp_parameters,
            });

            let _ = itx.send(InternalMessage::SaveConsumer(consumer));
            tracing::info!("[participant {part_id}]: {kind:?} consumer created: {id}");
          },
          Err(err) => {
            tracing::error!("[participant {part_id}]: Failed to create consumer: {err}");
          },
        }
      });
    },
    ClientMessage::ConsumePeers { producer_ids } => {},
    ClientMessage::ConsumerResume { id } => {
      tracing::debug!("message: ConsumerResume");
      // let mut ss = state.clone();
      let mut lock = state.participants.lock().await;
      let conn = lock.get_mut(&pid).unwrap();
      let lock = conn.consumers.lock().await;
      if let Some(consumer) = lock.get(&id).cloned() {
        let part_id = conn.id;
        let kind = consumer.kind();
        let id = consumer.id();
        tokio::spawn(async move {
          match consumer.resume().await {
            Ok(_) => {
              tracing::info!("[participant {part_id}]: Successfully resumed {kind:?} consumer: {id}");
            },
            Err(err) => {
              tracing::error!("[participant {part_id}]: Failed to resume {kind:?} consumer: {err}");
            },
          }
        });
      }
    },
  }
}

async fn handle_new_connection(
  sock: SocketRef,
  Data(data): Data::<ChatData>,
  Extension(sid): Extension::<SocketId>,
  State(mut state): State::<ChatRoomState>,
) {
  let (auth, host) = authenticate(&state.ctx.db.clone(), sock.clone(), data.appt_id).await;
  if !auth {
    tracing::error!("Unauthorized");
    sock.disconnect().ok();
    return;
  }
  if sock.extensions.get::<Username>().is_some() {
    return;
  }
  let username = Username(data.username.clone());

  let uri = &sock.req_parts().uri.to_string();
  tracing::debug!("uri: {uri}");
  // let ws_host = "https://localhost:3500"; // env::var("WSS_HOST").unwrap_or_default();
  // let uri = format!("{}{}", ws_host, &sock.req_parts().uri.to_string());
  // tracing::debug!("uri: {uri}");
  let uri = url::Url::from_str(&uri).unwrap();
  let pairs: HashMap<String, String> = uri.query_pairs().into_owned().collect();
  let Some(appt_id) = pairs.get("appointmentId") else {
    tracing::error!("Invalid appointment id");
    let _ = sock.emit("error", "Invalid appointment id");
    sock.disconnect().ok();
    return;
  };
  let uid = Uuid::from_str(appt_id).unwrap();
  sock.extensions.insert(AppointmentId(uid));

  let num_users = state.add_user();
  sock.extensions.insert(username.clone());
  sock.emit("login", &Res::Login { num_users }).ok();
  let wm = &state.worker_manager;
  let room = match data.room_id {
    Some(rid) => {
      tracing::info!("creating a room with id: {}", &rid);
      sock.extensions.insert(rid.clone());
      state.rooms_registry.get_or_create_room(Arc::new(sock.clone()), wm, rid).await.expect("err")
    },
    None => {
      if !host {
        sock.disconnect().ok();
        return;
      }
      tracing::info!("creating room");
      let room = state.rooms_registry.create_room(Arc::new(sock.clone()), wm).await.expect("err");
      let rid = room.id();
      sock.extensions.insert(rid.clone());
      room
    },
  };
  tracing::info!("new room: {}", &room.id());

  match ParticipantConnection::new(sock.clone(), room, username.clone()).await {
    Ok(echo) => {
      tracing::info!("new connection {}", &echo.id);
      let id = echo.id.clone();
      sock.extensions.insert(id.clone());
      state.add_participant(echo).await;
      let mut lock = state.participants.lock().await;
      let echo = lock.get_mut(&id).unwrap();
      echo.started(&mut sock.clone()).await;
    },
    Err(err) => {
      tracing::error!("echo failed: {err}");
    },
  }
}

async fn init_server_handlers(sock: SocketRef, rx: &mut UnboundedReceiver<ServerMessage>) {
  while let Some(message) = rx.recv().await {
    let json = serde_json::json!(message);
    tracing::debug!("[server] received message: {:?}", &json);
    let _ = sock.emit("servermessage", &json);
  }
}

async fn init_internal_handlers(sock: SocketRef, producers: Arc<Mutex<Vec<Producer>>>, consumers: Arc<Mutex<HashMap<ConsumerId, Consumer>>>, rx: &mut UnboundedReceiver<InternalMessage>) {
  while let Some(message) = rx.recv().await {
    tracing::debug!("[internal] received message: {:?}", &message);
    let sock = sock.clone();
    match message {
      InternalMessage::Stop => {
        let _ = &sock.disconnect();
      },
      InternalMessage::SaveProducer(p) => {
        let mut prods = producers.lock().await;
        prods.push(p);
      },
      InternalMessage::SaveConsumer(c) => {
        let mut cons = consumers.lock().await;
        cons.insert(c.id(), c);
      },
    }
  }
}

async fn init_room_handlers(sock: SocketRef, rx: &mut UnboundedReceiver<RoomMessage>) {
  while let Some(message) = rx.recv().await {
    match message {
      RoomMessage::Broadcast(server_message) => {
        let json = serde_json::json!(server_message);
        let _ = sock.broadcast().emit("servermessage", &json);
      }
    }
  }
}

/* async fn init_peer_handlers(
  participant_id: &ParticipantId,
  producers: &mut Vec<ProducerId>,
  tx: &UnboundedSender<ServerMessage>,
  rx: &mut UnboundedReceiver<PeerMessage>,
) {
  while let Some(message) = rx.recv().await {
    match message {
      PeerMessage::ConsumePeer(proceed) => {
        if proceed {
          if let Some(prod) = producers.pop() {
            let _ = tx.send(ServerMessage::ProducerAdded {
              username: None,
              participant_id: *participant_id,
              producer_id: prod,
            });
          }
        }
      },
      PeerMessage::Stop => {},
    }
  }
} */

async fn authenticate(
  db: &DatabaseConnection,
  sock: SocketRef,
  appointment_id: Option<AppointmentId>,
) -> (bool, bool) {
  let Some(token) = extract_auth_header(sock.clone()) else {
    return (false, false);
  };
  let Ok(claims) = verify_jwt(&token) else {
    return (false, false);
  };
  let Some(AppointmentId(appt_id)) = appointment_id else {
    return (false, false);
  };

  // check if user is either host or attendee
  use std::fs::File;

  let certs_dir = std::path::PathBuf::from_iter([std::env!("CARGO_MANIFEST_DIR"), "certs", "new"]);
  let pem = std::fs::read_to_string(certs_dir.join("ca.pem")).expect("could not read CA pem file");

  let root_cert = std::fs::File::open("certs/new/ca.pem").unwrap();
  let mut root_cert_vec = Vec::new();
  BufReader::new(root_cert).read_to_end(&mut root_cert_vec).expect("error reading cert file");

  let ca = Certificate::from_pem(pem);

  let client_cert = File::open("certs/new/localhost.san.pem").unwrap();
  let mut client_cert_vec = Vec::new();
  BufReader::new(client_cert).read_to_end(&mut client_cert_vec).expect("error reading cert file");

  let client_key = File::open("certs/new/san-key.pem").unwrap();
  let mut client_key_vec = Vec::new();
  BufReader::new(client_key).read_to_end(&mut client_key_vec).expect("error reading key file");

  let tls = ClientTlsConfig::new()
    .ca_certificate(ca)
    .identity(Identity::from_pem(&client_cert_vec, &client_key_vec))
    .domain_name("localhost");

  let channel = Channel::from_static("https://localhost:7891")
    .tls_config(tls)
    .expect("err")
    .connect()
    .await
    .expect("msg");

  let mut client = AppointmentServiceClient::new(channel);
  let mut request = tonic::Request::new(AppointmentRetrieve {
    id: appt_id.to_string(),
  });

  let auth_header = MetadataValue::try_from(format!("Bearer {}", &token)).expect("token is not valid");
  request.metadata_mut().insert("authorization", auth_header);

  let response = client.retrieve(request).await.expect("error sending request");
  let r = response.get_ref();

  let Some(ref data) = r.data else {
    return (true, false);
  };
  match data {
    appointment_response::Data::One(one) => {
      // the user is proven to be a Participant
    },
    appointment_response::Data::List(list) => {
      return (false, false);
    },
  }

  tracing::info!("RESPONSE={response:?}");

  tracing::info!("authenticating user with pid: {}", &claims.pid);
  sock.emit("welcome", "welcome user").expect("error sending message");

  (true, true)
}

fn extract_auth_header(sock: SocketRef) -> Option<String> {
  let headers = &sock.req_parts().headers;
  let access_token = headers.get_all("cookie").iter().find(|kv| {
    kv.to_str().unwrap().starts_with("access-token")
  }).expect("token not found").to_str().expect("invalid token");
  let tok = access_token.split(";")
    .find_map(|c| {
      let c = c.trim();
      if c.starts_with("access-token=") {
        Some(c.trim_start_matches("access-token="))
      } else {
        None
      }
    });

  match tok {
    Some(tok) => Some(tok.to_string()),
    None => None,
  }
}

fn verify_jwt(token: &str) -> Result<UserClaims, jsonwebtoken::errors::Error> {
  let secret = std::env::var("JWT_SECRET")
    .expect("JWT_SECRET must be set");

  use jsonwebtoken::{decode, DecodingKey, Validation};

  // TODO: access vault and send request

  let mut validate = Validation::new(Algorithm::HS512);
  validate.leeway = 0;
  /* let _ = decode::<UserClaims>(
    token,
    &DecodingKey::from_base64_secret("&self.secret")?,
    &validate,
  ); */
  let jwt = JWT::new(&secret).algorithm(Algorithm::HS512);
  let token_data = jwt.validate(token).expect("validation failed");
  Ok(token_data.claims)
}

#[async_trait]
impl Initializer for ChatInitializer {
  fn name(&self) -> String {
    "tutor-session".to_string()
  }

  async fn check(&self, _ctx: &AppContext) -> Result<Option<Check>> {
    Ok(Some(Check {
      status: CheckStatus::Ok,
      message: "ok".into(),
      description: None,
    }))
  }

  /* async fn before_run(&self, _app_context: &AppContext) -> Result<()> {
    let (internal_rx, internal_tx) = unbounded_channel::<InternalMessage>();
    Ok(())
  } */

  async fn after_routes(
    &self,
    router: AxumRouter,
    ctx: &AppContext,
  ) -> Result<AxumRouter> {
    let cc = ctx.clone();
    let (layer, io) = SocketIo::builder()
      .with_state(ChatRoomState::new(ctx.clone()))
      .build_layer();

    cc.shared_store.insert(RealtimeService {
      socket: io.clone(),
    });

    let db = cc.db.clone();
    io.ns("/meet", async move |sock: SocketRef| {
      let socket_id = sock.id.to_string();
      println!("socket_id: {socket_id}");
      sock.extensions.insert(SocketId(socket_id));

      let headers = &sock.req_parts().headers;
      println!("hh: {:#?}", &headers);
      let access_token = headers.get_all("cookie").iter().find(|kv| {
        kv.to_str().unwrap().starts_with("access-token")
      }).expect("token not found").to_str().expect("invalid token");
      // println!("access_token: {access_token}");
      // let cookies = headers.get("cookie").and_then(|v| v.to_str().ok()).unwrap_or("default");
      // println!("cookies: {cookies}");
      let tok = access_token.split(";")
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
          tracing::info!("token from jar: {t}");
          match verify_jwt(t) {
            Ok(c) => {
              tracing::info!("authenticating user with pid: {}", &c.pid);
              let _ = sock.emit("welcome", "welcome user");
              let _ = sock.emit("ping", "ping");
            },
            Err(err) => {
              tracing::error!("Error authenticating connection: {err}");
              let _ = sock.emit("error", "Authentication failed");
              sock.disconnect().ok();
              return;
            },
          }
        },
        None => {
          tracing::error!("Unauthorized connection");
          let _ = sock.emit("error", "Unauthorized");
          sock.disconnect().ok();
          return;
        },
      }

      sock.on("join", handle_new_connection);
      sock.on("clientmessage", handle_client_messages);
      sock.on("pong", async |sock: SocketRef, Data(data): Data::<ChatData>, Extension(sid): Extension::<SocketId>, State(mut state): State::<ChatRoomState>| {
        tracing::debug!("received pong");
      });
      sock.on_disconnect(
        async |
          sock: SocketRef,
          mut state: State<ChatRoomState>,
          Extension(username): Extension::<Username>,
          Extension(pid): Extension::<ParticipantId>,
        | {
          state.remove_participant(&pid).await;
          let num_users = state.remove_user();
          let res = &Res::UserEvent {
            num_users,
            username,
          };
          sock.broadcast().emit("user left", res).await.ok();
        },
      );
    });

    let router = router.layer(
      ServiceBuilder::new()
        .layer(CorsLayer::very_permissive())
        .layer(layer),
    );

    Ok(router)
  }
}

mod room {
  use std::{collections::HashMap, fmt, sync::{Arc, Weak}};
  use mediasoup::{prelude::*, worker::WorkerLogTag};
  use serde::{Deserialize, Serialize};
  use socketioxide::extract::SocketRef;
  use uuid::Uuid;
  use event_listener_primitives::{Bag, BagOnce, HandlerId};
  use crate::initializers::initialize_chat::{ChatRoomState, Participants, Username, media_codecs, participant::{ParticipantConnection, ParticipantId}};
  use parking_lot::Mutex;

  #[derive(Debug, Copy, Clone, Eq, PartialEq, Hash, Ord, PartialOrd, Deserialize, Serialize)]
  pub struct RoomId(pub Uuid);

  impl fmt::Display for RoomId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
      fmt::Display::fmt(&self.0, f)
    }
  }

  impl RoomId {
    pub fn new() -> Self {
      Self(Uuid::now_v7())
    }
  }

  #[derive(Default, Debug)]
  struct Handlers {
    producer_add: Bag<Arc<dyn Fn(&ParticipantId, &Producer) + Send + Sync>, ParticipantId, Producer>,
    producer_remove: Bag<Arc<dyn Fn(&ParticipantId, &ProducerId) + Send + Sync>, ParticipantId, ProducerId>,
    close: BagOnce<Box<dyn FnOnce() + Send>>,
  }

  struct Inner {
    socket: Arc<SocketRef>,
    id: RoomId,
    router: Router,
    handlers: Handlers,
    clients: Mutex<HashMap<ParticipantId, Vec<Producer>>>,
    client_names: Mutex<HashMap<ParticipantId, Username>>,
  }

  impl fmt::Debug for Inner {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
      f.debug_struct("Inner")
        .field("id", &self.id)
        .field("handlers", &"...")
        .field("clients", &self.clients)
        .finish()
    }
  }

  impl Drop for Inner {
    fn drop(&mut self) {
      tracing::info!("Room {} closed", self.id);
      self.handlers.close.call_simple();
    }
  }

  #[derive(Debug, Clone)]
  pub struct Room {
    inner: Arc<Inner>,
  }

  impl Room {
    pub async fn new(sock: Arc<SocketRef>, worker_manager: &WorkerManager) -> Result<Self, String> {
      Self::new_with_id(sock, worker_manager, RoomId::new()).await
    }

    pub async fn new_with_id(
      sock: Arc<SocketRef>,
      worker_manager: &WorkerManager,
      id: RoomId,
    ) -> Result<Room, String> {
      let worker = worker_manager
        .create_worker({
          let mut settings = WorkerSettings::default();
          settings.log_level = mediasoup::worker::WorkerLogLevel::Debug;
          settings.log_tags = vec![
            WorkerLogTag::Info,
            WorkerLogTag::Ice,
            WorkerLogTag::Dtls,
            WorkerLogTag::Rtp,
            WorkerLogTag::Srtp,
            WorkerLogTag::Rtcp,
            WorkerLogTag::Rtx,
            WorkerLogTag::Bwe,
            WorkerLogTag::Score,
            WorkerLogTag::Simulcast,
            WorkerLogTag::Svc,
            WorkerLogTag::Sctp,
            WorkerLogTag::Message,
          ];
          settings
        })
        .await
        .map_err(|err| format!("Failed to create worker: {err}"))?;

      let router = worker
        .create_router(RouterOptions::new(media_codecs()))
        .await
        .map_err(|err| format!("Failed to create router: {err}"))?;

      println!("Room {id} created");

      Ok(Self {
        inner: Arc::new(Inner {
          socket: sock,
          id,
          router,
          handlers: Handlers::default(),
          clients: Mutex::default(),
          client_names: Mutex::default(),
        }),
      })
    }

    pub fn id(&self) -> RoomId {
      self.inner.id
    }

    pub fn router(&self) -> &Router {
      &self.inner.router
    }

    pub fn add_producer(&self, participant_id: ParticipantId, producer: Producer) {
      self.inner
        .clients
        .lock()
        .entry(participant_id)
        .or_default()
        .push(producer.clone());
      
      self.inner
        .handlers
        .producer_add
        .call_simple(&participant_id, &producer);
    }

    pub fn remove_participant(&self, participant_id: &ParticipantId) {
      let producers = self.inner.clients.lock().remove(participant_id);

      for producer in producers.unwrap_or_default() {
        let pid = &producer.id();
        self.inner
          .handlers
          .producer_remove
          .call_simple(participant_id, pid);
      }
    }

    /* pub fn get_participant(&self, participant_id: &ParticipantId) -> &ParticipantConnection {
      let clients = self.inner.clients.lock();
      let part = clients.get(participant_id);
    } */

    pub fn get_all_producers(&self) -> Vec<(ParticipantId, ProducerId)> {
      self.inner
        .clients
        .lock()
        .iter()
        .flat_map(|(part_id, prods)| {
          let part_id = *part_id;
          prods.iter()
            .map(move |p| (part_id, p.id()))
        })
        .collect()
    }

    pub fn get_peer_producers(&self, participant_id: &ParticipantId) -> Vec<(ParticipantId, ProducerId)> {
      self.get_all_producers()
        .iter()
        .filter_map(|(k, v)| {
          if *k == *participant_id {
            None
          } else {
            Some((*k, *v))
          }
        })
        .collect()
    }

    pub fn on_producer_add<F: Fn(&ParticipantId, &Producer) + Send + Sync + 'static>(
      &self,
      callback: F,
    ) -> HandlerId {
      self.inner.handlers.producer_add.add(Arc::new(callback))
    }

    pub fn on_producer_remove<F: Fn(&ParticipantId, &ProducerId) + Send + Sync + 'static>(
      &self,
      callback: F,
    ) -> HandlerId {
      self.inner.handlers.producer_remove.add(Arc::new(callback))
    }

    pub fn on_close<F: FnOnce() + Send+ 'static>(&self, callback: F) -> HandlerId {
      self.inner.handlers.close.add(Box::new(callback))
    }

    pub fn downgrade(&self) -> WeakRoom {
      WeakRoom {
        inner: Arc::downgrade(&self.inner)
      }
    }
  }

  #[derive(Debug, Clone)]
  pub struct WeakRoom {
    inner: Weak<Inner>,
  }

  impl WeakRoom {
    pub fn upgrade(&self) -> Option<Room> {
      self.inner.upgrade().map(|inner| Room { inner })
    }
  }
}

mod rooms_registry {
  use std::{collections::{HashMap, hash_map::Entry}, sync::Arc};
  use async_lock::Mutex;
  use mediasoup::prelude::WorkerManager;
  use socketioxide::extract::SocketRef;
  use crate::initializers::initialize_chat::{ChatRoomState, room::{Room, RoomId, WeakRoom}};

  #[derive(Debug, Default, Clone)]
  pub struct RoomsRegistry {
    rooms: Arc<Mutex<HashMap<RoomId, WeakRoom>>>,
  }

  impl RoomsRegistry {
    pub async fn get_or_create_room(&self, sock: Arc<SocketRef>, worker_manager: &WorkerManager, room_id: RoomId) -> Result<Room, String> {
      let mut rooms = self.rooms.lock().await;
      match rooms.entry(room_id) {
        Entry::Occupied(mut entry) => match entry.get().upgrade() {
          Some(room) => Ok(room),
          None => {
            tracing::info!("room {room_id} occupied but empty");
            let room = Room::new_with_id(sock, worker_manager, room_id).await?;
            entry.insert(room.downgrade());
            room.on_close({
              let room_id = room.id();
              let rooms = Arc::clone(&self.rooms);

              move || {
                std::thread::spawn(move || {
                  futures_lite::future::block_on(async move {
                    rooms.lock().await.remove(&room_id);
                  });
                });
              }
            })
            .detach();
            Ok(room)
          }
        },
        Entry::Vacant(entry) => {
          let room = Room::new_with_id(sock, worker_manager, room_id).await?;
          entry.insert(room.downgrade());
          room.on_close({
            let room_id = room.id();
            let rooms = Arc::clone(&self.rooms);

            move || {
              std::thread::spawn(move || {
                futures_lite::future::block_on(async move {
                  rooms.lock().await.remove(&room_id);
                });
              });
            }
          })
          .detach();
          Ok(room)
        },
      }
    }

    pub async fn create_room(&self, sock: Arc<SocketRef>, worker_manager: &WorkerManager) -> Result<Room, String> {
      let mut rooms = self.rooms.lock().await;
      let room = Room::new(sock.clone(), worker_manager).await?;
      sock.join(room.id().clone().to_string());
      rooms.insert(room.id(), room.downgrade());
      room.on_close({
        let room_id = room.id();
        let rooms = Arc::clone(&self.rooms);

        move || {
          std::thread::spawn(move || {
            futures_lite::future::block_on(async move {
              rooms.lock().await.remove(&room_id);
            });
          });
        }
      })
      .detach();
      Ok(room)
    }
  }
}

mod participant {
  use std::{collections::HashMap, fmt, net::Ipv4Addr, sync::{Arc, atomic::AtomicBool}};
  use async_lock::Mutex;
  use event_listener_primitives::HandlerId;
  use mediasoup::prelude::*;
  use serde::{Deserialize, Serialize};
  use socketioxide::extract::SocketRef;
  use tokio::sync::mpsc::unbounded_channel;
  use uuid::Uuid;
  use crate::initializers::initialize_chat::{InternalChannel, PeerChannel, RoomChannel, ServerChannel, Username, init_internal_handlers, init_room_handlers, init_server_handlers, participant::messages::{InternalMessage, PeerMessage, RoomMessage, ServerMessage, TransportOptions}, room::Room};

  #[derive(Debug, Copy, Clone, Eq, PartialEq, Hash, Ord, PartialOrd, Deserialize, Serialize)]
  pub struct ParticipantId(Uuid);

  pub mod messages {
    use mediasoup::prelude::*;
    use serde::{Deserialize, Serialize};

    use crate::initializers::initialize_chat::{Username, participant::ParticipantId, room::RoomId};

    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    pub struct TransportOptions {
      pub id: TransportId,
      pub dtls_parameters: DtlsParameters,
      pub ice_candidates: Vec<IceCandidate>,
      pub ice_parameters: IceParameters,
    }

    #[derive(Serialize)]
    #[serde(tag = "action")]
    // #[rtype(result = "()")]
    pub enum ServerMessage {
      #[serde(rename_all = "camelCase")]
      Init {
        participant_id: ParticipantId,
        room_id: RoomId,
        consumer_transport_options: TransportOptions,
        producer_transport_options: TransportOptions,
        router_rtp_capabilities: RtpCapabilitiesFinalized,
      },

      #[serde(rename_all = "camelCase")]
      ProducerAdded {
        username: Option<String>,
        participant_id: ParticipantId,
        producer_id: ProducerId,
      },

      #[serde(rename_all = "camelCase")]
      ProducerRemoved {
        participant_id: ParticipantId,
        producer_id: ProducerId,
      },

      ConnectedProducerTransport,

      #[serde(rename_all = "camelCase")]
      Produced { id: ProducerId },

      ConnectedConsumerTransport,

      #[serde(rename_all = "camelCase")]
      Consumed {
        id: ConsumerId,
        producer_id: ProducerId,
        kind: MediaKind,
        rtp_parameters: RtpParameters,
      },
    }

    #[derive(Debug, Deserialize, Serialize)]
    #[serde(tag = "action")]
    pub enum ClientMessage {
      #[serde(rename_all = "camelCase")]
      Init { rtp_capabilities: RtpCapabilities },

      #[serde(rename_all = "camelCase")]
      ConnectProducerTransport { dtls_parameters: DtlsParameters },

      #[serde(rename_all = "camelCase")]
      Produce {
        kind: MediaKind,
        rtp_parameters: RtpParameters,
      },

      #[serde(rename_all = "camelCase")]
      ConnectConsumerTransport { dtls_parameters: DtlsParameters },

      #[serde(rename_all = "camelCase")]
      Consume { producer_id: ProducerId },

      #[serde(rename_all = "camelCase")]
      ConsumePeers { producer_ids: Vec<ProducerId> },

      ConsumerResume { id: ConsumerId },
    }

    #[derive(Clone, Debug)]
    pub enum InternalMessage {
      SaveProducer(Producer),

      SaveConsumer(Consumer),

      Stop,
    }

    #[derive(Serialize)]
    pub enum RoomMessage {
      Broadcast(ServerMessage),
    }

    #[derive(Clone, Debug)]
    pub enum PeerMessage {
      ConsumePeer(bool),
      Stop,
    }
  }

  impl fmt::Display for ParticipantId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
      fmt::Display::fmt(&self.0, f)
    }
  }

  impl ParticipantId {
    fn new() -> Self {
      Self(Uuid::now_v7())
    }
  }

  #[derive(Clone)]
  pub struct Transports {
    pub consumer: WebRtcTransport,
    pub producer: WebRtcTransport,
  }

  #[derive(Clone)]
  pub struct ParticipantConnection {
    pub id: ParticipantId,
    pub username: Username,
    pub client_rtp_capabilities: Option<RtpCapabilities>,
    pub consumers: Arc<Mutex<HashMap<ConsumerId, Consumer>>>,
    pub producers: Arc<Mutex<Vec<Producer>>>,
    pub transports: Transports,
    pub room: Room,
    pub attached_handlers: Vec<HandlerId>,
    pub server_channel: ServerChannel,
    pub internal_channel: InternalChannel,
    pub room_channel: RoomChannel,
    pub peer_channel: PeerChannel,
    pub peer_producers: Arc<Mutex<Vec<Producer>>>,
    pub consume_producer: Arc<Mutex<bool>>,
  }

  impl Drop for ParticipantConnection {
    fn drop(&mut self) {
      self.room.remove_participant(&self.id);
    }
  }

  impl fmt::Debug for ParticipantConnection {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
      f.debug_struct("ParticipantConnection")
        .field("id", &self.id)
        .finish()
    }
  }

  impl ParticipantConnection {
    pub async fn new(socket: SocketRef, room: Room, username: Username) -> Result<Self, String> {
      let transport_options = WebRtcTransportOptions::new(WebRtcTransportListenInfos::new(ListenInfo {
        protocol: Protocol::Udp,
        ip: std::net::IpAddr::V4(Ipv4Addr::LOCALHOST),
        announced_address: None,
        expose_internal_ip: false,
        port: None,
        port_range: None,
        flags: None,
        send_buffer_size: None,
        recv_buffer_size: None,
      }));

      let producer_transport = room.router()
        .create_webrtc_transport(transport_options.clone())
        .await
        .map_err(|err| format!("Failed to create producer transport: {err}"))?;

      let consumer_transport = room.router()
        .create_webrtc_transport(transport_options)
        .await
        .map_err(|err| format!("Failed to create consumer transport: {err}"))?;

      let plain = room.router()
        .create_plain_transport(PlainTransportOptions::new(ListenInfo {
          protocol: Protocol::Udp,
          ip: std::net::IpAddr::V4(Ipv4Addr::LOCALHOST),
          announced_address: None,
          expose_internal_ip: false,
          port: None,
          port_range: None,
          flags: None,
          send_buffer_size: None,
          recv_buffer_size: None,
        }))
        .await
        .map_err(|err| format!("Failed to create plain transport: {err}"))?;

      let (server_tx, mut server_rx) = unbounded_channel::<ServerMessage>();
      let (internal_tx, mut internal_rx) = unbounded_channel::<InternalMessage>();
      let (room_tx, mut room_rx) = unbounded_channel::<RoomMessage>();
      let (peer_tx, mut peer_rx) = unbounded_channel::<PeerMessage>();

      let stx = server_tx.clone();
      let consumers = Arc::new(Mutex::new(HashMap::new()));
      let producers = Arc::new(Mutex::new(vec![]));
      let s = Self {
        id: ParticipantId::new(),
        username,
        client_rtp_capabilities: None,
        consumers,
        producers,
        transports: Transports {
          consumer: consumer_transport,
          producer: producer_transport,
        },
        room,
        attached_handlers: Vec::new(),
        server_channel: ServerChannel { tx: server_tx },
        internal_channel: InternalChannel { tx: internal_tx },
        room_channel: RoomChannel { tx:room_tx },
        peer_channel: PeerChannel { tx: peer_tx },
        peer_producers: Arc::new(Mutex::new(vec![])),
        consume_producer: Arc::new(Mutex::new(false)),
      };
      let ssocket = socket.clone();
      tokio::spawn(async move {
        init_server_handlers(ssocket, &mut server_rx).await;
      });
      let prods = s.producers.clone();
      let cons = s.consumers.clone();
      let isocket = socket.clone();
      tokio::spawn(async move {
        init_internal_handlers(isocket, prods, cons, &mut internal_rx).await;
      });
      let rsocket = socket.clone();
      tokio::spawn(async move {
        init_room_handlers(rsocket, &mut room_rx).await;
      });
      /* let peer_producers = s.room.get_peer_producers(&s.id);
      let mut peers: Vec<ProducerId> = peer_producers.iter().map(|v| v.1).collect();
      tokio::spawn(async move {
        tracing::debug!("consuming {} peer producers in the room", &peers.len());
        init_peer_handlers(&s.id, &mut peers, &stx, &mut peer_rx).await;
      }); */
      Ok(s)
    }

    pub async fn started(&mut self, sock: &mut SocketRef) {
      let server_init_message = ServerMessage::Init {
        participant_id: self.id,
        room_id: self.room.id(),
        consumer_transport_options: TransportOptions {
          id: self.transports.consumer.id(),
          dtls_parameters: self.transports.consumer.dtls_parameters(),
          ice_candidates: self.transports.consumer.ice_candidates().clone(),
          ice_parameters: self.transports.consumer.ice_parameters().clone(),
        },
        producer_transport_options: TransportOptions {
          id: self.transports.producer.id(),
          dtls_parameters: self.transports.producer.dtls_parameters().clone(),
          ice_candidates: self.transports.producer.ice_candidates().clone(),
          ice_parameters: self.transports.producer.ice_parameters().clone(),
        },
        router_rtp_capabilities: self.room.router().rtp_capabilities().clone(),
      };

      let stx = self.server_channel.tx.clone();
      let rtx = self.room_channel.tx.clone();

      let _ = stx.send(server_init_message);
      let username = self.username.clone();

      self.attached_handlers.push(self.room.on_producer_add({
        let own_id = self.id;

        let stx = stx.clone();
        let rtx = rtx.clone();
        move |participant_id, producer| {
          tracing::info!("attached handler for {participant_id}: on_producer_add: {own_id}");
          if &own_id == participant_id {
            return;
          }
          let prod = producer.id();
          tracing::info!("sending message for {participant_id}: ServerMessage::ProducerAdded");
          stx.send(ServerMessage::ProducerAdded {
            username: Some(username.0.clone()),
            participant_id: *participant_id,
            producer_id: prod.clone(),
          }).expect("failed to send ServerMessage::ProducerAdded");

          /* rtx.send(RoomMessage::Broadcast(
            ServerMessage::ProducerAdded {
              participant_id: *participant_id,
              producer_id: prod,
            },
          )).expect("failed to send RoomMessage::Broadcast"); */
        }
      }));

      self.attached_handlers.push(self.room.on_producer_remove({
        let own_id = self.id;

        move |participant_id, producer_id| {
          tracing::info!("attached handler for {participant_id}: on_producer_remove");
          if &own_id == participant_id {
            return;
          }
          let prod = producer_id.clone();
          let pid = participant_id.clone();
          let _ = stx.send(ServerMessage::ProducerRemoved { participant_id: pid, producer_id: prod });
        }
      }));

      /* let prods = self.room.get_all_producers();
      tracing::debug!("prod count: {}", &prods.len());
      for (participant_id, producer_id) in self.room.get_all_producers() {
        let _ = self.server_channel.tx.send(ServerMessage::ProducerAdded { participant_id, producer_id });
      } */
      self.notify_peers().await;
    }

    pub async fn notify_peers(&self) {
      let peers = self.room.get_peer_producers(&self.id);
      tracing::debug!("notifying {} peers in the room", &peers.len());
      let prods = self.producers.lock().await;
      for prod in prods.iter() {
        let username = self.username.clone();
        let _ = self.room_channel.tx.send(RoomMessage::Broadcast(
          ServerMessage::ProducerAdded {
            username: Some(username.0.clone()),
            participant_id: self.id.clone(),
            producer_id: prod.id().clone(),
          }
        ));
      }
    }

    pub async fn consume_peers(&self) {
      let peers = self.room.get_peer_producers(&self.id);
      for (participant_id, producer_id) in peers {
        tracing::debug!("consuming producer {} of peer {}", &producer_id, &participant_id);
        let _ = self.server_channel.tx.send(ServerMessage::ProducerAdded {
          username: None,
          participant_id,
          producer_id,
        });
      }
      // let _ = self.peer_channel.tx.send(PeerMessage::ConsumePeer(true));
    }
  }
}

fn media_codecs() -> Vec<RtpCodecCapability> {
  vec![
    RtpCodecCapability::Audio {
      mime_type: MimeTypeAudio::Opus,
      preferred_payload_type: None,
      clock_rate: NonZeroU32::new(48_000).unwrap(),
      channels: NonZeroU8::new(2).unwrap(),
      parameters: RtpCodecParametersParameters::from([("useinbandfec", 1_u32.into())]),
      rtcp_feedback: vec![RtcpFeedback::TransportCc],
    },
    RtpCodecCapability::Video {
      mime_type: MimeTypeVideo::Vp8,
      preferred_payload_type: None,
      clock_rate: NonZeroU32::new(90_000).unwrap(),
      parameters: RtpCodecParametersParameters::default(),
      rtcp_feedback: vec![
        RtcpFeedback::Nack,
        RtcpFeedback::NackPli,
        RtcpFeedback::CcmFir,
        RtcpFeedback::GoogRemb,
        RtcpFeedback::TransportCc,
      ],
    },
    RtpCodecCapability::Video {
      mime_type: MimeTypeVideo::H264,
      preferred_payload_type: None,
      clock_rate: NonZeroU32::new(90_000).unwrap(),
      parameters: RtpCodecParametersParameters::default(),
      rtcp_feedback: vec![
        RtcpFeedback::Nack,
        RtcpFeedback::NackPli,
        RtcpFeedback::CcmFir,
        RtcpFeedback::GoogRemb,
        RtcpFeedback::TransportCc,
      ],
    },
    RtpCodecCapability::Video {
      mime_type: MimeTypeVideo::AV1,
      preferred_payload_type: None,
      clock_rate: NonZeroU32::new(90_000).unwrap(),
      parameters: RtpCodecParametersParameters::default(),
      rtcp_feedback: vec![
        RtcpFeedback::Nack,
        RtcpFeedback::NackPli,
        RtcpFeedback::CcmFir,
        RtcpFeedback::GoogRemb,
        RtcpFeedback::TransportCc,
      ],
    },
  ]
}
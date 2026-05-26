use std::{collections::HashMap, io::BufReader, net::SocketAddr, sync::{Arc, RwLock}, time::{SystemTime, UNIX_EPOCH}};

use axum_server::tls_rustls::RustlsConfig;
use chrono::Local;
use loco_rs::app::Initializer;
use redis::{JsonCommands, AsyncTypedCommands, JsonAsyncCommands};
use rsa::rand_core::RngCore;
use tonic::{async_trait, transport::{Identity, Server, ServerTlsConfig}};
use axum::Router as AxumRouter;
use loco_rs::prelude::*;


pub struct ServerInitializer;

#[async_trait]
impl Initializer for ServerInitializer {
  fn name(&self) -> String {
    "server-initializer".to_string()
  }

  async fn after_routes(&self, router: AxumRouter, ctx: &AppContext) -> Result<AxumRouter> {
    use std::fs::File;
    use std::io::Read;

    /* let router = router.layer(
      ServiceBuilder::new()
        .layer(CorsLayer::very_permissive()),
    ); */

    let rr = router.clone();
    tokio::spawn(async move {
      let root_cert = File::open("certs/new/ca.pem").unwrap();
      let mut root_cert_vec = Vec::new();
      BufReader::new(root_cert).read_to_end(&mut root_cert_vec).expect("error reading cert file");

      let client_cert = File::open("certs/new/localhost.san.pem").unwrap();
      let mut client_cert_vec = Vec::new();
      BufReader::new(client_cert).read_to_end(&mut client_cert_vec).expect("error reading cert file");

      let client_key = File::open("certs/new/san-key.pem").unwrap();
      let mut client_key_vec = Vec::new();
      BufReader::new(client_key).read_to_end(&mut client_key_vec).expect("error reading key file");
      
      axum_server::bind_rustls(SocketAddr::from(([127, 0, 0, 1], 3500)), RustlsConfig::from_pem(client_cert_vec, client_key_vec).await.unwrap())
        .serve(rr.into_make_service())
        .await
        .unwrap();

      println!("https now served on localhost:3500");
    });

    let certs_dir = std::path::PathBuf::from_iter([std::env!("CARGO_MANIFEST_DIR"), "certs", "new"]);
    let cert = std::fs::read_to_string(certs_dir.join("localhost.san.pem"))?;
    let key = std::fs::read_to_string(certs_dir.join("san-key.pem"))?;

    let ctx = ctx.clone();
    tokio::spawn(async move {
      let identity = Identity::from_pem(cert, key);
      let tls = ServerTlsConfig::new().identity(identity);

      let server = CredentialServiceServer::new(CredentialServer::new(ctx).await);
      Server::builder()
        .tls_config(tls)
        .expect("gRPC server failed to setup TLS config")
        .add_service(server)
        .serve(SocketAddr::from(([127, 0, 0, 1], 25567)))
        .await
        .unwrap();

      println!("gRPC server listening on port 25567");
    });

    Ok(router)
  }
}

use signal_proto::v1::credential::{CredentialListDevicesParams, CredentialLoginBeginRequest, CredentialLoginBeginResponse, CredentialLoginFinishRequest, CredentialLoginFinishResponse, CredentialRegisterBeginResponse, CredentialRegisterFinishRequest, CredentialRegisterFinishResponse, CredentialResponse, CredentialRetrieveDeviceParams, CredentialRetrieveKeysParams, CredentialStoreDeviceParams, CredentialStoreKeysParams, OpaqueBatchRegisterBeginRequest, OpaqueBatchRegisterBeginRespose, OpaqueBatchRegisterFinishRequest, OpaqueBatchRegisterFinishResponse, OpaqueLoginBeginRequest, OpaqueLoginBeginResponse, OpaqueLoginFinishRequest, OpaqueLoginFinishResponse, OpaqueRegisterBeginRequest, OpaqueRegisterBeginResponse, OpaqueRegisterFinishRequest, OpaqueRegisterFinishResponse, credential_service_server::{CredentialService, CredentialServiceServer}};

use opaque_ke::argon2::Argon2;
use opaque_ke::ciphersuite::CipherSuite;
use opaque_ke::errors::{InternalError, ProtocolError};
use opaque_ke::ksf::Ksf;
use opaque_ke::rand::rngs::OsRng;
use opaque_ke::{CredentialFinalization, CredentialRequest, Identifiers, RegistrationRequest, ServerLogin, ServerLoginParameters, ServerRegistration, ServerSetup};

use base64::{engine::general_purpose as b64, Engine as _};
use generic_array::{ArrayLength, GenericArray};
use serde::{Deserialize, Serialize};
use tower::BoxError;
use mongodb::bson::doc;

use crate::{common::types::{OpaqueLoginState, OpaqueRegistrationRecord}, services::{MongoService, RedisService}};

type ServerResult<T> = Result<tonic::Response<T>, tonic::Status>;

const BASE64: b64::GeneralPurpose = b64::URL_SAFE_NO_PAD;

enum Error {
  Protocol {
    context: &'static str,
    error: ProtocolError,
  },
  Base64 {
    context: &'static str,
    error: base64::DecodeError,
  },
  Internal {
    context: &'static str,
    error: InternalError,
  },
}

fn from_base64_error(context: &'static str) -> impl Fn(base64::DecodeError) -> Error {
  move |error| Error::Base64 { context, error }
}

fn from_protocol_error(context: &'static str) -> impl Fn(ProtocolError) -> Error {
  move |error| Error::Protocol { context, error }
}

/* impl From<Error> for JsError {
  fn from(err: Error) -> Self {
    let msg = match err {
      Error::Protocol { context, error } => {
        format!("opaque protocol error at \"{}\"; {}", context, error)
      }
      Error::Base64 { context, error } => {
        format!("base64 decoding failed at \"{}\"; {}", context, error)
      }
      Error::Internal { context, error } => {
        format!("Internal error at \"{}\"; {}", context, error)
      }
    };
    JsError::new(&msg)
  }
} */

struct DefaultCipherSuite;

impl CipherSuite for DefaultCipherSuite {
  type OprfCs = opaque_ke::Ristretto255;
  type KeyExchange = opaque_ke::TripleDh<opaque_ke::Ristretto255, sha2::Sha512>;
  type Ksf = CustomKsf;
}

#[derive(Default)]
struct CustomKsf {
  argon: Argon2<'static>,
}

impl Ksf for CustomKsf {
  fn hash<L: ArrayLength<u8>>(
    &self,
    input: GenericArray<u8, L>,
  ) -> Result<GenericArray<u8, L>, InternalError> {
    let mut output = GenericArray::default();
    self.argon
      .hash_password_into(&input, &[0; argon2::RECOMMENDED_SALT_LEN], &mut output)
      .map_err(|_| InternalError::KsfError)?;
    Ok(output)
  }
}

#[derive(Clone)]
struct State {
  server_setup: String,
  is_server_setup: bool,
  records: HashMap<String, String>,
}

pub struct CredentialServer {
  ctx: Arc<AppContext>,
  mongo: Arc<mongodb::Client>,
  server_setup: Arc<RwLock<Option<String>>>,
  is_server_setup: Arc<RwLock<bool>>,
  records: Arc<RwLock<HashMap<String, String>>>,
  logins: Arc<RwLock<HashMap<String, String>>>,
}

fn base64_decode<T: AsRef<[u8]>>(context: &'static str, input: T) -> Result<Vec<u8>, BoxError> {
  Ok(BASE64.decode(input).unwrap()) // .map_err(from_base64_error(context))
}

impl CredentialServer {
  pub async fn new(ctx: AppContext) -> Self {
    let mongo = MongoService::new().await.unwrap();
    Self {
      ctx: Arc::new(ctx),
      mongo: Arc::new(mongo.client.clone()),
      server_setup: Arc::new(RwLock::new(None)),
      is_server_setup: Arc::new(RwLock::new(false)),
      records: Arc::new(RwLock::new(HashMap::new())),
      logins: Arc::new(RwLock::new(HashMap::new())),
    }
  }

  fn create_server_setup(&self) -> String {
    let mut rng: OsRng = OsRng;
    let setup = ServerSetup::<DefaultCipherSuite>::new(&mut rng);
    BASE64.encode(setup.serialize())
  }
}

fn decode_server_setup(data: String) -> Result<ServerSetup<DefaultCipherSuite>, BoxError> {
  base64_decode("serverSetup", data).and_then(|bytes| {
    Ok(ServerSetup::<DefaultCipherSuite>::deserialize(&bytes).unwrap())
  })
}

pub fn get_server_public_key(data: String) -> Result<String, BoxError> {
  let server_setup = decode_server_setup(data)?;
  let pub_key = server_setup.keypair().public().serialize();
  Ok(BASE64.encode(pub_key))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CustomIdentifiers {
  client: Option<String>,
  server: Option<String>,
}

fn get_identifiers(idents: &Option<CustomIdentifiers>) -> Identifiers<'_> {
  Identifiers {
    client: idents
      .as_ref()
      .and_then(|idents| idents.client.as_ref().map(|val| val.as_bytes())),
    server: idents
      .as_ref()
      .and_then(|idents| idents.server.as_ref().map(|val| val.as_bytes())),
  }
}

#[derive(Debug, Serialize, Deserialize)]
enum KeyStretchingFunctionConfig {
  #[serde(rename = "rfc-recommended")]
  RfcRecommended,
  /// Deprecated: use `rfc-recommended` instead
  #[serde(rename = "rfc-draft-recommended")]
  RfcDraftRecommended,
  #[serde(rename = "memory-constrained")]
  MemoryConstrained,
  #[serde(rename = "argon2id-custom")]
  Custom {
    #[serde(rename = "iterations")]
    iterations: u32,
    #[serde(rename = "memory")]
    memory: u32,
    #[serde(rename = "parallelism")]
    parallelism: u32,
  },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateServerRegistrationResponseParams {
  #[serde(rename = "serverSetup")]
  server_setup: String,
  #[serde(rename = "userIdentifier")]
  user_identifier: String,
  #[serde(rename = "registrationRequest")]
  registration_request: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateServerRegistrationResponseResult {
  // #[serde(rename = "registrationResponse")]
  #[serde(rename = "registrationResponse")]
  registration_response: String,
}

pub fn create_server_registration_response(
  params: CreateServerRegistrationResponseParams,
) -> Result<CreateServerRegistrationResponseResult, BoxError> {
  let server_setup = decode_server_setup(params.server_setup)?;
  let registration_request_bytes =
    base64_decode("registrationRequest", params.registration_request)?;
  let server_registration_start_result = ServerRegistration::<DefaultCipherSuite>::start(
    &server_setup,
    RegistrationRequest::deserialize(&registration_request_bytes).unwrap(),
    params.user_identifier.as_bytes(),
  ).unwrap();
  let registration_response_bytes = server_registration_start_result.message.serialize();

  Ok(CreateServerRegistrationResponseResult {
    registration_response: BASE64.encode(registration_response_bytes),
  })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StartServerLoginParams {
  #[serde(rename = "serverSetup")]
  server_setup: String,
  #[serde(rename = "registrationRecord")]
  registration_record: Option<String>,
  #[serde(rename = "startLoginRequest")]
  start_login_request: String,
  #[serde(rename = "userIdentifier")]
  user_identifier: String,
  identifiers: Option<CustomIdentifiers>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StartServerLoginResult {
  #[serde(rename = "serverLoginState")]
  server_login_state: String,
  #[serde(rename = "loginResponse")]
  login_response: String,
}

pub fn start_server_login(
  params: StartServerLoginParams,
) -> Result<StartServerLoginResult, BoxError> {
  let server_setup = decode_server_setup(params.server_setup)?;
  let registration_record_bytes = match params.registration_record {
    Some(pw) => base64_decode("registrationRecord", pw).map(Some),
    None => Ok(None),
  }?;
  let credential_request_bytes = base64_decode("startLoginRequest", params.start_login_request)?;

  let mut rng: OsRng = OsRng;

  let registration_record = match registration_record_bytes.as_ref() {
    Some(bytes) => Some(
      ServerRegistration::<DefaultCipherSuite>::deserialize(bytes).unwrap(),
    ),
    None => None,
  };

  let start_params = ServerLoginParameters {
    identifiers: get_identifiers(&params.identifiers),
    context: None,
  };

  let server_login_start_result = ServerLogin::start(
    &mut rng,
    &server_setup,
    registration_record,
    CredentialRequest::deserialize(&credential_request_bytes).unwrap(),
    params.user_identifier.as_bytes(),
    start_params,
  ).unwrap();

  let login_response = BASE64.encode(server_login_start_result.message.serialize());
  let server_login_state = BASE64.encode(server_login_start_result.state.serialize());

  let result = StartServerLoginResult {
    server_login_state,
    login_response,
  };
  Ok(result)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FinishServerLoginParams {
  #[serde(rename = "serverLoginState")]
  server_login_state: String,
  #[serde(rename = "finishLoginRequest")]
  finish_login_request: String,
  identifiers: Option<CustomIdentifiers>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FinishServerLoginResult {
  #[serde(rename = "sessionKey")]
  session_key: String,
}

pub fn finish_server_login(
  params: FinishServerLoginParams,
) -> Result<FinishServerLoginResult, BoxError> {
  let credential_finalization_bytes = base64_decode("finishLoginRequest", params.finish_login_request)?;
  let state_bytes = base64_decode("serverLoginState", params.server_login_state)?;
  let state = ServerLogin::<DefaultCipherSuite>::deserialize(&state_bytes).unwrap();

  let finish_params = ServerLoginParameters {
    identifiers: get_identifiers(&params.identifiers),
    context: None,
  };

  let server_login_finish_result = state
    .finish(
      CredentialFinalization::deserialize(&credential_finalization_bytes).unwrap(),
      finish_params,
    ).unwrap();
  Ok(FinishServerLoginResult {
    session_key: BASE64.encode(server_login_finish_result.session_key),
  })
}

#[tonic::async_trait]
impl CredentialService for CredentialServer {
  async fn opaque_register_begin(&self, request: tonic::Request<OpaqueRegisterBeginRequest>) -> std::result::Result<
    tonic::Response<OpaqueRegisterBeginResponse>,
    tonic::Status,
  > {
    let pid = String::from(request.metadata().get("x-user-pid").unwrap().to_str().unwrap());
    tracing::debug!("[OPAQUE] register_begin: pid={}", &pid);
    let lock = self.is_server_setup.read().unwrap().clone();
    if !lock {
      {
        let mut lock = self.server_setup.write().unwrap();
        *lock = Some(self.create_server_setup());
      }
    }
    let server_setup = self.server_setup.read().unwrap().clone();
    let registration_response = create_server_registration_response(CreateServerRegistrationResponseParams {
      server_setup: server_setup.unwrap(),
      user_identifier: pid,
      registration_request: BASE64.encode(request.get_ref().registration_request.as_slice()),
    }).unwrap();

    Ok(tonic::Response::new(OpaqueRegisterBeginResponse {
      registration_response: registration_response.registration_response,
      server_setup: "".into(),
    }))
  }

  async fn opaque_register_finish(&self, request: tonic::Request<OpaqueRegisterFinishRequest>) -> std::result::Result<
    tonic::Response<OpaqueRegisterFinishResponse>,
    tonic::Status,
  > {
    let pid = String::from(request.metadata().get("x-user-pid").unwrap().to_str().unwrap());
    tracing::debug!("[OPAQUE] register_finish: pid={}", &pid);
    let registration_record = BASE64.encode(request.get_ref().registration_record.as_slice());
    {
      let mut lock = self.records.write().unwrap();
      lock.insert(pid.clone(), registration_record.clone());
    }
    {
      let mc = self.mongo.clone();
      let coll = mc.database("opqdb").collection::<OpaqueRegistrationRecord>("records");
      // let cc = coll.clone();
      tokio::spawn(async move {
        if coll.find_one(doc!{ "pid": &pid }).await.unwrap().is_none() {
          let mut rng: OsRng = OsRng;
          let mut salt = [0u8; 32];
          rng.fill_bytes(&mut salt);
          let salt = BASE64.encode(salt);
          coll.insert_one(OpaqueRegistrationRecord {
            id: uuid::Uuid::parse_str(&pid).unwrap(),
            pid,
            salt,
            registration_record: registration_record.clone(),
          }).await.unwrap();

          tracing::debug!("[MONGO] inserted new record successfully!");
        } else {
          coll.find_one_and_update(
            doc!{"pid": &pid},
            doc!{ "$set": {"registration_record": registration_record} },
          )
          .await
          .unwrap();
        }
      });
    }
    Ok(tonic::Response::new(OpaqueRegisterFinishResponse {
      status_code: 200,
      status: "Ok".into(),
      error: None,
    }))
  }

  async fn opaque_batch_register_begin(&self, request: tonic::Request<OpaqueBatchRegisterBeginRequest>) -> std::result::Result<
    tonic::Response<OpaqueBatchRegisterBeginRespose>,
    tonic::Status,
  > {
    let mut responses: Vec<OpaqueRegisterBeginResponse> = vec![];
    
    Ok(tonic::Response::new(OpaqueBatchRegisterBeginRespose {
      ..Default::default()
    }))
  }

  async fn opaque_batch_register_finish(&self, request: tonic::Request<OpaqueBatchRegisterFinishRequest>) -> std::result::Result<
    tonic::Response<OpaqueBatchRegisterFinishResponse>,
    tonic::Status,
  > {
    let mut responses: Vec<OpaqueRegisterFinishResponse> = vec![];
    Ok(tonic::Response::new(OpaqueBatchRegisterFinishResponse {
      ..Default::default()
    }))
  }

  async fn opaque_login_begin(&self, request: tonic::Request<OpaqueLoginBeginRequest>) -> std::result::Result<
    tonic::Response<OpaqueLoginBeginResponse>,
    tonic::Status,
  > {
    let pid = String::from(request.metadata().get("x-user-pid").unwrap().to_str().unwrap());
    tracing::debug!("[OPAQUE] login_begin: pid={}", &pid);
    let record = {
      let lock = self.records.read().unwrap();
      lock.get(&pid).unwrap().clone()
    };
    let record = {
      let coll = self.mongo.database("opqdb").collection::<OpaqueRegistrationRecord>("records");
      coll.find_one(doc!{ "pid": &pid }).await.unwrap().unwrap()
    };
    /* {
      if let Some(r) = self.ctx.shared_store.get::<RedisService>() {
        let mut cm = r.connection_manager;
        let cache_key = format!("opaque:{}:login_state", &pid);
        redis::pipe().json_set(&cache_key, "$", &record).unwrap().expire(&cache_key, 3600);
        // let _: () = cm.json_set(&cache_key, "$", &record).await.unwrap();
        // let _: () = cm.expire(&cache_key, 3600).await.unwrap();
      }
    } */
    tracing::debug!("[OPAQUE] found record: {:?}", &record);
    let registration_record = record.registration_record.clone();
    let login_response = start_server_login(StartServerLoginParams {
      server_setup: self.server_setup.read().unwrap().clone().unwrap(),
      registration_record: Some(registration_record),
      start_login_request: BASE64.encode(request.get_ref().start_login_request.as_slice()),
      user_identifier: pid.clone(),
      identifiers: Some(CustomIdentifiers { client: Some(pid.clone()), server: Some("server".into()) }),
    }).unwrap();
    let server_login_state = login_response.server_login_state.clone();
    tracing::debug!("[OPAQUE] new login: {}", &server_login_state);
    {
      let mut lock = self.logins.write().unwrap();
      lock.insert(pid.clone(), server_login_state.clone());
    }
    {
      let mc = self.mongo.clone();
      let coll = mc.database("opqdb").collection::<OpaqueLoginState>("logins");
      let cc = coll.clone();
      let login_state = OpaqueLoginState {
        id: uuid::Uuid::parse_str(&pid).unwrap(),
        pid: pid.clone(),
        state: server_login_state.clone(),
        timestamp: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
      };
      /* {
        let cache_key = format!("opaque:{}:login_state", &pid);
        redis::pipe().json_set(&cache_key, "$", &login_state).expect("failed to write login state to cache").expire(&cache_key, 3600);
        tracing::info!("state written to {cache_key}");
      } */
      {
        if let Some(r) = self.ctx.shared_store.get::<RedisService>() {
          let mut cm = r.connection_manager;
          let cache_key = format!("opaque:{}:login_state", &pid);
          // redis::pipe().json_set(&cache_key, "$", &record).unwrap().expire(&cache_key, 3600);
          let _: () = cm.json_set(&cache_key, "$", &login_state).await.unwrap();
          let _ = cm.expire(&cache_key, 120).await.unwrap();
        }
      }
      tokio::spawn(async move {
        cc.insert_one(login_state).await.unwrap();

        tracing::debug!("[MONGO] inserted new record successfully!");
      });
      /* if cc.find_one(doc!{ "pid": &pid }).await.unwrap().is_none() {
        tokio::spawn(async move {
          cc.insert_one(login_state).await.unwrap();

          tracing::debug!("[MONGO] inserted new record successfully!");
        });
      } else {
        cc.find_one_and_update(
          doc!{"pid": &pid},
          doc!{ "$set": {"state": server_login_state} },
        )
        .await
        .unwrap();
      } */
    }
    Ok(tonic::Response::new(OpaqueLoginBeginResponse {
      login_response: login_response.login_response,
      server_login_state: login_response.server_login_state,
    }))
  }

  async fn opaque_login_finish(&self, request: tonic::Request<OpaqueLoginFinishRequest>) -> std::result::Result<
    tonic::Response<OpaqueLoginFinishResponse>,
    tonic::Status,
  > {
    let pid = String::from(request.metadata().get("x-user-pid").unwrap().to_str().unwrap());
    tracing::debug!("[OPAQUE] login_finish: pid={}", &pid);
    let record = {
      let coll = self.mongo.database("opqdb").collection::<OpaqueRegistrationRecord>("records");
      coll.find_one(doc!{ "pid": &pid }).await.unwrap().unwrap()
    };
    /* let server_login_state = {
      let lock = self.logins.read().unwrap();
      lock.get(&pid).unwrap().clone()
    }; */
    let server_login_state = {
      if let Some(r) = self.ctx.shared_store.get::<RedisService>() {
        let mut cm = r.connection_manager;
        let cache_key = format!("opaque:{}:login_state", &pid);
        // redis::pipe().json_set(&cache_key, "$", &record).unwrap().expire(&cache_key, 3600);
        let value: String = cm.json_get(&cache_key, "$").await.unwrap();
        let logins: Vec<OpaqueLoginState> = serde_json::from_str(&value).unwrap();
        let login = logins.into_iter().last().unwrap();
        Some(login)
      } else {
        None
      }
    };
    let finish_response = finish_server_login(FinishServerLoginParams {
      server_login_state: server_login_state.unwrap().state.clone(),
      finish_login_request: BASE64.encode(request.get_ref().finish_login_request.as_slice()),
      identifiers: Some(CustomIdentifiers { client: Some(pid), server: Some("server".into()) }),
    }).unwrap();

    tracing::info!("[LoginFinished] session_key: {:#?}", finish_response);

    Ok(tonic::Response::new(OpaqueLoginFinishResponse {
      status_code: 200,
      status: "OK".into(),
      error: None,
      salt: BASE64.decode(record.salt).ok(),
    }))
  }

  async fn list_devices(&self, _request: tonic::Request<CredentialListDevicesParams>) -> std::result::Result<
    tonic::Response<CredentialResponse>,
    tonic::Status,
  > {
    unimplemented!("DO NOT CALL")
  }

  async fn login_begin(&self, _request: tonic::Request<CredentialLoginBeginRequest>) -> std::result::Result<
    tonic::Response<CredentialLoginBeginResponse>,
    tonic::Status,
  > {
    unimplemented!("DO NOT CALL")
  }

  async fn login_finish(&self, _request: tonic::Request<CredentialLoginFinishRequest>) -> std::result::Result<
    tonic::Response<CredentialLoginFinishResponse>,
    tonic::Status,
  > {
    unimplemented!("DO NOT CALL")
  }

  async fn register_begin(&self, _request: tonic::Request<()>) -> std::result::Result<
    tonic::Response<CredentialRegisterBeginResponse>,
    tonic::Status,
  > {
    unimplemented!("DO NOT CALL")
  }

  async fn register_finish(&self, _request: tonic::Request<CredentialRegisterFinishRequest>) -> std::result::Result<
    tonic::Response<CredentialRegisterFinishResponse>,
    tonic::Status,
  > {
    unimplemented!("DO NOT CALL")
  }

  async fn retrieve_device(&self, _request: tonic::Request<CredentialRetrieveDeviceParams>) -> std::result::Result<
    tonic::Response<CredentialResponse>,
    tonic::Status,
  > {
    unimplemented!("DO NOT CALL")
  }

  async fn retrieve_keys(&self, _request: tonic::Request<CredentialRetrieveKeysParams>) -> std::result::Result<
    tonic::Response<CredentialResponse>,
    tonic::Status,
  > {
    unimplemented!("DO NOT CALL")
  }

  async fn store_device(&self, _request: tonic::Request<CredentialStoreDeviceParams>) -> std::result::Result<
    tonic::Response<CredentialResponse>,
    tonic::Status,
  > {
    unimplemented!("DO NOT CALL")
  }

  async fn store_keys(&self, _request: tonic::Request<CredentialStoreKeysParams>) -> std::result::Result<
    tonic::Response<CredentialResponse>,
    tonic::Status,
  > {
    unimplemented!("DO NOT CALL")
  }

  async fn save_key(&self, _request: tonic::Request<CredentialStoreKeysParams>) -> std::result::Result<
    tonic::Response<CredentialResponse>,
    tonic::Status,
  > {
    unimplemented!("DO NOT CALL")
  }
}
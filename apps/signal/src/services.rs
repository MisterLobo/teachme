use std::{collections::HashMap, env, fs::{self, File}, io::BufReader, sync::Arc};

use apalis::prelude::*;
use apalis_codec::json::JsonCodec;
use apalis_nats::NatsJetStream;
use async_nats::{ConnectOptions, jetstream::context::Context};
use futures::SinkExt;
use rustls::{ClientConfig, RootCertStore};
use serde::{Deserialize, Serialize};
use socketioxide::SocketIo;
use tokio_cron_scheduler::JobScheduler;
use rustls_pemfile::{certs, pkcs8_private_keys};
use vaultrs::{api::{WrappedResponse, cubbyhole::requests::{GetSecretRequest, GetSecretRequestBuilder, SetSecretRequest, SetSecretRequestBuilder}, pki::requests::GenerateCertificateRequestBuilder, transit::{KeyType, requests::{CreateKeyRequest, CreateKeyRequestBuilder}}}, client::{VaultClient, VaultClientSettingsBuilder}, error::ClientError, kv2};
use mongodb::options::{ClientOptions, Tls};
use mongodb::Client;

use crate::common::types::OpaqueRegistrationRecord;

type ApalisNatsConfig = apalis_nats::Config<async_nats::jetstream::consumer::pull::Config>;

#[derive(Debug, Clone)]
pub struct TestClonableService;

#[derive(Debug)]
pub struct NonClonableService;

#[derive(Debug, Clone)]
pub struct StripeService {
  pub publishable_key: Option<String>,
  pub secret_key: Option<String>,
}

#[derive(Clone)]
pub struct CronService(pub JobScheduler);

#[derive(Debug, Clone)]
pub struct RealtimeService {
  pub socket: SocketIo,
}

#[derive(Debug, Clone)]
pub struct RedisService {
  pub client: redis::Client,
  pub connection_manager: redis::aio::ConnectionManager,
}

pub struct MongoService {
  pub client: Client,
}

impl MongoService {
  pub async fn new() -> Result<Self, BoxDynError> {
    let certs_dir = std::path::PathBuf::from_iter([std::env!("CARGO_MANIFEST_DIR"), "certs", "new"]);
    let ca = certs_dir.join("ca.pem");
    let ca = ca.to_str().unwrap();
    let cert_key = certs_dir.join("mongo.pem");
    let cert_key = cert_key.to_str().unwrap();

    let conn_str = env::var("MONGODB_URL").unwrap_or_default();

    // Parse options
    let client_options = ClientOptions::parse(conn_str).await?;
    tracing::debug!("[MONGO] client opts: {:?}", &client_options);

    let client = Client::with_options(client_options)?;
    /* let coll = client.database("opqdb").collection::<OpaqueRegistrationRecord>("records");

    let cc = coll.clone();
    tokio::spawn(async move {
      cc.insert_one(OpaqueRegistrationRecord {
        id: uuid::Uuid::now_v7(),
        pid: "test".into(),
        registration_record: "test".into(),
      }).await.unwrap();

      tracing::debug!("[MONGO] inserted new doc successfully!");
    }); */

    Ok(Self {
      client: client.clone(),
    })
  }
}

#[derive(Clone)]
pub struct EventService {
  pub client: async_nats::Client,
  pub worker: NatsJetStream<HashMap<String, String>, JsonCodec<Vec<u8>>, async_nats::jetstream::consumer::pull::Config>,
  pub jetstream: Context,
}

impl EventService {
  pub async fn new() -> Self {
    let nats_url = env::var("NATS_URL").unwrap_or_else(|_| "nats://localhost:4222".to_string());
    
    let tls_config = Self::get_client_config().await.unwrap();

    let client = async_nats::connect_with_options(
      nats_url,
      ConnectOptions::new()
      .tls_client_config(tls_config)
      .token(env::var("NATS_AUTH_TOKEN").unwrap())
      .tls_first()
    ).await.expect("NATS server unreachable");
    let jsclient = client.clone();

    let jetstream = async_nats::jetstream::new(jsclient.clone());

    let conf: ApalisNatsConfig = apalis_nats::Config::new("testone").with_pull_consumer();
    let mut worker = NatsJetStream::new(jsclient, conf).await;

    worker.send(Task::new(HashMap::new())).await.unwrap();

    println!("[NATS] listening for events");

    async fn send_test_nats(
      _: HashMap<String, String>,
      ctx: WorkerContext,
    ) -> Result<(), BoxDynError> {
      Ok(())
    }

    let ww = worker.clone();
    tokio::spawn(async move {
      let wrkr = WorkerBuilder::new("test-worker")
        .backend(ww)
        .concurrency(5)
        .data(10usize)
        .build(send_test_nats);

      wrkr.run().await.unwrap();
    });

    Self {
      client,
      worker,
      jetstream,
    }
  }
  async fn get_client_config() -> Result<ClientConfig, Box<dyn std::error::Error>> {
    let mut root_store = RootCertStore::empty();
    let mut ca_reader = BufReader::new(File::open("certs/new/ca.pem")?);
    for cert in certs(&mut ca_reader) {
      let _ = root_store.add(cert.unwrap().into());
    }

    let mut cert_reader = BufReader::new(File::open("certs/new/localhost.san.pem")?);
    let client_certs = certs(&mut cert_reader)
      .into_iter()
      .map(|c| c.unwrap().into())
      .collect();

    let mut key_reader = BufReader::new(File::open("certs/new/san-key.pk8.pem")?);
    let mut keys: Vec<_> = pkcs8_private_keys(&mut key_reader)
      .map(|k| k.unwrap())
      .collect();
    println!("{} keys", keys.len());
    let client_key = rustls::pki_types::PrivateKeyDer::Pkcs8(keys.remove(0));

    let tls_config = ClientConfig::builder()
      .with_root_certificates(root_store)
      .with_client_auth_cert(client_certs, client_key)
      .unwrap();

    Ok(tls_config)
  }
}

#[derive(Clone)]
pub struct VaultService {
  pub client: Arc<vaultrs::client::VaultClient>,
}
impl VaultService {
  pub fn new() -> Self {
    let cwd = env::current_dir().unwrap();
    let cwd = cwd.to_str().unwrap();
    let client = VaultClient::new(
      VaultClientSettingsBuilder::default()
        .ca_certs(vec![format!("{}/{}", cwd,  "certs/new/ca.pem")])
        .address("http://localhost:28300")
        .token("root_token")
        .build()
        .unwrap(), 
    ).unwrap();
    Self {
      client: Arc::new(client),
    }
  }
  pub async fn transit_key(&self, mount: String, key: String) -> Result<(), BoxDynError> {
    vaultrs::transit::key::create(
      &(*self.client),
      &mount,
      &key,
      Some(
        CreateKeyRequestBuilder::default()
          .derived(true)
          .key_type(KeyType::Aes256Gcm96)
          .auto_rotate_period("7d"),
      ),
    ).await?;

    Ok(())
  }
  pub async fn kvv2_set(&self, mount: String, path: String, key: String, value: String) -> Result<(), BoxDynError> {
    let secret = VaultSecret {
      key,
      value,
    };
    kv2::set(&(*self.client), &mount, &path, &secret).await?;

    Ok(())
  }
  pub async fn kvv2_read(&self, mount: String, path: String) -> Result<VaultSecret, BoxDynError> {
    let secret: VaultSecret = kv2::read(&(*self.client), &mount, &path).await?;
    Ok(secret)
  }
  pub async fn pki_gen_cert(&self, mount: String, role: String, cn: String, alt_names: Option<String>, ip_sans: Option<String>) -> Result<(String, String, String), BoxDynError> {
    let mut b = GenerateCertificateRequestBuilder::default();
    let cert = vaultrs::pki::cert::generate(&(*self.client), &mount, &role, Some(&mut b.common_name(cn)
      .alt_names(alt_names.unwrap_or_default())
      .ip_sans(ip_sans.unwrap_or_default())
    )).await?;

    Ok((cert.issuing_ca, cert.certificate, cert.private_key))
  }
  pub async fn wrapped_get_secret(&self, mount: String, path: String) -> Result<(), BoxDynError> {
    use vaultrs::api::ResponseWrapper;

    let endpoint = GetSecretRequestBuilder::default()
      .mount(&mount)
      .path(&path)
      .build()?;

    let wrap_resp: Result<WrappedResponse<GetSecretRequest>, ClientError> = endpoint.wrap(&(*self.client)).await;

    println!("[vault] wrapped: {}", wrap_resp.is_ok());

    Ok(())
  }
  pub async fn wrapped_set_secret(&self, mount: String, path: String) -> Result<(), BoxDynError> {
    use vaultrs::api::ResponseWrapper;

    let endpoint = SetSecretRequestBuilder::default()
      .mount(&mount)
      .path(&path)
      .build()?;

    let wrap_resp: Result<WrappedResponse<SetSecretRequest>, ClientError> = endpoint.wrap(&(*self.client)).await;

    println!("[vault] wrapped: {}", wrap_resp.is_ok());

    Ok(())
  }
}

#[derive(Deserialize, Serialize)]
pub struct VaultSecret {
  key: String,
  value: String,
}
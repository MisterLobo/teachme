pub mod types {
  use serde::{Deserialize, Serialize};
  use uuid::Uuid;

  #[derive(Clone, Deserialize, Serialize)]
  #[serde(rename_all = "camelCase")]
  pub struct EventPayload {
    pub user_id: Uuid,
    pub event: String,
    pub payload: serde_json::Value,
  }

  #[derive(Clone, Debug, Serialize, Deserialize)]
  pub struct OpaqueRegistrationRecord {
    pub id: uuid::Uuid,
    pub pid: String,
    pub registration_record: String,
    pub salt: String,
  }

  #[derive(Clone, Debug, Serialize, Deserialize)]
  pub struct OpaqueLoginState {
    pub id: uuid::Uuid,
    pub pid: String,
    pub state: String,
    pub timestamp: u64,
  }
}
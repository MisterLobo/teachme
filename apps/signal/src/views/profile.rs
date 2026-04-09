use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize, Serialize)]
pub enum ProfileResponseStatus {
  Success,
  Error,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProfileResonse {
  status: ProfileResponseStatus,
  data: Value,
}

impl ProfileResonse {
  pub fn new(data: Value, status: ProfileResponseStatus) -> Self {
    Self {
      status,
      data,
    }
  }
}

use chrono::{Duration, Local};
use loco_rs::model::ModelResult;
use sea_orm::{ActiveValue, TransactionTrait, entity::prelude::*};
use serde::{Deserialize, Serialize};
pub use super::_entities::credits::{ActiveModel, Model, Entity};
pub type Credits = Entity;
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreditParams {
    pub reference_id: Option<Uuid>,
    pub amount: Option<i32>,
    pub description: Option<String>,
    pub expiry: Option<DateTimeWithTimeZone>,
}

#[async_trait::async_trait]
impl ActiveModelBehavior for ActiveModel {
    async fn before_save<C>(self, _db: &C, insert: bool) -> std::result::Result<Self, DbErr>
    where
        C: ConnectionTrait,
    {
        if !insert && self.updated_at.is_unchanged() {
            let mut this = self;
            this.updated_at = sea_orm::ActiveValue::Set(chrono::Utc::now().into());
            Ok(this)
        } else {
            Ok(self)
        }
    }
}

// implement your read-oriented logic here
impl Model {
    pub async fn create(
        db: &DatabaseConnection,
        params: &CreditParams,
    ) -> ModelResult<Self> {
        let txn = db.begin().await?;

        let model = ActiveModel {
            id: ActiveValue::Set(params.reference_id.unwrap_or(Uuid::now_v7())),
            amount: ActiveValue::Set(Some(params.amount.clone().unwrap_or(5))),
            description: ActiveValue::Set(Some(params.description.clone().unwrap_or_default())),
            expires_at: ActiveValue::Set(Some(params.expiry.unwrap_or((Local::now() + Duration::days(30)).into()))),
            ..Default::default()
        }
        .insert(&txn)
        .await?;

        txn.commit().await?;

        Ok(model)
    }
}

// implement your write-oriented logic here
impl ActiveModel {}

// implement your custom finders, selectors oriented logic here
impl Entity {}

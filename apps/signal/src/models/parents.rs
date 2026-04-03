use loco_rs::{model::{ModelError, ModelResult}, prelude::*};
use sea_orm::{ActiveValue, TransactionTrait, entity::prelude::*};
use serde::{Deserialize, Serialize};
use crate::models::_entities::parents;

pub use super::_entities::parents::{ActiveModel, Model, Entity};
pub type Parents = Entity;

#[derive(Debug, Default, Deserialize, Serialize)]
pub struct CreateParams {
    #[serde(rename = "firstName")]
    pub first_name: String,
    #[serde(rename = "lastName")]
    pub last_name: String,
    pub country: String,
    pub city: Option<String>,
    pub currency: Option<String>,
    pub timezone: Option<String>,
    pub dob: Option<String>,
    pub bio: Option<String>,
    #[serde(rename = "primaryLanguage")]
    pub primary_language: Option<String>,
    pub category: Option<String>,
    pub subject: Option<String>,
    pub topic: Option<String>,
    #[serde(rename = "customerId")]
    pub customer_id: Uuid,
}

#[async_trait::async_trait]
impl ActiveModelBehavior for ActiveModel {
    async fn before_save<C>(self, _db: &C, insert: bool) -> std::result::Result<Self, DbErr>
    where
        C: ConnectionTrait,
    {
        if !insert && self.updated_at.is_unchanged() {
            let mut this = self;
            this.id = sea_orm::ActiveValue::Set(uuid::Uuid::now_v7());
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
        params: &CreateParams,
    ) -> ModelResult<Self> {
        let txn = db.begin().await?;

        let parent = ActiveModel {
            id: ActiveValue::Set(Uuid::now_v7()),
            first_name: ActiveValue::Set(params.first_name.clone()),
            last_name: ActiveValue::Set(params.last_name.clone()),
            ..Default::default()
        }
        .insert(&txn)
        .await?;

        txn.commit().await?;

        Ok(parent)
    }
    pub async fn find_by_customer(
        db: &DatabaseConnection,
        customer_id: &Uuid,
    ) -> ModelResult<Self> {
        let parent = parents::Entity::find()
            .filter(
                model::query::condition()
                    .eq(parents::Column::CustomerId, *customer_id)
                    .build()
            )
            .one(db)
            .await?;

        parent.ok_or(ModelError::EntityNotFound)
    }
}

// implement your write-oriented logic here
impl ActiveModel {}

// implement your custom finders, selectors oriented logic here
impl Entity {}

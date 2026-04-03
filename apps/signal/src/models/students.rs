use loco_rs::model::{self, ModelError, ModelResult};
use sea_orm::{ActiveValue, Condition, TransactionTrait, entity::prelude::*};
use serde::{Deserialize, Serialize};

use crate::models::_entities::students::{self, ActiveModel};

pub use super::_entities::students::{Model, Entity};
pub type Students = Entity;

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

#[derive(Debug, Default, Deserialize, Serialize)]
pub struct UpdateParams {
    #[serde(rename = "firstName")]
    pub first_name: String,
    #[serde(rename = "lastName")]
    pub last_name: String,
    pub country: Option<String>,
    pub currency: Option<String>,
    pub timezone: Option<String>,
    pub dob: Option<String>,
    pub bio: Option<String>,
    pub language: Option<String>,
    pub category: Option<String>,
    pub subject: Option<String>,
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

        let student = ActiveModel {
            id: ActiveValue::Set(Uuid::now_v7()),
            first_name: ActiveValue::Set(params.first_name.clone()),
            last_name: ActiveValue::Set(params.last_name.clone()),
            country: ActiveValue::Set(Some(params.country.clone())),
            currency: ActiveValue::Set(params.currency.clone()),
            language: ActiveValue::Set(params.primary_language.clone()),
            dob: ActiveValue::Set(None),
            locale: ActiveValue::Set(None),
            customer_id: ActiveValue::Set(Some(params.customer_id)),
            timezone: ActiveValue::Set(params.timezone.clone()),
            ..Default::default()
        }
        .insert(&txn)
        .await?;

        txn.commit().await?;

        Ok(student)
    }
    pub async fn find_by_customer(
        db: &DatabaseConnection,
        customer_id: &Uuid,
    ) -> ModelResult<Self> {
        let student = students::Entity::find()
            .filter(
                Condition::all()
                    .add(students::Column::CustomerId.eq(*customer_id))
            )
            .one(db)
            .await?;

        student.ok_or(ModelError::EntityNotFound)
    }
    pub async fn find_by_parent(
        db: &DatabaseConnection,
        parent_id: &Uuid,
    ) -> ModelResult<Self> {
        let student = students::Entity::find()
            .filter(
                model::query::condition()
                    .eq(students::Column::ParentId, *parent_id)
                    .build()
            )
            .one(db)
            .await?;

        student.ok_or(ModelError::EntityNotFound)
    }
}

// implement your write-oriented logic here
impl ActiveModel {
    pub async fn update_profile(
        mut self,
        db: &DatabaseConnection,
        params: &UpdateParams,
    ) -> ModelResult<Model> {
        self.update(db).await.map_err(ModelError::from)
    }
}

// implement your custom finders, selectors oriented logic here
impl Entity {}

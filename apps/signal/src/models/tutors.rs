use loco_rs::{model::{ModelError, ModelResult}, prelude::model};
use sea_orm::{TransactionTrait, entity::prelude::*};
use serde::{Deserialize, Serialize};
use crate::models::_entities::tutors;

pub use super::_entities::tutors::{ActiveModel, Model, Entity};
pub type Tutors = Entity;

#[derive(Debug, Default, Deserialize, Serialize)]
pub struct SearchParams {
    pub subject: Option<String>,
    pub topic: Option<String>,
    pub start_time: Option<DateTimeWithTimeZone>,
    pub duration_minutes: Option<i32>,
    pub session_price: Option<String>,
    pub characteristics: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateParams {
    pub first_name: String,
    pub last_name: String,
    pub country: String,
    pub city: Option<String>,
    pub currency: Option<String>,
    pub timezone: Option<String>,
    pub title: Option<String>,
    pub organization_id: Option<String>,
    pub dob: Option<String>,
    pub bio: Option<String>,
    pub primary_language: Option<String>,
    pub category: Option<String>,
    pub subject: Option<String>,
    pub topic: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct UpdateParams {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub country: Option<String>,
    pub city: Option<String>,
    pub currency: Option<String>,
    pub timezone: Option<String>,
    pub title: Option<String>,
    pub organization_id: Option<String>,
    pub dob: Option<String>,
    pub bio: Option<String>,
    pub primary_language: Option<String>,
    pub other_languages: Option<Vec<String>>,
    pub category: Option<String>,
    pub subject: Option<String>,
    pub topic: Option<String>,
    pub session_duration: Option<i32>,
    pub session_price: Option<f32>,
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
    pub async fn find_match(db: &DatabaseConnection, search_params: &SearchParams, search_params_embedding: Vec<f32>) -> ModelResult<Vec<Self>> {
        // db.query_all("stmt").await?;
        let tutors = tutors::Entity::find()
            .filter(
                model::query::condition()
                    .eq(tutors::Column::City, search_params.subject.as_ref().unwrap())
                    // .eq(tutors::Column::Embedding, PgVector::from(search_params_embedding))
                    .build(),
            )
            .all(db)
            .await?;
        Ok(tutors)
    }
}

// implement your write-oriented logic here
impl ActiveModel {}

// implement your custom finders, selectors oriented logic here
impl Entity {}

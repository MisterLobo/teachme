use loco_rs::model::ModelResult;
use sea_orm::{ActiveValue, TransactionTrait, entity::prelude::*};
use serde::{Deserialize, Serialize};
pub use super::_entities::tutor_reviews::{ActiveModel, Model, Entity};
pub type TutorReviews = Entity;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateReviewParams {
    pub tutor_id: Uuid,
    pub reviewer_id: Uuid,
    pub reviewer_type: String,
    pub comments: Option<String>,
    pub rating_stars: Option<i32>,
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
        params: &CreateReviewParams,
    ) -> ModelResult<Self> {
        let txn = db.begin().await?;

        let row = ActiveModel {
            tutor_id: ActiveValue::Set(params.tutor_id.clone()),
            reviewer_id: ActiveValue::Set(params.reviewer_id.clone()),
            reviewer_type: ActiveValue::Set(params.reviewer_type.clone()),
            comments: ActiveValue::Set(params.comments.clone()),
            rating_stars: ActiveValue::Set(params.rating_stars.clone()),
            ..Default::default()
        }
        .insert(&txn)
        .await?;

        txn.commit().await?;

        Ok(row)
    }
}

// implement your write-oriented logic here
impl ActiveModel {}

// implement your custom finders, selectors oriented logic here
impl Entity {}

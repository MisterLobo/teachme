use loco_rs::model::ModelResult;
use sea_orm::{ActiveValue, TransactionTrait, entity::prelude::*};
use serde::{Deserialize, Serialize};
pub use super::_entities::tutor_embeddings::{ActiveModel, Model, Entity};
pub type TutorEmbeddings = Entity;

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateParams {
    pub tutor_id: Uuid,
    pub embedding: PgVector,
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
            this.updated_at = sea_orm::ActiveValue::Set(chrono::Utc::now().naive_utc());
            Ok(this)
        } else {
            Ok(self)
        }
    }
}

// implement your read-oriented logic here
impl Model {
}

// implement your write-oriented logic here
impl ActiveModel {
    pub async fn create_embedding(
        db: &DatabaseConnection,
        params: &CreateParams,
    ) -> ModelResult<()> {
        let txn = db.begin().await?;

        let tutor = ActiveModel {
            id: ActiveValue::Set(params.tutor_id),
            embedding: ActiveValue::Set(params.embedding.clone()),
            ..Default::default()
        }
        .insert(&txn)
        .await?;

        txn.commit().await?;

        Ok(())
    }
}

// implement your custom finders, selectors oriented logic here
impl Entity {}

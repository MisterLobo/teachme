use loco_rs::model::ModelResult;
use sea_orm::{ActiveValue, entity::prelude::*};
pub use super::_entities::tutorial_sessions::{ActiveModel, Model, Entity};
pub type TutorialSessions = Entity;

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
    pub async fn create_session(
        db: &DatabaseConnection,
    ) -> ModelResult<Self> {
        let row = ActiveModel {
            id: ActiveValue::Set(Uuid::now_v7()),
            ..Default::default()
        }
        .insert(db)
        .await?;
        Ok(row)
    }
}

// implement your write-oriented logic here
impl ActiveModel {}

// implement your custom finders, selectors oriented logic here
impl Entity {}

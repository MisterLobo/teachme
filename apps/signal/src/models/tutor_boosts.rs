use loco_rs::model::ModelResult;
use sea_orm::{ActiveValue, TransactionTrait, entity::prelude::*};
use serde::{Deserialize, Serialize};
pub use super::_entities::tutor_boosts::{ActiveModel, Model, Entity};
pub type TutorBoosts = Entity;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoostParams {
    pub tutor_id: Uuid,
    pub boost_start: Option<DateTimeWithTimeZone>,
    pub boost_end: Option<DateTimeWithTimeZone>,
    pub boost_duration: Option<i32>,
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
        params: &BoostParams,
    ) -> ModelResult<Self> {
        let txn = db.begin().await?;

        let row = ActiveModel {
            tutor_id: ActiveValue::set(params.tutor_id.clone()),
            boost_duration: ActiveValue::Set(params.boost_duration.clone()),
            boost_start: ActiveValue::Set(params.boost_start.clone()),
            boost_end: ActiveValue::Set(params.boost_end.clone()),
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

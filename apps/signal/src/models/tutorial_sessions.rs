use loco_rs::model::ModelResult;
use sea_orm::{ActiveValue, IntoActiveModel, TransactionTrait, entity::prelude::*};
use serde::{Deserialize, Serialize};
pub use super::_entities::tutorial_sessions::{ActiveModel, Model, Entity};
pub type TutorialSessions = Entity;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSesssionParams {
    pub tutor_id: Uuid,
    pub student_id: Uuid,
    pub appointment_id: Uuid,
    pub session_id: String,
    pub session_link: Option<String>,
    pub session_length_secs: Option<i32>,
    pub tenant_id: Uuid,
    pub secret:  String,
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
    pub async fn create_session(
        db: &DatabaseConnection,
        params: &CreateSesssionParams,
    ) -> ModelResult<Self> {
        let txn = db.begin().await?;

        let row = ActiveModel {
            tenant_id: ActiveValue::Set(params.tenant_id.clone()),
            appointment_id: ActiveValue::Set(params.appointment_id.clone()),
            tutor_id: ActiveValue::Set(params.tutor_id.clone()),
            student_id: ActiveValue::Set(params.student_id.clone()),
            session_id: ActiveValue::Set(params.session_id.clone()),
            session_link: ActiveValue::Set(None),
            session_length_secs: ActiveValue::Set(None),
            secret: ActiveValue::Set(params.secret.clone()),
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

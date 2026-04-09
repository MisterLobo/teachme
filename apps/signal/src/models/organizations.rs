use loco_rs::model::{ModelError, ModelResult};
use sea_orm::{Condition, entity::prelude::*};
use serde::{Deserialize, Serialize};

pub use super::_entities::organizations::{ActiveModel, Column, Model, Entity};
pub type Organizations = Entity;

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateParams {
    pub name: String,
    #[serde(rename = "contactEmail")]
    pub contact_email: Option<String>,
    pub country: Option<String>,
    pub city: Option<String>,
    pub currency: Option<String>,
    pub timezone: Option<String>,
    pub title: Option<String>,
    #[serde(rename = "primaryLanguage")]
    pub primary_language: Option<String>,
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
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
    pub async fn find_by_tenant(db: &DatabaseConnection, id: &Uuid) -> ModelResult<Self> {
        let tutor = Entity::find()
            .filter(
                Condition::all()
                    .add(Column::TenantId.eq(*id))
            )
            .one(db)
            .await?;
        tutor.ok_or(ModelError::EntityNotFound)
    }
}

// implement your write-oriented logic here
impl ActiveModel {}

// implement your custom finders, selectors oriented logic here
impl Entity {}

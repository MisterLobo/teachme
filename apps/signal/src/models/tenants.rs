use loco_rs::model::{self, ModelError, ModelResult};
use sea_orm::{ActiveValue, FromJsonQueryResult, FromQueryResult, TransactionTrait, entity::prelude::*};
use serde::{Deserialize, Serialize};
use crate::models::{_entities::{sea_orm_active_enums::TenantType, tenants}, users};

pub use super::_entities::tenants::{ActiveModel, Model, Entity};
pub type Tenants = Entity;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TenantParams {
    #[serde(rename = "ownerId")]
    pub owner_id: Uuid,
    #[serde(rename = "tenantType")]
    pub tenant_type: TenantType,
    pub name: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq, FromQueryResult)]
pub struct TenantPid {
    pub id: Uuid,
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
    pub async fn find_by_user(
        db: &DatabaseConnection,
        user_id: &Uuid,
    ) -> ModelResult<Option<Self>> {
        let tenant = tenants::Entity::find()
            .filter(
                model::query::condition()
                    .eq(tenants::Column::OwnerId, user_id.clone())
                    .build(),
            )
            .one(db)
            .await?;

        Ok(tenant)
    }

    pub async fn find_by_id(
        db: &DatabaseConnection,
        id: &Uuid,
    ) -> ModelResult<Option<Self>> {
        let model = Entity::find_by_id(*id).one(db).await?;
        Ok(model)
    }

    pub async fn create(
        db: &DatabaseConnection,
        params: &TenantParams,
    ) -> ModelResult<Self> {
        let txn = db.begin().await?;

        let tenant = tenants::ActiveModel {
            id: ActiveValue::Set(Uuid::now_v7()),
            owner_id: ActiveValue::Set(params.owner_id),
            name: match params.tenant_type {
                TenantType::Individual => ActiveValue::Set("Personal".into()),
                TenantType::Organization => ActiveValue::Set(params.name.clone().unwrap_or_default()),
            },
            tenant_type: ActiveValue::Set(params.tenant_type),
            ..Default::default()
        }
        .insert(&txn)
        .await?;

        txn.commit().await?;
        Ok(tenant)
    }
}

// implement your write-oriented logic here
impl ActiveModel {}

// implement your custom finders, selectors oriented logic here
impl Entity {
    pub async fn get_pid(
        db: &DatabaseConnection,
        id: &Uuid,
    ) -> ModelResult<TenantPid> {
        let Some((tenant, user)) = Self::find_by_id(*id)
            .find_with_related(users::Entity)
            .into_json()
            .one(db)
            .await? else {
                return Err(ModelError::EntityNotFound);
            };
        let Some(user) = user else {
            return Err(ModelError::EntityNotFound);
        };
        tracing::debug!("tenant: {:?}", &tenant);
        let model: TenantPid = serde_json::from_value(tenant).unwrap();
        tracing::debug!("user: {:?}", &user);
        Ok(model)
    }
}

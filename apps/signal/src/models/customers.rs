use loco_rs::{model::{ModelError, ModelResult}, prelude::model};
use sea_orm::{ActiveValue, FromJsonQueryResult, FromQueryResult, TransactionTrait, entity::prelude::*};
use serde::{Deserialize, Serialize};

use crate::models::{_entities::{customers, sea_orm_active_enums::CustomerType}, users};

pub use super::_entities::customers::{ActiveModel, Model, Entity};
pub type Customers = Entity;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerParams {
    #[serde(rename = "userId")]
    pub user_id: Uuid,
    #[serde(rename = "customerType")]
    pub customer_type: CustomerType,
    pub name: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub enum Customer {
    Student(StripeCustomerParams),
    Parent(StripeCustomerParams),
}

#[derive(Debug, Deserialize, Serialize)]
pub struct StripeCustomerParams {
    pub email: String,
    pub name: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ApiResponseModel {}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq, DerivePartialModel, FromQueryResult)]
#[sea_orm(entity = "customers::Entity")]
pub struct CustomerPid {
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
    ) -> ModelResult<Self> {
        let tenant = customers::Entity::find()
            .filter(
                model::query::condition()
                    .eq(customers::Column::Id, user_id.clone())
                    .build(),
            )
            .one(db)
            .await?;

        tenant.ok_or(ModelError::EntityNotFound)
    }

    pub async fn create(
        db: &DatabaseConnection,
        params: &CustomerParams,
    ) -> ModelResult<Self> {
        let txn = db.begin().await?;

        let customer = ActiveModel {
            id: ActiveValue::Set(params.user_id.clone()),
            customer_type: ActiveValue::Set(params.customer_type),
            reference_id: ActiveValue::Set(params.user_id.clone()),
            user_id: ActiveValue::Set(Some(params.user_id)),
            plan: ActiveValue::Set(Some("trial".into())),
            status: ActiveValue::Set("active".into()),
            ..Default::default()
        }
        .insert(&txn)
        .await?;

        txn.commit().await?;
        Ok(customer)
    }
}

// implement your write-oriented logic here
impl ActiveModel {}

// implement your custom finders, selectors oriented logic here
impl Entity {
    pub async fn get_pid(
        db: &DatabaseConnection,
        id: &Uuid,
    ) -> ModelResult<CustomerPid> {
        let Some(customer) = Entity::find_by_id(*id)
            .left_join(users::Entity)
            .into_model::<CustomerPid>()
            .one(db)
            .await
            .expect("customers query error") else {
                return Err(ModelError::EntityNotFound);
            };
        tracing::debug!("pid: {:?}", &customer);
        Ok(customer)
    }
}

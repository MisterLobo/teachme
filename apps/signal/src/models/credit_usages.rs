use loco_rs::model::ModelResult;
use sea_orm::{ActiveValue, FromQueryResult, TransactionTrait, entity::prelude::*};
use serde::{Deserialize, Serialize};
use crate::models::_entities::sea_orm_active_enums::CreditStatus;

pub use super::_entities::credit_usages::{ActiveModel, Model, Entity};
pub type CreditUsages = Entity;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UseCreditParams {
    pub user: Uuid,
    pub amount: i32,
    pub purpose: Option<String>,
    pub status: CreditStatus,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, FromQueryResult)]
#[sea_orm(entity = "credit_usages::Entity")]
pub struct CreditUsage {
    pub amount: Option<i32>,
    pub purpose: Option<String>,
    #[sea_orm(nested)]
    pub user: crate::models::users::NamedUser,
}

#[derive(DeriveIden, Clone)]
pub enum Iden {
    Base,
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
    pub async fn create(
        db: &DatabaseConnection,
        params: &UseCreditParams,
    ) -> ModelResult<Self> {
        tracing::info!("new credits: {:#?}", &params);
        let txn = db.begin().await?;

        let m = ActiveModel {
            id: ActiveValue::Set(Uuid::now_v7()),
            user: ActiveValue::Set(params.user.clone()),
            amount: ActiveValue::Set(params.amount),
            purpose: ActiveValue::Set(params.purpose.clone()),
            status: ActiveValue::Set(params.status),
            ..Default::default()
        }
            .insert(&txn)
            .await?;

        txn.commit().await?;

        Ok(m)
    }
}

// implement your write-oriented logic here
impl ActiveModel {}

// implement your custom finders, selectors oriented logic here
impl Entity {}

use loco_rs::{model::{ModelError, ModelResult}, prelude::model};
use sea_orm::{ActiveValue, FromQueryResult, IntoActiveModel, TransactionTrait, entity::prelude::*};
use serde::{Deserialize, Serialize};
use crate::models::_entities::{appointments, transactions};

pub use super::_entities::transactions::{ActiveModel, Model, Entity};
pub type Transactions = Entity;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionParams {
    pub initiated_at: Option<DateTimeWithTimeZone>,
    pub completed_at: Option<DateTimeWithTimeZone>,
    pub status: Option<String>,
    pub appointment_id: Option<Uuid>,
    pub purpose: Option<String>,
    pub stripe_payment_intent_id: Option<String>,
    pub stripe_invoice_id: Option<String>,
    pub tenant_id: Option<Uuid>,
    pub biller: Option<Uuid>,
    pub billed_to: Option<Uuid>,
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
        params: &TransactionParams,
    ) -> ModelResult<Self> {
        let txn = db.begin().await?;

        let row = ActiveModel {
            id: ActiveValue::Set(Uuid::now_v7()),
            initiated_at: ActiveValue::Set(params.initiated_at.clone()),
            completed_at: ActiveValue::Set(params.completed_at.clone()),
            status: ActiveValue::Set(params.status.clone()),
            appointment_id: ActiveValue::Set(params.appointment_id.clone()),
            purpose: ActiveValue::Set(params.purpose.clone()),
            stripe_payment_intent_id: ActiveValue::Set(params.stripe_payment_intent_id.clone()),
            stripe_invoice_id: ActiveValue::Set(params.stripe_invoice_id.clone()),
            biller: ActiveValue::Set(params.biller.clone()),
            billed_to: ActiveValue::Set(params.billed_to.clone()),
            ..Default::default()
        }
        .insert(&txn)
        .await?;

        txn.commit().await?;

        Ok(row)
    }
}

// implement your write-oriented logic here
impl ActiveModel {
    pub async fn update_status(
        db: &DatabaseConnection,
        id: &Uuid,
        status: Option<String>,
    ) -> ModelResult<Self> {
        let txn = db.begin().await?;

        let m = ActiveModel {
            id: ActiveValue::Unchanged(*id),
            status: ActiveValue::Set(status),
            ..Default::default()
        }
            .save(&txn)
            .await?;

        txn.commit().await?;
        Ok(m)
    }
    pub async fn update_by_appointment(
        db: &DatabaseConnection,
        appt_id: &Uuid,
        stripe_invoice: Option<String>,
        stripe_payment: Option<String>,
        status: Option<String>,
    ) -> ModelResult<Self> {
        let Some(model) = Entity::find()
            .filter(transactions::Column::AppointmentId.eq(*appt_id))
            .one(db)
            .await? else {
                return Err(ModelError::EntityNotFound);
            };
        tracing::info!("[update_by_appointment] id: {:?}", &model.id);

        let txn = db.begin().await?;

        let mut am = ActiveModel {
            id: ActiveValue::Unchanged(model.id),
            status: ActiveValue::Set(status),
            ..Default::default()
        };

        if stripe_invoice.is_some() {
            am.stripe_invoice_id = ActiveValue::Set(stripe_invoice);
        }

        if stripe_payment.is_some() {
            am.stripe_payment_intent_id = ActiveValue::Set(stripe_payment);
        }

        let m = am.save(&txn).await?;

        txn.commit().await?;
        tracing::info!("[update_by_appointment] saved: {:#?}", &m);
        Ok(m)
    }
    pub async fn update(
        db: &DatabaseConnection,
        id: &Uuid,
        params: &TransactionParams,
    ) -> ModelResult<Self> {
        let txn = db.begin().await?;

        let m = ActiveModel {
            id: ActiveValue::Unchanged(*id),
            status: ActiveValue::Set(params.status.clone()),
            stripe_payment_intent_id: ActiveValue::Set(params.stripe_payment_intent_id.clone()),
            stripe_invoice_id: ActiveValue::Set(params.stripe_invoice_id.clone()),
            ..Default::default()
        }
            .save(&txn)
            .await?;

        txn.commit().await?;
        Ok(m)
    }
}

// implement your custom finders, selectors oriented logic here
impl Entity {}

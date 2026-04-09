use loco_rs::model::ModelResult;
use sea_orm::{ActiveValue, FromJsonQueryResult, TransactionTrait, entity::prelude::*};
use serde::{Deserialize, Serialize};
pub use super::_entities::subscriptions::{ActiveModel, Model, Entity};
pub type Subscriptions = Entity;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub enum SubscriptionType {
    None,
    Trial,
    Basic,
    Premium,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub enum SubscriptionPlan {
    Basic,
    Pro,
    Premium,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, FromJsonQueryResult, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UnlockedFeatures {
    full: bool,
    assistant: Option<bool>,
    smart_search: Option<bool>,
    boost_ranking: Option<bool>,
    review_session_recordings: Option<bool>,
    generate_transcripts: Option<bool>,
    org_size: Option<usize>,
    trial_credits: Option<u8>,
    trial_days: Option<u32>,
}

impl UnlockedFeatures {
    pub fn none() -> Self {
        Self::default()
    }
    pub fn basic() -> Self {
        Self {
            full: false,
            assistant: Some(true),
            ..Default::default()
        }
    }
    pub fn trial() -> Self {
        Self {
            full: true,
            trial_credits: Some(5),
            trial_days: Some(30),
            ..Default::default()
        }
    }
    pub fn full() -> Self {
        Self {
            full: true,
            ..Default::default()
        }
    }
    pub fn assistant(self, enabled: bool) -> Self {
        let mut s = self;
        s.assistant = Some(enabled);
        s
    }
    pub fn smart_search(self, enabled: bool) -> Self {
        let mut s = self;
        s.smart_search = Some(enabled);
        s
    }
    pub fn boost_ranking(self, enabled: bool) -> Self {
        let mut s = self;
        s.boost_ranking = Some(enabled);
        s
    }
    pub fn review_session_recordings(self, enabled: bool) -> Self {
        let mut s = self;
        s.review_session_recordings = Some(enabled);
        s
    }
    pub fn generate_transcripts(self, enabled: bool) -> Self {
        let mut s = self;
        s.generate_transcripts = Some(enabled);
        s
    }
    pub fn org_size(self, size: usize) -> Self {
        let mut s = self;
        s.org_size = Some(size);
        s
    }
    pub fn trial_credits(self, amount: u8) -> Self {
        let mut s = self;
        s.trial_credits = Some(amount);
        s
    }
    pub fn trial_days(self, days: u32) -> Self {
        let mut s = self;
        s.trial_days = Some(days);
        s
    }
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct StripeMetadata {
    pub customer_id: Option<String>,
    pub subscription_id: Option<String>,
    pub price_id: Option<String>,
    pub product_id: Option<String>,
    pub plan: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSubscriptionParams {
    pub subscriber_id: Uuid,
    pub stripe_metadata: StripeMetadata,
    pub plan: SubscriptionPlan,
    pub sub_type: SubscriptionType,
    pub features: UnlockedFeatures,
    pub status: String,
    pub is_trial: bool,
    pub trial_starts_at: Option<DateTimeWithTimeZone>,
    pub trial_ends_at: Option<DateTimeWithTimeZone>,
    pub trial_duration: Option<i32>,
    pub tenant_id: Option<Uuid>,
    pub period_starts_at: Option<DateTimeWithTimeZone>,
    pub period_ends_at: Option<DateTimeWithTimeZone>,
    pub next_billing_at: Option<DateTimeWithTimeZone>,
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
        params: &CreateSubscriptionParams,
    ) -> ModelResult<Self> {
        let txn = db.begin().await?;

        let row = ActiveModel {
            id: ActiveValue::Set(params.subscriber_id.clone()),
            tenant_id: ActiveValue::Set(params.tenant_id.clone()),
            plan: ActiveValue::Set(params.stripe_metadata.plan.clone()),
            unlocked_features: ActiveValue::Set(Some(params.features.clone())),
            stripe_customer_id: ActiveValue::Set(params.stripe_metadata.customer_id.clone()),
            stripe_subscription_id: ActiveValue::Set(params.stripe_metadata.subscription_id.clone()),
            stripe_price_id: ActiveValue::Set(params.stripe_metadata.price_id.clone()),
            stripe_product_id: ActiveValue::Set(params.stripe_metadata.product_id.clone()),
            trial_active: ActiveValue::Set(Some(params.is_trial)),
            trial_duration: ActiveValue::Set(params.trial_duration.clone()),
            trial_starts_at: ActiveValue::Set(params.trial_starts_at.clone()),
            trial_ends_at: ActiveValue::Set(params.trial_ends_at.clone()),
            period_start: ActiveValue::Set(params.period_starts_at.clone()),
            period_end: ActiveValue::Set(params.period_ends_at.clone()),
            status: ActiveValue::Set(Some(params.status.clone())),
            next_billing_at: ActiveValue::Set(params.next_billing_at.clone()),
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

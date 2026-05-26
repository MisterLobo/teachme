use std::collections::HashMap;

use chrono::{Duration, Local, TimeZone};
use redis::{Commands, JsonCommands};
use serde::{Deserialize, Serialize};
use loco_rs::prelude::*;
use stripe_billing::subscription::{CreateSubscription, CreateSubscriptionItems};
use stripe_core::customer::{CreateCustomer, RetrieveCustomer, RetrieveCustomerReturned};
use stripe_product::{price::SearchPrice, product::{CreateProduct, CreateProductDefaultPriceData, CreateProductDefaultPriceDataRecurring, CreateProductDefaultPriceDataRecurringInterval}};
use stripe_shared::SubscriptionStatus;

use crate::{common::types::EventPayload, models::{credits::{self, CreditParams}, customers::StripeCustomerParams, subscriptions::{self, CreateSubscriptionParams, StripeMetadata, SubscriptionPlan, SubscriptionType, UnlockedFeatures}, users::{RoleWithId, UserRole}}, services::{EventService, RedisService, StripeService}};

pub struct Worker {
    pub ctx: AppContext,
}

#[derive(Deserialize, Debug, Serialize)]
pub struct WorkerArgs {
    pub pid: Uuid,
    pub customer_params: Option<StripeCustomerParams>,
    pub role_id: Option<RoleWithId>,
    pub plan: Option<SubscriptionPlan>,
    pub sub_type: Option<SubscriptionType>,
    pub features: Option<UnlockedFeatures>,
}

#[async_trait]
impl BackgroundWorker<WorkerArgs> for Worker {
    /// Creates a new instance of the Worker with the given application context.
    /// 
    /// This function is called when registering the worker with the queue system.
    /// 
    /// # Parameters
    /// * `ctx` - The application context containing shared resources
    fn build(ctx: &AppContext) -> Self {
        Self { ctx: ctx.clone() }
    }

    /// Returns the class name of the worker.
    /// 
    /// This name is used when enqueueing jobs and identifying the worker in logs.
    /// The implementation returns the struct name as a string.
    fn class_name() -> String {
        "CreateStripeSubscription".to_string()
    }

    /// Returns tags associated with this worker.
    /// 
    /// Tags can be used to filter which workers run during startup.
    /// The default implementation returns an empty vector (no tags).
    fn tags() -> Vec<String> {
        Vec::new()
    }
    
    /// Performs the actual work when a job is processed.
    /// 
    /// This is the main function that contains the worker's logic.
    /// It gets executed when a job is dequeued from the job queue.
    /// 
    /// # Returns
    /// * `Result<()>` - Ok if the job completed successfully, Err otherwise
    async fn perform(&self, args: WorkerArgs) -> Result<()> {
        if args.role_id.is_none() {
            return Ok(());
        }
        println!("=================CreateStripeSubscription=======================");
        let (subscriber_id, tenant_id) = if let Some(id) = args.role_id {
            match id {
                RoleWithId::Tenant(t) => (t, Some(t)),
                RoleWithId::Customer(c) => (c, None),
            }
        } else {
            (Uuid::now_v7(), None)
        };

        let keys = self.ctx.shared_store.get::<StripeService>().expect("could not load instance of StripeService");
        let secret = &keys.secret_key.ok_or("invalid".to_string()).expect("Failed to retrieve secret");

        let client = stripe::ClientBuilder::new(secret)
            .request_strategy(stripe::RequestStrategy::Retry(3))
            .build()
            .unwrap();

        let (name, email) = match args.customer_params {
            Some(params) => (params.name, params.email),
            None => ("".into(), "".into())
        };

        let mut md: HashMap<String, String> = HashMap::new();
        md.insert("uid".into(), subscriber_id.clone().to_string());
        let customer = CreateCustomer::new()
            .name(name)
            .email(email)
            .metadata(md)
            .send(&client)
            .await
            .expect("Failed to send request");

        let prices = SearchPrice::new("product:'Free Trial' AND active:'true' AND type:'recurring'")
            .expand(vec!["data.product".into()])
            .send(&client)
            .await
            .expect("Error sending request");
        let (prod_id, price_id) = if prices.data.is_empty() {
            let p = CreateProduct::new("Free Trial")
                .default_price_data(CreateProductDefaultPriceData {
                    currency: stripe_types::Currency::USD,
                    unit_amount: Some(0),
                    currency_options: None,
                    custom_unit_amount: None,
                    metadata: None,
                    recurring: Some(
                        CreateProductDefaultPriceDataRecurring::new(CreateProductDefaultPriceDataRecurringInterval::Month),
                    ),
                    tax_behavior: None,
                    unit_amount_decimal: None,
                })
                .expand(vec!["default_price".into()])
                .send(&client)
                .await
                .expect("Error sending request");
            (p.id.to_string(), p.default_price.unwrap().as_object().unwrap().id.to_string())
        } else {
            let price = prices.data.first().unwrap();
            (price.product.as_object().unwrap().id.to_string(), price.id.to_string())
        };

        let stripe_customer_id = customer.id.to_string();
        let subscription = CreateSubscription::new()
            .customer(stripe_customer_id.clone())
            .trial_period_days(30u32)
            .items(vec![
                CreateSubscriptionItems {
                    quantity: Some(1),
                    price: Some(price_id.clone()),
                    ..Default::default()
                }
            ])
            // .trial_from_plan(true)
            .send(&client)
            .await
            .expect("Error sending request");

        let plan = args.plan.unwrap_or(SubscriptionPlan::Basic);
        let sub_type = args.sub_type.unwrap_or(SubscriptionType::Trial);
        let features = args.features.unwrap_or(UnlockedFeatures::none());

        self.ctx.cache.insert(&format!("{}:stripe-customer", &args.pid), &stripe_customer_id).await.expect("Failed to cache data");

        self.ctx.cache.insert(&format!("{}:stripe-subscription", &args.pid), &subscription.id.to_string()).await.expect("Failed to cache data");

        // self.ctx.cache.insert(&format!("{}:features", &args.pid), &features).await.expect("Failed to cache data");

        if let Some(r) = self.ctx.shared_store.get::<RedisService>() {
            let mut con = r.client.get_connection().expect("Failed to create connection");
            let _: () = con.json_set(&format!("{}:features", &args.pid), "$", &serde_json::json!(&features)).expect("Error caching json");

            let _: () = con.set(&format!("{}:credits", &args.pid), 5).expect("error exec redis cmd");
        }

        let _ = self.ctx.cache.insert(&format!("{}:subscription:plan", &args.pid), &plan).await?;

        let _ = self.ctx.cache.insert(&format!("{}:subscription:type", &args.pid), &sub_type).await?;

        let sub = subscriptions::Model::create(
            &self.ctx.db,
            &CreateSubscriptionParams {
                stripe_metadata: StripeMetadata {
                    customer_id: Some(stripe_customer_id),
                    subscription_id: Some(subscription.id.to_string()),
                    plan: None,
                    price_id: Some(price_id),
                    product_id: Some(prod_id),
                },
                plan,
                sub_type,
                features: features.clone(),
                status: match subscription.status {
                    SubscriptionStatus::Active => "active".into(),
                    SubscriptionStatus::Canceled => "canceled".into(),
                    SubscriptionStatus::Incomplete => "incomplete".into(),
                    SubscriptionStatus::IncompleteExpired => "expired".into(),
                    SubscriptionStatus::PastDue => "past_due".into(),
                    SubscriptionStatus::Paused => "paused".into(),
                    SubscriptionStatus::Trialing => "trialing".into(),
                    SubscriptionStatus::Unpaid => "unpaid".into(),
                    _ => "unknown".into(),
                },
                subscriber_id: subscriber_id.clone(),
                is_trial: true,
                trial_starts_at: {
                    let trial_starts_at = chrono::DateTime::from_timestamp(subscription.trial_start.unwrap(), 0).unwrap_or_default();
                    Some(trial_starts_at.fixed_offset())
                },
                trial_ends_at: {
                    let trial_ends_at = chrono::DateTime::from_timestamp(subscription.trial_end.unwrap(), 0).unwrap_or_default();
                    Some(trial_ends_at.fixed_offset())
                },
                trial_duration: {
                    let days = features.trial_days.unwrap_or(30);
                    Some(days as i32)
                },
                tenant_id,
                next_billing_at: None,
                period_ends_at: None,
                period_starts_at: None,
            }
        )
        .await
        .expect("Error creating subscription");

        if let Some(EventService { jetstream, client: _, worker: _ }) = self.ctx.shared_store.get() {
            let event_payload = EventPayload {
                user_id: Uuid::now_v7(),
                event: "subscription.created".into(),
                payload: serde_json::json!({}),
            };
            let payload = serde_json::to_vec(&event_payload).unwrap();
            // let bytes = payload.as_slice();
            jetstream.publish("subscription.created", payload.into()).await.expect("Error publishing event");
        }

        let _ = self.ctx
            .cache
            .insert(
                &format!("{}:subscription_id", &args.pid.to_string()),
                &sub.id.to_string(),
            ).await?;

        /* let _ = self.ctx
            .cache
            .insert(
                &format!("{}:features", &args.pid.to_string()),
                &features,
            ).await?; */

        credits::Model::create(&self.ctx.db, &CreditParams {
            reference_id: Some(subscriber_id),
            amount: {
                let credits = features.trial_credits.unwrap_or(5);
                Some(credits as i32)
            },
            description: Some("Free trial credits".into()),
            expiry: (Local::now().fixed_offset() + Duration::days({
                let days = features.trial_days.unwrap_or(30);
                days as i64
            })).into(),
        })
        .await
        .expect("DB error");

        

        Ok(())
    }
}

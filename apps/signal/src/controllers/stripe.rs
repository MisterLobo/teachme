#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unnecessary_struct_initialization)]
#![allow(clippy::unused_async)]

use std::{env, str::FromStr};

use axum::{Json, body::{Body, Bytes}, http::HeaderMap};
use loco_rs::prelude::*;
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use stripe_connect::{account::RetrieveAccount, account_link::{CreateAccountLink, CreateAccountLinkCollectionOptions, CreateAccountLinkType}};
use stripe_webhook::{Event, EventData, EventObject};

use crate::{models::{tutors, users}, services::StripeService};

#[derive(Serialize)]
struct ResponseBody {
    pub status: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct RequestBody {
    pub event: StripeEvent,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct PaymentIntent {
    pub id: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Invoice {
    pub id: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Charge {
    pub id: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Customer {
    pub id: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Subscription {
    pub id: String,
    pub customer: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "type", content = "payload")]
pub enum StripeEvent {
    ChargeRefunded(Charge),
    CustomerCreated(Customer),
    CustomerSubscriptionCreated(Subscription),
    InvoicePaid(Invoice),
    InvoicePaymentSucceeded(Invoice),
    PaymentIntentCreated(PaymentIntent),
    PaymentIntentSucceeded(PaymentIntent),
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct AccountLinkResponse {
    pub url: String,
}

pub async fn webhook(
    headers: HeaderMap,
    State(ctx): State<AppContext>,
    Json(body): Json::<RequestBody>,
) -> Result<Response> {
    let signature = headers.get("Stripe-Signature").unwrap().to_str().unwrap();
    tracing::debug!("body: {:?}", &body);
    let secret = env::var("STRIPE_WEBHOOK_SECRET").unwrap_or_default();

    /* match stripe_webhook::Webhook::construct_event(&body, signature, &secret) {
        Ok(event) => {},
        Err(err) => {
            tracing::error!("Webhook signature verification failed: {err}");
        },
    } */

    let res = Response::builder()
        .status(StatusCode::OK)
        .body(Body::new(format::json(ResponseBody { status: "success".into() })?))?;

    Ok(res)
}

pub async fn payment_intent_created() -> Result<Response> {
    let cli = stripe::ClientBuilder::new("secret").build().unwrap();
    
    format::empty()
}

pub async fn payment_intent_succeeded() -> Result<Response> {
    format::empty()
}

pub async fn connect_account(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let tenant_id = auth.claims.claims.get("tenant_id");
    if tenant_id.is_none() {
        return unauthorized("access denied");
    }
    let tenant_id = Uuid::from_str(tenant_id.unwrap().as_str().unwrap()).unwrap();
    let data = tutors::Model::find_by_tenant(&ctx.db, &tenant_id).await?;

    if (&data.stripe_connect_id).is_none() {
        return not_found()
    }
    let account = data.stripe_connect_id.unwrap();
    
    let keys = ctx.shared_store.get::<StripeService>().expect("could not load instance of StripeService");
    let secret = &keys.secret_key.ok_or("invalid".to_string()).expect("Failed to retrieve secret");
    let client = stripe::ClientBuilder::new(secret)
        .request_strategy(stripe::RequestStrategy::Retry(3))
        .build()
        .unwrap();

    let app_url = env::var("APP_URL").unwrap_or_default();
    let api_url = env::var("API_GATEWAY_URL").unwrap_or_default();
    let return_url = format!("{app_url}/me");
    let refresh_url = format!("{app_url}/stripe/refresh-link");
    let link = CreateAccountLink::new(
        account.clone(),
        CreateAccountLinkType::AccountOnboarding,
    )
        .return_url(return_url)
        .refresh_url(refresh_url)
        .send(&client)
        .await
        .expect("Failed to create AccountLink");

    let link_url = link.url.clone();
    ctx.cache.insert(&format!("{}:accountLink", &account), &link_url).await?;

    format::json(AccountLinkResponse {
        url: link.url,
    })
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api/stripe/")
        .add("webhook", post(webhook))
        .add("payment_intent", post(payment_intent_created))
        .add("connect", post(connect_account))
}

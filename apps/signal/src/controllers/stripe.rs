#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unnecessary_struct_initialization)]
#![allow(clippy::unused_async)]

use std::{env, str::FromStr};

use axum::{Json, body::{Body, Bytes}, http::HeaderMap};
use chrono::Local;
use loco_rs::prelude::*;
use redis::{Commands, JsonCommands};
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use stripe_billing::invoice::RetrieveInvoice;
use stripe_connect::{account::RetrieveAccount, account_link::{CreateAccountLink, CreateAccountLinkCollectionOptions, CreateAccountLinkType}};
use stripe_core::{PaymentIntentStatus, payment_intent::RetrievePaymentIntent};
use stripe_shared::InvoiceStatus;
use stripe_webhook::{Event, EventData, EventObject};
use tokio::join;

use crate::{common::types::EventPayload, models::{_entities::{sea_orm_active_enums::{AppointmentStatus, CreditStatus}, students}, appointments, credit_usages::{self, UseCreditParams}, transactions::{self, TransactionParams}, tutors, users}, services::{EventService, RedisService, StripeService}};

#[derive(Serialize)]
struct ResponseBody {
    pub status: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestBody {
    pub event_id: String,
    pub event: StripeEvent,
    pub status: String,
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
    InvoiceCreated(Invoice),
    InvoicePaid(Invoice),
    InvoicePaymentSucceeded(Invoice),
    PaymentCanceled(PaymentIntent),
    PaymentCreated(PaymentIntent),
    PaymentFailed(PaymentIntent),
    PaymentProcessing(PaymentIntent),
    PaymentRequiresAction(PaymentIntent),
    PaymentSucceeded(PaymentIntent),
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct AccountLinkResponse {
    pub url: String,
}

async fn update_user_credits(
    ctx: AppContext,
    host: Option<Uuid>,
    attendee: Option<Uuid>,
) -> Result<()> {
    let Some(r) = ctx.shared_store.get::<RedisService>() else {
        return Ok(());
    };
    
    let mut con = r.client.get_connection().expect("Failed to create connection");

    if let Some(attendee) = attendee {
        let ent = students::Entity::get_pid(&ctx.db, &attendee).await.expect("err");
        tracing::debug!("student: {:?}", &ent);
        let credits = students::Entity::check_credits(&ctx.db, &attendee).await.expect("err");
        let amount = credits.amount.unwrap_or(0).max(0) as i64;
        let used = credits.used.unwrap_or(0).max(0);
        let remain = (amount - used).max(0);
        /* if remain == 0 {
            if let Some(service) = ctx.shared_store.get::<EventService>() {
                service.jetstream.publish("booking.error", serde_json::to_vec(&EventPayload { user_id: attendee, event: "booking.error".into(), payload: serde_json::json!({})}).unwrap().into()).await.expect("error sending message");
            }
        } */
        // let _: () = con.set(&format!("{}:credits", &pid), 5).expect("error exec redis cmd");
        let _: () = con.json_set(&format!("{}:credits", ent.pid), "$", &serde_json::json!({
            "amount": remain,
        })).expect("Error writing to cache");
    }

    if let Some(host) = host {
        let ent = tutors::Entity::get_pid(&ctx.db, &host).await.expect("err");
        tracing::debug!("tutor: {:?}", &ent);
        // let _: () = con.set(&format!("{}:credits", &pid), 5).expect("error exec redis cmd");
        let _: () = con.json_set(&format!("{}:credits", ent.pid), "$", &serde_json::json!({
            "amount": 5,
        })).expect("Error writing to cache");
    }
    Ok(())
}

pub async fn webhook(
    headers: HeaderMap,
    State(ctx): State<AppContext>,
    Json(body): Json::<RequestBody>,
) -> Result<Response> {
    let keys = ctx.shared_store.get::<StripeService>().expect("could not load instance of StripeService");
    let secret = &keys.secret_key.ok_or("invalid".to_string()).expect("Failed to retrieve secret");

    let client = stripe::ClientBuilder::new(secret)
        .request_strategy(stripe::RequestStrategy::Retry(3))
        .build()
        .unwrap();

    tracing::info!("event: {:?}", &body.event);
    match &body.event {
        StripeEvent::PaymentCreated(payment) => {
            tracing::debug!("payment.created: {:?}", &payment);
            let payment = RetrievePaymentIntent::new(payment.id.clone())
                .send(&client)
                .await
                .expect("Error sending request");

            tracing::debug!("payment.created: {:?}", &payment);

            let Some(apt) = payment.metadata.get("appointmentId") else {
                tracing::error!("payment not for appointment");
                return format::json(serde_json::json!({
                    "status": 400,
                    "error": "payment is not for appointment",
                }));
            };
            let id = Uuid::from_str(apt).unwrap();
            let Ok(appt) = appointments::Model::get_appointment(&ctx.db, &id).await else {
                tracing::error!("could not find appointment with id {id}");
                return format::json(serde_json::json!({
                    "status": 400,
                    "error": "could not find appointment with id {id}",
                }));
            };

            transactions::Model::create(
                &ctx.db,
                &TransactionParams {
                    initiated_at: Some(chrono::DateTime::from_timestamp(payment.created, 0).unwrap_or_default().fixed_offset()),
                    completed_at: None,
                    billed_to: None, // Some(Uuid::from_str(&payment.metadata.get("recipient").unwrap()).unwrap()),
                    biller: None,
                    stripe_payment_intent_id: Some(payment.id.to_string()),
                    status: match &payment.status {
                        PaymentIntentStatus::Succeeded => Some("succeeded".into()),
                        PaymentIntentStatus::Processing => Some("processing".into()),
                        PaymentIntentStatus::Canceled => Some("canceled".into()),
                        PaymentIntentStatus::RequiresPaymentMethod => Some("requires_payment_method".into()),
                        PaymentIntentStatus::RequiresAction => Some("requires_action".into()),
                        PaymentIntentStatus::RequiresCapture => Some("requires_capture".into()),
                        PaymentIntentStatus::RequiresConfirmation => Some("requires_confirmation".into()),
                        PaymentIntentStatus::Unknown(u) => Some(u.clone()),
                        _ => None,
                    },
                    appointment_id: Some(appt.id.clone()),
                    tenant_id: Some(appt.tenant_id.clone()),
                    ..Default::default()
                },
            ).await?;

            if payment.status == PaymentIntentStatus::Succeeded {
                let attendee_used_credit = UseCreditParams {
                    amount: 1,
                    purpose: Some("Booked appointment".into()),
                    status: CreditStatus::Success,
                    user: appt.attendee_id.clone(),
                };
                let host_used_credit = UseCreditParams {
                    amount: 1,
                    purpose: Some("Booked appointment".into()),
                    status: CreditStatus::Success,
                    user: appt.host_id.clone(),
                };
                let (appt_status, txn_status, credits_attendee, credits_host) = join!(
                    appointments::ActiveModel::update_status(
                        &ctx.db,
                        &appt.id,
                        AppointmentStatus::Confirmed,
                    ),
                    appointments::ActiveModel::update_status(
                        &ctx.db,
                        &appt.id,
                        AppointmentStatus::Confirmed,
                    ),
                    credit_usages::Model::create(&ctx.db, &attendee_used_credit),
                    credit_usages::Model::create(&ctx.db, &host_used_credit),
                );

                let _ = update_user_credits(
                    ctx.clone(),
                    Some(appt.host_id.clone()),
                    Some(appt.attendee_id.clone()),
                ).await?;
            }
        },
        StripeEvent::PaymentCanceled(payment) |
        StripeEvent::PaymentFailed(payment) |
        StripeEvent::PaymentProcessing(payment) |
        StripeEvent::PaymentRequiresAction(payment) => {
            let payment = RetrievePaymentIntent::new(payment.id.clone())
                .send(&client)
                .await
                .expect("Error sending request");

            tracing::debug!("payment.requires_action: {:#?}", &payment);
            let appointment = payment.metadata.get("appointmentId");
            let Some(appointment) = appointment else {
                tracing::error!("payment not for appointment");
                return format::json(serde_json::json!({
                    "status": 400,
                    "error": "payment not for appointment",
                }));
            };
            let id = Uuid::from_str(appointment).unwrap();
            let _ = appointments::Model::get_appointment(&ctx.db, &id).await?;

            transactions::ActiveModel::update_by_appointment(
                &ctx.db,
                &id,
                None,
                Some(payment.id.to_string()),
                Some(payment.status.as_str().to_string()),
            ).await?;
        },
        StripeEvent::PaymentSucceeded(payment) => {
            tracing::debug!("payment.succeeded: {:#?}", &payment);
            let payment = RetrievePaymentIntent::new(payment.id.clone())
                .send(&client)
                .await
                .expect("Error sending request");

            tracing::debug!("payment.succeeded: {:#?}", &payment);
            let appointment = payment.metadata.get("appointmentId");
            let Some(appointment) = appointment else {
                tracing::error!("payment not for appointment");
                return format::json(serde_json::json!({
                    "status": 400,
                    "error": "payment not for appointment",
                }));
            };
            let id = Uuid::from_str(appointment).unwrap();
            let appt = appointments::Model::get_appointment(&ctx.db, &id).await?;

            let attendee_used_credit = UseCreditParams {
                amount: 1,
                purpose: Some("Booked appointment".into()),
                status: CreditStatus::Success,
                user: appt.attendee_id.clone(),
            };
            let host_used_credit = UseCreditParams {
                amount: 1,
                purpose: Some("Booked appointment".into()),
                status: CreditStatus::Success,
                user: appt.host_id.clone(),
            };
            let (appt_status, txn_status, credits_attendee, credits_host) = join!(
                appointments::ActiveModel::update_status(
                    &ctx.db,
                    &appt.id,
                    AppointmentStatus::Confirmed,
                ),
                appointments::ActiveModel::update_status(
                    &ctx.db,
                    &appt.id,
                    AppointmentStatus::Confirmed,
                ),
                credit_usages::Model::create(&ctx.db, &attendee_used_credit),
                credit_usages::Model::create(&ctx.db, &host_used_credit),
            );
            if let Some(EventService { jetstream, client: _, worker: _ }) = ctx.shared_store.get() {
                jetstream.publish("payment.status", serde_json::to_vec(&EventPayload {
                    user_id: appt.attendee_id,
                    event: "payment.status".into(),
                    payload: serde_json::json!({}),
                }).unwrap().into()).await.expect("Could not send message");
            }
        },
        StripeEvent::InvoiceCreated(invoice) => {
            tracing::debug!("invoice.created: {:#?}", &invoice);
        },
        StripeEvent::InvoicePaid(invoice) => {
            tracing::debug!("invoice.paid: {:#?}", &invoice);
        },
        StripeEvent::InvoicePaymentSucceeded(invoice) => {},
        _ => {},
    }
    
    format::json(serde_json::json!({
        "status": 200,
        "message": "ok",
    }))
}

pub async fn payment_intent_created(
    State(ctx): State<AppContext>,
    Json(body): Json::<RequestBody>,
) -> Result<Response> {
    let keys = ctx.shared_store.get::<StripeService>().expect("could not load instance of StripeService");
    let secret = &keys.secret_key.ok_or("invalid".to_string()).expect("Failed to retrieve secret");

    let client = stripe::ClientBuilder::new(secret)
        .request_strategy(stripe::RequestStrategy::Retry(3))
        .build()
        .unwrap();

    match body.event {
        StripeEvent::PaymentCreated(p) => {
            let payment = RetrievePaymentIntent::new(p.id.clone())
                .send(&client)
                .await
                .expect("Error sending request");

            tracing::debug!("payment: {:?}", &payment);
        },
        _ => {},
    }
    
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

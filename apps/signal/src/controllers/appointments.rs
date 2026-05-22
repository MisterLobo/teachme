#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unnecessary_struct_initialization)]
#![allow(clippy::unused_async)]
use axum::{body::Body, http::{HeaderMap, HeaderValue}};
use loco_rs::prelude::*;
use redis::Commands;
use reqwest::{ClientBuilder, StatusCode};
use sea_orm::TryIntoModel;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::env;
use crate::{common::types::EventPayload, models::{_entities::sea_orm_active_enums::CustomerType, appointments::{self, AppointmentQueryParams, CreateParams, GetAppointmentParams}, customers, students, tenants, tutors, users}, services::{EventService, RedisService}};

#[derive(Debug, Deserialize, Serialize)]
pub struct AppointmentCreateResponse {
    id: Option<Uuid>,
}

#[debug_handler]
pub async fn index(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    params: Query<AppointmentQueryParams>,
) -> Result<Response> {
    let tenant_id = auth.claims.claims.get("tenant_id");
    let user_type = users::Model::get_user_type(&ctx.db, &auth.claims.pid).await;
    if tenant_id.as_ref().is_none() {
        return unauthorized("access denied");
    }
    tracing::debug!("{:?}: {:?}", &user_type, &tenant_id);
    let tenant_id: Uuid = serde_json::from_value(tenant_id.unwrap().clone()).unwrap();
    let data = appointments::Model::get_appointments(&ctx.db, &tenant_id, &user_type, &params).await?;

    /* let api_key = env::var("CAL_COM_API_KEY").unwrap_or_default();
    let org_slug = env::var("CAL_ORG_SLUG").unwrap_or_default();
    let cal_url = env::var("CAL_API_URL").unwrap_or_default();
    let cal_url = format!(
        "{cal_url}/organizations/{0}/teams/{1}/bookings",
        1,
        1,
    );
    let mut headers = HeaderMap::new();
    headers.insert("Authorization", HeaderValue::from_str(&format!("Bearer {api_key}")).unwrap());
    headers.insert("cal-api-version", HeaderValue::from_str("2024-09-04").unwrap());
    let client = ClientBuilder::new()
        .default_headers(headers)
        .build()
        .expect("error");

    use futures::stream::{self, StreamExt};

    let free_slots: Vec<Value> = stream::iter(data.past.iter().zip(data.upcoming.iter()))
        .map(|r| {
            let c = client.clone();
            let u = cal_url.clone();
            let o = org_slug.clone();
            let p = params.clone();
            async move {
                (
                    c.get(&u)
                        .query(&[
                            ("organizationSlug", &o),
                            ("timeZone", &p.timezone.clone().unwrap_or("Asia/Manila".into())),
                            ("start", &p.start_time.clone().unwrap().to_rfc3339()),
                            ("end", &end.to_rfc3339()),
                            ("teamSlug", &r.data.clone().unwrap_or_default().team.slug),
                            ("eventTypeSlug", &r.data.clone().unwrap_or_default().event_type.slug.clone().unwrap_or_default()),
                        ])
                        .send()
                        .await
                        .ok(),
                    r.clone(),
                )
            }
        })
        .buffer_unordered(10)
        .filter_map(|(res, tutor)| async {
            match res {
                Some(r) if r.status() == 200 => Some((r.json::<Value>().await.ok(), tutor)),
                _ => None,
            }
        })
        .map(|(a, b)| {
            let cal_res: CalApiResponse = serde_json::from_value(a.unwrap_or_default()).unwrap();
            serde_json::json!({
                "metadata": b,
                "availableSlots": cal_res.data,
            })
        })
        .collect()
        .await; */

    format::json(serde_json::json!({
        "data": data,
    }))
}

async fn get_by_id(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Path(params): Path::<GetAppointmentParams>,
) -> Result<Response> {
    let appt = appointments::Model::get_appointment(&ctx.db, &params.id).await?;

    format::json(appt.to_response())
}

#[debug_handler]
async fn create(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Json(body): Json<CreateParams>,
) -> Result<Response> {
    tracing::debug!("host_id: {:?}", &body.host_id);
    let tutor = tutors::Model::find_by_id(&ctx.db, &body.host_id).await?;
    if tutor.is_none() {
        let mut resp = Response::new(Body::empty());
        *resp.status_mut() = StatusCode::NOT_FOUND;
        return Ok(resp)
    }
    tracing::debug!("host found");
    let user = users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await?;
    let tenant = tenants::Model::find_by_id(&ctx.db, &tutor.unwrap().tenant_id).await?;
    if tenant.is_none() {
        let mut resp = Response::new(Body::empty());
        *resp.status_mut() = StatusCode::NOT_FOUND;
        return Ok(resp)
    }
    let tenant_id = tenant.unwrap().id;
    tracing::debug!("tenant found");
    let customer = customers::Model::find_by_user(&ctx.db, &user.id).await.ok();
    let r = if let Some(c) = customer {
        let appt_id = match c.customer_type {
            CustomerType::StudentLearner => {
                let student = students::Model::find_by_customer(&ctx.db, &c.id).await?;
                let ent = students::Entity::get_pid(&ctx.db, &student.id).await.expect("err");
                tracing::debug!("student: {:?}", &ent);
                let credits = students::Entity::check_credits(&ctx.db, &ent.pid).await.expect("err");
                let amount = credits.amount.unwrap_or(0).max(0) as i64;
                let used = credits.used.unwrap_or(0).max(0);
                let remain = (amount - used).max(0);
                if remain == 0 {
                    if let Some(service) = ctx.shared_store.get::<EventService>() {
                        service.jetstream.publish(
                            "booking.error",
                            serde_json::to_vec(&EventPayload {
                                user_id: ent.pid,
                                event: "booking.error".into(),
                                payload: serde_json::json!({
                                    "status": "error",
                                    "message": "not enough credits",
                                })
                            }).unwrap().into()
                        ).await.expect("error sending message");
                    }
                    return Ok(Response::builder()
                        .status(400)
                        .body(Body::empty())
                        .unwrap()
                        .into_response()
                    );
                }
                let appt = appointments::Model::create_appointment(
                    &ctx.db,
                    &body,
                    &tenant_id,
                    &student.id,
                ).await?;
                let appt_id = appt.try_into_model().unwrap().id;

                if let Some(EventService { jetstream, client: _, worker:_  }) = ctx.shared_store.get::<EventService>() {
                    let payload = EventPayload {
                        user_id: Uuid::parse_str(&auth.claims.pid).unwrap(),
                        event: "booking.created".into(),
                        payload: serde_json::json!({
                            "id": &appt_id,
                            "status": "created",
                        }),
                    };
                    let payload = serde_json::to_vec(&payload).unwrap();
                    jetstream.publish("booking.created", payload.into()).await.unwrap();
                }
                if let Some(RedisService { mut client, connection_manager: _ }) = ctx.shared_store.get::<RedisService>() {
                    let _: () = client.set_ex(&format!("{}:last_booking", &appt_id.to_string()), &appt_id.to_string(), 60).expect("error writing to cache");
                }

                // let _ = ctx.cache.insert(&format!("{}:booking_uid", &appt_id.to_string()), &body.cal_booking_id).await?;
                Some(appt_id)
            },
            CustomerType::ParentGuardian => {
                None
            },
            _ => None,
        };
        format::json(AppointmentCreateResponse {
            id: appt_id,
        })
    } else {
        let mut resp = Response::new(Body::empty());
        *resp.status_mut() = StatusCode::FORBIDDEN;
        Ok(resp)
    };
    r
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api/appointments/")
        .add("/", get(index))
        .add("/create", post(create))
        .add("/{id}", get(get_by_id))
}

#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unnecessary_struct_initialization)]
#![allow(clippy::unused_async)]
use axum::body::Body;
use loco_rs::prelude::*;
use reqwest::StatusCode;
use sea_orm::TryIntoModel;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::models::{_entities::sea_orm_active_enums::CustomerType, appointments::{self, AppointmentQueryParams, CreateParams}, customers, students, tenants, tutors, users};

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
    let user = users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await?;
    let tenant_id = auth.claims.claims.get("tenant_id");
    let user_type = users::Model::get_user_type(&ctx.db, &auth.claims.pid).await;
    if tenant_id.as_ref().is_none() {
        return unauthorized("access denied");
    }
    tracing::debug!("{:?}: {:?}", &user_type, &tenant_id);
    let tenant_id: Uuid = serde_json::from_value(tenant_id.unwrap().clone()).unwrap();
    let data = appointments::Model::get_appointments(&ctx.db, &tenant_id, &user_type, &params).await?;
    format::json(serde_json::json!({
        "data": data,
    }))
}

#[debug_handler]
async fn create(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Json(body): Json<CreateParams>,
) -> Result<Response> {
    // let tenant_id: Uuid = serde_json::from_value(auth.claims.claims.get("tenant_id").unwrap().clone()).unwrap();
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
                // tracing::debug!("attendee: {:?}, host: {:?}", &student.id, &tenant_id);
                let appt = appointments::Model::create_appointment(
                    &ctx.db,
                    &body,
                    &tenant_id,
                    &student.id,
                ).await?;
                Some(appt.try_into_model().unwrap().id)
                // None
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
}

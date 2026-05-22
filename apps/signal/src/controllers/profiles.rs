#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unnecessary_struct_initialization)]
#![allow(clippy::unused_async)]
use loco_rs::prelude::*;
use rust_decimal::prelude::FromPrimitive;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{models::{self, _entities::{organizations, parents, sea_orm_active_enums::{self, CustomerType, TenantType}, students, tutors}, customers, tenants, users::{self, AuthUser, UserType}}, views::profile::{ProfileResonse, ProfileResponseStatus}};

#[derive(Debug, Default, Deserialize, Serialize)]
pub struct UpdateParams {
    #[serde(rename = "firstName")]
    pub first_name: Option<String>,
    #[serde(rename = "lastName")]
    pub last_name: Option<String>,
    pub country: Option<String>,
    pub city: Option<String>,
    pub currency: Option<String>,
    pub timezone: Option<String>,
    pub title: Option<String>,
    #[serde(skip_serializing)]
    pub organization_id: Option<String>,
    pub dob: Option<String>,
    pub bio: Option<String>,
    #[serde(rename = "primaryLanguage")]
    pub primary_language: Option<String>,
    #[serde(rename = "otherLanguages")]
    pub other_languages: Option<Vec<String>>,
    pub categories: Option<String>,
    pub subjects: Option<String>,
    #[serde(skip_serializing)]
    pub topic: Option<String>,
    #[serde(rename = "sessionDuration")]
    pub session_duration: Option<i32>,
    #[serde(rename = "sessionPrice")]
    pub session_price: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub enum ProfileType {
    Individual(tutors::Model),
    Organization(organizations::Model),
    Student(students::Model),
    Parent(parents::Model),
    Null,
}

#[debug_handler]
async fn me(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let user = users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await?;
    tracing::debug!("checking for role: {:?}", &user.role);
    let profile = match user.role {
        sea_orm_active_enums::UserRole::Tenant => {
            let tenant = tenants::Model::find_by_user(&ctx.db, &user.id).await?;
            let tenant = match tenant {
                Some(ref t) => {
                    match t.tenant_type {
                        TenantType::Individual => {
                            let data = tutors::Model::find_by_tenant(&ctx.db, &(tenant.as_ref()).unwrap().id).await?;
                            serde_json::json!(data)
                        },
                        TenantType::Organization => {
                            let data = tutors::Model::find_by_tenant(&ctx.db, &(tenant.as_ref()).unwrap().id).await?;
                            serde_json::json!(data)
                        },
                    }
                },
                None => {Value::Null},
            };
            serde_json::json!(tenant)
        },
        sea_orm_active_enums::UserRole::Customer => {
            let customer = customers::Model::find_by_user(&ctx.db, &user.id).await?;
            let profile = match customer.customer_type {
                CustomerType::StudentLearner => {
                    let data = students::Model::find_by_customer(&ctx.db, &customer.id).await?;
                    serde_json::json!(data)
                },
                CustomerType::ParentGuardian => {
                    let data = parents::Model::find_by_customer(&ctx.db, &customer.id).await?;
                    serde_json::json!(data)
                },
                _ => Value::Null,
            };
            serde_json::json!(profile)
        },
    };
    let res = ProfileResonse::new(serde_json::json!({
        "profile": profile,
        "email": &user.email,
        "phone": &user.phone,
    }), ProfileResponseStatus::Success);
    format::json(res)
}

#[debug_handler]
async fn check_profile(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let user_type = users::Model::get_user_type(&ctx.db, &auth.claims.pid).await;
    format::json(serde_json::json!({
        "type": user_type
    }))
}

async fn get_profile_type(
    auth: &auth::JWT,
    ctx: &AppContext,
) -> Result<ProfileType> {
    let user = users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await?;
    tracing::debug!("checking for role: {:?}", &user.role);
    let profile = match user.role {
        sea_orm_active_enums::UserRole::Tenant => {
            let tenant = tenants::Model::find_by_user(&ctx.db, &user.id).await?;
            let profile = match tenant {
                Some(ref t) => {
                    match t.tenant_type {
                        TenantType::Individual => {
                            let data = tutors::Model::find_by_tenant(&ctx.db, &(tenant.as_ref()).unwrap().id).await?;
                            ProfileType::Individual(data)
                        },
                        TenantType::Organization => {
                            let data = organizations::Model::find_by_tenant(&ctx.db, &(tenant.as_ref()).unwrap().id).await?;
                            ProfileType::Organization(data)
                        },
                    }
                },
                None => {ProfileType::Null},
            };
            profile
        },
        sea_orm_active_enums::UserRole::Customer => {
            let customer = customers::Model::find_by_user(&ctx.db, &user.id).await?;
            let profile = match customer.customer_type {
                CustomerType::StudentLearner => {
                    let data = students::Model::find_by_customer(&ctx.db, &customer.id).await?;
                    ProfileType::Student(data)
                },
                CustomerType::ParentGuardian => {
                    let data = parents::Model::find_by_customer(&ctx.db, &customer.id).await?;
                    ProfileType::Parent(data)
                },
                _ => ProfileType::Null,
            };
            profile
        },
    };

    Ok(profile)
}

#[debug_handler]
async fn update(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Json(params): Json<UpdateParams>,
) -> Result<Response> {
    let profile = get_profile_type(&auth, &ctx).await?;
    match profile {
        ProfileType::Individual(m) => {
            // let data = tutors::Model::find_by_tenant(&ctx.db, &(tenant.as_ref()).unwrap().id).await?;
            let am = tutors::ActiveModel {
                id: ActiveValue::Unchanged(m.id.clone()),
                bio: ActiveValue::Set(params.bio),
                title: ActiveValue::Set(params.title),
                // country: ActiveValue::Set(params.country),
                categories: ActiveValue::Set(params.categories),
                subjects: ActiveValue::Set(params.subjects),
                session_duration: ActiveValue::Set(params.session_duration.unwrap_or(30)),
                session_price: ActiveValue::Set(Decimal::from_str_exact(&params.session_price.unwrap_or("0".into())).ok()),
                currency: ActiveValue::Set(params.currency.unwrap_or("USD".into())),
                ..Default::default()
            };
            am.save(&ctx.db).await?;
        },
        ProfileType::Student(m) => {
            m.into_active_model().update_profile(&ctx.db, &models::students::UpdateParams {
                first_name: params.first_name.clone().unwrap(),
                last_name: params.last_name.clone().unwrap(),
                language: params.primary_language,
                country: params.country,
                currency: params.currency,
                category: params.categories,
                subject: params.subjects,
                ..Default::default()
            }).await?;
        },
        _ => {},
    }
    format::empty_json()
}

pub async fn get_metadata(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let ut = get_profile_type(&auth, &ctx).await?;
    match ut {
        ProfileType::Individual(m) => {
            let md = m.cal_metadata;
            format::json(md)
        },
        _ => format::empty_json()
    }
}

pub fn check_credits(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Json(params): Json<UpdateParams>,
) -> Result<Response> {
    format::empty()
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api/profile/")
        .add("/", get(me))
        .add("/metadata", get(get_metadata))
        .add("/", put(update))
        .add("/check", get(check_profile))
}

use crate::{
    mailers::auth::AuthMailer, models::{
        self, _entities::{sea_orm_active_enums::{self, CustomerType, TenantType}, users}, customers::{self, CustomerParams, StripeCustomerParams}, parents, students, subscriptions::{self, UnlockedFeatures}, tenants::{self, TenantParams}, tutors::{self, CreateParams}, users::{LoginParams, RegisterParams, UserRole, UserType}
    }, services::RedisService, views::auth::{CurrentResponse, LoginResponse}, workers::{create_stripe_connect, create_stripe_customer, create_stripe_subscription, create_tutor_embedding::{self, TutorDocument, WorkerArgs}}
};
use axum::http::{HeaderMap, HeaderValue};
use loco_rs::prelude::{format::json, *};
use qdrant_client::{Payload, Qdrant, qdrant::PointStruct};
use regex::Regex;
use reqwest::ClientBuilder;
use serde::{Deserialize, Serialize};
use serde_json::{Value, value::Serializer};
use slugify::slugify;
use std::{collections::HashMap, env, sync::OnceLock};
use redis::{Commands, JsonCommands};

pub static EMAIL_DOMAIN_RE: OnceLock<Regex> = OnceLock::new();

fn get_allow_email_domain_re() -> &'static Regex {
    EMAIL_DOMAIN_RE.get_or_init(|| {
        Regex::new(r"@example\.com$|@gmail\.com$").expect("Failed to compile regex")
    })
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ForgotParams {
    pub email: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ResetParams {
    pub token: String,
    pub password: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct MagicLinkParams {
    pub email: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ResendVerificationParams {
    pub email: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct RegisterResponse {
    user: users::Model,
    tenant: tenants::Model,
}

/// Register function creates a new user with the given parameters and sends a
/// welcome email to the user
#[debug_handler]
async fn register(
    State(ctx): State<AppContext>,
    Json(params): Json<RegisterParams>,
) -> Result<Response> {
    tracing::debug!("params: {:?}", &params);
    let res = users::Model::create_with_password(&ctx.db, &params).await;

    let user = match res {
        Ok(user) => user,
        Err(err) => {
            tracing::info!(
                message = err.to_string(),
                user_email = &params.email,
                "could not register user",
            );
            return format::json(());
        }
    };

    let user = user
        .into_active_model()
        .set_email_verification_sent(&ctx.db)
        .await?;

    if let Some(ref role) = params.role {
        match role {
            UserRole::Tenant(t) => {
                let tenant_params = TenantParams {
                    owner_id: user.id,
                    tenant_type: *t,
                    name: None,
                };

                // tenant_params.tenant_type = params.tenant_type.unwrap();
                let tenant = tenants::Model::create(&ctx.db, &tenant_params).await?;
                let p = params.clone();
                match t {
                    TenantType::Individual => {
                        let cp = CreateParams {
                            first_name: p.first_name.unwrap_or_default(),
                            last_name: p.last_name.unwrap_or_default(),
                            country: p.country.unwrap_or_default(),
                            currency: p.currency,
                            dob: p.dob,
                            tenant_id: Some(tenant.id),
                            timezone: p.timezone,
                            categories: p.categories,
                            subjects: p.subjects,
                            primary_language: p.primary_language,
                            session_duration: p.session_duration,
                            session_price: p.session_price,
                            cal_metadata: p.cal_metadata.clone(),
                            ..Default::default()
                        };
                        let tutor = tutors::Model::create_tutor(&ctx.db, &cp).await?;

                        let _ = &ctx.cache.insert(
                            &format!("{}:profile", &user.pid.to_string()),
                            &tutor,
                        ).await?;

                        let model = tutor.clone();
                        let document = format!(
                            "categories: {0}, subjects: {1}, country: {2}, currency: {3}, bio: {4}, session_price: {5:.2}, language: {6}, session_duration: {7}",
                            &tutor.categories.clone().unwrap_or_default(),
                            &tutor.subjects.clone().unwrap_or_default(),
                            &tutor.country,
                            &tutor.currency,
                            &tutor.bio.clone().unwrap_or_default(),
                            &tutor.session_price.clone().unwrap_or_default(),
                            &tutor.primary_language.clone().unwrap_or_default(),
                            &tutor.session_duration,
                        );

                        create_stripe_connect::Worker::perform_later(
                            &ctx,
                            create_stripe_connect::WorkerArgs {
                                pid: user.pid.clone(),
                                params: Some(params.clone()),
                                tutor: Some(model.clone()),
                            })
                            .await?;

                        /* create_stripe_customer::Worker::perform_later(
                            &ctx,
                            create_stripe_customer::WorkerArgs {
                                role: UserType::Individual,
                                row_id: Some(tenant.id),
                                customer: Some(
                                    customers::StripeCustomerParams {
                                        email: params.email,
                                        name: format!("{} {}", params.first_name.unwrap_or_default(), params.last_name.unwrap_or_default()),
                                    },
                                ),
                            },
                        )
                        .await?; */

                        create_stripe_subscription::Worker::perform_later(
                            &ctx,
                            create_stripe_subscription::WorkerArgs {
                                pid: user.pid.clone(),
                                customer_params: Some(StripeCustomerParams {
                                    email: user.email.clone(),
                                    name: tutor.name(),
                                }),
                                plan: Some(models::subscriptions::SubscriptionPlan::Basic),
                                features: Some(UnlockedFeatures::trial().trial_credits(3)),
                                role_id: Some(models::users::RoleWithId::Tenant(tenant.id.clone())),
                                sub_type: Some(models::subscriptions::SubscriptionType::Trial),
                            },
                        ).await?;

                        create_tutor_embedding::Worker::perform_later(
                            &ctx,
                            create_tutor_embedding::WorkerArgs {
                                tutor: Some(model.clone()),
                                prompt: document.into(),
                            })
                            .await?;
                    },
                    TenantType::Organization => {
                        let cp = models::organizations::CreateParams {
                            name: params.name.unwrap_or_default(),
                            contact_email: Some(params.email),
                            country: params.country,
                            timezone: params.timezone,
                            ..Default::default()
                        };
                    },
                }
            },
            UserRole::Customer(c) => {
                let customer_params = CustomerParams {
                    customer_type: *c,
                    user_id: user.id.clone(),
                    name: Some(user.name.clone()),
                };

                let params = params.clone();
                let customer = customers::Model::create(&ctx.db, &customer_params).await?;

                match c {
                    CustomerType::StudentLearner => {
                        let cp = students::CreateParams {
                            first_name: params.first_name.clone().unwrap_or_default(),
                            last_name: params.last_name.clone().unwrap_or_default(),
                            country: params.country.clone().unwrap_or_default(),
                            currency: params.currency,
                            dob: params.dob,
                            timezone: params.timezone,
                            customer_id: customer.id,
                            ..Default::default()
                        };
                        let student = students::Model::create(&ctx.db, &cp).await?;

                        create_stripe_subscription::Worker::perform_later(
                            &ctx,
                            create_stripe_subscription::WorkerArgs {
                                pid: user.pid.clone(),
                                customer_params: Some(StripeCustomerParams {
                                    email: user.email.clone(),
                                    name: student.name(),
                                }),
                                plan: Some(models::subscriptions::SubscriptionPlan::Basic),
                                features: Some(UnlockedFeatures::trial().trial_credits(10)),
                                role_id: Some(models::users::RoleWithId::Customer(customer.id.clone())),
                                sub_type: Some(models::subscriptions::SubscriptionType::Trial),
                            },
                        ).await?;
                        /* create_stripe_customer::Worker::perform_later(
                            &ctx,
                            create_stripe_customer::WorkerArgs {
                                role: UserType::Student,
                                row_id: Some(customer.id),
                                customer: Some(
                                    customers::StripeCustomerParams {
                                        email: params.email,
                                        name: format!("{} {}", params.first_name.unwrap_or_default(), params.last_name.unwrap_or_default()),
                                    },
                                ),
                            },
                        )
                        .await?; */
                    },
                    CustomerType::ParentGuardian => {
                        let cp = parents::CreateParams {
                            first_name: params.first_name.clone().unwrap_or_default(),
                            last_name: params.last_name.clone().unwrap_or_default(),
                            country: params.country.clone().unwrap_or_default(),
                            currency: params.currency,
                            dob: params.dob,
                            timezone: params.timezone,
                            customer_id: customer.id,
                            ..Default::default()
                        };
                        let parent = parents::Model::create(&ctx.db, &cp).await?;
                        create_stripe_customer::Worker::perform_later(
                            &ctx,
                            create_stripe_customer::WorkerArgs {
                                role: UserType::Parent,
                                row_id: Some(customer.id),
                                customer: Some(
                                    customers::StripeCustomerParams {
                                        email: params.email,
                                        name: format!("{} {}", params.first_name.unwrap_or_default(), params.last_name.unwrap_or_default()),
                                    },
                                ),
                            },
                        )
                        .await?;
                    },
                    _ => {},
                }
            },
        };
    }

    AuthMailer::send_welcome(&ctx, &user).await?;

    format::json(())
}

/// Verify register user. if the user not verified his email, he can't login to
/// the system.
#[debug_handler]
async fn verify(State(ctx): State<AppContext>, Path(token): Path<String>) -> Result<Response> {
    let Ok(user) = users::Model::find_by_verification_token(&ctx.db, &token).await else {
        return unauthorized("invalid token");
    };

    if user.email_verified_at.is_some() {
        tracing::info!(pid = user.pid.to_string(), "user already verified");
    } else {
        let active_model = user.into_active_model();
        let user = active_model.verified(&ctx.db).await?;
        tracing::info!(pid = user.pid.to_string(), "user verified");
    }

    format::json(())
}

/// In case the user forgot his password  this endpoints generate a forgot token
/// and send email to the user. In case the email not found in our DB, we are
/// returning a valid request for for security reasons (not exposing users DB
/// list).
#[debug_handler]
async fn forgot(
    State(ctx): State<AppContext>,
    Json(params): Json<ForgotParams>,
) -> Result<Response> {
    let Ok(user) = users::Model::find_by_email(&ctx.db, &params.email).await else {
        // we don't want to expose our users email. if the email is invalid we still
        // returning success to the caller
        return format::json(());
    };

    let user = user
        .into_active_model()
        .set_forgot_password_sent(&ctx.db)
        .await?;

    AuthMailer::forgot_password(&ctx, &user).await?;

    format::json(())
}

/// reset user password by the given parameters
#[debug_handler]
async fn reset(State(ctx): State<AppContext>, Json(params): Json<ResetParams>) -> Result<Response> {
    let Ok(user) = users::Model::find_by_reset_token(&ctx.db, &params.token).await else {
        // we don't want to expose our users email. if the email is invalid we still
        // returning success to the caller
        tracing::info!("reset token not found");

        return format::json(());
    };
    user.into_active_model()
        .reset_password(&ctx.db, &params.password)
        .await?;

    format::json(())
}

/// Creates a user login and returns a token
#[debug_handler]
async fn login(State(ctx): State<AppContext>, Json(params): Json<LoginParams>) -> Result<Response> {
    let Ok(user) = users::Model::find_by_email(&ctx.db, &params.email).await else {
        tracing::debug!(
            email = params.email,
            "login attempt with non-existent email"
        );
        return unauthorized("Invalid credentials!");
    };

    let valid = user.verify_password(&params.password);

    if !valid {
        return unauthorized("unauthorized!");
    }

    let jwt_secret = ctx.config.get_jwt_config()?;

    // let tenant = tenants::Model::find_by_user(&ctx.db, &user.id).await?;

    let tenant_id = match user.role {
        sea_orm_active_enums::UserRole::Tenant => {
            let tenant = tenants::Model::find_by_user(&ctx.db, &user.id).await?;
            tenant.unwrap().id
        },
        sea_orm_active_enums::UserRole::Customer => {
            let customer = customers::Model::find_by_user(&ctx.db, &user.id).await?;
            customer.id
        },
    };
    let token = user
        .generate_jwt(&jwt_secret.secret, jwt_secret.expiration, Some(tenant_id.to_string()))
        .or_else(|_| unauthorized("unauthorized!"))?;

    let _  = ctx.cache.insert(&format!("{}:role", &user.pid.to_string()), &user.role).await?;

    let sub = subscriptions::Model::get_subscription(&ctx.db, &tenant_id).await?;
    let features = subscriptions::Model::get_features(&ctx.db, &tenant_id).await?;
    // let _ = ctx.cache.insert(&format!("{}:features", &user.pid.to_string()), &features).await?;

    let stripe_customer_id = sub.clone().unwrap().stripe_customer_id;
    if let Some(r) = ctx.shared_store.get::<RedisService>() {
        let mut con = r.client.get_connection().expect("Failed to create connection");
        let _: () = con.set(&format!("{}:stripe-customer", &user.pid.to_string()), stripe_customer_id.unwrap_or_default()).expect("Error writing to cache");
        let _: () = con.json_set(&format!("{}:subscription", &user.pid.to_string()), "$", &serde_json::json!(&sub)).expect("Error writing to cache");
        let _: () = con.json_set(&format!("{}:features", &user.pid.to_string()), "$", &serde_json::json!(&features)).expect("Error writing to cache");
        let _: () = con.json_set(&format!("{}:credits", &user.pid.to_string()), "$", &serde_json::json!({
            "amount": &features.unwrap().trial_credits,
        })).expect("Error writing to cache");
    }

    format::json(LoginResponse::new(&user, &token))
}

#[debug_handler]
async fn current(auth: auth::JWT, State(ctx): State<AppContext>) -> Result<Response> {
    let user = users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await?;
    let profile = match user.role {
        sea_orm_active_enums::UserRole::Tenant => {
            let tenant = tenants::Model::find_by_user(&ctx.db, &user.id).await?;
            serde_json::json!(tenant)
        },
        sea_orm_active_enums::UserRole::Customer => {
            let customer = customers::Model::find_by_user(&ctx.db, &user.id).await?;
            serde_json::json!(customer)
        },
    };
    let mut res = CurrentResponse::new(&user);
    res.profile = Some(profile);
    format::json(res)
}

#[debug_handler]
async fn profile(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    format::empty_json()
}

/// Magic link authentication provides a secure and passwordless way to log in to the application.
///
/// # Flow
/// 1. **Request a Magic Link**:
///    A registered user sends a POST request to `/magic-link` with their email.
///    If the email exists, a short-lived, one-time-use token is generated and sent to the user's email.
///    For security and to avoid exposing whether an email exists, the response always returns 200, even if the email is invalid.
///
/// 2. **Click the Magic Link**:
///    The user clicks the link (/magic-link/{token}), which validates the token and its expiration.
///    If valid, the server generates a JWT and responds with a [`LoginResponse`].
///    If invalid or expired, an unauthorized response is returned.
///
/// This flow enhances security by avoiding traditional passwords and providing a seamless login experience.
async fn magic_link(
    State(ctx): State<AppContext>,
    Json(params): Json<MagicLinkParams>,
) -> Result<Response> {
    let email_regex = get_allow_email_domain_re();
    if !email_regex.is_match(&params.email) {
        tracing::debug!(
            email = params.email,
            "The provided email is invalid or does not match the allowed domains"
        );
        return bad_request("invalid request");
    }

    let Ok(user) = users::Model::find_by_email(&ctx.db, &params.email).await else {
        // we don't want to expose our users email. if the email is invalid we still
        // returning success to the caller
        tracing::debug!(email = params.email, "user not found by email");
        return format::empty_json();
    };

    let user = user.into_active_model().create_magic_link(&ctx.db).await?;
    AuthMailer::send_magic_link(&ctx, &user).await?;

    format::empty_json()
}

/// Verifies a magic link token and authenticates the user.
async fn magic_link_verify(
    Path(token): Path<String>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let Ok(user) = users::Model::find_by_magic_token(&ctx.db, &token).await else {
        // we don't want to expose our users email. if the email is invalid we still
        // returning success to the caller
        return unauthorized("unauthorized!");
    };

    let user = user.into_active_model().clear_magic_link(&ctx.db).await?;

    let jwt_secret = ctx.config.get_jwt_config()?;

    let tenant = tenants::Model::find_by_user(&ctx.db, &user.id).await?;

    let token = user
        .generate_jwt(&jwt_secret.secret, jwt_secret.expiration, Some(tenant.unwrap().id.to_string()))
        .or_else(|_| unauthorized("unauthorized!"))?;

    format::json(LoginResponse::new(&user, &token))
}

#[debug_handler]
async fn resend_verification_email(
    State(ctx): State<AppContext>,
    Json(params): Json<ResendVerificationParams>,
) -> Result<Response> {
    let Ok(user) = users::Model::find_by_email(&ctx.db, &params.email).await else {
        tracing::info!(
            email = params.email,
            "User not found for resend verification"
        );
        return format::json(());
    };

    if user.email_verified_at.is_some() {
        tracing::info!(
            pid = user.pid.to_string(),
            "User already verified, skipping resend"
        );
        return format::json(());
    }

    let user = user
        .into_active_model()
        .set_email_verification_sent(&ctx.db)
        .await?;

    AuthMailer::send_welcome(&ctx, &user).await?;
    tracing::info!(pid = user.pid.to_string(), "Verification email re-sent");

    format::json(())
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("/api/auth")
        .add("/register", post(register))
        .add("/verify/{token}", get(verify))
        .add("/login", post(login))
        .add("/forgot", post(forgot))
        .add("/reset", post(reset))
        .add("/current", get(current))
        .add("/magic-link", post(magic_link))
        .add("/magic-link/{token}", get(magic_link_verify))
        .add("/resend-verification-mail", post(resend_verification_email))
        .add("/profile", get(profile))
}

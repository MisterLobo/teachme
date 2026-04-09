use async_trait::async_trait;
use chrono::{offset::Local, Duration};
use loco_rs::{auth::jwt, hash, prelude::*};
use sea_orm::{ActiveEnum, DerivePartialModel, FromQueryResult};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use uuid::Uuid;

use crate::models::{self, _entities::{customers, sea_orm_active_enums::{self, CustomerType, TenantType}, tenants}};

pub use super::_entities::users::{self, ActiveModel, Entity, Model};

pub const MAGIC_LINK_LENGTH: i8 = 32;
pub const MAGIC_LINK_EXPIRATION_MIN: i8 = 5;

#[derive(Debug, Deserialize, Serialize)]
pub struct LoginParams {
    pub email: String,
    pub password: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub enum UserRole {
    Tenant(TenantType),
    Customer(CustomerType),
}

#[derive(Clone, Debug, PartialEq, DerivePartialModel, FromQueryResult, Eq, Serialize, Deserialize)]
#[sea_orm(entity = "users::Entity")]
#[sea_orm(table_name = "users")]
#[serde(rename_all = "camelCase")]
pub struct SafeModel {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    #[sea_orm(unique)]
    pub email: String,
    pub name: String,
    #[serde(rename = "emailVerifiedAt")]
    pub email_verified_at: Option<DateTimeWithTimeZone>,
    #[serde(rename = "resetSentAt")]
    pub reset_sent_at: Option<DateTimeWithTimeZone>,
    #[serde(rename = "emailVerficationToken")]
    pub email_verification_token: Option<String>,
    #[serde(rename = "emailVerificationSentAt")]
    pub email_verification_sent_at: Option<DateTimeWithTimeZone>,
    #[serde(rename = "magicLinkExpiration")]
    pub magic_link_expiration: Option<DateTimeWithTimeZone>,
    #[serde(rename = "calUserId")]
    pub cal_user_id: Option<i32>,
    #[sea_orm(column_type = "Text", nullable)]
    pub cal_username: Option<String>,
    pub phone: Option<String>,
    #[serde(rename = "phoneVerifiedAt")]
    pub phone_verified_at: Option<DateTimeWithTimeZone>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterParams {
    pub email: String,
    pub password: String,
    pub name: Option<String>,
    pub dob: Option<String>,
    #[serde(rename = "tenantType")]
    pub tenant_type: Option<TenantType>,
    #[serde(rename = "customerType")]
    pub customer_type: Option<CustomerType>,
    #[serde(rename = "calUserId")]
    pub cal_user_id: Option<i32>,
    #[serde(rename = "calUserName")]
    pub cal_username: Option<String>,
    #[serde(rename = "firstName")]
    pub first_name: Option<String>,
    #[serde(rename = "lastName")]
    pub last_name: Option<String>,
    pub country: Option<String>,
    pub currency: Option<String>,
    pub role: Option<UserRole>,
    pub phone: Option<String>,
    pub timezone: Option<String>,
    pub categories: Option<String>,
    pub subjects: Option<String>,
    #[serde(rename = "primaryLanguage")]
    pub primary_language: Option<String>,
    pub locale: Option<String>,
    #[serde(rename = "eventTypeSlug")]
    pub event_type_slug: Option<String>,
    #[serde(rename = "calendarId")]
    pub calendar_id: Option<i32>,
    #[serde(rename = "calendarName")]
    pub calendar_name: Option<String>,
    #[serde(rename = "scheduleId")]
    pub schedule_id: Option<i32>,
    #[serde(rename = "sessionDuration")]
    pub session_duration: Option<i32>,
    #[serde(rename = "sessionPrice")]
    pub session_price: Option<f32>,
    #[serde(rename = "calMetadata")]
    pub cal_metadata: Option<Value>,
}

#[derive(Debug, Deserialize, Serialize)]
pub enum UserType {
    Individual,
    Organization,
    Student,
    Parent,
    Null,
}

#[derive(Debug, Validate, Deserialize)]
pub struct Validator {
    #[validate(length(min = 2, message = "Name must be at least 2 characters long."))]
    pub name: String,
    #[validate(email(message = "invalid email"))]
    pub email: String,
}

impl Validatable for ActiveModel {
    fn validator(&self) -> Box<dyn Validate> {
        Box::new(Validator {
            name: self.name.as_ref().to_owned(),
            email: self.email.as_ref().to_owned(),
        })
    }
}

#[async_trait::async_trait]
impl ActiveModelBehavior for super::_entities::users::ActiveModel {
    async fn before_save<C>(self, _db: &C, insert: bool) -> Result<Self, DbErr>
    where
        C: ConnectionTrait,
    {
        self.validate()?;
        if insert {
            let mut this = self;
            this.pid = ActiveValue::Set(Uuid::now_v7());
            this.api_key = ActiveValue::Set(format!("lo-{}", Uuid::now_v7()));
            Ok(this)
        } else {
            Ok(self)
        }
    }
}

#[async_trait]
impl Authenticable for Model {
    async fn find_by_api_key(db: &DatabaseConnection, api_key: &str) -> ModelResult<Self> {
        let user = users::Entity::find()
            .filter(
                model::query::condition()
                    .eq(users::Column::ApiKey, api_key)
                    .build(),
            )
            .one(db)
            .await?;
        user.ok_or_else(|| ModelError::EntityNotFound)
    }

    async fn find_by_claims_key(db: &DatabaseConnection, claims_key: &str) -> ModelResult<Self> {
        Self::find_by_pid(db, claims_key).await
    }
}

impl Model {
    /// finds a user by the provided email
    ///
    /// # Errors
    ///
    /// When could not find user by the given token or DB query error
    pub async fn find_by_email(db: &DatabaseConnection, email: &str) -> ModelResult<Self> {
        let user = users::Entity::find()
            .filter(
                model::query::condition()
                    .eq(users::Column::Email, email)
                    .build(),
            )
            .one(db)
            .await?;
        user.ok_or_else(|| ModelError::EntityNotFound)
    }

    /// finds a user by the provided verification token
    ///
    /// # Errors
    ///
    /// When could not find user by the given token or DB query error
    pub async fn find_by_verification_token(
        db: &DatabaseConnection,
        token: &str,
    ) -> ModelResult<Self> {
        let user = users::Entity::find()
            .filter(
                model::query::condition()
                    .eq(users::Column::EmailVerificationToken, token)
                    .build(),
            )
            .one(db)
            .await?;
        user.ok_or_else(|| ModelError::EntityNotFound)
    }

    /// finds a user by the magic token and verify and token expiration
    ///
    /// # Errors
    ///
    /// When could not find user by the given token or DB query error ot token expired
    pub async fn find_by_magic_token(db: &DatabaseConnection, token: &str) -> ModelResult<Self> {
        let user = users::Entity::find()
            .filter(
                query::condition()
                    .eq(users::Column::MagicLinkToken, token)
                    .build(),
            )
            .one(db)
            .await?;

        let user = user.ok_or_else(|| ModelError::EntityNotFound)?;
        if let Some(expired_at) = user.magic_link_expiration {
            if expired_at >= Local::now() {
                Ok(user)
            } else {
                tracing::debug!(
                    user_pid = user.pid.to_string(),
                    token_expiration = expired_at.to_string(),
                    "magic token expired for the user."
                );
                Err(ModelError::msg("magic token expired"))
            }
        } else {
            tracing::error!(
                user_pid = user.pid.to_string(),
                "magic link expiration time not exists"
            );
            Err(ModelError::msg("expiration token not exists"))
        }
    }

    /// finds a user by the provided reset token
    ///
    /// # Errors
    ///
    /// When could not find user by the given token or DB query error
    pub async fn find_by_reset_token(db: &DatabaseConnection, token: &str) -> ModelResult<Self> {
        let user = users::Entity::find()
            .filter(
                model::query::condition()
                    .eq(users::Column::ResetToken, token)
                    .build(),
            )
            .one(db)
            .await?;
        user.ok_or_else(|| ModelError::EntityNotFound)
    }

    /// finds a user by the provided pid
    ///
    /// # Errors
    ///
    /// When could not find user  or DB query error
    pub async fn find_by_pid(db: &DatabaseConnection, pid: &str) -> ModelResult<Self> {
        let parse_uuid = Uuid::parse_str(pid).map_err(|e| ModelError::Any(e.into()))?;
        let user = users::Entity::find()
            .filter(
                model::query::condition()
                    .eq(users::Column::Pid, parse_uuid)
                    .build(),
            )
            .one(db)
            .await?;
        user.ok_or_else(|| ModelError::EntityNotFound)
    }

    pub async fn get_user_type(db: &DatabaseConnection, pid: &str) -> UserType {
        let parse_uuid = Uuid::parse_str(pid).map_err(|e| ModelError::Any(e.into())).expect("failed to parse UUID from str");
        let user = users::Entity::find()
            .filter(
                model::query::condition()
                    .eq(users::Column::Pid, parse_uuid)
                    .build(),
            )
            .one(db)
            .await.expect("Could not find user");

        if let Some(u) = user {
            match u.role {
                sea_orm_active_enums::UserRole::Tenant => {
                    let tenant = tenants::Model::find_by_user(&db, &u.id).await.expect("Could not find Tenant for User");
                    let tenant = match tenant {
                        Some(ref t) => {
                            match t.tenant_type {
                                TenantType::Individual => {
                                    UserType::Individual
                                },
                                TenantType::Organization => {
                                    UserType::Organization
                                },
                            }
                        },
                        None => UserType::Null,
                    };
                    tenant
                },
                sea_orm_active_enums::UserRole::Customer => {
                    let customer = customers::Model::find_by_user(&db, &u.id).await.expect("Could not find Customer for User");
                    let profile = match customer.customer_type {
                        CustomerType::StudentLearner => {
                            UserType::Student
                        },
                        CustomerType::ParentGuardian => {
                            UserType::Parent
                        },
                        _ => UserType::Null,
                    };
                    profile
                },
            }
        } else {
            UserType::Null
        }
    }

    /// finds a user by the provided api key
    ///
    /// # Errors
    ///
    /// When could not find user by the given token or DB query error
    pub async fn find_by_api_key(db: &DatabaseConnection, api_key: &str) -> ModelResult<Self> {
        let user = users::Entity::find()
            .filter(
                model::query::condition()
                    .eq(users::Column::ApiKey, api_key)
                    .build(),
            )
            .one(db)
            .await?;
        user.ok_or_else(|| ModelError::EntityNotFound)
    }

    /// Verifies whether the provided plain password matches the hashed password
    ///
    /// # Errors
    ///
    /// when could not verify password
    #[must_use]
    pub fn verify_password(&self, password: &str) -> bool {
        hash::verify_password(password, &self.password)
    }

    /// Asynchronously creates a user with a password and saves it to the
    /// database.
    ///
    /// # Errors
    ///
    /// When could not save the user into the DB
    pub async fn create_with_password(
        db: &DatabaseConnection,
        params: &RegisterParams,
    ) -> ModelResult<Self> {
        let txn = db.begin().await?;

        if users::Entity::find()
            .filter(
                model::query::condition()
                    .eq(users::Column::Email, &params.email)
                    .build(),
            )
            .one(&txn)
            .await?
            .is_some()
        {
            return Err(ModelError::EntityAlreadyExists {});
        }

        let password_hash =
            hash::hash_password(&params.password).map_err(|e| ModelError::Any(e.into()))?;

        let mut r = sea_orm_active_enums::UserRole::Tenant;
        if let Some(role) = &params.role {
            match role {
                UserRole::Tenant(_) => {
                    r = sea_orm_active_enums::UserRole::Tenant;
                },
                UserRole::Customer(_) => {
                    r = sea_orm_active_enums::UserRole::Customer;
                },
            }
        }
        let user = ActiveModel {
            id: ActiveValue::Set(Uuid::now_v7()),
            email: ActiveValue::set(params.email.to_string()),
            password: ActiveValue::set(password_hash),
            name: ActiveValue::set(params.name.clone().unwrap_or_default()),
            cal_user_id: ActiveValue::set(params.cal_user_id.clone()),
            cal_username: ActiveValue::Set(params.cal_username.clone()),
            role: ActiveValue::Set(r),
            phone: ActiveValue::Set(params.phone.clone()),
            ..Default::default()
        }
        .insert(&txn)
        .await?;

        txn.commit().await?;

        Ok(user)
    }

    /// Creates a JWT
    ///
    /// # Errors
    ///
    /// when could not convert user claims to jwt token
    pub fn generate_jwt(&self, secret: &str, expiration: u64, tenant_id: Option<String>) -> ModelResult<String> {
        let mut claims = Map::new();
        claims.insert("tenant_id".to_string(), tenant_id.into());
        claims.insert("role".to_string(), Value::String(self.role.to_value()));
        jwt::JWT::new(secret)
            .generate_token(expiration, self.pid.to_string(), claims)
            .map_err(ModelError::from)
    }
}

impl ActiveModel {
    /// Sets the email verification information for the user and
    /// updates it in the database.
    ///
    /// This method is used to record the timestamp when the email verification
    /// was sent and generate a unique verification token for the user.
    ///
    /// # Errors
    ///
    /// when has DB query error
    pub async fn set_email_verification_sent(
        mut self,
        db: &DatabaseConnection,
    ) -> ModelResult<Model> {
        self.email_verification_sent_at = ActiveValue::set(Some(Local::now().into()));
        self.email_verification_token = ActiveValue::Set(Some(Uuid::new_v4().to_string()));
        self.update(db).await.map_err(ModelError::from)
    }

    /// Sets the information for a reset password request,
    /// generates a unique reset password token, and updates it in the
    /// database.
    ///
    /// This method records the timestamp when the reset password token is sent
    /// and generates a unique token for the user.
    ///
    /// # Arguments
    ///
    /// # Errors
    ///
    /// when has DB query error
    pub async fn set_forgot_password_sent(mut self, db: &DatabaseConnection) -> ModelResult<Model> {
        self.reset_sent_at = ActiveValue::set(Some(Local::now().into()));
        self.reset_token = ActiveValue::Set(Some(Uuid::new_v4().to_string()));
        self.update(db).await.map_err(ModelError::from)
    }

    /// Records the verification time when a user verifies their
    /// email and updates it in the database.
    ///
    /// This method sets the timestamp when the user successfully verifies their
    /// email.
    ///
    /// # Errors
    ///
    /// when has DB query error
    pub async fn verified(mut self, db: &DatabaseConnection) -> ModelResult<Model> {
        self.email_verified_at = ActiveValue::set(Some(Local::now().into()));
        self.update(db).await.map_err(ModelError::from)
    }

    /// Resets the current user password with a new password and
    /// updates it in the database.
    ///
    /// This method hashes the provided password and sets it as the new password
    /// for the user.
    ///
    /// # Errors
    ///
    /// when has DB query error or could not hashed the given password
    pub async fn reset_password(
        mut self,
        db: &DatabaseConnection,
        password: &str,
    ) -> ModelResult<Model> {
        self.password =
            ActiveValue::set(hash::hash_password(password).map_err(|e| ModelError::Any(e.into()))?);
        self.reset_token = ActiveValue::Set(None);
        self.reset_sent_at = ActiveValue::Set(None);
        self.update(db).await.map_err(ModelError::from)
    }

    /// Creates a magic link token for passwordless authentication.
    ///
    /// Generates a random token with a specified length and sets an expiration time
    /// for the magic link. This method is used to initiate the magic link authentication flow.
    ///
    /// # Errors
    /// - Returns an error if database update fails
    pub async fn create_magic_link(mut self, db: &DatabaseConnection) -> ModelResult<Model> {
        let random_str = hash::random_string(MAGIC_LINK_LENGTH as usize);
        let expired = Local::now() + Duration::minutes(MAGIC_LINK_EXPIRATION_MIN.into());

        self.magic_link_token = ActiveValue::set(Some(random_str));
        self.magic_link_expiration = ActiveValue::set(Some(expired.into()));
        self.update(db).await.map_err(ModelError::from)
    }

    /// Verifies and invalidates the magic link after successful authentication.
    ///
    /// Clears the magic link token and expiration time after the user has
    /// successfully authenticated using the magic link.
    ///
    /// # Errors
    /// - Returns an error if database update fails
    pub async fn clear_magic_link(mut self, db: &DatabaseConnection) -> ModelResult<Model> {
        self.magic_link_token = ActiveValue::set(None);
        self.magic_link_expiration = ActiveValue::set(None);
        self.update(db).await.map_err(ModelError::from)
    }
}

use std::collections::HashMap;

use loco_rs::{model::{ModelError, ModelResult}, prelude::model};
use reqwest::Client;
use rust_decimal::prelude::FromPrimitive;
use sea_orm::{ActiveValue, Condition, DbBackend, FromJsonQueryResult, FromQueryResult, JoinType, QuerySelect, QueryTrait, TransactionTrait, entity::prelude::*};
use serde::{Deserialize, Serialize};
use crate::models::{_entities::{tenants, tutors, users}};

pub use super::_entities::tutors::{ActiveModel, Column, Model, Entity};
pub type Tutors = Entity;
pub type Tutor = Model;

pub type UserColumn = users::Column;
pub type TenantRelation = tenants::Relation;

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct SearchParams {
    pub prompt: String,
    pub subject: Option<String>,
    pub topic: Option<String>,
    pub start_time: Option<DateTimeWithTimeZone>,
    pub duration_minutes: Option<i32>,
    pub session_price: Option<f64>,
    pub session_duration: Option<i32>,
    pub characteristics: Option<String>,
    pub categories: Option<String>,
    pub subjects: Option<String>,
    pub country: Option<String>,
    pub timezone: Option<String>,
    pub currency: Option<String>,
    pub language: Option<String>,
    pub bio: Option<String>,
    pub title: Option<String>,
    pub cal_metadata: Option<Json>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct GetTutorParams {
    pub id: Uuid,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateParams {
    #[serde(rename = "firstName")]
    pub first_name: String,
    #[serde(rename = "lastName")]
    pub last_name: String,
    pub country: String,
    pub city: Option<String>,
    pub currency: Option<String>,
    pub timezone: Option<String>,
    pub title: Option<String>,
    #[serde(rename = "organizationId")]
    pub organization_id: Option<String>,
    pub dob: Option<String>,
    pub bio: Option<String>,
    #[serde(rename = "primaryLanguage")]
    pub primary_language: Option<String>,
    pub categories: Option<String>,
    pub subjects: Option<String>,
    pub topic: Option<String>,
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    #[serde(rename = "eventTypeSlug")]
    pub event_type_slug: Option<String>,
    #[serde(rename = "calendarId")]
    pub calendar_id: Option<i32>,
    pub calendar_name: Option<String>,
    #[serde(rename = "scheduleId")]
    pub schedule_id: Option<i32>,
    #[serde(rename = "sessionDuration")]
    pub session_duration: Option<i32>,
    #[serde(rename = "sessionPrice")]
    pub session_price: Option<f32>,
    pub locale: Option<String>,
    #[serde(rename = "memberId")]
    pub cal_metadata: Option<Json>,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
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
    #[serde(rename = "organizationId")]
    pub organization_id: Option<String>,
    pub dob: Option<String>,
    pub bio: Option<String>,
    #[serde(rename = "primaryLanguage")]
    pub primary_language: Option<String>,
    #[serde(rename = "otherLanguages")]
    pub other_languages: Option<Vec<String>>,
    pub category: Option<String>,
    pub subject: Option<String>,
    pub topic: Option<String>,
    #[serde(rename = "sessionDuration")]
    pub session_duration: Option<i32>,
    #[serde(rename = "sessionPrice")]
    pub session_price: Option<f32>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, FromJsonQueryResult)]
pub struct Language {
    pub name: String,
    pub proficiency_level: String,
    pub is_primary: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, FromJsonQueryResult)]
pub struct AvailabilitySchedule {
    pub schedule_id: i32,
    pub slug: String,
    pub timezone: String,
    pub is_default: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, FromJsonQueryResult)]
pub struct EventType {
    pub event_type_id: i32,
    pub duration: String,
    pub slug: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, FromJsonQueryResult)]
pub struct Calendar {
    pub calendar_ref_id: String,
    pub name: String,
    pub provider: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq, FromJsonQueryResult)]
#[serde(rename_all = "camelCase")]
pub struct CalMetadataTeam {
    pub slug: String,
    #[serde(rename = "teamId")]
    pub team_id: i32,
    #[serde(rename = "memberId")]
    pub member_id: i32,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq, FromJsonQueryResult)]
pub struct CalMetadataUser {
    pub id: i32,
    pub username: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq, FromJsonQueryResult)]
pub struct CalMetadataEventType {
    pub id: Option<i32>,
    pub slug: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq, FromJsonQueryResult)]
pub struct CalMetadataSchedules {
    pub team: i32,
    pub user: i32,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq, FromJsonQueryResult)]
pub struct CalMetadata {
    pub org :String,
    pub team: CalMetadataTeam,
    pub user: CalMetadataUser,
    #[serde(rename = "eventType")]
    pub event_type: CalMetadataEventType,
    pub schedules: CalMetadataSchedules,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq, FromJsonQueryResult)]
pub struct TutorCalMetadata {
    pub id: Uuid,
    pub tz: Option<String>,
    pub data: Option<CalMetadata>,
    #[serde(rename = "tutorData")]
    pub tutor_data: Option<Model>,
}

impl TutorCalMetadata {
    pub fn from(src: Json) -> Self {
        serde_json::from_value(src).unwrap()
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, FromQueryResult)]
pub struct TutorPid {
    pub id: Uuid,
    pub pid: Uuid,
    #[sea_orm(nested)]
    pub tenant: crate::models::tenants::TenantPid,
    #[sea_orm(nested)]
    pub user: crate::models::users::UserPid,
}

#[async_trait::async_trait]
impl ActiveModelBehavior for ActiveModel {
    async fn before_save<C>(self, _db: &C, insert: bool) -> std::result::Result<Self, DbErr>
    where
        C: ConnectionTrait,
    {
        if !insert && self.updated_at.is_unchanged() {
            let mut this = self;
            // this.id = ActiveValue::Set(uuid::Uuid::now_v7());
            this.updated_at = sea_orm::ActiveValue::Set(chrono::Utc::now().into());
            Ok(this)
        } else {
            Ok(self)
        }
    }
}

// implement your read-oriented logic here
impl Model {
    pub fn name(&self) -> String {
        format!("{} {}", &self.first_name, &self.last_name)
    }
    pub async fn create_tutor(
        db: &DatabaseConnection,
        params: &CreateParams,
    ) -> ModelResult<Self> {
        let txn = db.begin().await?;

        let tutor = ActiveModel {
            id: ActiveValue::Set(Uuid::now_v7()),
            first_name: ActiveValue::Set(params.first_name.clone()),
            last_name: ActiveValue::Set(params.last_name.clone()),
            country: ActiveValue::Set(params.country.clone()),
            currency: ActiveValue::Set(params.currency.clone().unwrap_or("USD".into())),
            categories: ActiveValue::Set(params.categories.clone()),
            subjects: ActiveValue::Set(params.subjects.clone()),
            status: ActiveValue::Set("active".into()),
            tenant_id: ActiveValue::Set(params.tenant_id.unwrap()),
            timezone: ActiveValue::Set(params.timezone.clone()),
            primary_language: ActiveValue::Set(params.primary_language.clone()),
            cal_metadata: ActiveValue::Set(params.cal_metadata.clone()),
            session_duration: ActiveValue::Set(params.session_duration.clone().unwrap()),
            session_price: ActiveValue::Set(Decimal::from_f32(params.session_price.unwrap())),
            ..Default::default()
        }
        .insert(&txn)
        .await?;

        txn.commit().await?;

        Ok(tutor)
    }

    pub async fn find_match(
        db: &DatabaseConnection,
        search_params: &SearchParams,
        search_params_embedding: Vec<f32>,
    ) -> ModelResult<Vec<Self>> {
        // db.query_all("stmt").await?;
        let tutors = tutors::Entity::find()
            .filter(
                model::query::condition()
                    .eq(tutors::Column::City, search_params.subject.as_ref().unwrap())
                    // .eq(tutors::Column::Embedding, PgVector::from(search_params_embedding))
                    .build(),
            )
            .all(db)
            .await?;
        Ok(tutors)
    }

    pub async fn get_metadata(db: &DatabaseConnection, ids: Vec<Uuid>) -> ModelResult<Vec<TutorCalMetadata>> {
        let tutors = tutors::Entity::find()
            .filter(
                Condition::all()
                    .add(tutors::Column::Id.is_in(ids))
            )
            .all(db)
            .await?;
        Ok(
            tutors.iter()
                .map(|t| TutorCalMetadata::from(
                    serde_json::json!({
                        "id": t.id.clone(),
                        "tz": t.timezone.clone(),
                        "data": t.cal_metadata.clone(),
                        "tutorData": t.clone(),
                    })
                )).collect()
        )
    }

    pub async fn find_by_id(db: &DatabaseConnection, id: &Uuid) -> ModelResult<Option<Self>> {
        let tutor = tutors::Entity::find_by_id(*id)
            .one(db)
            .await?;
        Ok(tutor)
    }

    pub async fn find_by_tenant(db: &DatabaseConnection, id: &Uuid) -> ModelResult<Self> {
        let tutor = tutors::Entity::find()
            .filter(
                Condition::all()
                    .add(tutors::Column::TenantId.eq(*id))
            )
            .one(db)
            .await?;
        tutor.ok_or(ModelError::EntityNotFound)
    }

    pub async fn find_all(db: &DatabaseConnection, search_params: &SearchParams) -> ModelResult<Vec<Self>> {
        let price = search_params.session_price.as_ref().unwrap().clone();
        let val = Decimal::from_f64_retain(price).unwrap_or_default();
        tracing::debug!("{val:?}");
        
        let tutors = tutors::Entity::find()
            .filter(
                Condition::any()
                    .add(tutors::Column::Categories.contains(search_params.categories.clone().unwrap_or_default()))
                    .add(tutors::Column::Subjects.contains(search_params.subject.clone().unwrap_or_default()))
                    .add(tutors::Column::SessionDuration.eq(search_params.duration_minutes.as_ref().cloned()))
                    .add(tutors::Column::SessionPrice.eq(val))
                    .add(tutors::Column::Currency.eq(search_params.currency.as_ref().unwrap_or(&String::from("USD"))))
                    .add(tutors::Column::PrimaryLanguage.eq(search_params.language.as_ref().unwrap_or(&String::from("English"))))
            )
            .all(db)
            .await?;

        Ok(tutors)
    }
}

// implement your write-oriented logic here
impl ActiveModel {
    pub async fn update_profile(
        mut self,
        db: &DatabaseConnection,
        params: &UpdateParams,
    ) -> ModelResult<()> {
        // self.id = ActiveValue::Set(*id);
        let txn = db.begin().await?;

        self.bio = ActiveValue::Set(params.bio.clone());
        self.title = ActiveValue::Set(params.title.clone());
        self.currency = ActiveValue::Set(params.currency.clone().unwrap_or("USD".to_string()));
        self.session_duration = ActiveValue::Set(params.session_duration.clone().unwrap_or(30));
        self.session_price = ActiveValue::Set(Decimal::from_f32(params.session_price.unwrap_or(0.)));

        self.update(&txn).await?;

        Ok(txn.commit().await?)
    }
}

// implement your custom finders, selectors oriented logic here
impl Entity {
    pub async fn get_pid(
        db: &DatabaseConnection,
        id: &Uuid,
    ) -> ModelResult<TutorPid> {
        let stmt = Entity::find_by_id(*id)
            .select_only()
            .column(tutors::Column::Id)
            .tbl_col_as((users::Entity, UserColumn::Pid), "pid")
            .left_join(tenants::Entity)
            .join(JoinType::LeftJoin, TenantRelation::Users.def())
            .build(DbBackend::Postgres)
            .to_string();
        tracing::debug!("stmt: {stmt}");
        let Some(tutor) = Entity::find_by_id(*id)
            .select_only()
            .column(tutors::Column::Id)
            .tbl_col_as((users::Entity, users::Column::Pid), "pid")
            .left_join(tenants::Entity)
            .join(JoinType::LeftJoin, TenantRelation::Users.def())
            .into_model::<TutorPid>()
            .one(db)
            .await
            .expect("tutors query error") else {
                return Err(ModelError::EntityNotFound);
            };
        tracing::debug!("tutor: {:?}", &tutor);
        Ok(tutor)
    }
}

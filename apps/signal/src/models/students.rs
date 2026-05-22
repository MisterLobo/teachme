use loco_rs::model::{self, ModelError, ModelResult};
use sea_orm::{ActiveValue, Condition, DbBackend, FromJsonQueryResult, FromQueryResult, JoinType, QuerySelect, QueryTrait, SelectColumns, TransactionTrait, entity::prelude::*};
use serde::{Deserialize, Serialize};
use crate::models::{_entities::{credit_usages, credits, customers, students::{self, ActiveModel}, users}, customers::CustomerPid};
pub use super::_entities::students::{Model, Entity};

pub type Students = Entity;

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
    pub dob: Option<String>,
    pub bio: Option<String>,
    #[serde(rename = "primaryLanguage")]
    pub primary_language: Option<String>,
    pub category: Option<String>,
    pub subject: Option<String>,
    pub topic: Option<String>,
    #[serde(rename = "customerId")]
    pub customer_id: Uuid,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateParams {
    #[serde(rename = "firstName")]
    pub first_name: String,
    #[serde(rename = "lastName")]
    pub last_name: String,
    pub country: Option<String>,
    pub currency: Option<String>,
    pub timezone: Option<String>,
    pub dob: Option<String>,
    pub bio: Option<String>,
    pub language: Option<String>,
    pub category: Option<String>,
    pub subject: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, FromQueryResult)]
#[sea_orm(entity = "students::Entity")]
pub struct StudentPid {
    pub id: Uuid,
    pub pid: Uuid,
    #[sea_orm(nested)]
    pub customer: crate::models::customers::CustomerPid,
    #[sea_orm(nested)]
    pub user: crate::models::users::UserPid,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, FromQueryResult)]
#[sea_orm(entity = "students::Entity")]
pub struct StudentCredits {
    pub id: Uuid,
    pub used: Option<i64>,
    pub amount: Option<i32>,
    #[sea_orm(nested)]
    pub credits: crate::models::credits::CreditsHistory,
}

#[async_trait::async_trait]
impl ActiveModelBehavior for ActiveModel {
    async fn before_save<C>(self, _db: &C, insert: bool) -> std::result::Result<Self, DbErr>
    where
        C: ConnectionTrait,
    {
        if !insert && self.updated_at.is_unchanged() {
            let mut this = self;
            this.id = sea_orm::ActiveValue::Set(uuid::Uuid::now_v7());
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
    pub async fn create(
        db: &DatabaseConnection,
        params: &CreateParams,
    ) -> ModelResult<Self> {
        let txn = db.begin().await?;

        let student = ActiveModel {
            id: ActiveValue::Set(Uuid::now_v7()),
            first_name: ActiveValue::Set(params.first_name.clone()),
            last_name: ActiveValue::Set(params.last_name.clone()),
            country: ActiveValue::Set(Some(params.country.clone())),
            currency: ActiveValue::Set(params.currency.clone()),
            language: ActiveValue::Set(params.primary_language.clone()),
            dob: ActiveValue::Set(None),
            locale: ActiveValue::Set(None),
            customer_id: ActiveValue::Set(Some(params.customer_id)),
            timezone: ActiveValue::Set(params.timezone.clone()),
            ..Default::default()
        }
        .insert(&txn)
        .await?;

        txn.commit().await?;

        Ok(student)
    }
    pub async fn find_by_customer(
        db: &DatabaseConnection,
        customer_id: &Uuid,
    ) -> ModelResult<Self> {
        let student = Students::find()
            .filter(
                Condition::all()
                    .add(students::Column::CustomerId.eq(*customer_id))
            )
            .one(db)
            .await?;

        student.ok_or(ModelError::EntityNotFound)
    }
    pub async fn find_by_parent(
        db: &DatabaseConnection,
        parent_id: &Uuid,
    ) -> ModelResult<Self> {
        let student = Students::find()
            .filter(
                model::query::condition()
                    .eq(students::Column::ParentId, *parent_id)
                    .build()
            )
            .one(db)
            .await?;

        student.ok_or(ModelError::EntityNotFound)
    }
}

// implement your write-oriented logic here
impl ActiveModel {
    pub async fn update_profile(
        mut self,
        db: &DatabaseConnection,
        params: &UpdateParams,
    ) -> ModelResult<Model> {
        self.update(db).await.map_err(ModelError::from)
    }
}

// implement your custom finders, selectors oriented logic here
impl Entity {
    pub async fn get_pid(
        db: &DatabaseConnection,
        id: &Uuid,
    ) -> ModelResult<StudentPid> {
        let stmt = Entity::find_by_id(*id)
            .select_only()
            .column(students::Column::Id)
            .tbl_col_as((users::Entity, users::Column::Pid), "pid")
            .left_join(customers::Entity)
            .join(JoinType::LeftJoin, customers::Relation::Users.def());
        let sstmt = stmt.build(DbBackend::Postgres)
            .to_string();
        tracing::debug!("stmt: {sstmt}");
        let Some(student) = stmt.into_model::<StudentPid>()
            .one(db)
            .await
            .expect("student query error") else {
                return Err(ModelError::EntityNotFound);
            };
        tracing::debug!("pid: {:?}", &student);
        Ok(student)
    }
    pub async fn check_credits(
        db: &DatabaseConnection,
        id: &Uuid,
    ) -> ModelResult<StudentCredits> {
        let stmt = Entity::find_by_id(*id)
            .select_only()
            .column(students::Column::Id)
            .tbl_col_as((credits::Entity, credits::Column::Amount), "amount")
            .column_as(credit_usages::Column::Amount.sum(), "used")
            .left_join(credits::Entity)
            .left_join(credit_usages::Entity)
            // .join(JoinType::LeftJoin, credit_usages::Relation::Students.def())
            // .join(JoinType::InnerJoin, students::Relation::CreditUsages.def())
            .group_by(students::Column::Id)
            .group_by(credits::Column::Amount);
        let sstmt = stmt.build(DbBackend::Postgres)
            .to_string();
        tracing::debug!("stmt: {sstmt}");
        let Some(student) = stmt.into_model::<StudentCredits>()
            .one(db)
            .await
            .expect("student credits error") else {
                return Err(ModelError::EntityNotFound);
            };
        tracing::debug!("student credits: {:?}", &student);
        Ok(student)
    }
}

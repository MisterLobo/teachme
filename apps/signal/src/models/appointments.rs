use anyhow::bail;
use chrono::Duration;
use loco_rs::model::{ModelError, ModelResult};
use sea_orm::{ActiveValue, Condition, TransactionTrait, TryIntoModel, entity::prelude::*};
use serde::{Deserialize, Serialize};

use crate::models::{_entities::{appointments, sea_orm_active_enums::{CustomerType, TenantType}}, students, tutors, users::{self, UserRole, UserType}};

pub use super::_entities::appointments::{ActiveModel, Model, Entity};
pub type Appointments = Entity;

#[derive(Debug, Default, Deserialize, Serialize)]
pub struct CreateParams {
    #[serde(rename = "hostId")]
    pub host_id: Uuid,
    #[serde(rename = "dateTime")]
    pub date_time: DateTimeWithTimeZone,
    pub duration: i32,
    #[serde(rename = "calBookingId")]
    pub cal_booking_id: i32,
}

#[derive(Debug, Default, Deserialize, Serialize)]
pub struct AppointmentData {
    id: Uuid,
    #[serde(rename = "startAt")]
    start_at: DateTimeWithTimeZone,
    #[serde(rename = "endAt")]
    end_at: DateTimeWithTimeZone,
    duration: i32,
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
    pub async fn get_appointments(
        db: &DatabaseConnection,
        tenant_customer_id: &Uuid,
        role: &UserType,
    ) -> ModelResult<Vec<AppointmentData>> {
        let results = match role {
            UserType::Individual => {
                let  tutor = tutors::Model::find_by_tenant(db, tenant_customer_id).await?;
                let rows = appointments::Entity::find()
                    .filter(
                        Condition::all()
                            .add(appointments::Column::HostId.eq(tutor.id))
                    )
                    .all(db)
                    .await?;
                rows
            },
            UserType::Student => {
                let student = students::Model::find_by_customer(db, tenant_customer_id).await?;
                let rows = appointments::Entity::find()
                    .filter(
                        Condition::all()
                            .add(appointments::Column::AttendeeId.eq(student.id))
                    )
                    .all(db)
                    .await?;
                rows
            },
            _ => vec![],
        };
        Ok(results.iter().map(|r| AppointmentData {
            id: r.id,
            start_at: r.start_at,
            end_at: r.start_at + Duration::minutes(r.duration as i64),
            duration: r.duration,
        }).collect())
    }
    pub async fn create_appointment(
        db: &DatabaseConnection,
        params: &CreateParams,
        tenant_id: &Uuid,
        attendee_id: &Uuid,
    ) -> ModelResult<Self> {
        let txn = db.begin().await?;

        let appt = ActiveModel {
            id: ActiveValue::Set(Uuid::now_v7()),
            tenant_id: ActiveValue::Set(*tenant_id),
            host_id: ActiveValue::Set(params.host_id),
            attendee_id: ActiveValue::Set(*attendee_id),
            start_at: ActiveValue::Set(params.date_time),
            duration: ActiveValue::Set(params.duration),
            cal_booking_id: ActiveValue::Set(Some(params.cal_booking_id)),
            ..Default::default()
        }
        .insert(&txn)
        .await?;

        txn.commit().await?;

        Ok(appt)
        // Err(ModelError::Message("not allowed".into()))
    }
}

// implement your write-oriented logic here
impl ActiveModel {
    /* pub async fn create_appointment(
        db: &DatabaseConnection,
        params: &CreateParams,
        tenant_id: &Uuid,
        attendee_id: &Uuid,
    ) -> ModelResult<Self> {
        let txn = db.begin().await?;

        let appt = ActiveModel {
            tenant_id: ActiveValue::Set(*tenant_id),
            host_id: ActiveValue::Set(params.host_id),
            attendee_id: ActiveValue::Set(*attendee_id),
            start_at: ActiveValue::Set(params.date_time),
            duration: ActiveValue::Set(params.duration),
            cal_booking_id: ActiveValue::Set(params.cal_booking_id),
            ..Default::default()
        }
        .save(&txn)
        .await?;

        txn.commit().await?;

        Ok(appt)
        // Err(ModelError::Message("not allowed".into()))
    } */
}

// implement your custom finders, selectors oriented logic here
impl Entity {}

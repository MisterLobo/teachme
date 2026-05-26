use std::time::SystemTime;

use chrono::{Duration, FixedOffset, Local};
use loco_rs::{model::{ModelError, ModelResult}, prelude::format};
use sea_orm::{ActiveValue, Condition, QueryOrder, QuerySelect, QueryTrait, TransactionTrait, entity::prelude::*};
use serde::{Deserialize, Serialize};

use crate::models::{_entities::{appointments, sea_orm_active_enums::{self, AppointmentStatus}}, students, tutors, users::UserType};

pub use super::_entities::appointments::{ActiveModel, Model, Entity};
pub type Appointments = Entity;

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct GetAppointmentParams {
    pub id: Uuid,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateParams {
    #[serde(rename = "hostId")]
    pub host_id: Uuid,
    #[serde(rename = "dateTime")]
    pub date_time: DateTimeWithTimeZone,
    pub duration: i32,
    #[serde(rename = "calBookingId")]
    pub cal_booking_id: String,
    pub cal_booking_metadata: Json,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppointmentData {
    id: Uuid,
    #[serde(rename = "startAt")]
    start_at: DateTimeWithTimeZone,
    #[serde(rename = "endAt")]
    end_at: DateTimeWithTimeZone,
    duration: i32,
    cal_booking_id: Option<String>,
    host_id: Uuid,
    attendee_id: Uuid,
    canceled_at: Option<DateTimeWithTimeZone>,
    cancel_reason: Option<String>,
    host: Option<tutors::Model>,
    attendee: Option<students::Model>,
    cal_booking: Option<Json>,
    status: Option<AppointmentStatus>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct AppointmentQueryParams {
    pub start: Option<DateTimeWithTimeZone>,
    pub end: Option<DateTimeWithTimeZone>,
    pub grouped: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct GroupedAppointments {
    pub past: Vec<AppointmentData>,
    pub upcoming: Vec<AppointmentData>,
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
    pub fn to_response(&self) -> AppointmentData {
        AppointmentData {
            id: self.id,
            start_at: self.start_at,
            end_at: self.start_at + Duration::minutes(self.duration as i64),
            duration: self.duration,
            host_id: self.host_id,
            attendee_id: self.attendee_id,
            cal_booking_id: self.cal_booking_id.clone(),
            canceled_at: self.cancelled_at,
            cancel_reason: self.cancel_reason.clone(),
            host: None,
            attendee: None,
            cal_booking: self.cal_metadata.clone(),
            status: self.status.clone(),
        }
    }
    async fn get_past(
        db: &DatabaseConnection,
        dt: Option<DateTimeWithTimeZone>,
        owner_id: &Uuid,
        host: bool,
        tenant_id: Option<Uuid>,
    ) -> Vec<Self> {
        if host {
            tracing::debug!("querying past dates for host: {:?} {:?}", &owner_id, &dt);
        } else {
            tracing::debug!("querying past dates for attendee: {:?} {:?}", &owner_id, &dt);
        }
        let cond = match dt {
            Some(e) => {
                let cond = Condition::all()
                    .add(appointments::Column::StartAt.lt(e.naive_utc()));
                if host {
                    cond
                        .add(appointments::Column::TenantId.eq(tenant_id.unwrap()))
                        .add( appointments::Column::HostId.eq(*owner_id))
                } else {
                    cond.add( appointments::Column::AttendeeId.eq(*owner_id))
                }
            },
            None => {
                let now = Local::now();
                let utc = now.naive_utc();
                let cond = Condition::all()
                    .add(appointments::Column::StartAt.lt(utc));
                if host {
                    cond.add( appointments::Column::HostId.eq(*owner_id))
                } else {
                    cond.add( appointments::Column::AttendeeId.eq(*owner_id))
                }
            },
        };
        // tracing::debug!("cond: {:?}", &cond);
        let rows = appointments::Entity::find()
            .filter(cond)
            .column(appointments::Column::Id)
            .column(appointments::Column::AttendeeId)
            .column(appointments::Column::HostId)
            .column(appointments::Column::StartAt)
            .column(appointments::Column::EndAt)
            .column(appointments::Column::Status)
            .column(appointments::Column::CancelledAt)
            .column(appointments::Column::CancelReason)
            .column(appointments::Column::Duration)
            .column(appointments::Column::Status)
            .limit(10)
            // .group_by(appointments::Column::StartAt)
            .order_by_desc(appointments::Column::StartAt)
            .all(db)
            .await
            // .ok();
            .expect("Error querying db");
        rows //.unwrap_or(vec![])
    }
    async fn get_upcoming(
        db: &DatabaseConnection,
        dt: Option<DateTimeWithTimeZone>,
        owner_id: &Uuid,
        host: bool,
        tenant_id: Option<Uuid>,
    ) -> Vec<Self> {
        if host {
            tracing::debug!("querying upcoming dates for host: {:?} {:?}", &owner_id, &dt);
        } else {
            tracing::debug!("querying upcoming dates for attendee: {:?} {:?}", &owner_id, &dt);
        }
        let cond = match dt {
            Some(e) => {
                let cond = Condition::all()
                    .add(appointments::Column::EndAt.gt(e.to_utc()));
                if host {
                    cond
                        .add(appointments::Column::TenantId.eq(tenant_id.unwrap()))
                        .add( appointments::Column::HostId.eq(*owner_id))
                } else {
                    cond.add( appointments::Column::AttendeeId.eq(*owner_id))
                }
            },
            None => {
                let now = Local::now();
                let utc = now.naive_utc();
                let cond = Condition::all()
                    .add(appointments::Column::EndAt.gt(utc));
                if host {
                    cond.add( appointments::Column::HostId.eq(*owner_id))
                } else {
                    cond.add( appointments::Column::AttendeeId.eq(*owner_id))
                }
               // cond
            },
        };
        // tracing::debug!("cond: {:?}", &cond);
        let rows = appointments::Entity::find()
            .filter(cond)
            .column(appointments::Column::Id)
            .column(appointments::Column::AttendeeId)
            .column(appointments::Column::HostId)
            .column(appointments::Column::StartAt)
            .column(appointments::Column::EndAt)
            .column(appointments::Column::Status)
            .column(appointments::Column::CancelledAt)
            .column(appointments::Column::CancelReason)
            .column(appointments::Column::Duration)
            .column(appointments::Column::CalBookingId)
            .column(appointments::Column::CalMetadata)
            .column(appointments::Column::Status)
            .limit(10)
            // .group_by(appointments::Column::StartAt)
            .order_by_asc(appointments::Column::StartAt)
            .all(db)
            .await
            .expect("Error querying db");
            //.ok();
        let hosts: Vec<Option<tutors::Model>> = rows.load_one(tutors::Entity, db).await.expect("DB error");
        // tracing::debug!("hosts: {:#?}", hosts);
        /* for (row, host) in rows.into_iter().zip(hosts.into_iter()) {
            
        } */
        rows //.unwrap_or(vec![])
    }

    pub async fn get_appointment(
        db: &DatabaseConnection,
        id: &Uuid,
    ) -> ModelResult<Self> {
        let Some(m) = Entity::find_by_id(*id)
            .one(db)
            .await? else {
                return Err(ModelError::EntityNotFound);
            };
        Ok(m)
    }

    pub async fn get_appointments(
        db: &DatabaseConnection,
        tenant_customer_id: &Uuid,
        role: &UserType,
        params: &AppointmentQueryParams,
    ) -> ModelResult<GroupedAppointments> {
        let (past, upcoming) = match role {
            UserType::Individual => {
                let  tutor = tutors::Model::find_by_tenant(db, &tenant_customer_id.clone()).await?;
                let past_rows = Self::get_past(db, params.start, &tutor.id, true, Some(*tenant_customer_id)).await;
                let upcoming_rows = Self::get_upcoming(db, params.start, &tutor.id, true, Some(*tenant_customer_id)).await;
                (
                    past_rows.iter().map(|r| r.to_response())
                    .collect(),
                    upcoming_rows.iter().map(|r| r.to_response())
                    .collect(),
                )
            },
            UserType::Student => {
                let  student = students::Model::find_by_customer(db, tenant_customer_id).await?;
                let past_rows = Self::get_past(db, params.start, &student.id, false, None).await;
                let upcoming_rows = Self::get_upcoming(db, params.start, &student.id, false, None).await;
                (
                    past_rows.iter().map(|r| r.to_response())
                    .collect(),
                    upcoming_rows.iter().map(|r| r.to_response())
                    .collect(),
                )
            },
            _ => (vec![], vec![]),
        };
        Ok(GroupedAppointments {
            past,
            upcoming,
        })
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
            end_at: ActiveValue::Set(params.date_time + Duration::minutes(params.duration.into())),
            duration: ActiveValue::Set(params.duration),
            cal_booking_id: ActiveValue::Set(Some(params.cal_booking_id.clone())),
            cal_metadata: ActiveValue::Set(Some(params.cal_booking_metadata.clone())),
            ..Default::default()
        }
        .insert(&txn)
        .await?;

        txn.commit().await?;

        Ok(appt)
    }
}

// implement your write-oriented logic here
impl ActiveModel {
    pub async fn update_status(
        db: &DatabaseConnection,
        id: &Uuid,
        status: sea_orm_active_enums::AppointmentStatus,
    ) -> ModelResult<Self> {
        tracing::warn!("[update_status] id: {:?}", &id);
        let txn = db.begin().await?;

        let m = Self {
            id: ActiveValue::Unchanged(*id),
            status: ActiveValue::Set(Some(status)),
            ..Default::default()
        }
            .save(&txn)
            .await?;

        txn.commit().await?;

        Ok(m)
    }
}

// implement your custom finders, selectors oriented logic here
impl Entity {}

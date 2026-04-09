use std::time::SystemTime;

use chrono::{Duration, FixedOffset, Local};
use loco_rs::{model::ModelResult, prelude::format};
use sea_orm::{ActiveValue, Condition, QueryOrder, QuerySelect, QueryTrait, TransactionTrait, entity::prelude::*};
use serde::{Deserialize, Serialize};

use crate::models::{_entities::appointments, students, tutors, users::UserType};

pub use super::_entities::appointments::{ActiveModel, Model, Entity};
pub type Appointments = Entity;

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
pub struct AppointmentData {
    id: Uuid,
    #[serde(rename = "startAt")]
    start_at: DateTimeWithTimeZone,
    #[serde(rename = "endAt")]
    end_at: DateTimeWithTimeZone,
    duration: i32,
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
    async fn get_past(
        db: &DatabaseConnection,
        dt: Option<DateTimeWithTimeZone>,
        owner_id: &Uuid,
        host: bool,
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
                    cond.add( appointments::Column::HostId.eq(*owner_id))
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
        tracing::debug!("cond: {:#?}", &cond);
        let rows = appointments::Entity::find()
            .filter(cond)
            .limit(10)
            .group_by(appointments::Column::StartAt)
            .order_by_desc(appointments::Column::StartAt)
            .all(db)
            .await
            .ok();
        rows.unwrap_or(vec![])
    }
    async fn get_upcoming(
        db: &DatabaseConnection,
        dt: Option<DateTimeWithTimeZone>,
        owner_id: &Uuid,
        host: bool,
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
                    cond.add( appointments::Column::HostId.eq(*owner_id))
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
            },
        };
        let rows = appointments::Entity::find()
            .filter(cond)
            .limit(10)
            .group_by(appointments::Column::StartAt)
            .order_by_asc(appointments::Column::StartAt)
            .all(db)
            .await
            .ok();
        rows.unwrap_or(vec![])
    }

    pub async fn get_appointments(
        db: &DatabaseConnection,
        tenant_customer_id: &Uuid,
        role: &UserType,
        params: &AppointmentQueryParams,
    ) -> ModelResult<GroupedAppointments> {
        let (past, upcoming) = match role {
            UserType::Individual => {
                let  tutor = tutors::Model::find_by_tenant(db, tenant_customer_id).await?;
                let past_rows = Self::get_past(db, params.start, &tutor.id, true).await;
                let upcoming_rows = Self::get_upcoming(db, params.start, &tutor.id, true).await;
                (
                    past_rows.iter().map(|r| AppointmentData {
                        id: r.id,
                        start_at: r.start_at,
                        end_at: r.start_at + Duration::minutes(r.duration as i64),
                        duration: r.duration,
                    })
                    .collect(),
                    upcoming_rows.iter().map(|r| AppointmentData {
                        id: r.id,
                        start_at: r.start_at,
                        end_at: r.start_at + Duration::minutes(r.duration as i64),
                        duration: r.duration,
                    })
                    .collect(),
                )
            },
            UserType::Student => {
                let  student = students::Model::find_by_customer(db, tenant_customer_id).await?;
                let past_rows = Self::get_past(db, params.start, &student.id, true).await;
                let upcoming_rows = Self::get_upcoming(db, params.start, &student.id, true).await;
                (
                    past_rows.iter().map(|r| AppointmentData {
                        id: r.id,
                        start_at: r.start_at,
                        end_at: r.start_at + Duration::minutes(r.duration as i64),
                        duration: r.duration,
                    })
                    .collect(),
                    upcoming_rows.iter().map(|r| AppointmentData {
                        id: r.id,
                        start_at: r.start_at,
                        end_at: r.start_at + Duration::minutes(r.duration as i64),
                        duration: r.duration,
                    })
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
            cal_booking_id: ActiveValue::Set(Some(params.cal_booking_id)),
            ..Default::default()
        }
        .insert(&txn)
        .await?;

        txn.commit().await?;

        Ok(appt)
    }
}

// implement your write-oriented logic here
impl ActiveModel {}

// implement your custom finders, selectors oriented logic here
impl Entity {}

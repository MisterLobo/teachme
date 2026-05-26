#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unnecessary_struct_initialization)]
#![allow(clippy::unused_async)]
use std::collections::HashMap;
use std::env;
use std::str::FromStr;

use axum::body::Body;
use axum::http::{HeaderMap, HeaderValue};
use chrono::Duration;
use fastembed::TextEmbedding;
use loco_rs::prelude::*;
use qdrant_client::Qdrant;
use qdrant_client::qdrant::point_id::PointIdOptions;
use qdrant_client::qdrant::{Condition, Filter, QueryPointsBuilder, Range};
use reqwest::{ClientBuilder, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use crate::models::tutors::{self, CreateParams, GetTutorParams, UpdateParams};
use crate::models::users;
use crate::{
    models::tutors::SearchParams,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResults {
    data: Vec<Value>,
    count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CalApiResponse {
    pub data: Value,
    pub status: String,
}

#[debug_handler]
pub async fn index(State(_ctx): State<AppContext>) -> Result<Response> {
    let mut res = Response::new(Body::empty());
    *res.status_mut() = StatusCode::NOT_FOUND;
    Ok(res)
}

#[debug_handler]
async fn search(
    // auth: auth::JWT,
    State(ctx): State<AppContext>,
    Json(params): Json<SearchParams>,
) -> Result<Response> {
    tracing::debug!("search params: {:?}", &params);
    let price = Decimal::from_f64_retain(params.session_price.clone().unwrap_or_default()).unwrap_or_default();
    price.as_f64();
    let documents = vec![
        params.prompt.clone(),
    ];

    let mut model = TextEmbedding::try_new(Default::default()).expect("could not initialize model");
    let embeddings = model.embed(documents, None).unwrap();
    let embedding = embeddings.first().unwrap().clone();
    let qdrant_url = env::var("QDRANT_API_URL").unwrap_or_default();
    let qclient = Qdrant::from_url(&qdrant_url).build().expect("error");
    let session_price = Condition::range("session_price", Range {
        gte: Some(price.as_f64()),
        lte: Some(price.as_f64() + 10.),
        ..Default::default()
    });
    let session_duration = Condition::range("session_price", Range {
        gte: Some(f64::from(params.session_duration.clone().unwrap())),
        lte: Some(f64::from(params.session_duration.clone().unwrap() + 30)),
        ..Default::default()
    });
    let query_result = qclient.query(
        QueryPointsBuilder::new("tutors")
            .query(embedding)
            .limit(10)
            .filter(Filter::any([
                Condition::matches_text("categories", params.categories.clone().unwrap_or_default()),
                Condition::matches_text("subjects", params.subjects.clone().unwrap_or_default()),
                Condition::matches("country", params.country.clone().unwrap_or_default()),
                Condition::matches("currency", params.currency.clone().unwrap_or_default()),
                Condition::matches_text("bio", params.bio.clone().unwrap_or_default()),
                Condition::matches("timezone", params.timezone.clone().unwrap_or_default()),
                session_price,
                session_duration,
            ]))
            .with_payload(true),
    ).await.expect("msg");
    tracing::debug!("results from qdrant: {:#?}", query_result);
    // let found_point = query_result.result.into_iter().next().unwrap();

    let ids: Vec<Uuid> = query_result.result.iter().filter_map(|v| {
        let id = v.id.clone().unwrap();
        let pt = match id.point_id_options.unwrap() {
            PointIdOptions::Uuid(uid) => Some(Uuid::from_str(&uid).unwrap()),
            PointIdOptions::Num(_) => None,
        };
        pt
    })
    .collect();

    let meta_results = tutors::Model::get_metadata(&ctx.db, ids).await?;
    tracing::debug!("response from metadata: {} {:?}", &meta_results.len(), &meta_results);
    // let results = tutors::Model::find_all(&ctx.db, &params).await?;
    let count = meta_results.len();

    let end = params.start_time.clone().unwrap() + Duration::minutes(30);

    tracing::debug!("start={} end={}", &params.start_time.clone().unwrap().to_rfc3339(), &end.to_rfc3339());
    let api_key = env::var("CAL_COM_API_KEY").unwrap_or_default();
    let org_slug = env::var("CAL_ORG_SLUG").unwrap_or_default();
    let cal_url = env::var("CAL_API_URL").unwrap_or_default();
    let cal_url = format!(
        "{cal_url}/slots",
    );
    let mut headers = HeaderMap::new();
    headers.insert("Authorization", HeaderValue::from_str(&format!("Bearer {api_key}")).unwrap());
    headers.insert("cal-api-version", HeaderValue::from_str("2024-09-04").unwrap());
    let client = ClientBuilder::new()
        .default_headers(headers)
        .build()
        .expect("error");

    use futures::stream::{self, StreamExt};

    let free_slots: Vec<Value> = stream::iter(meta_results)
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
        .await;

    format::json(SearchResults {
        data: free_slots,
        count: count,
    })
}

#[debug_handler]
async fn get_by_id(
    State(ctx): State<AppContext>,
    // auth: auth::JWT,
    Path(params): Path<GetTutorParams>,
) -> Result<Response> {
    let tutor = tutors::Model::find_by_id(&ctx.db, &params.id).await?;
    tracing::debug!("tutor found: {:?}", &tutor);
    format::json(tutor.unwrap())
}

#[debug_handler]
async fn get_metadata(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Path(params): Path<GetTutorParams>,
) -> Result<Response> {
    format::empty_json()
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api/tutors/")
        .add("/", get(index))
        // .add("/search", post(search))
        .add("/{id}", get(get_by_id))
        .add("/metadata", get(get_metadata))
}

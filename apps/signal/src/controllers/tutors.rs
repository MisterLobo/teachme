#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unnecessary_struct_initialization)]
#![allow(clippy::unused_async)]
use loco_rs::prelude::*;
use serde::{Deserialize, Serialize};
use crate::{
    models::tutors::SearchParams,
};
use crate::{workers::semantic_search};

#[debug_handler]
pub async fn index(State(_ctx): State<AppContext>) -> Result<Response> {
    format::empty()
}

#[debug_handler]
async fn search(
    State(ctx): State<AppContext>,
    Json(params): Json<SearchParams>,
) -> Result<Response> {
    tracing::debug!("search params: {:?}", params);
    semantic_search::Worker::build(&ctx).perform(semantic_search::WorkerArgs { search_params: params }).await?;
    format::json({})
}

#[debug_handler]
async fn create(
    State(ctx): State<AppContext>,
) -> Result<Response> {
    format::empty()
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api/tutors/")
        .add("/", get(index))
        .add("/search", post(search))
        .add("/create", post(create))
}

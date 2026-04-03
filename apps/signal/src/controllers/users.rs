#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unnecessary_struct_initialization)]
#![allow(clippy::unused_async)]
use loco_rs::prelude::*;

#[debug_handler]
pub async fn index(State(_ctx): State<AppContext>) -> Result<Response> {
    format::empty()
}

async fn check_user(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    format::empty_json()
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api/users/")
        .add("/", get(index))
        .add("/check", get(check_user))
}

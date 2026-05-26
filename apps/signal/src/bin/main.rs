use std::env;

use loco_rs::cli;
use migration::Migrator;
use qdrant_client::{Qdrant, qdrant::{CreateCollectionBuilder, VectorParamsBuilder, VectorsConfigBuilder}};
use rustls::crypto::CryptoProvider;
use signal::app::App;
use dotenv::dotenv;

#[tokio::main]
async fn main() -> loco_rs::Result<()> {
    dotenv().ok();

    CryptoProvider::install_default(
        rustls::crypto::ring::default_provider()
    ).unwrap();

    let client = Qdrant::from_url(&env::var("QDRANT_API_URL").unwrap_or_default())
        .api_key(env::var("QDRANT_API_KEY"))
        .build()
        .expect("failed to initialize connection");
    let coll = client.list_collections().await.expect("error");
    let params = VectorParamsBuilder::new(384, qdrant_client::qdrant::Distance::Cosine).build();
    let mut config = VectorsConfigBuilder::default();
    config.add_vector_params(params);
    if coll.collections.len() == 0 {
        client.create_collection(
            CreateCollectionBuilder::new("tutors")
                .vectors_config(config)
                .build()
        ).await.expect("failed to create collection");
    }
    
    tracing::debug!("{}", coll.collections.len());

    cli::main::<App, Migrator>().await
}

use std::{collections::HashMap, env};

use fastembed::TextEmbedding;
use qdrant_client::{Payload, Qdrant, config::QdrantConfig, qdrant::{PointStruct, UpsertPointsBuilder, Vectors}};
use serde::{Deserialize, Serialize};
use loco_rs::prelude::*;

use crate::models::{self, tutors};

pub struct Worker {
    pub ctx: AppContext,
    pub qdrant: Qdrant,
}

#[derive(Default, Deserialize, Debug, Serialize)]
pub struct TutorDocument {
    // pub id: String,
    pub categories: String,
    pub subjects: String,
    pub country: String,
    pub bio: String,
    pub currency: String,
    pub session_price: Decimal,
    pub primary_language: String,
}

impl TutorDocument {
    pub fn from_model(model: &tutors::Model) -> Self {
        Self {
            // id: model.id.to_string(),
            categories: model.categories.clone().unwrap_or_default(),
            subjects: model.subjects.clone().unwrap_or_default(),
            country: model.country.clone(),
            bio: model.bio.clone().unwrap_or_default(),
            currency: model.currency.clone(),
            session_price: model.session_price.unwrap_or_default(),
            primary_language: model.primary_language.clone().unwrap_or_default(),
        }
    }
}

#[derive(Deserialize, Debug, Serialize)]
pub struct WorkerArgs {
    pub tutor: Option<models::_entities::tutors::Model>,
    pub prompt: Option<String>,
}

impl WorkerArgs {
    pub fn new() -> Self {
        Self {
            tutor: None,
            prompt: None,
        }
    }
}

#[async_trait]
impl BackgroundWorker<WorkerArgs> for Worker {
    /// Creates a new instance of the Worker with the given application context.
    /// 
    /// This function is called when registering the worker with the queue system.
    /// 
    /// # Parameters
    /// * `ctx` - The application context containing shared resources
    fn build(ctx: &AppContext) -> Self {
        let url = std::env::var("QDRANT_API_URL").unwrap_or_default();
        Self {
            ctx: ctx.clone(),
            qdrant: Qdrant::from_url(&url)
                .skip_compatibility_check()
                .build()
                .expect("failed to initialize connection"),
        }
    }

    /// Returns the class name of the worker.
    /// 
    /// This name is used when enqueueing jobs and identifying the worker in logs.
    /// The implementation returns the struct name as a string.
    fn class_name() -> String {
        "CreateTutorEmbedding".to_string()
    }

    /// Returns tags associated with this worker.
    /// 
    /// Tags can be used to filter which workers run during startup.
    /// The default implementation returns an empty vector (no tags).
    fn tags() -> Vec<String> {
        Vec::new()
    }
    
    /// Performs the actual work when a job is processed.
    /// 
    /// This is the main function that contains the worker's logic.
    /// It gets executed when a job is dequeued from the job queue.
    /// 
    /// # Returns
    /// * `Result<()>` - Ok if the job completed successfully, Err otherwise
    async fn perform(&self, args: WorkerArgs) -> Result<()> {
        println!("=================CreateTutorEmbedding=======================");
        let mut model = TextEmbedding::try_new(Default::default()).expect("could not initialize model");

        let documents = vec![
            args.prompt.unwrap(),
        ];

        let embeddings = model.embed(documents, None).unwrap();
        let embedding = embeddings.first().unwrap().clone();
        // let embedding = pgvector::Vector::from(embedding);
        /* tutor_embeddings::ActiveModel::create_embedding(&self.ctx.db, &tutor_embeddings::CreateParams {
            tutor_id: args.tutor_id,
            embedding,
        }).await?; */

        let index = TutorDocument::from_model(&args.tutor.as_ref().clone().unwrap());
        let payload: Payload = serde_json::json!(index).try_into().unwrap();
        tracing::debug!("{:#?}", payload);

        let client = &self.qdrant;

        let coll = client.list_collections().await.expect("failed to execute list");

        let ps = PointStruct::new(args.tutor.as_ref().unwrap().id.to_string(), embedding, payload);
        let points = client.upsert_points(
            // "tutors_embedding", vec![ps],
            UpsertPointsBuilder::new("tutors", vec![ps]).wait(true),
        ).await.expect("error upsert on Points");
        tracing::debug!("{:?}", points.result);

        Ok(())
    }
}

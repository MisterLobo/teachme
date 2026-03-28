use fastembed::{InitOptions, TextEmbedding};
use serde::{Deserialize, Serialize};
use loco_rs::prelude::*;

use crate::models::tutors::{self, SearchParams};

pub struct Worker {
    pub ctx: AppContext,
}

#[derive(Deserialize, Debug, Serialize)]
pub struct WorkerArgs {
    pub search_params: SearchParams,
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
        Self { ctx: ctx.clone() }
    }

    /// Returns the class name of the worker.
    /// 
    /// This name is used when enqueueing jobs and identifying the worker in logs.
    /// The implementation returns the struct name as a string.
    fn class_name() -> String {
        "SemanticSearch".to_string()
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
        println!("=================SemanticSearch=======================");
        /* let mut model = TextEmbedding::try_new(
            InitOptions::new(fastembed::EmbeddingModel::AllMiniLML12V2),
        ).unwrap(); */
        let mut model = TextEmbedding::try_new(Default::default()).expect("could not initialize model");

        let documents = vec![
            "passage: Hello, World!",
        ];

        let embeddings = model.embed(documents, None).unwrap();
        let first = &embeddings[0];

        tutors::Model::find_match(&self.ctx.db, &args.search_params, first.clone()).await?;

        Ok(())
    }
}

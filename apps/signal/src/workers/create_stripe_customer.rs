use migration::ExprTrait;
use serde::{Deserialize, Serialize};
use loco_rs::prelude::*;
use stripe_core::customer::{CreateCustomer, SearchCustomer};

use crate::{models::{customers::{self, Customer}, users::UserRole}, services::StripeService};

pub struct Worker {
    pub ctx: AppContext,
}

#[derive(Deserialize, Debug, Serialize)]
pub struct WorkerArgs {
    pub row_id: Option<Uuid>,
    pub customer: Option<Customer>,
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
        "CreateStripeCustomer".to_string()
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
        if args.customer.is_none() {
            return Ok(())
        }
        println!("=================CreateStripeCustomer=======================");
        let c = args.customer.unwrap();
        let cus = match &c {
            Customer::Student(s) => s,
            Customer::Parent(p) => p,
        };
        let keys = self.ctx.shared_store.get::<StripeService>().expect("could not load instance of StripeService");
        let secret = &keys.secret_key.ok_or("invalid".to_string()).expect("Failed to retrieve secret");

        let client = stripe::ClientBuilder::new(secret)
            .request_strategy(stripe::RequestStrategy::Retry(3))
            .build()
            .unwrap();

        let customer = SearchCustomer::new(format!("email~\"{}\"", &cus.email))
            .send(&client)
            .await
            .expect("error searching customer");

        if !customer.data.is_empty() {
            return Ok(());
        }
        let customer = CreateCustomer::new()
            .email(cus.email.clone())
            .name(cus.name.clone())
            .send(&client)
            .await
            .expect("error creating customer");

        tracing::debug!("new stripe customer: {}", &customer.id.to_string());

        tracing::debug!("updating row: id={}", &args.row_id.unwrap());
        let updates = customers::ActiveModel {
            id: ActiveValue::Unchanged(args.row_id.unwrap()),
            stripe_customer_id: ActiveValue::Set(Some(customer.id.to_string())),
            ..Default::default()
        }
        .save(&self.ctx.db)
        .await
        .expect("failed to update record");

        tracing::debug!("updated: {:#?}", &updates);
        Ok(())
    }
}

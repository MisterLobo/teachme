use serde::{Deserialize, Serialize};
use loco_rs::prelude::*;
use stripe_connect::account::{CapabilitiesParam, CapabilityParam, CreateAccount, CreateAccountBusinessProfile, CreateAccountIndividual, CreateAccountType, TosAcceptanceSpecs};
use stripe_shared::AccountBusinessType;

use crate::{models::{self, tutors, users::RegisterParams}, services::StripeService};

pub struct Worker {
    pub ctx: AppContext,
}

#[derive(Deserialize, Debug, Serialize)]
pub struct WorkerArgs {
    pub pid: Uuid,
    pub params: Option<RegisterParams>,
    pub tutor: Option<models::_entities::tutors::Model>,
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
        "CreateStripeConnect".to_string()
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
        if args.params.is_none() {
            return Ok(())
        }
        if args.tutor.is_none() {
            return Ok(())
        }
        let params = args.params.unwrap();
        let tutor = args.tutor.unwrap();
        println!("=================CreateStripeConnect=======================");
        let keys = self.ctx.shared_store.get::<StripeService>().expect("could not load instance of StripeService");
        let secret = &keys.secret_key.ok_or("invalid".to_string()).expect("Failed to retrieve secret");

        let client = stripe::ClientBuilder::new(secret)
            .request_strategy(stripe::RequestStrategy::Retry(3))
            .build()
            .unwrap();

        let account = CreateAccount::new()
            .type_(CreateAccountType::Express)
            .individual(CreateAccountIndividual {
                first_name: Some(tutor.first_name.clone()),
                last_name: Some(tutor.last_name.clone()),
                ..Default::default()
            })
            .business_type(AccountBusinessType::Individual)
            .country(tutor.country)
            .email(params.email)
            .business_profile(CreateAccountBusinessProfile {
                name: Some(format!("{} {}", tutor.first_name.clone(), tutor.last_name.clone())),
                ..Default::default()
            })
            .tos_acceptance(TosAcceptanceSpecs {
                service_agreement: Some("recipient".into()),
                ..Default::default()
            })
            .capabilities(CapabilitiesParam {
                transfers: Some(CapabilityParam {
                    requested: Some(true),
                }),
                ..Default::default()
            })
            .send(&client)
            .await
            .expect("error creating account");

        self.ctx.cache.insert(&format!("{}:stripe-account", &args.pid), &account.id.to_string()).await.expect("Failed to cache data");

        tracing::debug!("new account: {:#?}", &account);
        let model = tutors::ActiveModel {
                id: ActiveValue::Unchanged(tutor.id),
                stripe_connect_id: ActiveValue::Set(Some(account.id.to_string())),
                ..Default::default()
            }
            .save(&self.ctx.db)
            .await
            .expect("failed to update data");
        
        tracing::debug!("updated: {:#?}", &model);
        Ok(())
    }
}

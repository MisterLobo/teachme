use loco_rs::prelude::*;

pub struct SendPayment;
#[async_trait]
impl Task for SendPayment {
    fn task(&self) -> TaskInfo {
        TaskInfo {
            name: "send_payment".to_string(),
            detail: "Task generator".to_string(),
        }
    }
    async fn run(&self, _app_context: &AppContext, _vars: &task::Vars) -> Result<()> {
        println!("Task SendPayment generated");
        //1. Get all recent transactions
        //2. Collect all transactions of every 10 tutors
        Ok(())
    }
}

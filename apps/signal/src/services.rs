use socketioxide::extract::SocketRef;
use tokio_cron_scheduler::JobScheduler;

#[derive(Debug, Clone)]
pub struct TestClonableService;

#[derive(Debug)]
pub struct NonClonableService;

#[derive(Debug, Clone)]
pub struct StripeService {
  pub publishable_key: Option<String>,
  pub secret_key: Option<String>,
}

#[derive(Clone)]
pub struct CronService(pub JobScheduler);

#[derive(Debug, Clone)]
pub struct RealtimeService {
  pub socket: SocketRef,
}
use loco_rs::{bgworker::BackgroundWorker, testing::prelude::*};
use signal::{
    app::App,
    workers::create_stripe_customer::{Worker, WorkerArgs},
};
use serial_test::serial;

#[tokio::test]
#[serial]
async fn test_run_create_stripe_customer_worker() {
    let boot = boot_test::<App>().await.unwrap();

    // Execute the worker ensuring that it operates in 'ForegroundBlocking' mode, which prevents the addition of your worker to the background
    assert!(
        Worker::perform_later(&boot.app_context,WorkerArgs { role: signal::models::users::UserType::Null, row_id: None, customer: None })
            .await
            .is_ok()
    );
    // Include additional assert validations after the execution of the worker
}

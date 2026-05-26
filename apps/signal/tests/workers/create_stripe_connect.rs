use loco_rs::{bgworker::BackgroundWorker, testing::prelude::*};
use signal::{
    app::App,
    workers::create_stripe_connect::{Worker, WorkerArgs},
};
use serial_test::serial;
use uuid::Uuid;

#[tokio::test]
#[serial]
async fn test_run_create_stripe_connect_worker() {
    let boot = boot_test::<App>().await.unwrap();

    // Execute the worker ensuring that it operates in 'ForegroundBlocking' mode, which prevents the addition of your worker to the background
    assert!(
        Worker::perform_later(&boot.app_context,WorkerArgs { pid: Uuid::now_v7(), params: None, tutor: None })
            .await
            .is_ok()
    );
    // Include additional assert validations after the execution of the worker
}

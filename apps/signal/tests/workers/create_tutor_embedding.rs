use loco_rs::{bgworker::BackgroundWorker, testing::prelude::*};
use signal::{
    app::App,
    workers::create_tutor_embedding::{Worker, WorkerArgs},
};
use serial_test::serial;

#[tokio::test]
#[serial]
async fn test_run_create_tutor_embedding_worker() {
    let boot = boot_test::<App>().await.unwrap();

    // Execute the worker ensuring that it operates in 'ForegroundBlocking' mode, which prevents the addition of your worker to the background
    assert!(
        Worker::perform_later(&boot.app_context, WorkerArgs {
            prompt: None,
            tutor: None,
        })
            .await
            .is_ok()
    );
    // Include additional assert validations after the execution of the worker
}

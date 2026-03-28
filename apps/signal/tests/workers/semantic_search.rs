use loco_rs::{bgworker::BackgroundWorker, testing::prelude::*};
use signal::{
    app::App, models::tutors::SearchParams, workers::semantic_search::{Worker, WorkerArgs}
};
use serial_test::serial;

#[tokio::test]
#[serial]
async fn test_run_semantic_search_worker() {
    let boot = boot_test::<App>().await.unwrap();

    // Execute the worker ensuring that it operates in 'ForegroundBlocking' mode, which prevents the addition of your worker to the background
    assert!(
        Worker::perform_later(&boot.app_context,WorkerArgs { search_params: Default::default() })
            .await
            .is_ok()
    );
    // Include additional assert validations after the execution of the worker
}

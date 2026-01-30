//! Terminal Performance Tests
//!
//! Tests for terminal concurrent connections and connection latency.
//!
//! These tests measure:
//! - Concurrent connection handling capacity
//! - Connection establishment latency (P95)
//! - Reconnection recovery time
//!
//! Run with: cargo test --test performance_terminal -- --nocapture

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Semaphore;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use futures_util::SinkExt;

// Fixed: Use path parameter format instead of query parameter
const WS_URL_BASE: &str = "ws://localhost:3001/api/terminal";

/// Statistics collector for performance metrics
#[derive(Debug, Default)]
struct PerfStats {
    successful: AtomicUsize,
    failed: AtomicUsize,
    latencies_ms: parking_lot::Mutex<Vec<u64>>,
}

impl PerfStats {
    fn new() -> Self {
        Self::default()
    }

    fn record_success(&self, latency_ms: u64) {
        self.successful.fetch_add(1, Ordering::SeqCst);
        self.latencies_ms.lock().push(latency_ms);
    }

    fn record_failure(&self) {
        self.failed.fetch_add(1, Ordering::SeqCst);
    }

    fn success_rate(&self) -> f64 {
        let success = self.successful.load(Ordering::SeqCst) as f64;
        let total = success + self.failed.load(Ordering::SeqCst) as f64;
        if total == 0.0 {
            0.0
        } else {
            success / total * 100.0
        }
    }

    fn p95_latency_ms(&self) -> Option<u64> {
        let mut latencies = self.latencies_ms.lock().clone();
        if latencies.is_empty() {
            return None;
        }
        latencies.sort();
        let idx = (latencies.len() as f64 * 0.95) as usize;
        Some(latencies[idx.min(latencies.len() - 1)])
    }

    fn avg_latency_ms(&self) -> Option<f64> {
        let latencies = self.latencies_ms.lock();
        if latencies.is_empty() {
            return None;
        }
        Some(latencies.iter().sum::<u64>() as f64 / latencies.len() as f64)
    }
}

/// Attempt to establish a WebSocket connection and measure latency
async fn connect_and_measure(
    url_base: &str,
    terminal_id: &str,
    stats: Arc<PerfStats>,
) {
    // Fixed: Use path parameter format
    let full_url = format!("{}/{}", url_base, terminal_id);
    let start = Instant::now();

    match tokio::time::timeout(Duration::from_secs(10), connect_async(&full_url)).await {
        Ok(Ok((mut ws, _))) => {
            let latency = start.elapsed().as_millis() as u64;

            // Send a ping to verify connection is working
            if ws.send(Message::Ping(vec![])).await.is_ok() {
                stats.record_success(latency);
            } else {
                stats.record_failure();
            }

            // Close connection gracefully
            let _ = ws.close(None).await;
        }
        Ok(Err(_)) | Err(_) => {
            stats.record_failure();
        }
    }
}

/// Run concurrent connection test with specified number of connections
async fn run_concurrent_test(num_connections: usize, max_concurrent: usize) -> PerfStats {
    let stats = Arc::new(PerfStats::new());
    let semaphore = Arc::new(Semaphore::new(max_concurrent));

    let mut handles = Vec::with_capacity(num_connections);

    for i in 0..num_connections {
        let stats = Arc::clone(&stats);
        let semaphore = Arc::clone(&semaphore);
        // Fixed: Use proper UUID format
        let terminal_id = uuid::Uuid::new_v4().to_string();

        let handle = tokio::spawn(async move {
            let _permit = semaphore.acquire().await.unwrap();
            connect_and_measure(WS_URL_BASE, &terminal_id, stats).await;
        });

        handles.push(handle);

        // Small delay to avoid thundering herd
        if i % 10 == 0 {
            tokio::time::sleep(Duration::from_millis(1)).await;
        }
    }

    // Wait for all connections to complete
    for handle in handles {
        let _ = handle.await;
    }

    Arc::try_unwrap(stats).unwrap_or_default()
}

/// Check if server is running
async fn server_is_running() -> bool {
    reqwest::Client::new()
        .get("http://localhost:3001/api/cli_types")
        .timeout(Duration::from_secs(5))
        .send()
        .await
        .is_ok()
}

#[tokio::test]
#[ignore = "requires running server"]
async fn test_terminal_concurrent_connections_100() {
    if !server_is_running().await {
        eprintln!("Server not running, skipping test");
        return;
    }

    let stats = run_concurrent_test(100, 50).await;

    println!("\n=== 100 Concurrent Connections Test ===");
    println!("Success rate: {:.2}%", stats.success_rate());
    println!("P95 latency: {:?} ms", stats.p95_latency_ms());
    println!("Avg latency: {:.2} ms", stats.avg_latency_ms().unwrap_or(0.0));

    assert!(
        stats.success_rate() >= 99.0,
        "Success rate {:.2}% is below 99% threshold",
        stats.success_rate()
    );
}

#[tokio::test]
#[ignore = "requires running server"]
async fn test_terminal_concurrent_connections_500() {
    if !server_is_running().await {
        eprintln!("Server not running, skipping test");
        return;
    }

    let stats = run_concurrent_test(500, 100).await;

    println!("\n=== 500 Concurrent Connections Test ===");
    println!("Success rate: {:.2}%", stats.success_rate());
    println!("P95 latency: {:?} ms", stats.p95_latency_ms());
    println!("Avg latency: {:.2} ms", stats.avg_latency_ms().unwrap_or(0.0));

    assert!(
        stats.success_rate() >= 95.0,
        "Success rate {:.2}% is below 95% threshold",
        stats.success_rate()
    );
}

#[tokio::test]
#[ignore = "requires running server"]
async fn test_terminal_connection_latency_p95() {
    if !server_is_running().await {
        eprintln!("Server not running, skipping test");
        return;
    }

    let stats = run_concurrent_test(50, 10).await;

    println!("\n=== Connection Latency Test ===");
    println!("P95 latency: {:?} ms", stats.p95_latency_ms());
    println!("Avg latency: {:.2} ms", stats.avg_latency_ms().unwrap_or(0.0));

    if let Some(p95) = stats.p95_latency_ms() {
        assert!(
            p95 <= 500,
            "P95 latency {} ms exceeds 500ms threshold",
            p95
        );
    }
}

#[tokio::test]
#[ignore = "requires running server"]
async fn test_terminal_reconnection_recovery() {
    if !server_is_running().await {
        eprintln!("Server not running, skipping test");
        return;
    }

    // Fixed: Use proper UUID and path format
    let terminal_id = uuid::Uuid::new_v4().to_string();
    let url = format!("{}/{}", WS_URL_BASE, terminal_id);

    // First connection
    let start = Instant::now();
    let (mut ws1, _) = connect_async(&url).await.expect("First connection failed");
    let first_connect_time = start.elapsed();

    // Close connection
    ws1.close(None).await.expect("Failed to close first connection");

    // Wait a bit
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Reconnect
    let start = Instant::now();
    let (mut ws2, _) = connect_async(&url).await.expect("Reconnection failed");
    let reconnect_time = start.elapsed();

    println!("\n=== Reconnection Recovery Test ===");
    println!("First connection: {:?}", first_connect_time);
    println!("Reconnection: {:?}", reconnect_time);

    assert!(
        reconnect_time.as_secs() <= 5,
        "Reconnection took {:?}, exceeds 5s threshold",
        reconnect_time
    );

    let _ = ws2.close(None).await;
}

#[cfg(test)]
mod benchmarks {
    use super::*;

    /// Benchmark helper for connection throughput
    pub async fn benchmark_connection_throughput(connections_per_second: usize, duration_secs: u64) -> PerfStats {
        let stats = Arc::new(PerfStats::new());
        let start = Instant::now();
        let mut connection_count = 0;

        while start.elapsed().as_secs() < duration_secs {
            let batch_start = Instant::now();
            let mut handles = Vec::new();

            for _ in 0..connections_per_second {
                let stats = Arc::clone(&stats);
                let terminal_id = uuid::Uuid::new_v4().to_string();

                handles.push(tokio::spawn(async move {
                    connect_and_measure(WS_URL_BASE, &terminal_id, stats).await;
                }));

                connection_count += 1;
            }

            for handle in handles {
                let _ = handle.await;
            }

            // Wait for the rest of the second
            let elapsed = batch_start.elapsed();
            if elapsed < Duration::from_secs(1) {
                tokio::time::sleep(Duration::from_secs(1) - elapsed).await;
            }
        }

        println!("Total connections attempted: {}", connection_count);
        Arc::try_unwrap(stats).unwrap_or_default()
    }
}

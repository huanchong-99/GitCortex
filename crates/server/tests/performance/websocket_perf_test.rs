//! WebSocket Performance Tests
//!
//! Tests for WebSocket message throughput and latency.
//!
//! These tests measure:
//! - Single connection message throughput (TPS)
//! - Multi-connection aggregate throughput
//! - Message latency (P95)
//! - Broadcast performance
//!
//! Run with: cargo test --test performance_websocket -- --nocapture

use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Semaphore;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use futures_util::{SinkExt, StreamExt};
use serde_json::json;

// Fixed: Use path parameter format
const WS_URL_BASE: &str = "ws://localhost:3001/api/terminal";

/// Check if a WebSocket message is an error response from the server
/// This helps distinguish between successful echoes and error messages
fn is_error_message(msg: &Message) -> bool {
    match msg {
        Message::Text(text) => {
            // Check for common error patterns in JSON responses
            let text_lower = text.to_lowercase();
            text_lower.contains("\"error\"")
                || text_lower.contains("\"type\":\"error\"")
                || text_lower.contains("not found")
                || text_lower.contains("invalid")
                || text_lower.contains("failed")
        }
        _ => false,
    }
}

/// Message throughput statistics
#[derive(Debug, Default)]
struct ThroughputStats {
    messages_sent: AtomicUsize,
    messages_received: AtomicUsize,
    bytes_sent: AtomicU64,
    bytes_received: AtomicU64,
    latencies_us: parking_lot::Mutex<Vec<u64>>,
    errors: AtomicUsize,
}

impl ThroughputStats {
    fn new() -> Self {
        Self::default()
    }

    fn record_send(&self, bytes: usize) {
        self.messages_sent.fetch_add(1, Ordering::SeqCst);
        self.bytes_sent.fetch_add(bytes as u64, Ordering::SeqCst);
    }

    fn record_receive(&self, bytes: usize, latency_us: u64) {
        self.messages_received.fetch_add(1, Ordering::SeqCst);
        self.bytes_received.fetch_add(bytes as u64, Ordering::SeqCst);
        self.latencies_us.lock().push(latency_us);
    }

    fn record_error(&self) {
        self.errors.fetch_add(1, Ordering::SeqCst);
    }

    fn tps(&self, duration: Duration) -> f64 {
        let messages = self.messages_received.load(Ordering::SeqCst) as f64;
        messages / duration.as_secs_f64()
    }

    fn p95_latency_us(&self) -> Option<u64> {
        let mut latencies = self.latencies_us.lock().clone();
        if latencies.is_empty() {
            return None;
        }
        latencies.sort();
        let idx = (latencies.len() as f64 * 0.95) as usize;
        Some(latencies[idx.min(latencies.len() - 1)])
    }

    fn avg_latency_us(&self) -> Option<f64> {
        let latencies = self.latencies_us.lock();
        if latencies.is_empty() {
            return None;
        }
        Some(latencies.iter().sum::<u64>() as f64 / latencies.len() as f64)
    }

    fn throughput_mbps(&self, duration: Duration) -> f64 {
        let bytes = self.bytes_received.load(Ordering::SeqCst) as f64;
        (bytes * 8.0) / (duration.as_secs_f64() * 1_000_000.0)
    }
}

/// Generate test message of specified size
fn generate_message(size: usize) -> String {
    let base = "test_message_";
    let padding_size = size.saturating_sub(base.len());
    format!("{}{}", base, "x".repeat(padding_size))
}

/// Run single connection throughput test
async fn run_single_connection_throughput(
    messages_to_send: usize,
    message_size: usize,
) -> Option<(ThroughputStats, Duration)> {
    let terminal_id = uuid::Uuid::new_v4().to_string();
    // Fixed: Use path parameter format
    let url = format!("{}/{}", WS_URL_BASE, terminal_id);

    let (mut ws, _) = match connect_async(&url).await {
        Ok(conn) => conn,
        Err(_) => return None,
    };

    let stats = Arc::new(ThroughputStats::new());
    let message = generate_message(message_size);
    // Fixed: Use JSON WsMessage format expected by server
    let payload = json!({ "type": "input", "data": message });
    let payload_str = payload.to_string();
    let msg_len = payload_str.len();
    let start = Instant::now();

    for _ in 0..messages_to_send {
        let send_time = Instant::now();
        let msg = Message::Text(payload_str.clone());

        if ws.send(msg).await.is_ok() {
            stats.record_send(msg_len);

            // Wait for echo/response with timeout
            match tokio::time::timeout(Duration::from_secs(5), ws.next()).await {
                Ok(Some(Ok(response))) => {
                    // Fixed: Check if response is an error message
                    if is_error_message(&response) {
                        stats.record_error();
                    } else {
                        let latency = send_time.elapsed().as_micros() as u64;
                        let response_len = match &response {
                            Message::Text(t) => t.len(),
                            Message::Binary(b) => b.len(),
                            _ => 0,
                        };
                        stats.record_receive(response_len, latency);
                    }
                }
                _ => {
                    stats.record_error();
                }
            }
        } else {
            stats.record_error();
        }
    }

    let duration = start.elapsed();
    let _ = ws.close(None).await;

    Some((Arc::try_unwrap(stats).unwrap_or_default(), duration))
}

/// Run multi-connection throughput test
async fn run_multi_connection_throughput(
    num_connections: usize,
    messages_per_connection: usize,
    message_size: usize,
) -> (ThroughputStats, Duration) {
    let stats = Arc::new(ThroughputStats::new());
    let semaphore = Arc::new(Semaphore::new(num_connections));
    let start = Instant::now();

    let mut handles = Vec::with_capacity(num_connections);

    for _ in 0..num_connections {
        let stats = Arc::clone(&stats);
        let semaphore = Arc::clone(&semaphore);

        let handle = tokio::spawn(async move {
            let _permit = semaphore.acquire().await.unwrap();
            let terminal_id = uuid::Uuid::new_v4().to_string();
            // Fixed: Use path parameter format
            let url = format!("{}/{}", WS_URL_BASE, terminal_id);

            if let Ok((mut ws, _)) = connect_async(&url).await {
                let message = generate_message(message_size);
                // Fixed: Use JSON WsMessage format
                let payload = json!({ "type": "input", "data": message });
                let payload_str = payload.to_string();
                let msg_len = payload_str.len();

                for _ in 0..messages_per_connection {
                    let send_time = Instant::now();
                    let msg = Message::Text(payload_str.clone());

                    if ws.send(msg).await.is_ok() {
                        stats.record_send(msg_len);

                        match tokio::time::timeout(Duration::from_secs(5), ws.next()).await {
                            Ok(Some(Ok(response))) => {
                                // Fixed: Check if response is an error message
                                if is_error_message(&response) {
                                    stats.record_error();
                                } else {
                                    let latency = send_time.elapsed().as_micros() as u64;
                                    let response_len = match &response {
                                        Message::Text(t) => t.len(),
                                        Message::Binary(b) => b.len(),
                                        _ => 0,
                                    };
                                    stats.record_receive(response_len, latency);
                                }
                            }
                            _ => {
                                stats.record_error();
                            }
                        }
                    } else {
                        stats.record_error();
                    }
                }

                let _ = ws.close(None).await;
            }
        });

        handles.push(handle);
    }

    for handle in handles {
        let _ = handle.await;
    }

    let duration = start.elapsed();
    (Arc::try_unwrap(stats).unwrap_or_default(), duration)
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
async fn test_ws_single_connection_throughput() {
    if !server_is_running().await {
        eprintln!("Server not running, skipping test");
        return;
    }

    let messages = 100;
    let message_size = 256; // 256 bytes

    if let Some((stats, duration)) = run_single_connection_throughput(messages, message_size).await {
        let tps = stats.tps(duration);

        println!("\n=== Single Connection Throughput Test ===");
        println!("Messages sent: {}", stats.messages_sent.load(Ordering::SeqCst));
        println!("Messages received: {}", stats.messages_received.load(Ordering::SeqCst));
        println!("Duration: {:?}", duration);
        println!("TPS: {:.2}", tps);
        println!("P95 latency: {:?} us", stats.p95_latency_us());
        println!("Avg latency: {:.2} us", stats.avg_latency_us().unwrap_or(0.0));
        println!("Throughput: {:.2} Mbps", stats.throughput_mbps(duration));
        println!("Errors: {}", stats.errors.load(Ordering::SeqCst));

        // Fixed: Add assertions for success rate
        let sent = stats.messages_sent.load(Ordering::SeqCst);
        let received = stats.messages_received.load(Ordering::SeqCst);
        assert!(sent > 0, "No messages sent");
        let success_rate = received as f64 / sent as f64 * 100.0;
        assert!(
            success_rate >= 90.0,
            "Success rate {:.2}% below 90% threshold",
            success_rate
        );
    } else {
        panic!("Failed to establish connection");
    }
}

#[tokio::test]
#[ignore = "requires running server"]
async fn test_ws_multi_connection_throughput() {
    if !server_is_running().await {
        eprintln!("Server not running, skipping test");
        return;
    }

    let connections = 50;
    let messages_per_conn = 20;
    let message_size = 256;

    let (stats, duration) = run_multi_connection_throughput(
        connections,
        messages_per_conn,
        message_size,
    ).await;

    let total_messages = connections * messages_per_conn;
    let tps = stats.tps(duration);

    println!("\n=== Multi-Connection Throughput Test ===");
    println!("Connections: {}", connections);
    println!("Messages per connection: {}", messages_per_conn);
    println!("Total messages expected: {}", total_messages);
    println!("Messages received: {}", stats.messages_received.load(Ordering::SeqCst));
    println!("Duration: {:?}", duration);
    println!("Aggregate TPS: {:.2}", tps);
    println!("P95 latency: {:?} us", stats.p95_latency_us());
    println!("Avg latency: {:.2} us", stats.avg_latency_us().unwrap_or(0.0));
    println!("Throughput: {:.2} Mbps", stats.throughput_mbps(duration));
    println!("Errors: {}", stats.errors.load(Ordering::SeqCst));

    // Fixed: Add assertions
    let received = stats.messages_received.load(Ordering::SeqCst);
    let success_rate = received as f64 / total_messages as f64 * 100.0;
    assert!(
        success_rate >= 90.0,
        "Success rate {:.2}% below 90% threshold",
        success_rate
    );
}

#[tokio::test]
#[ignore = "requires running server"]
async fn test_ws_message_latency_p95() {
    if !server_is_running().await {
        eprintln!("Server not running, skipping test");
        return;
    }

    // Test with different message sizes
    let sizes = [64, 256, 1024, 4096];

    println!("\n=== Message Latency by Size ===");

    for size in sizes {
        if let Some((stats, _)) = run_single_connection_throughput(50, size).await {
            println!(
                "Size: {} bytes, P95: {:?} us, Avg: {:.2} us",
                size,
                stats.p95_latency_us(),
                stats.avg_latency_us().unwrap_or(0.0)
            );

            // P95 should be under 100ms (100,000 us) for reasonable performance
            if let Some(p95) = stats.p95_latency_us() {
                assert!(
                    p95 <= 100_000,
                    "P95 latency {} us exceeds 100ms threshold for {} byte messages",
                    p95,
                    size
                );
            }
        }
    }
}

#[tokio::test]
#[ignore = "requires running server"]
async fn test_ws_large_message_handling() {
    if !server_is_running().await {
        eprintln!("Server not running, skipping test");
        return;
    }

    // Test with large messages (up to 64KB)
    let sizes = [1024, 8192, 32768, 65536];

    println!("\n=== Large Message Handling Test ===");

    for size in sizes {
        if let Some((stats, duration)) = run_single_connection_throughput(10, size).await {
            let success_rate = stats.messages_received.load(Ordering::SeqCst) as f64 / 10.0 * 100.0;

            println!(
                "Size: {} bytes, Success: {:.0}%, Throughput: {:.2} Mbps",
                size,
                success_rate,
                stats.throughput_mbps(duration)
            );

            assert!(
                success_rate >= 90.0,
                "Success rate {:.0}% below 90% for {} byte messages",
                success_rate,
                size
            );
        }
    }
}

#[tokio::test]
#[ignore = "requires running server"]
async fn test_ws_sustained_load() {
    if !server_is_running().await {
        eprintln!("Server not running, skipping test");
        return;
    }

    // Sustained load for 10 seconds
    let duration_secs = 10;
    let connections = 10;
    let message_size = 256;

    println!("\n=== Sustained Load Test ({} seconds) ===", duration_secs);

    let stats = Arc::new(ThroughputStats::new());
    let start = Instant::now();

    let mut handles = Vec::new();

    for _ in 0..connections {
        let stats = Arc::clone(&stats);

        let handle = tokio::spawn(async move {
            let terminal_id = uuid::Uuid::new_v4().to_string();
            let url = format!("{}/{}", WS_URL_BASE, terminal_id);

            if let Ok((mut ws, _)) = connect_async(&url).await {
                let message = generate_message(message_size);
                let payload = json!({ "type": "input", "data": message });
                let payload_str = payload.to_string();
                let msg_len = payload_str.len();
                let test_start = Instant::now();

                while test_start.elapsed().as_secs() < duration_secs as u64 {
                    let send_time = Instant::now();
                    let msg = Message::Text(payload_str.clone());

                    if ws.send(msg).await.is_ok() {
                        stats.record_send(msg_len);

                        match tokio::time::timeout(Duration::from_secs(5), ws.next()).await {
                            Ok(Some(Ok(response))) => {
                                // Fixed: Check if response is an error message
                                if is_error_message(&response) {
                                    stats.record_error();
                                } else {
                                    let latency = send_time.elapsed().as_micros() as u64;
                                    let response_len = match &response {
                                        Message::Text(t) => t.len(),
                                        Message::Binary(b) => b.len(),
                                        _ => 0,
                                    };
                                    stats.record_receive(response_len, latency);
                                }
                            }
                            _ => {
                                stats.record_error();
                            }
                        }
                    }

                    // Small delay to avoid overwhelming
                    tokio::time::sleep(Duration::from_millis(10)).await;
                }

                let _ = ws.close(None).await;
            }
        });

        handles.push(handle);
    }

    for handle in handles {
        let _ = handle.await;
    }

    let total_duration = start.elapsed();

    println!("Total duration: {:?}", total_duration);
    println!("Messages sent: {}", stats.messages_sent.load(Ordering::SeqCst));
    println!("Messages received: {}", stats.messages_received.load(Ordering::SeqCst));
    println!("TPS: {:.2}", stats.tps(total_duration));
    println!("P95 latency: {:?} us", stats.p95_latency_us());
    println!("Errors: {}", stats.errors.load(Ordering::SeqCst));

    // Fixed: Add assertions
    let sent = stats.messages_sent.load(Ordering::SeqCst);
    let received = stats.messages_received.load(Ordering::SeqCst);
    assert!(sent > 0, "No messages sent");
    let error_rate = stats.errors.load(Ordering::SeqCst) as f64 / sent as f64 * 100.0;
    assert!(
        error_rate <= 10.0,
        "Error rate {:.2}% exceeds 10% threshold",
        error_rate
    );
    assert!(received > 0, "No messages received");
}

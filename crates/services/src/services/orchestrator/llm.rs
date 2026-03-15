//! LLM client abstractions and implementations.

use std::{future::Future, num::NonZeroU32, sync::Arc, time::Duration};

use async_trait::async_trait;
use governor::{
    Quota, RateLimiter,
    clock::DefaultClock,
    state::{InMemoryState, NotKeyed},
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::time::sleep;

use super::{
    config::OrchestratorConfig,
    resilient_llm::{ProviderEvent, ProviderStatusReport},
    types::{LLMMessage, LLMResponse, LLMUsage},
};

/// Defines the LLM client interface used by the orchestrator.
#[async_trait]
pub trait LLMClient: Send + Sync {
    async fn chat(&self, messages: Vec<LLMMessage>) -> anyhow::Result<LLMResponse>;

    /// Returns provider status reports. Default returns empty (single-provider clients).
    async fn provider_status(&self) -> Vec<ProviderStatusReport> {
        Vec::new()
    }

    /// Reset a provider's circuit breaker by name. Default returns false.
    async fn reset_provider(&self, _provider_name: &str) -> bool {
        false
    }

    /// Take provider events collected during the last chat call. Default returns empty.
    async fn take_provider_events(&self) -> Vec<ProviderEvent> {
        Vec::new()
    }
}

/// Retries an async operation with exponential backoff.
pub async fn retry_with_backoff<T, E, F, Fut>(max_retries: u32, mut operation: F) -> Result<T, E>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T, E>>,
{
    let mut last_error = None;

    for attempt in 0..max_retries {
        match operation().await {
            Ok(result) => {
                if attempt > 0 {
                    tracing::info!("Operation succeeded on attempt {}", attempt + 1);
                }
                return Ok(result);
            }
            Err(e) if attempt < max_retries - 1 => {
                tracing::warn!(
                    "Attempt {} failed, retrying in {}ms",
                    attempt + 1,
                    1000 * (attempt + 1)
                );
                last_error = Some(e);
                sleep(Duration::from_millis(1000 * u64::from(attempt + 1))).await;
            }
            Err(e) => {
                tracing::error!("All {} attempts failed", max_retries);
                return Err(e);
            }
        }
    }

    Err(last_error.unwrap())
}

/// Wraps an LLM client with a per-second rate limiter.
pub struct RateLimitedClient<T> {
    inner: T,
    rate_limiter: Arc<RateLimiter<NotKeyed, InMemoryState, DefaultClock>>,
}

impl<T> RateLimitedClient<T> {
    pub fn new(inner: T, requests_per_second: u32) -> anyhow::Result<Self> {
        let rate = NonZeroU32::new(requests_per_second)
            .ok_or_else(|| anyhow::anyhow!("Rate limit must be greater than 0"))?;
        let quota = Quota::per_second(rate);
        let rate_limiter = Arc::new(RateLimiter::direct(quota));

        Ok(Self {
            inner,
            rate_limiter,
        })
    }
}

#[async_trait]
impl<T> LLMClient for RateLimitedClient<T>
where
    T: LLMClient,
{
    async fn chat(&self, messages: Vec<LLMMessage>) -> anyhow::Result<LLMResponse> {
        self.rate_limiter
            .check()
            .map_err(|_| anyhow::anyhow!("rate limit exceeded"))?;
        self.inner.chat(messages).await
    }

    /// [G24-001] Transparent forwarding to inner client.
    async fn provider_status(&self) -> Vec<ProviderStatusReport> {
        self.inner.provider_status().await
    }

    /// [G24-001] Transparent forwarding to inner client.
    async fn reset_provider(&self, provider_name: &str) -> bool {
        self.inner.reset_provider(provider_name).await
    }

    /// [G24-001] Transparent forwarding to inner client.
    async fn take_provider_events(&self) -> Vec<ProviderEvent> {
        self.inner.take_provider_events().await
    }
}

/// LLM client for OpenAI-compatible chat endpoints.
pub struct OpenAICompatibleClient {
    client: Client,
    base_url: String,
    api_key: String,
    model: String,
}

/// Mock LLM Client for testing
#[cfg(test)]
pub struct MockLLMClient {
    pub should_fail: bool,
    pub response_content: String,
}

#[cfg(test)]
impl MockLLMClient {
    pub fn new() -> Self {
        Self {
            should_fail: false,
            response_content: "Mock response for testing".to_string(),
        }
    }

    pub fn with_response(content: &str) -> Self {
        Self {
            should_fail: false,
            response_content: content.to_string(),
        }
    }

    pub fn that_fails() -> Self {
        Self {
            should_fail: true,
            response_content: String::new(),
        }
    }
}

#[cfg(test)]
impl Default for MockLLMClient {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
#[async_trait]
impl LLMClient for MockLLMClient {
    async fn chat(&self, _messages: Vec<LLMMessage>) -> anyhow::Result<LLMResponse> {
        if self.should_fail {
            return Err(anyhow::anyhow!("Mock LLM client error"));
        }

        Ok(LLMResponse {
            content: self.response_content.clone(),
            usage: Some(LLMUsage {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
            }),
        })
    }
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: Option<f32>,
    max_tokens: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
    usage: Option<UsageInfo>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

#[allow(clippy::struct_field_names)]
#[derive(Debug, Deserialize)]
struct UsageInfo {
    prompt_tokens: i32,
    completion_tokens: i32,
    total_tokens: i32,
}

impl OpenAICompatibleClient {
    pub fn new(config: &OrchestratorConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            base_url: config.base_url.trim_end_matches('/').to_string(),
            api_key: config.api_key.clone(),
            model: config.model.clone(),
        }
    }

    /// Perform a single chat request without retry logic
    async fn chat_once(&self, messages: Vec<LLMMessage>) -> anyhow::Result<LLMResponse> {
        let url = format!("{}/chat/completions", self.base_url);

        let chat_messages: Vec<ChatMessage> = messages
            .into_iter()
            .map(|m| ChatMessage {
                role: m.role,
                content: m.content,
            })
            .collect();

        let request = ChatRequest {
            model: self.model.clone(),
            messages: chat_messages,
            temperature: Some(0.7),
            max_tokens: Some(4096),
        };

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("LLM API error: {status} - {body}"));
        }

        let chat_response: ChatResponse = response.json().await?;
        // [G24-005] Return an error when the API returns no choices instead of
        // silently producing an empty string that downstream code cannot distinguish
        // from a legitimate empty response.
        let content = chat_response
            .choices
            .first()
            .map(|c| c.message.content.clone())
            .ok_or_else(|| anyhow::anyhow!("LLM API returned empty choices array"))?;

        let usage = chat_response.usage.map(|u| LLMUsage {
            prompt_tokens: u.prompt_tokens,
            completion_tokens: u.completion_tokens,
            total_tokens: u.total_tokens,
        });

        Ok(LLMResponse { content, usage })
    }
}

#[async_trait]
impl LLMClient for OpenAICompatibleClient {
    async fn chat(&self, messages: Vec<LLMMessage>) -> anyhow::Result<LLMResponse> {
        // G24-006: keep internal retry at 1 attempt (no internal retry) so that
        // ResilientLLMClient's cross-provider retry loop is the sole retry layer.
        // Stacking 3 inner retries × N providers leads to excessive backoff delays
        // and confusing failure counts in the circuit breaker.
        self.chat_once(messages).await
    }
}

/// Build terminal completion prompt
///
/// This helper function encapsulates the logic for building prompts
/// to avoid string concatenation in business logic.
pub fn build_terminal_completion_prompt(
    terminal_id: &str,
    task_id: &str,
    commit_hash: &str,
    commit_message: &str,
) -> String {
    format!(
        "Terminal {terminal_id} has completed task {task_id}.\n\n\
         Commit: {commit_hash}\n\
         Message: {commit_message}\n\n\
         Please analyze the results and decide on the next step."
    )
}

/// Validates configuration and returns a rate-limited LLM client.
///
/// When `config.fallback_providers` is non-empty, the returned client is a
/// [`ResilientLLMClient`] that wraps the primary provider plus all fallbacks
/// with automatic circuit-breaking and failover.  Otherwise the original
/// single-provider path is used (fully backward compatible).
pub fn create_llm_client(config: &OrchestratorConfig) -> anyhow::Result<Box<dyn LLMClient>> {
    config.validate().map_err(|e| anyhow::anyhow!(e))?;

    if config.fallback_providers.is_empty() {
        // Original single-provider path.
        let client = OpenAICompatibleClient::new(config);
        let client = RateLimitedClient::new(client, config.rate_limit_requests_per_second)?;
        Ok(Box::new(client))
    } else {
        // Multi-provider resilient path.
        let primary_name = format!("primary({})", config.model);
        let primary_client = OpenAICompatibleClient::new(config);
        let primary_client =
            RateLimitedClient::new(primary_client, config.rate_limit_requests_per_second)?;

        let mut providers: Vec<(String, Box<dyn LLMClient>)> =
            vec![(primary_name, Box::new(primary_client))];

        let mut fallbacks: Vec<_> = config.fallback_providers.clone();
        fallbacks.sort_by_key(|p| p.priority);

        for fb in &fallbacks {
            let fb_config = OrchestratorConfig {
                api_type: fb.api_type.clone(),
                base_url: fb.base_url.clone(),
                api_key: fb.api_key.clone(),
                model: fb.model.clone(),
                timeout_secs: config.timeout_secs,
                rate_limit_requests_per_second: config.rate_limit_requests_per_second,
                ..Default::default()
            };
            let fb_client = OpenAICompatibleClient::new(&fb_config);
            let fb_client =
                RateLimitedClient::new(fb_client, config.rate_limit_requests_per_second)?;
            providers.push((fb.name.clone(), Box::new(fb_client)));
        }

        tracing::info!(
            "ResilientLLMClient created with {} providers: {:?}",
            providers.len(),
            providers.iter().map(|(n, _)| n.as_str()).collect::<Vec<_>>(),
        );

        Ok(Box::new(
            super::resilient_llm::ResilientLLMClient::new(providers),
        ))
    }
}

#[cfg(test)]
mod rate_limit_tests {
    use tokio::time::sleep;

    use super::*;

    fn test_messages() -> Vec<LLMMessage> {
        vec![LLMMessage {
            role: "user".to_string(),
            content: "Hello".to_string(),
        }]
    }

    #[tokio::test]
    async fn rate_limiter_blocks_excessive_requests() {
        let client = RateLimitedClient::new(MockLLMClient::new(), 2).expect("rate limit");
        let messages = test_messages();

        assert!(client.chat(messages.clone()).await.is_ok());
        assert!(client.chat(messages.clone()).await.is_ok());

        let result = client.chat(messages.clone()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("rate limit"));
    }

    #[tokio::test]
    async fn rate_limiter_refills_after_duration() {
        let client = RateLimitedClient::new(MockLLMClient::new(), 2).expect("rate limit");
        let messages = test_messages();

        client.chat(messages.clone()).await.expect("first");
        client.chat(messages.clone()).await.expect("second");

        sleep(Duration::from_millis(1100)).await;

        let result = client.chat(messages.clone()).await;
        assert!(result.is_ok());
    }
}

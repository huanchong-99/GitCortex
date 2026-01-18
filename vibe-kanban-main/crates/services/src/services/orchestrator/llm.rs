//! LLM 客户端抽象

use std::time::Duration;

use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::{
    config::OrchestratorConfig,
    types::{LLMMessage, LLMResponse, LLMUsage},
};

#[async_trait]
pub trait LLMClient: Send + Sync {
    async fn chat(&self, messages: Vec<LLMMessage>) -> anyhow::Result<LLMResponse>;
}

pub struct OpenAICompatibleClient {
    client: Client,
    base_url: String,
    api_key: String,
    model: String,
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
}

#[async_trait]
impl LLMClient for OpenAICompatibleClient {
    async fn chat(&self, messages: Vec<LLMMessage>) -> anyhow::Result<LLMResponse> {
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
            return Err(anyhow::anyhow!("LLM API error: {} - {}", status, body));
        }

        let chat_response: ChatResponse = response.json().await?;
        let content = chat_response
            .choices
            .first()
            .map(|c| c.message.content.clone())
            .unwrap_or_default();

        let usage = chat_response.usage.map(|u| LLMUsage {
            prompt_tokens: u.prompt_tokens,
            completion_tokens: u.completion_tokens,
            total_tokens: u.total_tokens,
        });

        Ok(LLMResponse { content, usage })
    }
}

pub fn create_llm_client(config: &OrchestratorConfig) -> anyhow::Result<Box<dyn LLMClient>> {
    config.validate().map_err(|e| anyhow::anyhow!(e))?;
    Ok(Box::new(OpenAICompatibleClient::new(config)))
}

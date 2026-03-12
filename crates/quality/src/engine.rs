//! 质量门执行引擎
//!
//! 编排 Provider → 收集报告 → 求值 → 决策
//! 这是质量门的顶层入口

use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tracing::{info, warn};

use crate::config::{QualityGateConfig, QualityGateMode};
use crate::gate::evaluator::ConditionEvaluator;
use crate::gate::result::MeasureValue;
use crate::gate::QualityGateLevel;
use crate::metrics::MetricKey;
use crate::provider::QualityProvider;
use crate::report::QualityReport;

/// 质量门执行引擎
///
/// 职责：
/// 1. 加载配置
/// 2. 调度启用的 Provider 执行分析
/// 3. 聚合 Provider 报告
/// 4. 对质量门条件求值
/// 5. 生成最终决策
pub struct QualityEngine {
    config: QualityGateConfig,
    providers: Vec<Arc<dyn QualityProvider>>,
}

impl QualityEngine {
    /// 创建引擎实例
    pub fn new(config: QualityGateConfig, providers: Vec<Arc<dyn QualityProvider>>) -> Self {
        Self { config, providers }
    }

    /// 从项目目录自动创建引擎
    pub fn from_project(project_root: &Path) -> anyhow::Result<Self> {
        let config = QualityGateConfig::load_from_project(project_root)?;

        // 根据配置创建启用的 providers
        let mut providers: Vec<Arc<dyn QualityProvider>> = Vec::new();

        if config.providers.rust {
            providers.push(Arc::new(
                crate::provider::rust_analyzer::RustProvider::default(),
            ));
        }
        if config.providers.frontend {
            providers.push(Arc::new(
                crate::provider::frontend::FrontendProvider::default(),
            ));
        }
        if config.providers.repo {
            providers.push(Arc::new(crate::provider::repo::RepoProvider::default()));
        }
        if config.providers.security {
            providers.push(Arc::new(crate::provider::security::SecurityProvider));
        }
        if config.providers.sonar {
            let sonar_token = std::env::var("SONAR_TOKEN")
                .ok()
                .or(config.sonar.token.clone());
            let mut sonar = crate::provider::sonar::SonarProvider::default();
            sonar.host_url = config.sonar.host_url.clone();
            sonar.project_key = config.sonar.project_key.clone();
            sonar.token = sonar_token;
            providers.push(Arc::new(sonar));
        }

        Ok(Self::new(config, providers))
    }

    /// 执行质量门分析
    ///
    /// # 参数
    /// - `project_root`: 项目根目录
    /// - `level`: 质量门层级（Terminal/Branch/Repo）
    /// - `changed_files`: 变更文件列表（Terminal gate 用于增量分析）
    pub async fn run(
        &self,
        project_root: &Path,
        level: QualityGateLevel,
        changed_files: Option<&[String]>,
    ) -> anyhow::Result<QualityReport> {
        // 检查是否启用
        if !self.config.is_enabled() {
            info!("Quality gate is disabled (mode=off), skipping");
            return Ok(QualityReport::aggregate(vec![]));
        }

        info!("Starting quality gate analysis: {} (mode={:?})", level, self.config.mode);

        // 并发运行所有启用的 providers
        let mut handles = Vec::new();
        for provider in &self.providers {
            if !provider.is_enabled() {
                continue;
            }
            let provider = Arc::clone(provider);
            let root = project_root.to_path_buf();
            let files = changed_files.map(|f| f.to_vec());

            handles.push(tokio::spawn(async move {
                let files_ref = files.as_deref();
                provider.analyze(&root, files_ref).await
            }));
        }

        // 收集所有 provider 报告
        let mut reports = Vec::new();
        for handle in handles {
            match handle.await {
                Ok(Ok(report)) => {
                    info!("Provider '{}' completed in {}ms", report.provider_name, report.duration_ms);
                    reports.push(report);
                }
                Ok(Err(e)) => {
                    warn!("Provider analysis failed: {}", e);
                }
                Err(e) => {
                    warn!("Provider task panicked: {}", e);
                }
            }
        }

        // 聚合报告
        let mut quality_report = QualityReport::aggregate(reports);

        // 获取质量门定义并求值
        let gate = self.config.get_gate(level)?;

        // 收集所有度量值
        let mut all_metrics: HashMap<MetricKey, MeasureValue> = HashMap::new();
        for provider_report in &quality_report.provider_reports {
            all_metrics.extend(provider_report.metrics.clone());
        }

        // 条件求值
        let eval_results = ConditionEvaluator::evaluate_all(&gate.conditions, &all_metrics);

        // 生成质量门决策
        let decision = gate.evaluate(&eval_results);

        info!("{}", quality_report.status_line());

        quality_report = quality_report.with_decision(decision);

        Ok(quality_report)
    }

    /// 获取当前配置
    pub fn config(&self) -> &QualityGateConfig {
        &self.config
    }

    /// 获取模式
    pub fn mode(&self) -> QualityGateMode {
        self.config.mode
    }
}

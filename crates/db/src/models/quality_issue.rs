use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct QualityIssue {
    pub id: Uuid,
    pub run_id: Uuid,
    pub provider: String,
    pub rule_id: String,
    pub severity: String,
    pub message: String,
    pub file_path: Option<String>,
    pub line_start: Option<i64>,
    pub line_end: Option<i64>,
    pub column_start: Option<i64>,
    pub column_end: Option<i64>,
    pub created_at: DateTime<Utc>,
}

impl QualityIssue {
    pub async fn insert_batch(
        pool: &sqlx::SqlitePool,
        issues: &[QualityIssue],
    ) -> Result<(), sqlx::Error> {
        let mut tx = pool.begin().await?;
        for issue in issues {
            sqlx::query(
                r#"
                INSERT INTO quality_issues (
                    id, run_id, provider, rule_id, severity, message,
                    file_path, line_start, line_end, column_start, column_end,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                "#,
            )
            .bind(issue.id)
            .bind(issue.run_id)
            .bind(&issue.provider)
            .bind(&issue.rule_id)
            .bind(&issue.severity)
            .bind(&issue.message)
            .bind(&issue.file_path)
            .bind(issue.line_start)
            .bind(issue.line_end)
            .bind(issue.column_start)
            .bind(issue.column_end)
            .bind(issue.created_at)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
        Ok(())
    }

    pub async fn find_by_run(
        pool: &sqlx::SqlitePool,
        run_id: Uuid,
    ) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as::<_, Self>(
            "SELECT * FROM quality_issues WHERE run_id = ? ORDER BY created_at DESC",
        )
        .bind(run_id)
        .fetch_all(pool)
        .await
    }
}

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct QualityRun {
    pub id: Uuid,
    pub project_id: Uuid,
    pub workflow_id: Option<Uuid>,
    pub task_id: Option<Uuid>,
    pub terminal_id: Option<Uuid>,
    pub level: String,
    pub status: String,
    pub mode: String,
    pub gate_name: String,
    pub duration_ms: Option<i64>,
    pub summary: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl QualityRun {
    pub async fn insert(
        pool: &sqlx::SqlitePool,
        run: &QualityRun,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO quality_runs (
                id, project_id, workflow_id, task_id, terminal_id,
                level, status, mode, gate_name, duration_ms, summary,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(run.id)
        .bind(run.project_id)
        .bind(run.workflow_id)
        .bind(run.task_id)
        .bind(run.terminal_id)
        .bind(&run.level)
        .bind(&run.status)
        .bind(&run.mode)
        .bind(&run.gate_name)
        .bind(run.duration_ms)
        .bind(&run.summary)
        .bind(run.created_at)
        .bind(run.updated_at)
        .execute(pool)
        .await?;
        
        Ok(())
    }

    pub async fn find_by_workflow(
        pool: &sqlx::SqlitePool,
        workflow_id: Uuid,
    ) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as::<_, Self>(
            "SELECT * FROM quality_runs WHERE workflow_id = ? ORDER BY created_at DESC",
        )
        .bind(workflow_id)
        .fetch_all(pool)
        .await
    }

    pub async fn find_by_terminal(
        pool: &sqlx::SqlitePool,
        terminal_id: Uuid,
    ) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as::<_, Self>(
            "SELECT * FROM quality_runs WHERE terminal_id = ? ORDER BY created_at DESC",
        )
        .bind(terminal_id)
        .fetch_all(pool)
        .await
    }

    pub async fn find_by_id(
        pool: &sqlx::SqlitePool,
        id: Uuid,
    ) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, Self>("SELECT * FROM quality_runs WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await
    }
}

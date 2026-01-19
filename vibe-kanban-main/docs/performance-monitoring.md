# Performance Monitoring Guide

This guide provides comprehensive information about monitoring and optimizing the performance of the GitCortex workflow system.

## Table of Contents

1. [Database Indexes](#database-indexes)
2. [Connection Pool Configuration](#connection-pool-configuration)
3. [Running Benchmarks](#running-benchmarks)
4. [Monitoring with RUST_LOG](#monitoring-with-rust_log)
5. [Cleanup Queries](#cleanup-queries)
6. [Performance Best Practices](#performance-best-practices)

---

## Database Indexes

### Overview

Performance indexes have been added to optimize common query patterns in the workflow system. These indexes are created via migration `20260119000001_add_performance_indexes.sql`.

### Index Types

#### 1. Composite Indexes

Composite indexes combine multiple columns to optimize queries that filter or sort on multiple fields.

**Example:**
```sql
CREATE INDEX idx_workflow_project_status
ON workflow(project_id, status)
WHERE status IN ('created', 'ready', 'running');
```

**Optimizes:**
- Finding active workflows by project ID
- Queries like: `SELECT * FROM workflow WHERE project_id = ? AND status IN ('created', 'ready', 'running')`

#### 2. Partial Indexes

Partial indexes include a `WHERE` clause to index only a subset of rows, reducing index size and improving performance.

**Example:**
```sql
CREATE INDEX idx_workflow_active
ON workflow(status, created_at DESC)
WHERE status NOT IN ('completed', 'failed', 'cancelled');
```

**Benefits:**
- Smaller index size (only active workflows)
- Faster inserts/updates on completed workflows
- Optimized for listing active workflows

### Index Summary Table

| Index Name | Table | Columns | Filter Condition | Optimizes Query |
|------------|-------|---------|------------------|-----------------|
| `idx_workflow_project_status` | workflow | (project_id, status) | status IN ('created', 'ready', 'running') | Find active workflows by project |
| `idx_workflow_active` | workflow | (status, created_at DESC) | status NOT IN ('completed', 'failed', 'cancelled') | List active workflows |
| `idx_workflow_completed_cleanup` | workflow | (project_id, completed_at) | status IN ('completed', 'failed', 'cancelled') AND completed_at IS NOT NULL | Cleanup old completed workflows |
| `idx_workflow_task_workflow_status` | workflow_task | (workflow_id, status, order_index) | - | Find tasks by workflow with status |
| `idx_workflow_task_active` | workflow_task | (status, created_at) | status IN ('pending', 'running', 'review_pending') | Find active tasks |
| `idx_terminal_task_status` | terminal | (workflow_task_id, status, order_index) | - | Find terminals by task with status |
| `idx_terminal_active` | terminal | (status, started_at) | status IN ('starting', 'waiting', 'working') | Find active terminals |
| `idx_terminal_cleanup` | terminal | (workflow_task_id, completed_at) | status IN ('completed', 'failed', 'cancelled') AND completed_at IS NOT NULL | Cleanup old terminals |
| `idx_git_event_workflow_status` | git_event | (workflow_id, process_status, created_at) | process_status IN ('pending', 'processing') | Process events by workflow |
| `idx_git_event_terminal_status` | git_event | (terminal_id, process_status, created_at) | process_status = 'pending' | Process events by terminal |
| `idx_git_event_cleanup` | git_event | (workflow_id, processed_at) | process_status = 'processed' AND processed_at IS NOT NULL | Cleanup processed events |
| `idx_terminal_log_streaming` | terminal_log | (terminal_id, created_at DESC) | created_at > datetime('now', '-1 hour') | Stream recent logs |
| `idx_terminal_log_cleanup` | terminal_log | (created_at) | created_at < datetime('now', '-7 days') | Cleanup old logs |

### Checking Index Usage

To verify which indexes are being used by queries, enable SQLite query explanation:

```bash
# Enable query logging
sqlite3 assets/db.sqlite "EXPLAIN QUERY PLAN SELECT * FROM workflow WHERE project_id = 'xxx' AND status = 'running';"
```

Look for `USING INDEX` in the output to confirm index usage.

---

## Connection Pool Configuration

### Overview

The database connection pool is configured in `crates/db/src/lib.rs` with optimal settings for SQLite performance.

### Configuration Parameters

```rust
SqlitePoolOptions::new()
    .max_connections(10)           // Maximum concurrent connections
    .min_connections(2)            // Minimum idle connections to maintain
    .acquire_timeout(Duration::from_secs(30))    // Max time to wait for connection
    .idle_timeout(Duration::from_secs(600))      // Close idle connections after 10 min
    .max_lifetime(Duration::from_secs(3600))     // Refresh connections after 1 hour
    .test_before_acquire(true)     // Verify connection health before use
```

### Parameter Rationale

| Parameter | Value | Reasoning |
|-----------|-------|-----------|
| `max_connections` | 10 | SQLite performs best with limited concurrent connections. High connection counts can cause contention. |
| `min_connections` | 2 | Maintains baseline connectivity for immediate response to requests. |
| `acquire_timeout` | 30s | Prevents indefinite blocking while allowing time for connection availability. |
| `idle_timeout` | 10 min | Releases unused connections to free resources, but keeps them available for typical usage patterns. |
| `max_lifetime` | 1 hour | Periodically refreshes connections to prevent long-lived connection issues. |
| `test_before_acquire` | true | Ensures connections are healthy before use, preventing errors from stale connections. |

### Monitoring Connection Pool

Monitor connection pool metrics in your logs:

```
[INFO] Connection pool stats: {size: 2, available: 1}
```

If you see frequent timeouts or pool exhaustion, consider:
1. Increasing `max_connections` slightly (but stay under 20 for SQLite)
2. Checking for connection leaks (connections not being released)
3. Reviewing query performance for slow queries that hold connections

---

## Running Benchmarks

### Overview

Performance benchmarks are provided to measure query performance and detect regressions.

### Running Benchmarks

Run all workflow benchmarks:
```bash
cargo bench --bench workflow_bench
```

Run a specific benchmark:
```bash
cargo bench --bench workflow_bench -- find_by_project
```

### Benchmark Descriptions

#### 1. `find_by_id`

Measures the performance of looking up a single workflow by ID.

**Expected Performance:** < 1ms per query

#### 2. `find_by_project`

Measures the performance of finding all workflows for a project with varying dataset sizes (10, 50, 100, 500 workflows).

**Expected Performance:**
- 10 workflows: < 5ms
- 50 workflows: < 10ms
- 100 workflows: < 20ms
- 500 workflows: < 50ms

#### 3. `find_by_project_with_status`

Measures the performance of finding workflows with a status filter using partial indexes.

**Expected Performance:** < 10ms for 100 workflows

### Interpreting Results

Benchmark results are displayed in a HTML report:

```bash
open target/criterion/report/index.html
```

Look for:
- **Mean time:** Average execution time
- **Std. Dev.:** Consistency of performance (lower is better)
- **Iterations:** Number of times the benchmark ran

### Regression Detection

To detect performance regressions, save baseline results:

```bash
# Save baseline
cargo bench --bench workflow_bench -- --save-baseline main

# Compare against baseline
cargo bench --bench workflow_bench -- --baseline main
```

---

## Monitoring with RUST_LOG

### Overview

Query performance logging is implemented in `Workflow::find_by_project` using tracing instrumentation.

### Enabling Debug Logging

Set the `RUST_LOG` environment variable to enable performance logging:

```bash
# Enable debug logging for the db crate
RUST_LOG=db=debug cargo run

# Enable debug logging for all crates
RUST_LOG=debug cargo run
```

### Log Output Example

When debug logging is enabled, you'll see performance metrics:

```
[2025-01-19T10:30:45Z DEBUG db::models::workflow] find_by_project query completed
    project_id: "proj-abc123",
    count: 5,
    duration_ms: 12
```

### Log Fields

| Field | Description |
|-------|-------------|
| `project_id` | The project ID being queried |
| `count` | Number of workflows returned |
| `duration_ms` | Query execution time in milliseconds |

### Adding Performance Logging to Other Queries

To add performance logging to other query functions:

```rust
use tracing::{instrument, debug};

#[instrument(skip(pool), fields(project_id))]
pub async fn find_by_project(pool: &SqlitePool, project_id: &str) -> sqlx::Result<Vec<Self>> {
    let start = std::time::Instant::now();
    let result = sqlx::query_as::<_, Workflow>(/* query */)
        .bind(project_id)
        .fetch_all(pool)
        .await;

    let elapsed = start.elapsed();
    debug!(
        project_id = %project_id,
        count = result.as_ref().map(|v| v.len()).unwrap_or(0),
        duration_ms = elapsed.as_millis(),
        "find_by_project query completed"
    );

    result
}
```

---

## Cleanup Queries

### Overview

Regular cleanup of old data is essential for maintaining database performance.

### Cleanup Queries

#### 1. Clean Up Old Completed Workflows

Delete completed workflows older than 30 days:

```sql
DELETE FROM workflow
WHERE status IN ('completed', 'failed', 'cancelled')
  AND completed_at < datetime('now', '-30 days');
```

**Uses index:** `idx_workflow_completed_cleanup`

#### 2. Clean Up Old Terminals

Delete terminals for completed workflows older than 30 days:

```sql
DELETE FROM terminal
WHERE status IN ('completed', 'failed', 'cancelled')
  AND completed_at < datetime('now', '-30 days');
```

**Uses index:** `idx_terminal_cleanup`

#### 3. Clean Up Processed Git Events

Delete processed events older than 7 days:

```sql
DELETE FROM git_event
WHERE process_status = 'processed'
  AND processed_at < datetime('now', '-7 days');
```

**Uses index:** `idx_git_event_cleanup`

#### 4. Clean Up Old Terminal Logs

Delete terminal logs older than 7 days:

```sql
DELETE FROM terminal_log
WHERE created_at < datetime('now', '-7 days');
```

**Uses index:** `idx_terminal_log_cleanup`

### Implementing Cleanup Jobs

Create a scheduled cleanup job in your application:

```rust
use tokio::time::{interval, Duration};

pub async fn cleanup_old_data(pool: &SqlitePool) -> anyhow::Result<()> {
    // Clean up old completed workflows
    let workflow_result = sqlx::query(
        "DELETE FROM workflow
         WHERE status IN ('completed', 'failed', 'cancelled')
           AND completed_at < datetime('now', '-30 days')"
    )
    .execute(pool)
    .await?;

    tracing::info!("Cleaned up {} old workflows", workflow_result.rows_affected());

    // Clean up old terminal logs
    let log_result = sqlx::query(
        "DELETE FROM terminal_log
         WHERE created_at < datetime('now', '-7 days')"
    )
    .execute(pool)
    .await?;

    tracing::info!("Cleaned up {} old log entries", log_result.rows_affected());

    Ok(())
}

// Run cleanup daily
pub async fn spawn_cleanup_job(pool: SqlitePool) {
    tokio::spawn(async move {
        let mut interval = interval(Duration::from_secs(86400)); // 24 hours
        loop {
            interval.tick().await;
            if let Err(e) = cleanup_old_data(&pool).await {
                tracing::error!("Cleanup job failed: {}", e);
            }
        }
    });
}
```

---

## Performance Best Practices

### 1. Use Appropriate Indexes

- **Do:** Create indexes for columns used in WHERE clauses, JOIN conditions, and ORDER BY clauses
- **Don't:** Create indexes for low-cardinality columns (e.g., boolean flags with mostly the same value)
- **Do:** Use partial indexes for filtering common subsets (e.g., active records)
- **Don't:** Create redundant indexes

### 2. Optimize Query Patterns

**Inefficient:**
```sql
SELECT * FROM workflow WHERE status = 'running' ORDER BY created_at DESC;
```

**Efficient (uses index):**
```sql
SELECT * FROM workflow
WHERE status NOT IN ('completed', 'failed', 'cancelled')
ORDER BY created_at DESC;
```

### 3. Use Transactions for Bulk Operations

```rust
let mut tx = pool.begin().await?;
for workflow in workflows {
    // ... insert operations ...
}
tx.commit().await?;
```

### 4. Avoid N+1 Queries

**Inefficient (N+1):**
```rust
let workflows = Workflow::find_by_project(&pool, project_id).await?;
for workflow in workflows {
    let tasks = WorkflowTask::find_by_workflow(&pool, &workflow.id).await?; // N queries
}
```

**Efficient (single query with JOIN):**
```rust
let workflows_with_tasks = sqlx::query_as::<_, (Workflow, WorkflowTask)>(
    "SELECT w.*, t.* FROM workflow w
     LEFT JOIN workflow_task t ON w.id = t.workflow_id
     WHERE w.project_id = ?"
)
.bind(project_id)
.fetch_all(&pool)
.await?;
```

### 5. Monitor and Rebuild Indexes

SQLite indexes can become fragmented over time. Periodically rebuild:

```sql
REINDEX;
ANALYZE;
```

### 6. Use Prepared Statements

SQLx automatically prepares and caches statements. Use parameterized queries:

```rust
// Good (prepared statement)
sqlx::query_as::<_, Workflow>("SELECT * FROM workflow WHERE id = ?")
    .bind(id)
    .fetch_one(&pool)
    .await?;

// Bad (dynamic SQL, not prepared)
sqlx::query_as::<_, Workflow>(&format!("SELECT * FROM workflow WHERE id = '{}'", id))
    .fetch_one(&pool)
    .await?;
```

### 7. Limit Result Sets

For large result sets, use pagination:

```sql
SELECT * FROM workflow
WHERE project_id = ?
ORDER BY created_at DESC
LIMIT 50 OFFSET 0;
```

### 8. Regular Database Maintenance

Run VACUUM periodically to reclaim space:

```sql
VACUUM;
```

Schedule this during low-traffic periods as it locks the database.

---

## Troubleshooting

### Slow Queries

1. **Enable query logging** to identify slow queries
2. **Run EXPLAIN QUERY PLAN** to see if indexes are being used
3. **Check for missing indexes** on WHERE and JOIN columns
4. **Verify connection pool** isn't exhausted

### High Memory Usage

1. **Reduce max_connections** in the pool
2. **Use pagination** instead of loading all records
3. **Run VACUUM** to reclaim database space
4. **Clean up old data** regularly

### Database Lock Contention

1. **Reduce connection count** (SQLite has limited write concurrency)
2. **Use transactions** to group related operations
3. **Keep transactions short** - don't do I/O inside transactions
4. **Consider WAL mode** for better read concurrency (not currently used)

---

## Additional Resources

- [SQLite Query Planning](https://www.sqlite.org/queryplanner.html)
- [SQLx Performance Guide](https://github.com/launchbadge/sqlx)
- [Criterion.rs Documentation](https://bheisler.github.io/criterion.rs/book/index.html)
- [Tracing Instrumentation](https://docs.rs/tracing/latest/tracing/)

---

**Last Updated:** 2025-01-19
**Migration Version:** 20260119000001

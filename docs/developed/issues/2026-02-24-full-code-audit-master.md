# 全量代码审计主报告（36组分片 + 6 Agent并发）

> **创建时间:** 2026-02-24 20:55:56
> **审计目标:** 全项目逐文件审计，重点识别跨模块冲突、状态机不一致、业务逻辑冲突、并发与时序问题。
> **执行模式:** 每轮 6 个 Agent 并发，按 G01-G36 共 6 轮覆盖。
> **覆盖文件数:** 1001
> **当前进度:** 第二遍全量审计（Pass2）6/6 已完成

## 1. 范围与方法

1. 代码清单来自 `git ls-files`，排除 `docs/**` 与 `*.md`，保留后端/前端/脚本/SQL/配置代码文件。
2. 将全部代码按文件均分为 36 组（G01-G36），每组独立审计并输出问题。
3. 每轮并发审计 6 组（6 Agent），完成后统一写入本文件的“轮次报告”和“问题总账”。
4. 问题级别：`P0` 阻断、`P1` 高、`P2` 中、`P3` 低。

## 2. 36组审计计划总览

| Group | Round | Slot | FileCount |
|---|---:|---:|---:|
| G01 | 1 | 1 | 28 |
| G02 | 1 | 2 | 28 |
| G03 | 1 | 3 | 28 |
| G04 | 1 | 4 | 28 |
| G05 | 1 | 5 | 28 |
| G06 | 1 | 6 | 28 |
| G07 | 2 | 1 | 28 |
| G08 | 2 | 2 | 28 |
| G09 | 2 | 3 | 28 |
| G10 | 2 | 4 | 28 |
| G11 | 2 | 5 | 28 |
| G12 | 2 | 6 | 28 |
| G13 | 3 | 1 | 28 |
| G14 | 3 | 2 | 28 |
| G15 | 3 | 3 | 28 |
| G16 | 3 | 4 | 28 |
| G17 | 3 | 5 | 28 |
| G18 | 3 | 6 | 28 |
| G19 | 4 | 1 | 28 |
| G20 | 4 | 2 | 28 |
| G21 | 4 | 3 | 28 |
| G22 | 4 | 4 | 28 |
| G23 | 4 | 5 | 28 |
| G24 | 4 | 6 | 28 |
| G25 | 5 | 1 | 28 |
| G26 | 5 | 2 | 28 |
| G27 | 5 | 3 | 28 |
| G28 | 5 | 4 | 28 |
| G29 | 5 | 5 | 28 |
| G30 | 5 | 6 | 28 |
| G31 | 6 | 1 | 28 |
| G32 | 6 | 2 | 28 |
| G33 | 6 | 3 | 28 |
| G34 | 6 | 4 | 28 |
| G35 | 6 | 5 | 28 |
| G36 | 6 | 6 | 21 |

## 3. 分组文件清单（逐文件覆盖）

### G01（Round 1 / Slot 1）
- `.cargo/config.toml`
- `.github/workflows/baseline-check.yml`
- `assets/scripts/toast-notification.ps1`
- `Cargo.toml`
- `clippy.toml`
- `crates/cc-switch/Cargo.toml`
- `crates/cc-switch/src/atomic_write.rs`
- `crates/cc-switch/src/claude.rs`
- `crates/cc-switch/src/codex.rs`
- `crates/cc-switch/src/config_path.rs`
- `crates/cc-switch/src/error.rs`
- `crates/cc-switch/src/gemini.rs`
- `crates/cc-switch/src/lib.rs`
- `crates/cc-switch/src/switcher.rs`
- `crates/db/benches/workflow_bench.rs`
- `crates/db/Cargo.toml`
- `crates/db/migrations/20250617183714_init.sql`
- `crates/db/migrations/20250620212427_execution_processes.sql`
- `crates/db/migrations/20250620214100_remove_stdout_stderr_from_task_attempts.sql`
- `crates/db/migrations/20250621120000_relate_activities_to_execution_processes.sql`
- `crates/db/migrations/20250623120000_executor_sessions.sql`
- `crates/db/migrations/20250623130000_add_executor_type_to_execution_processes.sql`
- `crates/db/migrations/20250625000000_add_dev_script_to_projects.sql`
- `crates/db/migrations/20250701000000_add_branch_to_task_attempts.sql`
- `crates/db/migrations/20250701000001_add_pr_tracking_to_task_attempts.sql`
- `crates/db/migrations/20250701120000_add_assistant_message_to_executor_sessions.sql`
- `crates/db/migrations/20250708000000_add_base_branch_to_task_attempts.sql`
- `crates/db/migrations/20250709000000_add_worktree_deleted_flag.sql`

### G02（Round 1 / Slot 2）
- `crates/db/migrations/20250710000000_add_setup_completion.sql`
- `crates/db/migrations/20250715154859_add_task_templates.sql`
- `crates/db/migrations/20250716143725_add_default_templates.sql`
- `crates/db/migrations/20250716161432_update_executor_names_to_kebab_case.sql`
- `crates/db/migrations/20250716170000_add_parent_task_to_tasks.sql`
- `crates/db/migrations/20250717000000_drop_task_attempt_activities.sql`
- `crates/db/migrations/20250719000000_add_cleanup_script_to_projects.sql`
- `crates/db/migrations/20250720000000_add_cleanupscript_to_process_type_constraint.sql`
- `crates/db/migrations/20250726182144_update_worktree_path_to_container_ref.sql`
- `crates/db/migrations/20250726210910_make_branch_optional.sql`
- `crates/db/migrations/20250727124142_remove_command_from_execution_process.sql`
- `crates/db/migrations/20250727150349_remove_working_directory.sql`
- `crates/db/migrations/20250729162941_create_execution_process_logs.sql`
- `crates/db/migrations/20250729165913_remove_stdout_and_stderr_from_execution_processes.sql`
- `crates/db/migrations/20250730000000_add_executor_action_to_execution_processes.sql`
- `crates/db/migrations/20250730000001_rename_process_type_to_run_reason.sql`
- `crates/db/migrations/20250730124500_add_execution_process_task_attempt_index.sql`
- `crates/db/migrations/20250805112332_add_executor_action_type_to_task_attempts.sql`
- `crates/db/migrations/20250805122100_fix_executor_action_type_virtual_column.sql`
- `crates/db/migrations/20250811000000_add_copy_files_to_projects.sql`
- `crates/db/migrations/20250813000001_rename_base_coding_agent_to_profile.sql`
- `crates/db/migrations/20250815100344_migrate_old_executor_actions.sql`
- `crates/db/migrations/20250818150000_refactor_images_to_junction_tables.sql`
- `crates/db/migrations/20250819000000_move_merge_commit_to_merges_table.sql`
- `crates/db/migrations/20250902120000_add_masked_by_restore_to_execution_processes.sql`
- `crates/db/migrations/20250902184501_rename-profile-to-executor.sql`
- `crates/db/migrations/20250903091032_executors_to_screaming_snake.sql`
- `crates/db/migrations/20250905090000_add_after_head_commit_to_execution_processes.sql`

### G03（Round 1 / Slot 3）
- `crates/db/migrations/20250906120000_add_follow_up_drafts.sql`
- `crates/db/migrations/20250910120000_add_before_head_commit_to_execution_processes.sql`
- `crates/db/migrations/20250917123000_optimize_selects_and_cleanup_indexes.sql`
- `crates/db/migrations/20250921222241_unify_drafts_tables.sql`
- `crates/db/migrations/20250923000000_make_branch_non_null.sql`
- `crates/db/migrations/20251020120000_convert_templates_to_tags.sql`
- `crates/db/migrations/20251101090000_drop_execution_process_logs_pk.sql`
- `crates/db/migrations/20251114000000_create_shared_tasks.sql`
- `crates/db/migrations/20251120000001_refactor_to_scratch.sql`
- `crates/db/migrations/20251129155145_drop_drafts_table.sql`
- `crates/db/migrations/20251202000000_migrate_to_electric.sql`
- `crates/db/migrations/20251206000000_add_parallel_setup_script_to_projects.sql`
- `crates/db/migrations/20251209000000_add_project_repositories.sql`
- `crates/db/migrations/20251215145026_drop_worktree_deleted.sql`
- `crates/db/migrations/20251216000000_add_dev_script_working_dir_to_projects.sql`
- `crates/db/migrations/20251216142123_refactor_task_attempts_to_workspaces_sessions.sql`
- `crates/db/migrations/20251219000000_add_agent_working_dir_to_projects.sql`
- `crates/db/migrations/20251219164205_add_missing_indexes_for_slow_queries.sql`
- `crates/db/migrations/20251220134608_fix_session_executor_format.sql`
- `crates/db/migrations/20251221000000_add_workspace_flags.sql`
- `crates/db/migrations/20260107000000_move_scripts_to_repos.sql`
- `crates/db/migrations/20260107115155_add_seen_to_coding_agent_turns.sql`
- `crates/db/migrations/20260112160045_add_composite_indexes_for_performance.sql`
- `crates/db/migrations/20260117000001_create_workflow_tables.sql`
- `crates/db/migrations/20260119000000_encrypt_api_keys.sql`
- `crates/db/migrations/20260119000001_add_performance_indexes.sql`
- `crates/db/migrations/20260119000002_add_workflow_project_created_index.sql`
- `crates/db/migrations/20260125000000_add_orchestrator_state.sql`

### G04（Round 1 / Slot 4）
- `crates/db/migrations/20260125000001_add_terminal_session_binding.sql`
- `crates/db/migrations/20260202090000_fix_workflow_project_id_type.sql`
- `crates/db/migrations/20260206000000_add_auto_confirm_to_terminal.sql`
- `crates/db/migrations/20260208010000_backfill_terminal_auto_confirm.sql`
- `crates/db/migrations/20260208020000_fix_terminal_old_foreign_keys.sql`
- `crates/db/migrations/20260224000000_add_git_watcher_enabled.sql`
- `crates/db/src/lib.rs`
- `crates/db/src/models/cli_type.rs`
- `crates/db/src/models/coding_agent_turn.rs`
- `crates/db/src/models/execution_process.rs`
- `crates/db/src/models/execution_process_logs.rs`
- `crates/db/src/models/execution_process_repo_state.rs`
- `crates/db/src/models/git_event.rs`
- `crates/db/src/models/image.rs`
- `crates/db/src/models/merge.rs`
- `crates/db/src/models/mod.rs`
- `crates/db/src/models/project.rs`
- `crates/db/src/models/project_repo.rs`
- `crates/db/src/models/repo.rs`
- `crates/db/src/models/scratch.rs`
- `crates/db/src/models/session.rs`
- `crates/db/src/models/tag.rs`
- `crates/db/src/models/task.rs`
- `crates/db/src/models/terminal.rs`
- `crates/db/src/models/workflow.rs`
- `crates/db/src/models/workspace.rs`
- `crates/db/src/models/workspace_repo.rs`
- `crates/deployment/Cargo.toml`

### G05（Round 1 / Slot 5）
- `crates/deployment/src/lib.rs`
- `crates/executors/Cargo.toml`
- `crates/executors/src/actions/coding_agent_follow_up.rs`
- `crates/executors/src/actions/coding_agent_initial.rs`
- `crates/executors/src/actions/mod.rs`
- `crates/executors/src/actions/review.rs`
- `crates/executors/src/actions/script.rs`
- `crates/executors/src/approvals.rs`
- `crates/executors/src/command.rs`
- `crates/executors/src/env.rs`
- `crates/executors/src/executors/acp/client.rs`
- `crates/executors/src/executors/acp/harness.rs`
- `crates/executors/src/executors/acp/mod.rs`
- `crates/executors/src/executors/acp/normalize_logs.rs`
- `crates/executors/src/executors/acp/session.rs`
- `crates/executors/src/executors/amp.rs`
- `crates/executors/src/executors/claude.rs`
- `crates/executors/src/executors/claude/client.rs`
- `crates/executors/src/executors/claude/protocol.rs`
- `crates/executors/src/executors/claude/types.rs`
- `crates/executors/src/executors/codex.rs`
- `crates/executors/src/executors/codex/client.rs`
- `crates/executors/src/executors/codex/jsonrpc.rs`
- `crates/executors/src/executors/codex/normalize_logs.rs`
- `crates/executors/src/executors/codex/review.rs`
- `crates/executors/src/executors/codex/session.rs`
- `crates/executors/src/executors/copilot.rs`
- `crates/executors/src/executors/cursor.rs`

### G06（Round 1 / Slot 6）
- `crates/executors/src/executors/cursor/mcp.rs`
- `crates/executors/src/executors/droid.rs`
- `crates/executors/src/executors/droid/normalize_logs.rs`
- `crates/executors/src/executors/droid/session.rs`
- `crates/executors/src/executors/gemini.rs`
- `crates/executors/src/executors/mod.rs`
- `crates/executors/src/executors/opencode.rs`
- `crates/executors/src/executors/opencode/normalize_logs.rs`
- `crates/executors/src/executors/opencode/sdk.rs`
- `crates/executors/src/executors/opencode/types.rs`
- `crates/executors/src/executors/qa_mock.rs`
- `crates/executors/src/executors/qwen.rs`
- `crates/executors/src/lib.rs`
- `crates/executors/src/logs/mod.rs`
- `crates/executors/src/logs/plain_text_processor.rs`
- `crates/executors/src/logs/stderr_processor.rs`
- `crates/executors/src/logs/utils/entry_index.rs`
- `crates/executors/src/logs/utils/mod.rs`
- `crates/executors/src/logs/utils/patch.rs`
- `crates/executors/src/mcp_config.rs`
- `crates/executors/src/profile.rs`
- `crates/executors/src/stdout_dup.rs`
- `crates/local-deployment/Cargo.toml`
- `crates/local-deployment/src/command.rs`
- `crates/local-deployment/src/container.rs`
- `crates/local-deployment/src/copy.rs`
- `crates/local-deployment/src/lib.rs`
- `crates/review/Cargo.toml`

### G07（Round 2 / Slot 1）
- `crates/review/src/api.rs`
- `crates/review/src/archive.rs`
- `crates/review/src/claude_session.rs`
- `crates/review/src/config.rs`
- `crates/review/src/error.rs`
- `crates/review/src/github.rs`
- `crates/review/src/main.rs`
- `crates/review/src/session_selector.rs`
- `crates/server/benches/performance.rs`
- `crates/server/build.rs`
- `crates/server/Cargo.toml`
- `crates/server/src/bin/generate_types.rs`
- `crates/server/src/bin/mcp_task_server.rs`
- `crates/server/src/error.rs`
- `crates/server/src/lib.rs`
- `crates/server/src/main.rs`
- `crates/server/src/mcp/mod.rs`
- `crates/server/src/mcp/task_server.rs`
- `crates/server/src/middleware/auth.rs`
- `crates/server/src/middleware/mod.rs`
- `crates/server/src/middleware/model_loaders.rs`
- `crates/server/src/routes/approvals.rs`
- `crates/server/src/routes/cli_types.rs`
- `crates/server/src/routes/config.rs`
- `crates/server/src/routes/containers.rs`
- `crates/server/src/routes/event_bridge.rs`
- `crates/server/src/routes/events.rs`
- `crates/server/src/routes/execution_processes.rs`

### G08（Round 2 / Slot 2）
- `crates/server/src/routes/filesystem.rs`
- `crates/server/src/routes/frontend.rs`
- `crates/server/src/routes/git.rs`
- `crates/server/src/routes/health.rs`
- `crates/server/src/routes/images.rs`
- `crates/server/src/routes/mod.rs`
- `crates/server/src/routes/models.rs`
- `crates/server/src/routes/oauth.rs`
- `crates/server/src/routes/organizations.rs`
- `crates/server/src/routes/projects.rs`
- `crates/server/src/routes/repo.rs`
- `crates/server/src/routes/scratch.rs`
- `crates/server/src/routes/sessions/mod.rs`
- `crates/server/src/routes/sessions/queue.rs`
- `crates/server/src/routes/sessions/review.rs`
- `crates/server/src/routes/shared_tasks_types.rs`
- `crates/server/src/routes/slash_commands.rs`
- `crates/server/src/routes/subscription_hub.rs`
- `crates/server/src/routes/tags.rs`
- `crates/server/src/routes/task_attempts.rs`
- `crates/server/src/routes/task_attempts/codex_setup.rs`
- `crates/server/src/routes/task_attempts/cursor_setup.rs`
- `crates/server/src/routes/task_attempts/gh_cli_setup.rs`
- `crates/server/src/routes/task_attempts/images.rs`
- `crates/server/src/routes/task_attempts/pr.rs`
- `crates/server/src/routes/task_attempts/util.rs`
- `crates/server/src/routes/task_attempts/workspace_summary.rs`
- `crates/server/src/routes/tasks.rs`

### G09（Round 2 / Slot 3）
- `crates/server/src/routes/terminal_ws.rs`
- `crates/server/src/routes/terminals.rs`
- `crates/server/src/routes/workflow_events.rs`
- `crates/server/src/routes/workflow_ws.rs`
- `crates/server/src/routes/workflows.rs`
- `crates/server/src/routes/workflows_dto.rs`
- `crates/server/src/tests/integration/mod.rs`
- `crates/server/src/tests/integration/terminal_ws_test.rs`
- `crates/server/src/tests/mod.rs`
- `crates/server/src/tests/terminal_validation_test.rs`
- `crates/server/tests/auth_test.rs`
- `crates/server/tests/cli_detection_test.rs`
- `crates/server/tests/cli_types_detect_test.rs`
- `crates/server/tests/deployment_process_manager_test.rs`
- `crates/server/tests/events_test.rs`
- `crates/server/tests/performance/database_perf_test.rs`
- `crates/server/tests/performance/mod.rs`
- `crates/server/tests/performance/terminal_perf_test.rs`
- `crates/server/tests/performance/websocket_perf_test.rs`
- `crates/server/tests/readme_status_test.rs`
- `crates/server/tests/security/access_control_test.rs`
- `crates/server/tests/security/encryption_test.rs`
- `crates/server/tests/security/injection_prevention_test.rs`
- `crates/server/tests/security/log_sanitization_test.rs`
- `crates/server/tests/security/mod.rs`
- `crates/server/tests/security_test.rs`
- `crates/server/tests/slash_commands_integration_test.rs`
- `crates/server/tests/slash_commands_pool_test.rs`

### G10（Round 2 / Slot 4）
- `crates/server/tests/slash_commands_test.rs`
- `crates/server/tests/terminal_logs_api_test.rs`
- `crates/server/tests/terminal_stop_test.rs`
- `crates/server/tests/terminal_ws_test.rs`
- `crates/server/tests/workflow_api_test.rs`
- `crates/server/tests/workflow_contract.rs`
- `crates/services/Cargo.toml`
- `crates/services/src/lib.rs`
- `crates/services/src/services/analytics.rs`
- `crates/services/src/services/approvals.rs`
- `crates/services/src/services/approvals/executor_approvals.rs`
- `crates/services/src/services/auth.rs`
- `crates/services/src/services/cc_switch.rs`
- `crates/services/src/services/config/editor/mod.rs`
- `crates/services/src/services/config/mod.rs`
- `crates/services/src/services/config/versions/mod.rs`
- `crates/services/src/services/config/versions/v1.rs`
- `crates/services/src/services/config/versions/v2.rs`
- `crates/services/src/services/config/versions/v3.rs`
- `crates/services/src/services/config/versions/v4.rs`
- `crates/services/src/services/config/versions/v5.rs`
- `crates/services/src/services/config/versions/v6.rs`
- `crates/services/src/services/config/versions/v7.rs`
- `crates/services/src/services/config/versions/v8.rs`
- `crates/services/src/services/container.rs`
- `crates/services/src/services/diff_stream.rs`
- `crates/services/src/services/error_handler.rs`
- `crates/services/src/services/events.rs`

### G11（Round 2 / Slot 5）
- `crates/services/src/services/events/patches.rs`
- `crates/services/src/services/events/streams.rs`
- `crates/services/src/services/events/types.rs`
- `crates/services/src/services/file_ranker.rs`
- `crates/services/src/services/file_search.rs`
- `crates/services/src/services/filesystem.rs`
- `crates/services/src/services/filesystem_watcher.rs`
- `crates/services/src/services/git.rs`
- `crates/services/src/services/git/cli.rs`
- `crates/services/src/services/git_host/azure/cli.rs`
- `crates/services/src/services/git_host/azure/mod.rs`
- `crates/services/src/services/git_host/detection.rs`
- `crates/services/src/services/git_host/github/cli.rs`
- `crates/services/src/services/git_host/github/mod.rs`
- `crates/services/src/services/git_host/mod.rs`
- `crates/services/src/services/git_host/types.rs`
- `crates/services/src/services/git_watcher.rs`
- `crates/services/src/services/image.rs`
- `crates/services/src/services/merge_coordinator.rs`
- `crates/services/src/services/mod.rs`
- `crates/services/src/services/notification.rs`
- `crates/services/src/services/oauth_credentials.rs`
- `crates/services/src/services/orchestrator/agent.rs`
- `crates/services/src/services/orchestrator/config.rs`
- `crates/services/src/services/orchestrator/constants.rs`
- `crates/services/src/services/orchestrator/llm.rs`
- `crates/services/src/services/orchestrator/message_bus.rs`
- `crates/services/src/services/orchestrator/mod.rs`

### G12（Round 2 / Slot 6）
- `crates/services/src/services/orchestrator/persistence.rs`
- `crates/services/src/services/orchestrator/persistence_test.rs`
- `crates/services/src/services/orchestrator/prompt_handler.rs`
- `crates/services/src/services/orchestrator/runtime.rs`
- `crates/services/src/services/orchestrator/runtime_test.rs`
- `crates/services/src/services/orchestrator/state.rs`
- `crates/services/src/services/orchestrator/terminal_coordinator.rs`
- `crates/services/src/services/orchestrator/terminal_coordinator_test.rs`
- `crates/services/src/services/orchestrator/tests.rs`
- `crates/services/src/services/orchestrator/types.rs`
- `crates/services/src/services/pr_monitor.rs`
- `crates/services/src/services/project.rs`
- `crates/services/src/services/qa_repos.rs`
- `crates/services/src/services/queued_message.rs`
- `crates/services/src/services/repo.rs`
- `crates/services/src/services/share.rs`
- `crates/services/src/services/template_renderer.rs`
- `crates/services/src/services/terminal/bridge.rs`
- `crates/services/src/services/terminal/detector.rs`
- `crates/services/src/services/terminal/launcher.rs`
- `crates/services/src/services/terminal/mod.rs`
- `crates/services/src/services/terminal/output_fanout.rs`
- `crates/services/src/services/terminal/process.rs`
- `crates/services/src/services/terminal/prompt_detector.rs`
- `crates/services/src/services/terminal/prompt_watcher.rs`
- `crates/services/src/services/terminal/utf8_decoder.rs`
- `crates/services/src/services/workspace_manager.rs`
- `crates/services/src/services/worktree_manager.rs`

### G13（Round 3 / Slot 1）
- `crates/services/src/utils/mod.rs`
- `crates/services/test_edge_cases.rs`
- `crates/services/tests/error_handler_test.rs`
- `crates/services/tests/filesystem_repo_discovery.rs`
- `crates/services/tests/git_ops_safety.rs`
- `crates/services/tests/git_watcher_integration_test.rs`
- `crates/services/tests/git_workflow.rs`
- `crates/services/tests/merge_coordinator_test.rs`
- `crates/services/tests/phase18_git_watcher.rs`
- `crates/services/tests/phase18_scenarios.rs`
- `crates/services/tests/status_broadcast_test.rs`
- `crates/services/tests/terminal_binding_test.rs`
- `crates/services/tests/terminal_integration.rs`
- `crates/services/tests/terminal_lifecycle_test.rs`
- `crates/services/tests/terminal_logging_test.rs`
- `crates/services/tests/terminal_timeout_test.rs`
- `crates/utils/Cargo.toml`
- `crates/utils/src/api/mod.rs`
- `crates/utils/src/api/oauth.rs`
- `crates/utils/src/api/organizations.rs`
- `crates/utils/src/api/projects.rs`
- `crates/utils/src/approvals.rs`
- `crates/utils/src/assets.rs`
- `crates/utils/src/browser.rs`
- `crates/utils/src/diff.rs`
- `crates/utils/src/git.rs`
- `crates/utils/src/jwt.rs`
- `crates/utils/src/lib.rs`

### G14（Round 3 / Slot 2）
- `crates/utils/src/log_msg.rs`
- `crates/utils/src/msg_store.rs`
- `crates/utils/src/path.rs`
- `crates/utils/src/port_file.rs`
- `crates/utils/src/response.rs`
- `crates/utils/src/sentry.rs`
- `crates/utils/src/shell.rs`
- `crates/utils/src/stream_lines.rs`
- `crates/utils/src/text.rs`
- `crates/utils/src/tokio.rs`
- `crates/utils/src/version.rs`
- `docker/compose/docker-compose.dev.yml`
- `docker/compose/docker-compose.yml`
- `docker/Dockerfile`
- `frontend/.eslintrc.cjs`
- `frontend/.eslintrc.strict.cjs`
- `frontend/index.html`
- `frontend/postcss.config.cjs`
- `frontend/src/App.tsx`
- `frontend/src/components/AgentAvailabilityIndicator.tsx`
- `frontend/src/components/agents/AgentIcon.tsx`
- `frontend/src/components/board/StatusBar.test.tsx`
- `frontend/src/components/board/StatusBar.tsx`
- `frontend/src/components/board/TaskCard.test.tsx`
- `frontend/src/components/board/TaskCard.tsx`
- `frontend/src/components/board/TerminalActivityPanel.test.tsx`
- `frontend/src/components/board/TerminalActivityPanel.tsx`
- `frontend/src/components/board/TerminalDots.test.tsx`

### G15（Round 3 / Slot 3）
- `frontend/src/components/board/TerminalDots.tsx`
- `frontend/src/components/board/WorkflowCard.test.tsx`
- `frontend/src/components/board/WorkflowCard.tsx`
- `frontend/src/components/board/WorkflowKanbanBoard.test.tsx`
- `frontend/src/components/board/WorkflowKanbanBoard.tsx`
- `frontend/src/components/board/WorkflowSidebar.test.tsx`
- `frontend/src/components/board/WorkflowSidebar.tsx`
- `frontend/src/components/common/ProfileVariantBadge.tsx`
- `frontend/src/components/common/RawLogText.tsx`
- `frontend/src/components/ConfigProvider.tsx`
- `frontend/src/components/debug/TerminalDebugView.test.tsx`
- `frontend/src/components/debug/TerminalDebugView.tsx`
- `frontend/src/components/debug/TerminalSidebar.test.tsx`
- `frontend/src/components/debug/TerminalSidebar.tsx`
- `frontend/src/components/DevBanner.tsx`
- `frontend/src/components/dialogs/auth/GhCliSetupDialog.tsx`
- `frontend/src/components/dialogs/git/ForcePushDialog.tsx`
- `frontend/src/components/dialogs/global/BetaWorkspacesDialog.tsx`
- `frontend/src/components/dialogs/global/DisclaimerDialog.tsx`
- `frontend/src/components/dialogs/global/FeatureShowcaseDialog.tsx`
- `frontend/src/components/dialogs/global/OAuthDialog.tsx`
- `frontend/src/components/dialogs/global/OnboardingDialog.tsx`
- `frontend/src/components/dialogs/global/ReleaseNotesDialog.tsx`
- `frontend/src/components/dialogs/index.ts`
- `frontend/src/components/dialogs/org/CreateOrganizationDialog.tsx`
- `frontend/src/components/dialogs/org/InviteMemberDialog.tsx`
- `frontend/src/components/dialogs/projects/LinkProjectDialog.tsx`
- `frontend/src/components/dialogs/projects/ProjectEditorSelectionDialog.tsx`

### G16（Round 3 / Slot 4）
- `frontend/src/components/dialogs/projects/ProjectFormDialog.tsx`
- `frontend/src/components/dialogs/scripts/ScriptFixerDialog.tsx`
- `frontend/src/components/dialogs/settings/CreateConfigurationDialog.tsx`
- `frontend/src/components/dialogs/settings/DeleteConfigurationDialog.tsx`
- `frontend/src/components/dialogs/shared/ConfirmDialog.tsx`
- `frontend/src/components/dialogs/shared/FolderPickerDialog.tsx`
- `frontend/src/components/dialogs/shared/LoginRequiredPrompt.tsx`
- `frontend/src/components/dialogs/shared/RepoPickerDialog.tsx`
- `frontend/src/components/dialogs/tasks/ChangeTargetBranchDialog.tsx`
- `frontend/src/components/dialogs/tasks/CreateAttemptDialog.tsx`
- `frontend/src/components/dialogs/tasks/CreatePRDialog.tsx`
- `frontend/src/components/dialogs/tasks/DeleteTaskConfirmationDialog.tsx`
- `frontend/src/components/dialogs/tasks/EditBranchNameDialog.tsx`
- `frontend/src/components/dialogs/tasks/EditorSelectionDialog.tsx`
- `frontend/src/components/dialogs/tasks/GitActionsDialog.tsx`
- `frontend/src/components/dialogs/tasks/PrCommentsDialog.tsx`
- `frontend/src/components/dialogs/tasks/ReassignDialog.tsx`
- `frontend/src/components/dialogs/tasks/RebaseDialog.tsx`
- `frontend/src/components/dialogs/tasks/RestoreLogsDialog.tsx`
- `frontend/src/components/dialogs/tasks/ShareDialog.tsx`
- `frontend/src/components/dialogs/tasks/StartReviewDialog.tsx`
- `frontend/src/components/dialogs/tasks/StopShareTaskDialog.tsx`
- `frontend/src/components/dialogs/tasks/TagEditDialog.tsx`
- `frontend/src/components/dialogs/tasks/TaskFormDialog.tsx`
- `frontend/src/components/dialogs/tasks/ViewProcessesDialog.tsx`
- `frontend/src/components/dialogs/tasks/ViewRelatedTasksDialog.tsx`
- `frontend/src/components/dialogs/wysiwyg/ImagePreviewDialog.tsx`
- `frontend/src/components/diff/CommentWidgetLine.tsx`

### G17（Round 3 / Slot 5）
- `frontend/src/components/diff/ReviewCommentRenderer.tsx`
- `frontend/src/components/DiffCard.tsx`
- `frontend/src/components/DiffViewSwitch.tsx`
- `frontend/src/components/EditorAvailabilityIndicator.tsx`
- `frontend/src/components/ExecutorConfigForm.tsx`
- `frontend/src/components/ide/IdeIcon.tsx`
- `frontend/src/components/ide/OpenInIdeButton.tsx`
- `frontend/src/components/layout/Navbar.tsx`
- `frontend/src/components/layout/NewDesignLayout.tsx`
- `frontend/src/components/layout/NormalLayout.tsx`
- `frontend/src/components/legacy-design/LegacyDesignScope.tsx`
- `frontend/src/components/Logo.tsx`
- `frontend/src/components/logs/VirtualizedList.tsx`
- `frontend/src/components/NormalizedConversation/DisplayConversationEntry.tsx`
- `frontend/src/components/NormalizedConversation/EditDiffRenderer.tsx`
- `frontend/src/components/NormalizedConversation/FileChangeRenderer.tsx`
- `frontend/src/components/NormalizedConversation/FileContentView.tsx`
- `frontend/src/components/NormalizedConversation/NextActionCard.tsx`
- `frontend/src/components/NormalizedConversation/PendingApprovalEntry.tsx`
- `frontend/src/components/NormalizedConversation/RetryEditorInline.tsx`
- `frontend/src/components/NormalizedConversation/UserMessage.tsx`
- `frontend/src/components/org/MemberListItem.tsx`
- `frontend/src/components/org/PendingInvitationItem.tsx`
- `frontend/src/components/org/RemoteProjectItem.tsx`
- `frontend/src/components/panels/AttemptHeaderActions.tsx`
- `frontend/src/components/panels/DiffsPanel.tsx`
- `frontend/src/components/panels/PreviewPanel.tsx`
- `frontend/src/components/panels/SharedTaskPanel.tsx`

### G18（Round 3 / Slot 6）
- `frontend/src/components/panels/TaskAttemptPanel.tsx`
- `frontend/src/components/panels/TaskPanel.tsx`
- `frontend/src/components/panels/TaskPanelHeaderActions.tsx`
- `frontend/src/components/pipeline/MergeTerminalNode.test.tsx`
- `frontend/src/components/pipeline/MergeTerminalNode.tsx`
- `frontend/src/components/pipeline/OrchestratorHeader.test.tsx`
- `frontend/src/components/pipeline/OrchestratorHeader.tsx`
- `frontend/src/components/pipeline/TaskPipeline.test.tsx`
- `frontend/src/components/pipeline/TaskPipeline.tsx`
- `frontend/src/components/pipeline/TerminalDetailPanel.test.tsx`
- `frontend/src/components/pipeline/TerminalDetailPanel.tsx`
- `frontend/src/components/pipeline/TerminalNode.test.tsx`
- `frontend/src/components/pipeline/TerminalNode.tsx`
- `frontend/src/components/rjsf/fields/index.ts`
- `frontend/src/components/rjsf/fields/KeyValueField.tsx`
- `frontend/src/components/rjsf/index.ts`
- `frontend/src/components/rjsf/templates/ArrayFieldTemplate.tsx`
- `frontend/src/components/rjsf/templates/FieldTemplate.tsx`
- `frontend/src/components/rjsf/templates/FormTemplate.tsx`
- `frontend/src/components/rjsf/templates/index.ts`
- `frontend/src/components/rjsf/templates/ObjectFieldTemplate.tsx`
- `frontend/src/components/rjsf/theme.ts`
- `frontend/src/components/rjsf/widgets/CheckboxWidget.tsx`
- `frontend/src/components/rjsf/widgets/index.ts`
- `frontend/src/components/rjsf/widgets/SelectWidget.tsx`
- `frontend/src/components/rjsf/widgets/TextareaWidget.tsx`
- `frontend/src/components/rjsf/widgets/TextWidget.tsx`
- `frontend/src/components/SearchBar.tsx`

### G19（Round 4 / Slot 1）
- `frontend/src/components/settings/ExecutorProfileSelector.tsx`
- `frontend/src/components/settings/index.ts`
- `frontend/src/components/showcase/ShowcaseStageMedia.tsx`
- `frontend/src/components/TagManager.tsx`
- `frontend/src/components/tasks/AgentSelector.tsx`
- `frontend/src/components/tasks/BranchSelector.tsx`
- `frontend/src/components/tasks/ClickedElementsBanner.tsx`
- `frontend/src/components/tasks/ConfigSelector.tsx`
- `frontend/src/components/tasks/ConflictBanner.tsx`
- `frontend/src/components/tasks/follow-up/FollowUpConflictSection.tsx`
- `frontend/src/components/tasks/RepoBranchSelector.tsx`
- `frontend/src/components/tasks/RepoSelector.tsx`
- `frontend/src/components/tasks/SharedTaskCard.tsx`
- `frontend/src/components/tasks/TaskCard.test.tsx`
- `frontend/src/components/tasks/TaskCard.tsx`
- `frontend/src/components/tasks/TaskCardHeader.tsx`
- `frontend/src/components/tasks/TaskDetails/preview/DevServerLogsView.tsx`
- `frontend/src/components/tasks/TaskDetails/preview/NoServerContent.tsx`
- `frontend/src/components/tasks/TaskDetails/preview/PreviewToolbar.tsx`
- `frontend/src/components/tasks/TaskDetails/preview/ReadyContent.tsx`
- `frontend/src/components/tasks/TaskDetails/ProcessesTab.tsx`
- `frontend/src/components/tasks/TaskDetails/ProcessLogsViewer.tsx`
- `frontend/src/components/tasks/TaskFollowUpSection.tsx`
- `frontend/src/components/tasks/TodoPanel.tsx`
- `frontend/src/components/tasks/Toolbar/GitOperations.tsx`
- `frontend/src/components/tasks/UserAvatar.tsx`
- `frontend/src/components/tasks/VariantSelector.tsx`
- `frontend/src/components/terminal/TerminalDebugView.test.tsx`

### G20（Round 4 / Slot 2）
- `frontend/src/components/terminal/TerminalDebugView.tsx`
- `frontend/src/components/terminal/TerminalEmulator.test.tsx`
- `frontend/src/components/terminal/TerminalEmulator.tsx`
- `frontend/src/components/ThemeProvider.tsx`
- `frontend/src/components/ui/actions-dropdown.tsx`
- `frontend/src/components/ui/alert.tsx`
- `frontend/src/components/ui/auto-expanding-textarea.tsx`
- `frontend/src/components/ui/badge.tsx`
- `frontend/src/components/ui/breadcrumb.tsx`
- `frontend/src/components/ui/button.tsx`
- `frontend/src/components/ui/card.tsx`
- `frontend/src/components/ui/carousel.tsx`
- `frontend/src/components/ui/checkbox.tsx`
- `frontend/src/components/ui/dialog.tsx`
- `frontend/src/components/ui/dropdown-menu.tsx`
- `frontend/src/components/ui/input.tsx`
- `frontend/src/components/ui/json-editor.tsx`
- `frontend/src/components/ui/label.tsx`
- `frontend/src/components/ui/loader.tsx`
- `frontend/src/components/ui/multi-file-search-textarea.tsx`
- `frontend/src/components/ui/new-card.tsx`
- `frontend/src/components/ui/pr-comment-card.tsx`
- `frontend/src/components/ui/select.tsx`
- `frontend/src/components/ui/shadcn-io/kanban.tsx`
- `frontend/src/components/ui/switch.tsx`
- `frontend/src/components/ui/table/data-table.tsx`
- `frontend/src/components/ui/table/index.ts`
- `frontend/src/components/ui/table/table.tsx`

### G21（Round 4 / Slot 3）
- `frontend/src/components/ui/tabs.tsx`
- `frontend/src/components/ui/textarea.tsx`
- `frontend/src/components/ui/toast.tsx`
- `frontend/src/components/ui/toggle-group.tsx`
- `frontend/src/components/ui/tooltip.tsx`
- `frontend/src/components/ui/wysiwyg.tsx`
- `frontend/src/components/ui/wysiwyg/context/task-attempt-context.tsx`
- `frontend/src/components/ui/wysiwyg/lib/code-highlight-theme.ts`
- `frontend/src/components/ui/wysiwyg/lib/create-decorator-node.tsx`
- `frontend/src/components/ui/wysiwyg/nodes/image-node.tsx`
- `frontend/src/components/ui/wysiwyg/nodes/pr-comment-node.tsx`
- `frontend/src/components/ui/wysiwyg/plugins/clickable-code-plugin.tsx`
- `frontend/src/components/ui/wysiwyg/plugins/code-block-shortcut-plugin.tsx`
- `frontend/src/components/ui/wysiwyg/plugins/code-highlight-plugin.tsx`
- `frontend/src/components/ui/wysiwyg/plugins/file-tag-typeahead-plugin.tsx`
- `frontend/src/components/ui/wysiwyg/plugins/image-keyboard-plugin.tsx`
- `frontend/src/components/ui/wysiwyg/plugins/keyboard-commands-plugin.tsx`
- `frontend/src/components/ui/wysiwyg/plugins/markdown-sync-plugin.tsx`
- `frontend/src/components/ui/wysiwyg/plugins/read-only-link-plugin.tsx`
- `frontend/src/components/ui/wysiwyg/plugins/toolbar-plugin.tsx`
- `frontend/src/components/ui/wysiwyg/transformers/code-block-transformer.ts`
- `frontend/src/components/ui/wysiwyg/transformers/table-transformer.ts`
- `frontend/src/components/ui-new/actions/index.ts`
- `frontend/src/components/ui-new/actions/pages.ts`
- `frontend/src/components/ui-new/actions/useActionVisibility.ts`
- `frontend/src/components/ui-new/containers/BrowseRepoButtonContainer.tsx`
- `frontend/src/components/ui-new/containers/ChangesPanelContainer.tsx`
- `frontend/src/components/ui-new/containers/CommentWidgetLine.tsx`

### G22（Round 4 / Slot 4）
- `frontend/src/components/ui-new/containers/ContextBarContainer.tsx`
- `frontend/src/components/ui-new/containers/ConversationListContainer.tsx`
- `frontend/src/components/ui-new/containers/CopyButton.tsx`
- `frontend/src/components/ui-new/containers/CreateChatBoxContainer.tsx`
- `frontend/src/components/ui-new/containers/CreateRepoButtonContainer.tsx`
- `frontend/src/components/ui-new/containers/DiffViewCardWithComments.tsx`
- `frontend/src/components/ui-new/containers/FileTreeContainer.tsx`
- `frontend/src/components/ui-new/containers/GitHubCommentRenderer.tsx`
- `frontend/src/components/ui-new/containers/GitPanelContainer.tsx`
- `frontend/src/components/ui-new/containers/GitPanelCreateContainer.tsx`
- `frontend/src/components/ui-new/containers/LogsContentContainer.tsx`
- `frontend/src/components/ui-new/containers/NavbarContainer.tsx`
- `frontend/src/components/ui-new/containers/NewDisplayConversationEntry.tsx`
- `frontend/src/components/ui-new/containers/PreviewBrowserContainer.tsx`
- `frontend/src/components/ui-new/containers/PreviewControlsContainer.tsx`
- `frontend/src/components/ui-new/containers/ProcessListContainer.tsx`
- `frontend/src/components/ui-new/containers/ProjectSelectorContainer.tsx`
- `frontend/src/components/ui-new/containers/RecentReposListContainer.tsx`
- `frontend/src/components/ui-new/containers/ReviewCommentRenderer.tsx`
- `frontend/src/components/ui-new/containers/RightSidebar.tsx`
- `frontend/src/components/ui-new/containers/SearchableDropdownContainer.tsx`
- `frontend/src/components/ui-new/containers/SessionChatBoxContainer.tsx`
- `frontend/src/components/ui-new/containers/VirtualizedProcessLogs.tsx`
- `frontend/src/components/ui-new/containers/WorkspacesLayout.tsx`
- `frontend/src/components/ui-new/containers/WorkspacesMainContainer.tsx`
- `frontend/src/components/ui-new/containers/WorkspacesSidebarContainer.tsx`
- `frontend/src/components/ui-new/dialogs/ChangeTargetDialog.tsx`
- `frontend/src/components/ui-new/dialogs/commandBar/injectSearchMatches.ts`

### G23（Round 4 / Slot 5）
- `frontend/src/components/ui-new/dialogs/commandBar/useCommandBarState.ts`
- `frontend/src/components/ui-new/dialogs/commandBar/useResolvedPage.ts`
- `frontend/src/components/ui-new/dialogs/CommandBarDialog.tsx`
- `frontend/src/components/ui-new/dialogs/ConfirmDialog.tsx`
- `frontend/src/components/ui-new/dialogs/CreateProjectDialog.tsx`
- `frontend/src/components/ui-new/dialogs/CreateRepoDialog.tsx`
- `frontend/src/components/ui-new/dialogs/RebaseDialog.tsx`
- `frontend/src/components/ui-new/dialogs/RenameWorkspaceDialog.tsx`
- `frontend/src/components/ui-new/dialogs/ResolveConflictsDialog.tsx`
- `frontend/src/components/ui-new/dialogs/WorkspacesGuideDialog.tsx`
- `frontend/src/components/ui-new/hooks/usePreviewDevServer.ts`
- `frontend/src/components/ui-new/hooks/usePreviewUrl.ts`
- `frontend/src/components/ui-new/hooks/useWorkspaces.ts`
- `frontend/src/components/ui-new/primitives/Button.tsx`
- `frontend/src/components/ui-new/primitives/Card.tsx`
- `frontend/src/components/ui-new/primitives/ChatBoxBase.tsx`
- `frontend/src/components/ui-new/primitives/CollapsibleSection.tsx`
- `frontend/src/components/ui-new/primitives/CollapsibleSectionHeader.tsx`
- `frontend/src/components/ui-new/primitives/Command.tsx`
- `frontend/src/components/ui-new/primitives/CommandBar.tsx`
- `frontend/src/components/ui-new/primitives/CommentCard.tsx`
- `frontend/src/components/ui-new/primitives/ContextBar.tsx`
- `frontend/src/components/ui-new/primitives/conversation/ChatApprovalCard.tsx`
- `frontend/src/components/ui-new/primitives/conversation/ChatAssistantMessage.tsx`
- `frontend/src/components/ui-new/primitives/conversation/ChatEntryContainer.tsx`
- `frontend/src/components/ui-new/primitives/conversation/ChatErrorMessage.tsx`
- `frontend/src/components/ui-new/primitives/conversation/ChatFileEntry.tsx`
- `frontend/src/components/ui-new/primitives/conversation/ChatMarkdown.tsx`

### G24（Round 4 / Slot 6）
- `frontend/src/components/ui-new/primitives/conversation/ChatScriptEntry.tsx`
- `frontend/src/components/ui-new/primitives/conversation/ChatSystemMessage.tsx`
- `frontend/src/components/ui-new/primitives/conversation/ChatThinkingMessage.tsx`
- `frontend/src/components/ui-new/primitives/conversation/ChatTodoList.tsx`
- `frontend/src/components/ui-new/primitives/conversation/ChatToolSummary.tsx`
- `frontend/src/components/ui-new/primitives/conversation/ChatUserMessage.tsx`
- `frontend/src/components/ui-new/primitives/conversation/DiffViewCard.tsx`
- `frontend/src/components/ui-new/primitives/conversation/index.ts`
- `frontend/src/components/ui-new/primitives/conversation/ToolStatusDot.tsx`
- `frontend/src/components/ui-new/primitives/CreateChatBox.tsx`
- `frontend/src/components/ui-new/primitives/Dialog.tsx`
- `frontend/src/components/ui-new/primitives/Dropdown.tsx`
- `frontend/src/components/ui-new/primitives/ErrorAlert.tsx`
- `frontend/src/components/ui-new/primitives/Field.tsx`
- `frontend/src/components/ui-new/primitives/FormField.tsx`
- `frontend/src/components/ui-new/primitives/IconButton.tsx`
- `frontend/src/components/ui-new/primitives/IconButtonGroup.tsx`
- `frontend/src/components/ui-new/primitives/IconListItem.tsx`
- `frontend/src/components/ui-new/primitives/InputField.tsx`
- `frontend/src/components/ui-new/primitives/Label.tsx`
- `frontend/src/components/ui-new/primitives/PrimaryButton.tsx`
- `frontend/src/components/ui-new/primitives/ProcessListItem.tsx`
- `frontend/src/components/ui-new/primitives/RecentReposList.tsx`
- `frontend/src/components/ui-new/primitives/RepoCard.tsx`
- `frontend/src/components/ui-new/primitives/RepoCardSimple.tsx`
- `frontend/src/components/ui-new/primitives/RunningDots.tsx`
- `frontend/src/components/ui-new/primitives/SearchableDropdown.tsx`
- `frontend/src/components/ui-new/primitives/SectionHeader.tsx`

### G25（Round 5 / Slot 1）
- `frontend/src/components/ui-new/primitives/SelectedReposList.tsx`
- `frontend/src/components/ui-new/primitives/Separator.tsx`
- `frontend/src/components/ui-new/primitives/SessionChatBox.tsx`
- `frontend/src/components/ui-new/primitives/SplitButton.tsx`
- `frontend/src/components/ui-new/primitives/StatusPill.tsx`
- `frontend/src/components/ui-new/primitives/Toolbar.tsx`
- `frontend/src/components/ui-new/primitives/Tooltip.tsx`
- `frontend/src/components/ui-new/primitives/ViewHeader.tsx`
- `frontend/src/components/ui-new/primitives/WorkspaceSummary.tsx`
- `frontend/src/components/ui-new/scope/NewDesignScope.tsx`
- `frontend/src/components/ui-new/types/fileTree.ts`
- `frontend/src/components/ui-new/utils/workflowStatus.ts`
- `frontend/src/components/ui-new/views/ChangesPanel.tsx`
- `frontend/src/components/ui-new/views/FileTree.tsx`
- `frontend/src/components/ui-new/views/FileTreeNode.tsx`
- `frontend/src/components/ui-new/views/FileTreePlaceholder.tsx`
- `frontend/src/components/ui-new/views/FileTreeSearchBar.tsx`
- `frontend/src/components/ui-new/views/GitPanel.tsx`
- `frontend/src/components/ui-new/views/GitPanelCreate.tsx`
- `frontend/src/components/ui-new/views/Navbar.tsx`
- `frontend/src/components/ui-new/views/PreviewBrowser.tsx`
- `frontend/src/components/ui-new/views/PreviewControls.tsx`
- `frontend/src/components/ui-new/views/WorkspacesMain.tsx`
- `frontend/src/components/ui-new/views/WorkspacesSidebar.tsx`
- `frontend/src/components/wizard/StepIndicator.test.tsx`
- `frontend/src/components/wizard/StepIndicator.tsx`
- `frontend/src/components/wizard/WorkflowConfigureStep.test.tsx`
- `frontend/src/components/wizard/WorkflowConfigureStep.tsx`

### G26（Round 5 / Slot 2）
- `frontend/src/components/wizard/WorkflowExecuteStep.test.tsx`
- `frontend/src/components/wizard/WorkflowExecuteStep.tsx`
- `frontend/src/components/wizard/WorkflowReviewStep.test.tsx`
- `frontend/src/components/wizard/WorkflowReviewStep.tsx`
- `frontend/src/components/wizard/WorkflowWizard.test.tsx`
- `frontend/src/components/wizard/WorkflowWizard.tsx`
- `frontend/src/components/workflow/constants.ts`
- `frontend/src/components/workflow/hooks/__tests__/useWizardNavigation.test.ts`
- `frontend/src/components/workflow/hooks/__tests__/useWizardValidation.test.ts`
- `frontend/src/components/workflow/hooks/useWizardNavigation.ts`
- `frontend/src/components/workflow/hooks/useWizardValidation.ts`
- `frontend/src/components/workflow/PipelineView.test.tsx`
- `frontend/src/components/workflow/PipelineView.tsx`
- `frontend/src/components/workflow/StepIndicator.test.tsx`
- `frontend/src/components/workflow/StepIndicator.tsx`
- `frontend/src/components/workflow/steps/index.ts`
- `frontend/src/components/workflow/steps/Step0Project.test.tsx`
- `frontend/src/components/workflow/steps/Step0Project.tsx`
- `frontend/src/components/workflow/steps/Step1Basic.test.tsx`
- `frontend/src/components/workflow/steps/Step1Basic.tsx`
- `frontend/src/components/workflow/steps/Step2Tasks.test.tsx`
- `frontend/src/components/workflow/steps/Step2Tasks.tsx`
- `frontend/src/components/workflow/steps/Step3Models.test.tsx`
- `frontend/src/components/workflow/steps/Step3Models.tsx`
- `frontend/src/components/workflow/steps/Step4Terminals.test.tsx`
- `frontend/src/components/workflow/steps/Step4Terminals.tsx`
- `frontend/src/components/workflow/steps/Step5Commands.test.tsx`
- `frontend/src/components/workflow/steps/Step5Commands.tsx`

### G27（Round 5 / Slot 3）
- `frontend/src/components/workflow/steps/Step6Advanced.test.tsx`
- `frontend/src/components/workflow/steps/Step6Advanced.tsx`
- `frontend/src/components/workflow/TerminalCard.test.tsx`
- `frontend/src/components/workflow/TerminalCard.tsx`
- `frontend/src/components/workflow/types.test.ts`
- `frontend/src/components/workflow/types.ts`
- `frontend/src/components/workflow/validators/__tests__/step4Terminals.test.ts`
- `frontend/src/components/workflow/validators/__tests__/steps.test.ts`
- `frontend/src/components/workflow/validators/index.ts`
- `frontend/src/components/workflow/validators/step0Project.ts`
- `frontend/src/components/workflow/validators/step1Basic.ts`
- `frontend/src/components/workflow/validators/step2Tasks.ts`
- `frontend/src/components/workflow/validators/step3Models.ts`
- `frontend/src/components/workflow/validators/step4Terminals.ts`
- `frontend/src/components/workflow/validators/step5Commands.ts`
- `frontend/src/components/workflow/validators/step6Advanced.ts`
- `frontend/src/components/workflow/WorkflowPromptDialog.test.tsx`
- `frontend/src/components/workflow/WorkflowPromptDialog.tsx`
- `frontend/src/components/workflow/WorkflowWizard.test.tsx`
- `frontend/src/components/workflow/WorkflowWizard.tsx`
- `frontend/src/config/showcases.ts`
- `frontend/src/constants/processes.ts`
- `frontend/src/contexts/ActionsContext.tsx`
- `frontend/src/contexts/ApprovalFeedbackContext.tsx`
- `frontend/src/contexts/ApprovalFormContext.tsx`
- `frontend/src/contexts/ChangesViewContext.tsx`
- `frontend/src/contexts/ClickedElementsProvider.tsx`
- `frontend/src/contexts/CreateModeContext.tsx`

### G28（Round 5 / Slot 4）
- `frontend/src/contexts/EntriesContext.tsx`
- `frontend/src/contexts/ExecutionProcessesContext.tsx`
- `frontend/src/contexts/GitOperationsContext.tsx`
- `frontend/src/contexts/LogsPanelContext.tsx`
- `frontend/src/contexts/MessageEditContext.tsx`
- `frontend/src/contexts/PortalContainerContext.tsx`
- `frontend/src/contexts/ProcessSelectionContext.tsx`
- `frontend/src/contexts/ProjectContext.tsx`
- `frontend/src/contexts/RetryUiContext.tsx`
- `frontend/src/contexts/ReviewProvider.tsx`
- `frontend/src/contexts/SearchContext.tsx`
- `frontend/src/contexts/TabNavigationContext.tsx`
- `frontend/src/contexts/WorkspaceContext.tsx`
- `frontend/src/hooks/__tests__/useErrorNotification.test.tsx`
- `frontend/src/hooks/auth/useAuth.ts`
- `frontend/src/hooks/auth/useAuthMutations.ts`
- `frontend/src/hooks/auth/useAuthStatus.ts`
- `frontend/src/hooks/auth/useCurrentUser.ts`
- `frontend/src/hooks/index.ts`
- `frontend/src/hooks/useAgentAvailability.ts`
- `frontend/src/hooks/useApprovalMutation.ts`
- `frontend/src/hooks/useAssigneeUserName.ts`
- `frontend/src/hooks/useAttempt.ts`
- `frontend/src/hooks/useAttemptBranch.ts`
- `frontend/src/hooks/useAttemptConflicts.ts`
- `frontend/src/hooks/useAttemptCreation.ts`
- `frontend/src/hooks/useAttemptExecution.ts`
- `frontend/src/hooks/useAttemptRepo.ts`

### G29（Round 5 / Slot 5）
- `frontend/src/hooks/useAutoLinkSharedTasks.ts`
- `frontend/src/hooks/useBranchStatus.ts`
- `frontend/src/hooks/useChangeTargetBranch.ts`
- `frontend/src/hooks/useCliTypes.test.tsx`
- `frontend/src/hooks/useCliTypes.ts`
- `frontend/src/hooks/useCommandBarShortcut.ts`
- `frontend/src/hooks/useContextBarPosition.ts`
- `frontend/src/hooks/useConversationHistory.ts`
- `frontend/src/hooks/useCreateAttachments.ts`
- `frontend/src/hooks/useCreateModeState.ts`
- `frontend/src/hooks/useCreateSession.ts`
- `frontend/src/hooks/useCreateWorkspace.ts`
- `frontend/src/hooks/useDebouncedCallback.ts`
- `frontend/src/hooks/useDevServer.ts`
- `frontend/src/hooks/useDevserverPreview.ts`
- `frontend/src/hooks/useDevserverUrl.ts`
- `frontend/src/hooks/useDiffStream.ts`
- `frontend/src/hooks/useDiffSummary.ts`
- `frontend/src/hooks/useEditorAvailability.ts`
- `frontend/src/hooks/useErrorNotification.ts`
- `frontend/src/hooks/useExecutionProcesses.ts`
- `frontend/src/hooks/useExecutorSelection.ts`
- `frontend/src/hooks/useFollowUpSend.ts`
- `frontend/src/hooks/useForcePush.ts`
- `frontend/src/hooks/useGitHubComments.ts`
- `frontend/src/hooks/useGitOperations.ts`
- `frontend/src/hooks/useHasDevServerScript.ts`
- `frontend/src/hooks/useImageMetadata.ts`

### G30（Round 5 / Slot 6）
- `frontend/src/hooks/useImageUpload.ts`
- `frontend/src/hooks/useJsonPatchWsStream.ts`
- `frontend/src/hooks/useLogStream.ts`
- `frontend/src/hooks/useMediaQuery.ts`
- `frontend/src/hooks/useMerge.ts`
- `frontend/src/hooks/useMessageEditRetry.ts`
- `frontend/src/hooks/useNavigateWithSearch.ts`
- `frontend/src/hooks/useOpenInEditor.ts`
- `frontend/src/hooks/useOpenProjectInEditor.ts`
- `frontend/src/hooks/useOrganizationInvitations.ts`
- `frontend/src/hooks/useOrganizationMembers.ts`
- `frontend/src/hooks/useOrganizationMutations.ts`
- `frontend/src/hooks/useOrganizationProjects.ts`
- `frontend/src/hooks/useOrganizationSelection.ts`
- `frontend/src/hooks/usePrComments.ts`
- `frontend/src/hooks/usePreviewSettings.ts`
- `frontend/src/hooks/usePreviousPath.ts`
- `frontend/src/hooks/useProfiles.ts`
- `frontend/src/hooks/useProjectMutations.ts`
- `frontend/src/hooks/useProjectRemoteMembers.ts`
- `frontend/src/hooks/useProjectRepos.ts`
- `frontend/src/hooks/useProjects.ts`
- `frontend/src/hooks/useProjectTasks.ts`
- `frontend/src/hooks/usePush.ts`
- `frontend/src/hooks/useQueueStatus.ts`
- `frontend/src/hooks/useRebase.ts`
- `frontend/src/hooks/useRenameBranch.ts`
- `frontend/src/hooks/useRepoBranches.ts`

### G31（Round 6 / Slot 1）
- `frontend/src/hooks/useRepoBranchSelection.ts`
- `frontend/src/hooks/useRetryProcess.ts`
- `frontend/src/hooks/useScratch.ts`
- `frontend/src/hooks/useScriptPlaceholders.ts`
- `frontend/src/hooks/useSessionAttachments.ts`
- `frontend/src/hooks/useSessionMessageEditor.ts`
- `frontend/src/hooks/useSessionQueueInteraction.ts`
- `frontend/src/hooks/useSessionSend.ts`
- `frontend/src/hooks/useSlashCommands.ts`
- `frontend/src/hooks/useTask.ts`
- `frontend/src/hooks/useTaskAttempt.ts`
- `frontend/src/hooks/useTaskAttempts.ts`
- `frontend/src/hooks/useTaskImages.ts`
- `frontend/src/hooks/useTaskMutations.test.tsx`
- `frontend/src/hooks/useTaskMutations.ts`
- `frontend/src/hooks/useTaskRelationships.ts`
- `frontend/src/hooks/useTodos.ts`
- `frontend/src/hooks/useUserOrganizations.ts`
- `frontend/src/hooks/useVariant.ts`
- `frontend/src/hooks/useVideoProgress.ts`
- `frontend/src/hooks/useWorkflows.test.tsx`
- `frontend/src/hooks/useWorkflows.ts`
- `frontend/src/hooks/useWorkspaceCount.ts`
- `frontend/src/hooks/useWorkspaceMutations.ts`
- `frontend/src/hooks/useWorkspaceSessions.ts`
- `frontend/src/i18n/__tests__/config.test.ts`
- `frontend/src/i18n/__tests__/workflow.test.ts`
- `frontend/src/i18n/config.ts`

### G32（Round 6 / Slot 2）
- `frontend/src/i18n/index.ts`
- `frontend/src/i18n/languages.ts`
- `frontend/src/keyboard/hooks.ts`
- `frontend/src/keyboard/index.ts`
- `frontend/src/keyboard/registry.ts`
- `frontend/src/keyboard/types.ts`
- `frontend/src/keyboard/useSemanticKey.ts`
- `frontend/src/lib/__tests__/api-logging.test.ts`
- `frontend/src/lib/__tests__/api-result.test.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/conflicts.ts`
- `frontend/src/lib/devServerUtils.ts`
- `frontend/src/lib/electric/config.ts`
- `frontend/src/lib/electric/sharedTasksCollection.ts`
- `frontend/src/lib/mcpStrategies.ts`
- `frontend/src/lib/modals.ts`
- `frontend/src/lib/openTaskForm.ts`
- `frontend/src/lib/paths.test.ts`
- `frontend/src/lib/paths.ts`
- `frontend/src/lib/remoteApi.ts`
- `frontend/src/lib/searchTagsAndFiles.ts`
- `frontend/src/lib/types.ts`
- `frontend/src/lib/utils.ts`
- `frontend/src/main.tsx`
- `frontend/src/pages/__tests__/WorkflowDebugPage.test.tsx`
- `frontend/src/pages/Board.test.tsx`
- `frontend/src/pages/Board.tsx`
- `frontend/src/pages/FullAttemptLogs.tsx`

### G33（Round 6 / Slot 3）
- `frontend/src/pages/Pipeline.test.tsx`
- `frontend/src/pages/Pipeline.tsx`
- `frontend/src/pages/settings/AgentSettings.tsx`
- `frontend/src/pages/settings/GeneralSettings.tsx`
- `frontend/src/pages/settings/index.ts`
- `frontend/src/pages/settings/McpSettings.test.ts`
- `frontend/src/pages/settings/McpSettings.tsx`
- `frontend/src/pages/settings/organizationRemoteCapability.test.ts`
- `frontend/src/pages/settings/organizationRemoteCapability.ts`
- `frontend/src/pages/settings/OrganizationSettings.tsx`
- `frontend/src/pages/settings/ProjectSettings.tsx`
- `frontend/src/pages/settings/ReposSettings.tsx`
- `frontend/src/pages/settings/SettingsLayout.tsx`
- `frontend/src/pages/SlashCommands.e2e.test.tsx`
- `frontend/src/pages/SlashCommands.test.tsx`
- `frontend/src/pages/SlashCommands.tsx`
- `frontend/src/pages/ui-new/Workspaces.tsx`
- `frontend/src/pages/ui-new/WorkspacesLanding.tsx`
- `frontend/src/pages/WorkflowDebug.test.tsx`
- `frontend/src/pages/WorkflowDebug.tsx`
- `frontend/src/pages/WorkflowDebugPage.test.tsx`
- `frontend/src/pages/WorkflowDebugPage.tsx`
- `frontend/src/pages/Workflows.test.tsx`
- `frontend/src/pages/Workflows.tsx`
- `frontend/src/stores/__tests__/wsStore.test.ts`
- `frontend/src/stores/index.ts`
- `frontend/src/stores/modelStore.ts`
- `frontend/src/stores/terminalStore.ts`

### G34（Round 6 / Slot 4）
- `frontend/src/stores/useDiffViewStore.ts`
- `frontend/src/stores/useExpandableStore.ts`
- `frontend/src/stores/useTaskDetailsUiStore.ts`
- `frontend/src/stores/useUiPreferencesStore.ts`
- `frontend/src/stores/wizardStore.ts`
- `frontend/src/stores/workflowStore.ts`
- `frontend/src/stores/wsStore.ts`
- `frontend/src/styles/diff-style-overrides.css`
- `frontend/src/styles/edit-diff-overrides.css`
- `frontend/src/styles/legacy/index.css`
- `frontend/src/styles/new/index.css`
- `frontend/src/test/browserslist-env.test.ts`
- `frontend/src/test/canvas-mock.test.ts`
- `frontend/src/test/legacy-components.test.ts`
- `frontend/src/test/legacy-routes.test.ts`
- `frontend/src/test/no-vibe-companion.test.ts`
- `frontend/src/test/renderWithI18n.tsx`
- `frontend/src/test/setup.ts`
- `frontend/src/test/tailwind-config.test.ts`
- `frontend/src/test/test-global.d.ts`
- `frontend/src/types/__tests__/websocket.test.ts`
- `frontend/src/types/attempt.ts`
- `frontend/src/types/logs.ts`
- `frontend/src/types/modal-args.d.ts`
- `frontend/src/types/modals.ts`
- `frontend/src/types/showcase.ts`
- `frontend/src/types/tabs.ts`
- `frontend/src/types/virtual-executor-schemas.d.ts`

### G35（Round 6 / Slot 5）
- `frontend/src/types/websocket.ts`
- `frontend/src/utils/companionInstallTask.ts`
- `frontend/src/utils/date.ts`
- `frontend/src/utils/executor.ts`
- `frontend/src/utils/extToLanguage.ts`
- `frontend/src/utils/fileTreeUtils.ts`
- `frontend/src/utils/fileTypeIcon.ts`
- `frontend/src/utils/id.ts`
- `frontend/src/utils/previewBridge.ts`
- `frontend/src/utils/scriptPlaceholders.ts`
- `frontend/src/utils/statusLabels.ts`
- `frontend/src/utils/streamJsonPatchEntries.ts`
- `frontend/src/utils/string.ts`
- `frontend/src/utils/StyleOverride.tsx`
- `frontend/src/utils/theme.ts`
- `frontend/src/utils/TruncatePath.tsx`
- `frontend/src/vite-env.d.ts`
- `frontend/src/vitest-globals.d.ts`
- `frontend/src/vscode/bridge.ts`
- `frontend/src/vscode/ContextMenu.tsx`
- `frontend/tailwind.config.cjs`
- `frontend/tailwind.legacy.config.js`
- `frontend/tailwind.new.config.js`
- `frontend/vite.config.ts`
- `frontend/vitest.config.ts`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `rustfmt.toml`

### G36（Round 6 / Slot 6）
- `rust-toolchain.toml`
- `scripts/audit-security.sh`
- `scripts/check-i18n.sh`
- `scripts/docker/e2e-smoke.sh`
- `scripts/docker/entrypoint.sh`
- `scripts/docker/install/install-ai-clis.sh`
- `scripts/docker/install/lib/common.sh`
- `scripts/docker/install/verify-all-clis.sh`
- `scripts/migrate_auto_confirm.sh`
- `scripts/migrate_auto_confirm.sql`
- `scripts/prepare-db.js`
- `scripts/run-dev.js`
- `scripts/run-frontend-dev.js`
- `scripts/setup-dev-environment.js`
- `scripts/verify-baseline.sh`
- `shared/types.ts`
- `tests/e2e/workflow_create_integration_test.rs`
- `tests/e2e/workflow_create_test.rs`
- `tests/e2e/workflow_recovery_test.rs`
- `tests/e2e/workflow_test.rs`
- `tests/unit/slug_test.rs`

## 4. 轮次执行记录

### Round 1（G01-G06）
- 状态：✅ 已完成
- 审计人：6 个并发 Agent
- 覆盖：168/168 文件（G01-G06 全覆盖）
- 输出：共识别 7 个冲突型问题（P1×7）
- 结论：
1. G01、G05 未发现实质冲突型 bug。
2. G02/G03 暴露多处 migration 时序与数据一致性风险。
3. G04 暴露 `GitEvent` 重名导致模型契约冲突。
4. G06 暴露 Windows 平台兼容与路径解析冲突。

### Round 2（G07-G12）
- 状态：⏸ 待执行

### Round 3（G13-G18）
- 状态：⏸ 待执行

### Round 4（G19-G24）
- 状态：⏸ 待执行

### Round 5（G25-G30）
- 状态：⏸ 待执行

### Round 6（G31-G36）
- 状态：⏸ 待执行

## 5. 问题总账（持续追加）

| ID | Round | Group | Severity | 问题摘要 | 影响范围 | 证据(file:line) | 修复建议 | 状态 |
|---|---:|---|---|---|---|---|---|---|
| AUD-R1-001 | 1 | G02 | P1 | execution_processes 全量删除触发日志级联删除 | 历史执行日志丢失，Timeline 不完整 | `crates/db/migrations/20250729162941_create_execution_process_logs.sql`, `crates/db/migrations/20250730000000_add_executor_action_to_execution_processes.sql` | 调整迁移顺序：先清理/迁移数据再建日志表，或先备份 execution_process_logs 再删父表 | ✅ 已修复 |
| AUD-R1-002 | 1 | G03 | P1 | merges.repo_id 迁移将 NULL 写入 NOT NULL 新列可能中断升级 | 旧数据升级失败，数据库迁移阻断 | `crates/db/migrations/20251209000000_add_project_repositories.sql:111` | 更新前过滤 NULL 或回填默认 repo，保证 `repo_id_new` 写入非空 | ✅ 已修复 |
| AUD-R1-003 | 1 | G03 | P1 | API Key 加密迁移只加字段未完成回填链路 | 明文 key 持续存在，安全与契约不一致 | `crates/db/migrations/20260119000000_encrypt_api_keys.sql:1` | 增加显式 backfill + 切换读写列 + 最终清理明文字段 | ✅ 已修复 |
| AUD-R1-004 | 1 | G03 | P1 | 移除 `shared_tasks` 表但前端仍访问对应 Electric collection | 项目页/任务面板运行时查询失败 | `crates/db/migrations/20251202000000_migrate_to_electric.sql:23`, `frontend/src/lib/electric/sharedTasksCollection.ts:9`, `frontend/src/hooks/useProjectTasks.ts:68` | 要么保留兼容表，要么同步移除 collection/hook 入口并加特性开关 | ✅ 已修复 |
| AUD-R1-005 | 1 | G04 | P1 | `GitEvent` 在两个模型文件中重复定义并同时 re-export | 编译/类型解析冲突，服务层 helper 可见性异常 | `crates/db/src/models/git_event.rs:15`, `crates/db/src/models/terminal.rs:176`, `crates/db/src/models/mod.rs:19` | 删除或重命名 `terminal.rs` 中重复类型，保留单一权威 `GitEvent` | ✅ 已修复 |
| AUD-R1-006 | 1 | G06 | P1 | QA mock 依赖 `sh/sleep/rm` 导致 Windows 无法跑日志回放 | QA 模式跨平台失效，验证链路中断 | `crates/executors/src/executors/qa_mock.rs:56`, `crates/executors/src/executors/qa_mock.rs:64` | 用 Rust 原生异步回放或提供 PowerShell 等跨平台实现 | ✅ 已修复 |
| AUD-R1-007 | 1 | G06 | P1 | patch 路径解析按 `split(':')` 截断 Windows 盘符路径 | 工具调用记录路径错误，日志与真实修改不一致 | `crates/executors/src/executors/droid/normalize_logs.rs:706` | 改为 `splitn(2, ':')` 或 `strip_prefix`，保留完整路径 | ✅ 已修复 |
| AUD2-R1-001 | 1 | G01 | P1 | `atomic_write` 临时文件名仅使用 PID，进程内并发写会互相截断 | CLI 配置写入竞态，可能覆盖模型/凭据配置 | `crates/cc-switch/src/atomic_write.rs:34` | 临时文件名加入唯一随机后缀并使用 `create_new` 防碰撞 | ✅ 已修复 |
| AUD2-R1-002 | 1 | G01 | P2 | `update_claude_model` 只写 `auth_token` 未写 `api_key` | 新 API key 不生效，配置与调用语义不一致 | `crates/cc-switch/src/claude.rs:106` | 同步写入 `env.api_key`，并区分 token/key 语义 | ✅ 已修复 |
| AUD2-R1-003 | 1 | G02 | P2 | 迁移删除 execution_processes 造成 logs/sessions 级联清空 | 历史执行会话和日志数据被不可逆删除 | `crates/db/migrations/20250730000000_add_executor_action_to_execution_processes.sql:3`, `crates/db/migrations/20250729162941_create_execution_process_logs.sql:3` | 改为逐行迁移或归档，不做全表 DELETE | ✅ 已修复 |
| AUD2-R1-004 | 1 | G03 | P1 | 草稿合并迁移遗漏 `retry_drafts` | retry 草稿数据孤儿化，重试流程断裂 | `crates/db/migrations/20250921222241_unify_drafts_tables.sql:34` | 增加 `retry_drafts -> drafts` 回填与清理 | ✅ 已修复 |
| AUD2-R1-005 | 1 | G03 | P2 | repo 级脚本迁移用 `LIMIT 1` 覆盖多项目差异配置 | 多项目共享 repo 时脚本配置被静默覆盖 | `crates/db/migrations/20260107000000_move_scripts_to_repos.sql:9` | 保留项目维度或检测冲突并中止迁移 | ✅ 已修复 |
| AUD2-R2-001 | 2 | G09 | P2 | 测试中 `Arc::ptr_eq` 使用但缺少 `Arc` 导入 | `server` 测试编译中断，回归覆盖受阻 | `crates/server/tests/deployment_process_manager_test.rs:43` | 增加 `use std::sync::Arc;` 或改全限定名调用 | ✅ 已修复 |
| AUD2-R2-002 | 2 | G11 | P2 | file_search watcher 未持久保存导致 debouncer 立即释放 | HEAD 变更无法触发缓存刷新，搜索结果滞后 | `crates/services/src/services/file_search.rs:606` | 将 `new_debouncer` 放入 `self.watchers` 并维护生命周期 | ✅ 已修复 |
| AUD2-R2-003 | 2 | G10 | P3 | 多个 terminal 相关 API 测试仅占位断言，未真正验证接口 | `terminal logs/stop/ws` 回归缺口，易漏回归 | `crates/server/tests/terminal_logs_api_test.rs:5`, `crates/server/tests/terminal_stop_test.rs:9`, `crates/server/tests/terminal_ws_test.rs:1` | 补齐真实 API/WS 集成断言，替换占位 `assert!(true)` | ✅ 已修复 |
| AUD2-R3-001 | 3 | G14 | P2 | dev compose 明文硬编码固定加密密钥 | 任意获取仓库者可复用密钥，破坏加密隔离 | `docker/compose/docker-compose.dev.yml:16` | 改为外部环境变量注入或本地生成，不入仓库 | ✅ 已修复 |
| AUD2-R3-002 | 3 | G14 | P2 | Docker 构建阶段直接 `curl | bash` 执行远程脚本 | 供应链攻击面扩大，构建可信性不足 | `docker/Dockerfile:41` | 使用校验和验证/签名包安装，避免直接管道执行 | ✅ 已修复 |
| AUD2-R4-001 | 4 | G19 | P2 | follow-up 输入与排队消息状态竞争，导致编辑内容被回写覆盖 | 用户输入体验受损，可能误提交旧消息 | `frontend/src/components/tasks/TaskFollowUpSection.tsx:360` | 编辑时乐观清空 queue 状态，pending 期间优先使用本地草稿 | ✅ 已修复 |
| AUD2-R4-002 | 4 | G21 | P3 | inline code 点击监听器重复挂载且未移除 | 事件重复触发和前端内存泄漏风险 | `frontend/src/components/ui/wysiwyg/plugins/clickable-code-plugin.tsx:57` | 为监听器建立可移除句柄并在重挂载/清理时解除绑定 | ✅ 已修复 |
| AUD2-R4-003 | 4 | G24 | P1 | `window.open` 未使用 `noopener/noreferrer` | 反向 Tabnabbing，可被恶意链接劫持 opener | `frontend/src/components/ui-new/primitives/RepoCard.tsx:219` | `window.open(url,'_blank','noopener,noreferrer')` 并置空 opener | ✅ 已修复 |
| AUD2-R5-001 | 5 | G28 | P2 | `useAuthStatus` 在 `enabled=false` 时仍强制 `refetch` | 认证状态查询绕过开关，产生多余请求和状态抖动 | `frontend/src/hooks/auth/useAuthStatus.ts:20` | 在 effect 中增加 `options.enabled` 判断，禁用时不触发 refetch | ✅ 已修复 |
| AUD2-R5-002 | 5 | G30 | P2 | merge/push/rebase 在无 `attemptId` 时仍走 `onSuccess` 流程 | UI 误判操作成功并触发无意义缓存失效 | `frontend/src/hooks/useMerge.ts:17`, `frontend/src/hooks/usePush.ts:28`, `frontend/src/hooks/useRebase.ts:24` | 无 `attemptId` 时直接 reject/return error，禁止触发 success 回调 | ✅ 已修复 |
| AUD2-R5-003 | 5 | G30 | P3 | `useLogStream` 日志数组无限增长 | 长会话下内存与重渲染压力持续升高 | `frontend/src/hooks/useLogStream.ts:58` | 引入日志窗口上限（如最近 N 条）并做增量渲染 | ✅ 已修复 |
| AUD2-R5-004 | 5 | G28 | P3 | `useAgentAvailability` effect 未依赖 `notifyError` | 回调变更时可能使用陈旧闭包，错误提示不一致 | `frontend/src/hooks/useAgentAvailability.ts:52` | 将 `notifyError` 纳入依赖或以 `useRef` 固定引用 | ✅ 已修复 |
| AUD2-R5-005 | 5 | G30 | P3 | `usePreviousPath` 使用模块级全局历史池 | 同浏览器多用户/多会话可能共享回退轨迹 | `frontend/src/hooks/usePreviousPath.ts:4` | 在登录态/组织切换时清理历史，或改为会话级存储 | ✅ 已修复 |
| AUD2-R6-001 | 6 | G31 | P1 | `useWorkspaceSessions` 在 `sessions` 变化时无条件重置选中会话 | 用户手动选择会被轮询/刷新覆盖，新建会话模式被清空 | `frontend/src/hooks/useWorkspaceSessions.ts:48` | 仅在“无有效当前选择”或“当前选择已失效”时自动回退到首项 | ✅ 已修复 |
| AUD2-R6-002 | 6 | G31 | P2 | `useTodos` 对缺失时间戳条目使用 `new Date()` 导致新旧顺序漂移 | 旧 TODO 可能被误判为最新并覆盖真实最新任务 | `frontend/src/hooks/useTodos.ts:21` | 缺失时间戳时跳过比较或沿用稳定基准时间，禁止注入“当前时刻” | ✅ 已修复 |
| AUD2-R6-003 | 6 | G32 | P2 | `useSemanticKey` 未执行函数型 `enabled/when` 谓词 | 快捷键无法按运行时条件正确启停，导致误触发 | `frontend/src/keyboard/useSemanticKey.ts:49` | 先解析函数谓词为布尔值，再统一用于触发守卫与依赖管理 | ✅ 已修复 |
| AUD2-R6-004 | 6 | G32 | P3 | `formatBytes` 将 `0n` 视为 falsy 并返回空字符串 | 0 字节文件大小展示为空，前端信息不一致 | `frontend/src/lib/utils.ts:12` | 仅对 `null/undefined` 早返回，0 值应展示 `0 B` | ✅ 已修复 |
| AUD2-R6-005 | 6 | G34 | P1 | `defaultUiState` 共享 `Set`（模块级单例）造成跨任务状态污染 | 一个任务的删除态会泄漏到其他任务 UI | `frontend/src/stores/useTaskDetailsUiStore.ts:22` | 改为默认状态工厂函数并确保每任务获得独立 `Set` 实例 | ✅ 已修复 |
| AUD2-R6-006 | 6 | G35 | P2 | `StyleOverride` 在 `VITE_PARENT_ORIGIN` 未配置时放行任意来源消息 | 被嵌入场景下可被非受信父页面注入样式覆盖 | `frontend/src/utils/StyleOverride.tsx:32` | 改为 fail-closed：未配置允许来源时直接拒绝消息 | ✅ 已修复 |
| AUD2-R6-007 | 6 | G35 | P2 | `StyleOverride` 未限制变量名前缀，受信来源可覆盖任意 CSS 变量 | 关键视觉变量可被篡改，存在 UI 误导/钓鱼风险 | `frontend/src/utils/StyleOverride.tsx:48` | 仅允许 `--vibe-*` 白名单变量并校验 value 内容 | ✅ 已修复 |
| AUD2-R6-008 | 6 | G36 | P2 | Docker CLI 安装脚本以 root 直接全局安装 npm 包且不锁定版本 | 供应链污染时影响容器高权限执行面 | `scripts/docker/install/lib/common.sh:35` | 锁版本与完整性校验，避免无审计的 latest 全局安装路径 | ✅ 已修复 |
| AUD2-R6-009 | 6 | G36 | P3 | Windows 端口清理使用 `taskkill /f /t` 强杀占用 PID | 可能误杀无关系统/开发进程并导致数据丢失 | `scripts/run-dev.js:321` | 仅回收本工具创建的 PID，其他进程改为提示并中止 | ✅ 已修复 |

## 6. 备注

- 若单文件内容过大，按轮次分批追加，保持“问题总账”连续。
- 所有新增问题必须带可定位路径与行号。

## 7. 第二遍全量审计（资深代码审计工程师）

> **审计要求:** 全量复扫，重点发现跨模块冲突、状态机不一致、业务逻辑冲突、平台兼容冲突。  
> **执行方式:** 6 个并发 Agent × 6 轮（G01-G36）。  
> **分组清单:** `tmp/audit-pass2-manifest.json`（1001 文件，36 组）。  
> **当前状态:** ✅ Pass2 全部完成（Round 1-6）

### Pass2-Round 1（G01-G06）
- 状态：✅ 已完成
- 覆盖：168/168（100%）
- 结果：新增问题 5 条（P1×2，P2×3），其余组未检出实质冲突

### Pass2-Round 2（G07-G12）
- 状态：✅ 已完成
- 覆盖：168/168（100%）
- 结果：新增问题 3 条（P2×2，P3×1）；另有 1 条误报已通过 `cargo check -p server --lib` 排除

### Pass2-Round 3（G13-G18）
- 状态：✅ 已完成
- 覆盖：168/168（100%）
- 结果：新增问题 2 条（P2×2），其余组未检出实质冲突

### Pass2-Round 4（G19-G24）
- 状态：✅ 已完成
- 覆盖：168/168（100%）
- 结果：新增问题 3 条（P1×1，P2×1，P3×1）

### Pass2-Round 5（G25-G30）
- 状态：✅ 已完成
- 覆盖：168/168（100%）
- 结果：新增问题 5 条（P2×2，P3×3）

### Pass2-Round 6（G31-G36）
- 状态：✅ 已完成
- 覆盖：161/161（100%）
- 结果：新增问题 9 条（P1×2，P2×5，P3×2）；其中 G33 本轮未检出实质冲突

### Pass2 总结
- 覆盖：1001/1001 文件（36 组全覆盖）
- 问题总数：27（P1×5，P2×15，P3×7）
- 分组分布：17 组检出问题，19 组未检出实质冲突

## 8. 修复执行进度（2026-02-24）

- 本轮修复策略：6 个并发 Agent 按领域拆分并行修复（前端 Hook、前端 UI/安全、脚本/容器、Rust 执行器、服务层/迁移）
- 已修复：34
- 待修复：0

### 当前待修复清单
- 无（本批次待修复项已清零）

---
description: 改动 fluxdown_api 后需注意 OpenAPI 规范与 wire 契约
condition: native/api/src/**
interruptMode: never
---

你正在修改 `native/api`（本机 HTTP API）。注意：

- handler 注解（`#[utoipa::path]`）与 `ToSchema` 派生需同步更新；`openapi.rs` 有漂移守卫测试，路由常量与注解不同步会跑挂。
- 可运行 `cargo run -p fluxdown_api --example gen_openapi > openapi.json` 导出 OpenAPI 规范。
- wire 契约（`types.rs`）是 camelCase JSON，CLI 与扩展共用，字段改名是破坏性变更。
- 语义区分：脚本接管入口走外部下载确认流程；aria2/管理 API 直接建任务无弹框。

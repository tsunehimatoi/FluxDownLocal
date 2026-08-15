# FluxDown internals · 日志 · 发布与 CI · 设计文档实现状态

> 本文件是 `FluxDown/AGENTS.md` 的深挖附录：只放**枚举性 / 可从源码复原**的细节，硬不变式与红线在 AGENTS.md。
> 路径以 `FluxDown/` 为根（cwd=工作区根时前置 `FluxDown/`）。事实层以源码为准，文档给坐标。

---

## 日志系统

Dart 与 Rust 两端写**同一目录同一文件**，统一格式 `HH:MM:SS.mmm [Tag] message`。
- 目录：Windows exe 同级 `logs/`；Linux `~/.local/share/fluxdown/logs/`。文件名 `fluxdown_YYYY-MM-DD.log`，单卷 2MB 分卷，总量超 `log_max_size_mb`（默认 10MB）从最旧删，保留 7 天。
- Dart：`import '../services/log_service.dart'; logInfo(_tag, msg); logError(...)`。
- Rust：`use crate::logger::log_info; log_info!("[mod] ...")`（Rust 2024 无 `#[macro_use]`，每文件显式 use）。
- 导出：设置「关于」→ ZIP（纯 Dart 标准库，零依赖）。

---

## 发布与 CI（`.github/workflows/release.yml`）

**组件变更检测**流水线，`v*` tag 触发。`changes` job diff `PREV..TAG` 映射路径→输出（`app`/`extension`/`mobile`/`cli`），首个 tag 全量构建。**分支守卫**：稳定 `vX.Y.Z` 必须是 `origin/stable` 祖先；预览 `vX.Y.Z-rc.N` 必须在 `origin/main`；否则整条失败。

路径→组件映射（要点）：`fluxDown/*`→extension；`native/cli/*`→cli；`native/api/*`→cli；`native/engine/*`→app+mobile+cli；`android|lib/src/mobile/*`→mobile；`lib/*`→app+mobile；`docs/*`/`*.md`→不构建。

构建矩阵：Windows（x64+arm64，Inno 安装器+便携 zip）、扩展（Chrome+Firefox，预发布 tag 不打包扩展）、Linux（AppImage/deb/arch/tar.gz）、macOS（x64+arm64，DMG+便携）、Android（split-per-abi + universal APK，cargokit 编各 ABI cdylib）、CLI 六平台。每个 release job 各用自己的组件 tag，跑 git-cliff（`--include-path <组件目录>`）后经 Claude Code CLI 翻译为中英双语（`<!-- fluxdown:lang:zh/en -->` 标记，失败回退原始 cliff）。

构建期 dart-define：`APP_VERSION`。

---

## 设计文档实现状态（`docs/`）

> ⚠️ `docs/` 在 `.gitignore` 里（零文件入库），下列设计文档**只存在于本机工作副本**；契约与不变式一律写回 `AGENTS.md` / 本目录，别只留在 `docs/`。

避免混淆——**已实现** vs **仅设计**：
- **已实现**：多文件任务组（`multi-file-task-group-design.md`）、插件系统 + 去中心化市场（`fluxdown-plugin-marketplace-plan.md` 等）。
- **已移除**：FluxDown 官方账号、云设备、配置同步、更新、遥测与云 CDN 配置链路；局域网 `link/` 直连保留。
- **已实现（客户端）**：RSS 订阅自动下载（`rss-subscription-design.md`，issue #97）——引擎 `native/engine/src/rss/`、REST `/api/v1/rss/*`、hub 信号、桌面 UI（侧边栏区块 + 条目流 + 三 Tab 对话框 + 两步向导）、CLI `fluxdown rss`、MCP `rss_list`/`rss_add`/`rss_remove`。
- **已实现（免费层）**：webhook 任务事件通知（`webhook-notification-design.md`）——引擎 `native/engine/src/webhook.rs`（6 事件 × 8 预设 + 占位符模板 + HMAC 签名 + 环形投递日志）、REST `/api/v1/webhooks/{deliveries,test,simulate}`、hub 信号、桌面「通知」设置分类。端点表就是 config 键 `webhook.endpoints`，桌面 / CLI `--local` 共享。**付费托管 Relay（设计 §6）未实现**，客户端无任何 relay 代码。
- **命名歧义警告**：引擎里的 `tracker_subscription.rs` / `ed2k/server_subscription.rs` 指 **BT tracker 列表 / ED2K server.met 订阅**，与 `rss/` 的 feed 订阅是两回事；`engine/src/webhook.rs` 是任务事件推送。

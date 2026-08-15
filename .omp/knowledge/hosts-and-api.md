# FluxDown internals · HTTP API · 宿主与客户端 crate

> 本文件是 `FluxDown/AGENTS.md` 的深挖附录：只放**枚举性 / 可从源码复原**的细节，硬不变式与红线在 AGENTS.md。
> 路径以 `FluxDown/` 为根（cwd=工作区根时前置 `FluxDown/`）。事实层以源码为准，文档给坐标。

---

## HTTP API（`native/api`，`fluxdown_api`）

一个端口（桌面默认 17800 **仅 127.0.0.1**）、一个 axum 服务器，多组按配置独立启停的路由。`local_server_*` 配置变更时 actor 热重启监听（优雅停机 + 重绑，20×100ms 重试竞态）。

| 路由组 | 端点 | 开关（config 键） | 鉴权 |
|---|---|---|---|
| 探活 | `GET /ping` | 总开关 | 无 |
| 脚本接管 | `POST /download`、`/download/batch` | `local_server_takeover_enabled`（默认开） | `X-FluxDown-Client` 头 + 可选 token |
| aria2 兼容 | `POST /jsonrpc`（36 方法）+ `GET /jsonrpc`（WS 升级，`jsonrpc_ws.rs`：RPC + `onDownloadXxx` 通知推送） | `local_server_jsonrpc_enabled`（默认开） | 可选 token（`X-FluxDown-Token` 或 `params[0]="token:xxx"`） |
| 管理 API | `/api/v1/*`（info、tasks CRUD+pause/continue[all]、queues、resolve/preview、groups CRUD+pause/continue、**rss** CRUD+refresh+items+items/action+validate；旧 plugins/market 路由若仍存在仅属待删除兼容面） | `local_server_api_enabled`（桌面默认**关**） | **强制** token（Bearer 或 `X-FluxDown-Token`） |
| MCP | `POST /mcp`（Streamable HTTP 无状态子集，协议 2025-06-18；12 工具：download_add/list/get/pause/resume/pause_all/resume_all/remove + queue_list + rss_list/rss_add/rss_remove） | `local_server_mcp_enabled`（桌面默认关） | 同管理 API token |
| OpenAPI | `GET /api/v1/openapi.json`（utoipa 3.1，含漂移守卫测试） | 随管理 API | 无 |

- **`ApiHost` trait**（`service.rs`）：必需方法（list/get/create/delete/pause/continue task、pause/continue all、list_queues、submit_external）+ 可默认降级方法（config/groups/resolve_preview/subscribe_task_events/…）。plugins/market 默认方法是待删除兼容债，不得新增调用方。`UNKNOWN_ENDPOINT_MESSAGE` 区分未注册路由 404 与资源 404。
- **鉴权**（`auth.rs`）：常量时间比较；接管需 `X-FluxDown-Client` 头（利用 CORS 预检挡跨源 fetch）；管理/MCP 强制非空 token（403）。桌面默认绑 127.0.0.1（`local_server_lan_enabled` 可改绑 0.0.0.0），默认不返 CORS 头。
- **CORS 豁免开关**（`local_server_cors_allow_all`，默认 false）：开启后 `cors_and_preflight` 中间件对预检与真实响应都发 `Access-Control-Allow-Origin: *`（+ `Allow-Private-Network: true`、`Allow-Headers` 回显），等价 aria2 `--rpc-allow-origin-all`。这是安全模型第 2 条的显式豁免——供「用浏览器 `fetch` 探测 aria2」的网站识别本机服务，代价是任意网页可探测/提交下载（仍受确认框 + 管理 token 保护）。
- **语义区分**：脚本接管 → 外部下载流程（弹确认框）；aria2 `addUri`/管理 `POST /tasks` → 直接建任务返真实 ID（自动化预期无弹框）。`takeover.rs` 的 batch 两形态合并为单 `DownloadRequest`（url 换行 join，匹配 Dart 单确认约定）。
- **aria2 纯映射**（`aria2.rs`）：GID↔task_id 编解码、`METHOD_NAMES`=36、`NOTIFICATION_NAMES`=6、业务错误统一 `code:1`。

---

## 宿主与客户端 crate

### `native/hub`（桌面/移动 App，唯一 rinf）
`lib.rs`（`write_interface!`、current_thread runtime）；`signals/mod.rs`（信号定义——Dart 绑定契约，不可手改）；`actors/download_actor.rs`（核心事件循环；`resolve_rx/plugin_retry_rx` 若仍存在是旧插件兼容接线，删除插件引擎前仍须 drain 防堵塞）；`api_host.rs`（`HubApiHost`：读直查 Db，写经 command+oneshot 进 actor）；`rinf_sink.rs`（`EventSink`→Dart 信号）；`rinf_selection.rs`（`HostSelection`：HLS 60s 超时默认最高码率）；`signal_bridge.rs`（`From` 转换）；`native_messaging.rs`（Windows Named Pipe `\\.\pipe\fluxdown` / Unix socket；另有 `listener_endpoint()`/`probe_listener()` 供 Doctor 自连自 ping）；`nmh_registry.rs`（写 NMH 清单；另有只读 `diagnose()`）；`file_association.rs`（.torrent 关联）；`protocol_registry.rs`（`fluxdown://`）；`diagnostics.rs`（设置页 Doctor 探针聚合——NMH 二进制/清单/各浏览器注册、pipe ping、本地 HTTP `/ping`、协议与 `.torrent` 关联、日志目录可写；由 `download_actor` 里一条独立后台泵消费 `RunDiagnostics`/`RepairNmhRegistration`，**不碰 Engine、不进主 `select!`、不进 `aux_tx`**）；`reveal_file.rs`；`compat_flags.rs`（Windows 清除 PCA 误设的 RUNASADMIN AppCompatFlags，修 CreateProcess 740）；`logger.rs`（转发 engine 的 shim）。

> ⚠️ **`download_actor.rs` 的主 `tokio::select!` 已占满 tokio 的 64 分支硬上限**（`tokio/src/macros/select.rs` 的 `count_field!` 最后一格是 `_63`），再加一条就是编译错误 `up to 64 branches supported`。
> **新增任何 Dart 信号 / 定时节拍 / 回流通道都不许往主循环加分支**，一律并进既有的「辅助信号合并转发」：两个后台 `tokio::spawn` 泵（任务组 5 信号 / RSS 8 信号 + 60s 节拍 + 引擎回流）把消息合流进同一条 `aux_tx`，主循环只有一条 `Some(aux) = aux_rx.recv()`。照 `enum AuxSignal { Group(..), Rss(..) }` 加变体即可。

### `native/cli`（`fluxdown_cli`，二进制 `fluxdown`）
aria2c 风格。命令：ping/info/add(get)/list(ls)/status(stat)/pause/resume/rm/pause-all/resume-all/queue/watch/**config**(set/unset/get/list/path)。
- **A 模式**（默认）：typed HTTP client（复用 api `routes`+`types`），连运行中的 App。
- **B 模式**（`add --local`）：本进程内嵌 `fluxdown_engine::Engine`（`NoopSink`/`NoopSelection`）独立下载至终态，共享同一 SQLite（安装模式）。Ctrl-C → 暂停 + 退出码 7。
- env：`FLUXDOWN_URL`（默认 `http://127.0.0.1:17800`）/`FLUXDOWN_TOKEN`；`--json`；`K/M/G/T` 按 1024 解析；`.no_proxy()` 直连回环。退出码：0/1/2/3/5/7/24/32（aria2 风格，`exit.rs`）。

### `native/nmh`
浏览器 Native Messaging Host **中继二进制**（`com.fluxdown.nmh`）。浏览器 ↔（stdin/stdout 4 字节 LE 长度 + JSON）↔ nmh ↔（Named Pipe / UDS）↔ App。同步单线程；懒连 + 重连；除 `NO_LAUNCH_ACTIONS`(ping/tasks/task_op/open/reveal) 外未连接时自动拉起 App（50ms 轮询至 10s）；`warmup` 本地应答重叠冷启动；1MB 帧上限。

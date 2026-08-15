# FluxDown internals · Flutter 前端 · 浏览器扩展 · 用户脚本

> 本文件是 `FluxDown/AGENTS.md` 的深挖附录：只放**枚举性 / 可从源码复原**的细节，硬不变式与红线在 AGENTS.md。
> 路径以 `FluxDown/` 为根（cwd=工作区根时前置 `FluxDown/`）。事实层以源码为准，文档给坐标。

---

## Flutter 前端架构（`lib/src`）

**状态管理**：ChangeNotifier + ListenableBuilder（无 Provider/Riverpod/Bloc），`_safeNotifyListeners()` 防已释放。Provider 统一模式：订阅 rinf 信号 + 单向 `sendSignalToRust` 写（`SettingsProvider`/`ComponentController`/`download_controller`/…）。旧 `PluginProvider` 属应用内 `.fxplug` 插件系统残留，不是精简版产品能力。

**两套配置平面**：引擎 config（`SettingsProvider`，经 rinf → `db.rs config` 表）vs Dart-only 客户端偏好（主题等，存 `KvStore`）。

### 存储：`services/kv_store.dart`
SharedPreferences 门面，**便携模式**（`portable` 标记）写 `<exe>/portable_data/settings.json`（400ms 防抖），安装模式透传。init() 全量入内存缓存，`runApp` 前必须 await。是主题等客户端偏好的存储层。

### 主题：双层 token 系统（schema v2）
- `flux_theme_tokens.dart`：Layer0 **颜色** token（~30 字段 + 嵌套 metric），5 内置预设工厂（defaultDark/Light、midnightBlue、nord、warmLight），JSON per-field 回退，`FluxThemeScope` InheritedWidget 下发。
- `flux_metric_tokens.dart`：Layer1 **非颜色**度量 token（~60 字段：15 圆角/2 描边/5 间距/3 按钮高/~22 alpha/8 移动几何），private raw + clamped getter。
- `app_colors.dart`/`app_metrics.dart`：读门面（`.of(context)`）；`AppMetrics.soft/muted/scrim(color)` 由 base+alpha 派生半透明色，消灭魔法数。
- `theme_provider.dart`：5 内置 × 5 accent（blue/green/violet/rose/custom）+ 导入自定义主题（`imported_themes_v2`）+ uiScale；`activeTokens` 优先级 导入主题 > 内置+accent。
- `segment_palette.dart`：黄金角生成最多 256 个对比安全的 per-thread 颜色。

### 快速下载小窗：`popup/`（第二 Flutter 引擎）
原生宿主以 `--quick-popup` 拉起 `runQuickPopupApp()`，**零插件注册 + 不初始化 Rust**，经 MethodChannel `fluxdown/popup_child` 与主引擎通信（主引擎侧 `services/popup_window_service.dart`）。payload（主题 tokens/语言/队列/目录/URL）JSON 注入；复用 `quick_download_form`/`manifest_select_view` 与同一 token→ShadTheme 管线。清单预解析命中时原窗切 ManifestSelectView。

### 其它服务/模型（新）
`platform_utils.dart`（便携检测 + 数据目录迁移，与 `data_dir.rs` 同步）、`resolve_variant_service.dart`（rinf 信号驱动全局弹窗）；`models/`：`components_provider`（Ffmpeg/Ytdlp 控制器）、`ua_presets`（UA 单一事实源）、`custom_category`、`manifest_breadcrumb`。若仍存在 `plugin_provider`，仅视为待删除的旧插件兼容代码。

### 桌面 widgets 架构（不逐文件，按族看）
- **视图系统**：`task_list` + `task_list_item`（行）、`task_columns`（列注册表，表头/行单一事实源）、`view_options_panel`（UI，backed by `models/view_prefs`）、`task_tab_bar`、`status_bar`、`sidebar`、`header_bar`。列表/网格双形态 + 舒适/紧凑双密度 + 多维分组吸顶 + 动态列。
- **manifest 对话框族**：`manifest_select_dialog`/`manifest_select_view`（与 popup 共享）/`manifest_dialog_chrome`/`manifest_browse_list`/`manifest_advanced_panel`（backed by `models/manifest_selection`+`manifest_breadcrumb`）。
- **组件**：`task_group_card`/`group_detail_panel`（backed by `models/task_group`）。
- **详情**：`detail_panel`/`bt_file_list_widget`。
- **对话框族**：`new_download_dialog`、`quick_download_dialog`+`quick_download_form`（与 popup 共享）、`queue_manager_dialog`、`resolve_variant_dialog`、`hls_quality_dialog`、`bt_file_selection_dialog`、`category_edit_dialog`。旧插件对话框不应再由产品入口引用。
- **原语**：`flux_sonner`（toast）、`context_menu`、`split_action_button`、`number_selector`、`ui_scale_widget`、`dir_picker_field`。

### 移动端 `mobile/`（Android 已发布）
`mobile_app`（`Platform.isAndroid||isIOS` 路由入口）、`mobile_shell`（任务/设置双屏 + 悬浮 Dock）、`mobile_ui`、`screens/`、`pages/`、`sheets/`、`services/`（share_intent、mobile_storage）。无窗口/托盘/autostart/NMH；保留 HLS/BT/variant 全局弹窗。复用 models/i18n/theme/bindings。

### 设置项（单一事实源 = `models/settings_provider.dart` load switch + `db.rs config` 表）
分类：**下载**（default_save_dir/segments、auto_max_connections、domain_conn_caps、max_concurrent_tasks、speed_limit_bytes、max_auto_retries、auto_retry_delay_secs、auto_resume_on_start、remember/last_save_dir、default_queue_id、global_user_agent、cdn_multi_enabled、cdn_max_nodes［0=自动］、cdn_node_health/auto_route_health［引擎本地学习缓存，UI 不读写］）、**App/系统**（close_to_tray、start_minimized_to_tray、auto_startup、notify_on_complete、silent_download_enabled、silent_skip_selection、use_server_time、keep_awake_while_downloading、log_max_size_mb、reveal_file_cmd）、**剪贴板**、**侧栏/标题栏可见性**、**自定义分类**、**代理**、**BT**、**ED2K**。桌面悬浮球设置目前仍是待删除技术债，不得继续扩展。

---

## 浏览器扩展（`fluxDown/`）与用户脚本（`userscript/`）

### 扩展（WXT，Chrome + Firefox MV3）
- **通信**：全平台走 NMH。扩展 →（stdin/stdout）→ `fluxdown_nmh` →（Windows Named Pipe / Linux-mac UDS）→ App。消息 = 4 字节 LE 长度 + JSON。action：`ping`（只探不拉起）/`download`/`batch_download`（换行 join 单确认，按 700KB+1000 条分块防 1MB 帧上限，旧 App 回退逐条）/`warmup`（本地应答重叠冷启动）。
- **下载拦截**：复用成熟下载扩展的“事件发生即取消浏览器下载并转交 NMH”模型；浏览器冷启动时不得把历史/恢复队列重放给 FluxDown，也不得同时留下浏览器默认下载框。
- **精简边界**：不注入资源嗅探、DOM/fetch/XHR/MediaSource 监听、资源面板或网页悬浮球；保留常规下载拦截、右键下载、磁力链接、NMH 和下载中任务角标（含既有动画与配色）。
- Chrome ID 经 manifest key 钉住（匹配 NMH `allowed_origins`）；Alt+Shift+D 切换拦截；`Alt+Click` 15s 放行；声明零数据采集。

### 用户脚本（`userscript/fluxdown.user.js`，Tampermonkey）
页面态**扩展替代**（不能/不愿装扩展的用户）。`GM_xmlhttpRequest` POST 到本机 RPC `:17800/download`（带 `X-FluxDown-Client` 头 + 可选 token），拦截 DOM 下载 + hook fetch/XHR/MediaSource 嗅探。局限：无法拦截内核发起（Content-Disposition）下载、仅非 httpOnly cookie。

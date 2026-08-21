# FluxDown 精简版：受保护的本地专属修改清单（Protected Local Modifications Ledger）

> **本文档为受保护本地特性的唯一事实源（Single Source of Truth）。**
> 在定期同步上游官方提交（`upstream/*`）、解决代码冲突或进行大规模重构时，**AI 严禁丢弃、回退或覆盖本清单中的任何特性**。
> 若遇到无法调和的代码冲突，**必须立刻停手向用户请示，由用户决策！**

---

## 0. 为什么需要本清单？

上游官方仓库（`zerx-lab/FluxDown`）在演进过程中，部分 UI 文件（如 `header_bar.dart`、`settings_page.dart`、`download_controller.dart`）会发生全量重构或覆写。在通过 `git cherry-pick` 纳入上游改动时，极易因 cherry-pick 覆盖而导致精简版本地的独有体验（例如标题栏垃圾桶按钮、Doctor 诊断、扩展动画等）被静默冲掉。

为杜绝此类回归，本分支建立了：
1. **本清单（坐标与关键契约）**：**每当产生或变更任何上游无关的本地专属改动（带 `(local)` 标识的 commit）时，AI 必须同回合将改动点、代码坐标与契约登记至本文档！**
2. **自动化防回退检测与注入脚本（`scripts/inject_clear_completed.ps1` 等）**
3. **上游同步流程（SOP）中的必经检查卡点（Gate Checkpoint）**

---

## 1. 核心正向特性保护清单（Must NEVER Drop）

### 特性 1：主界面标题栏「清空已完成任务」垃圾桶按钮

- **特性说明**：参考 Motrix 的使用习惯，在标题栏右侧工具按钮区增加垃圾桶图标。点击后通过单次 IPC 批量清除所有已完成任务的列表记录，**保留本地已下载的落盘文件**。支持右键隐藏及在「设置 → 通用 → 标题栏按钮」中自由开关显隐。
- **涉及代码坐标与契约**：
  | 文件位置 | 关键代码 / 契约 | 作用 |
  |---|---|---|
  | `lib/src/models/download_controller.dart` | `void deleteCompletedTasks()` | 收集 `TaskStatus.completed` 任务并调用 `deleteCheckedTasks(deleteFiles: false)` |
  | `lib/src/widgets/header_bar.dart` | `_TitlebarToolButtons` 内的 `LucideIcons.trash2` 按钮 | 标题栏渲染垃圾桶按钮，绑定 `deleteCompletedTasks`，右键弹出快捷隐藏菜单 |
  | `lib/src/widgets/header_bar.dart` | `_TitlebarOverlayReservation` | 工具按钮数包含 `showTitlebarClearCompleted`，默认保底宽度为 5 按钮（`_toolButtonWidth * 5`） |
  | `lib/src/models/settings_provider.dart` | `bool _showTitlebarClearCompleted = true;`<br/>`bool get showTitlebarClearCompleted`<br/>`void setShowTitlebarClearCompleted(bool)`<br/>`case 'show_titlebar_clear_completed':` | 负责显隐状态的内存读写与 DB 持久化 |
  | `lib/src/pages/settings_page.dart` | `s.showTitlebarClearCompleted`<br/>`s.showTitlebarClearCompletedDesc` | 「设置 → 通用 → 标题栏按钮」分类下的开关行 |
  | `lib/src/i18n/translations.dart` | `clearCompletedTasks`<br/>`showTitlebarClearCompleted`<br/>`showTitlebarClearCompletedDesc` | 多语言 Getter 契约 |
  | `assets/i18n/{zh,en}.json` | `"clearCompletedTasks"` / `"showTitlebarClearCompleted"` / `"showTitlebarClearCompletedDesc"` | 中英文基础翻译 |
  | `scripts/inject_clear_completed.ps1` | 自动化注入脚本 | 检查并自动补全上述 7 处代码注入点 |
- **防回退验证与自愈命令**：
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/inject_clear_completed.ps1
  ```

---

### 特性 2：Doctor 环境诊断与一键修复系统

- **特性说明**：完全由本地 Rust 引擎与 Hub 驱动的环境体检与修复功能，排查 Native Messaging Host (NMH) 浏览器清单注册、端口监听、协议关联与日志自检，支持一键重注册修复与报告复制。
- **涉及代码坐标与契约**：
  | 文件位置 | 关键代码 / 契约 | 作用 |
  |---|---|---|
  | `lib/src/widgets/doctor_report_view.dart` | `DoctorReportView` 完整组件 | 诊断 UI 渲染、自检项目状态展示、修复操作回调、报告复制 |
  | `lib/src/pages/settings_page.dart` | `SettingsCategory.doctor`<br/>`_buildDoctorContent()` | 设置页独立的 Doctor 分类入口与卡片 |
  | `native/hub/src/diagnostics.rs` | `run_doctor()` / `repair_doctor()` | 诊断与一键修复实现（NMH 注册校验、端口探活、协议关联） |
  | `native/hub/src/signals/mod.rs` | `RunDoctorRequest`/`Response`<br/>`RepairDoctorRequest`/`Response` | Dart↔Rust FFI 诊断交互信号 |
  | `native/hub/src/nmh_registry.rs` | NMH 注册自检与写入 | 覆盖 Chrome / Edge / Firefox / Brave 等浏览器的 Native Messaging 注册 |

---

### 特性 3：浏览器扩展 Aria2-Explorer 风格动画与任务角标

- **特性说明**：浏览器扩展工具栏图标移植 Aria2 Explorer 的动态 Canvas 动画（下载旋转箭头、进度环、暂停脉冲、完成打勾），并且**角标数字严格绑定当前正在下载中的任务数量**（而非包含已完成的历史任务）。
- **涉及代码坐标与契约**：
  | 文件位置 | 关键代码 / 契约 | 作用 |
  |---|---|---|
  | `fluxDown/utils/icon-manager.ts` | `ToolbarIconManager`<br/>`formatDownloadingBadge(count)` | OffscreenCanvas 图标动画绘制与角标数字格式化（只显示 downloadingCount） |
  | `fluxDown/entrypoints/background.ts` | `toolbarIcon.setTaskState(...)`<br/>`toolbarIcon.playResult(...)` | 监听任务生命周期，派发动画与角标状态 |

---

### 特性 4：浏览器扩展下载拦截零弹窗机制（Zero Native Popups · Commit `ec7c2dc`）

- **特性说明**：Chrome/Edge 扩展中，`downloads.onDeterminingFilename` 事件在判定为被 FluxDown 接管时，**直接调用 `browser.downloads.cancel(id)` 与 `erase({id})`，绝不调用 `suggest()`**。只有在放行（如禁用拦截、Alt 绕过、App 熔断、白名单）时才调用 `suggest()`（`callSuggestPassthrough()`）。彻底根治无参调用 `suggest()` 导致的浏览器原生「另存为」弹窗或下载托盘闪烁问题。
- **涉及代码坐标与契约**：
  | 文件位置 | 关键代码 / 契约 | 作用 |
  |---|---|---|
  | `fluxDown/entrypoints/background.ts` | `callSuggestPassthrough()` / `browser.downloads.cancel` | 拦截时直接取消并抹除，放行时才调用 `suggest()` |

---

### 特性 5：aria2 RPC / RSS 无人值守直接下载（Unattended Mode）

- **特性说明**：针对自动化追更场景，在设置开启「跳过二次选择」或通过 aria2 / RSS 创建任务时，BT / 磁力 / 流媒体任务直接落库 `unattended=1` 并自动全选所有文件启动，**绝对不弹出任何文件选择或画质选择弹窗阻断自动化下载**。
- **涉及代码坐标与契约**：
  | 文件位置 | 关键代码 / 契约 | 作用 |
  |---|---|---|
  | `native/engine/src/download_manager.rs` | `unattended_selection: bool` | 任务创建时传入无人值守标记 |
  | `native/engine/src/db.rs` | `tasks.unattended`<br/>`set_task_unattended`<br/>`is_task_unattended` | 数据库字段持久化与状态读取 |
  | `native/engine/src/hls_downloader.rs` / `dash_downloader.rs` | `if (variants.len() <= 1 || unattended)` | 流媒体画质选择自动短路跳过 |

---

### 特性 6：任务列表增强交互

- **特性说明**：
  - **列表多选与框选**：支持 Ctrl / Shift 多选及鼠标拖拽框选任务（`task_list.dart`）。
  - **任务操作气泡提示**：各操作按钮悬停显示详细 Tooltip 说明（`task_list_item.dart`）。
  - **复制落盘文件**：右键菜单支持直接将已下载完成的文件复制到操作系统剪贴板（`copyFileToClipboard`）。
  - **失效任务清理与重下**：支持快速清理丢失磁盘文件的失效任务记录并一键重新下载。

---

### 特性 7：本地专属打包与自动化发布脚本

- **涉及文件**：
  - `scripts/build_custom_windows.ps1`：Windows InnoSetup 自动构建与便携包目录装配脚本。
  - `installer/windows/setup.iss`：InnoSetup 安装程序配置文件。
  - `scripts/check_upstream_engine.ps1`：上游纯引擎提交快速过滤与比对脚本。
  - `scripts/inject_clear_completed.ps1`：标题栏清理按钮防丢失注入与校验脚本。

---

### 特性 8：逐提交上游同步审计与隔离合入治理

- **特性说明**：上游同步禁止整体 merge，必须从审计水位线开始按时间顺序逐提交判定，在 `sync/*` 隔离分支完成裁剪、门禁与受保护特性核对后，才允许 `--ff-only` 推进 `main`。
- **涉及文件**：
  - `.omp/knowledge/upstream-sync.md`：同步阶段、版本判定与质量门禁 SOP。
  - `.omp/knowledge/upstream-sync-ledger.md`：每个上游提交的采纳/裁剪/废弃结果及单调水位线。
  - `.omp/knowledge/streamlined-edition.md`：冲突裁剪时的产品边界事实源。
- **冲突契约**：涉及本清单其他本地特性的冲突必须停止并由用户决策；不得用整体 merge、跳过记账或重写水位线规避审计。

---

## 2. 核心负向红线清单（Must NOT Restore）

同步上游时，以下官方组件必须**坚决丢弃**，绝不允许重新带入精简版代码库：

1. **官方云端服务**：
   - 官方账号体系、登录、注册、套餐、订阅购买。
   - 设备配对与远程任务同步（FluxCloud）。
   - 官方云端配置下发与健康上报。
2. **遥测与数据上报**：
   - 下载统计上报、部署追踪、设备指纹上报。
3. **独立后台更新器**：
   - `fluxdown_updater.exe` 常驻进程与自动联网更新轮询。
4. **应用内 JS 插件系统**：
   - 应用内 `.fxplug` 插件市场、安装 UI 与 QuickJS 插件运行环境。
5. **浏览器端侵入式嗅探**：
   - DOM 扫描、MutationObserver、Fetch/XHR 原生方法 monkey patch 与页面悬浮球。
6. **服务端与运维**：
   - Headless Web 服务端、Docker 镜像、NAS 软件包、Astro 官网。

---

## 3. 同步后核对自检 SOP Checklist（Agent 必须执行）

每次从上游同步完成后，进入打包发版前，**必须逐项勾选以下核对表**：

```markdown
- [ ] 1. 标题栏清理按钮：运行 `powershell -ExecutionPolicy Bypass -File scripts/inject_clear_completed.ps1` 显示全部 Already injected。
- [ ] 2. 标题栏占位宽度：检查 `lib/src/widgets/header_bar.dart` 的 `_TitlebarOverlayReservation` 保底宽度为 5 按钮（`* 5`）。
- [ ] 3. 控制器清理方法：检查 `lib/src/models/download_controller.dart` 中存在 `deleteCompletedTasks()`。
- [ ] 4. Doctor 环境诊断：检查 `lib/src/pages/settings_page.dart` 中存在 `SettingsCategory.doctor` 且 `DoctorReportView` 正常引用。
- [ ] 5. 浏览器扩展角标与动画：检查 `fluxDown/utils/icon-manager.ts` 中存在 `formatDownloadingBadge` 且使用 `OffscreenCanvas` 动画。
- [ ] 6. 浏览器拦截零弹窗：检查 `fluxDown/entrypoints/background.ts` 拦截分支直接 cancel+erase，不调用 `suggest()`。
- [ ] 7. aria2 无人值守：检查 `native/engine/src/download_manager.rs` 中包含 `unattended_selection` 逻辑。
- [ ] 8. 负向红线审查：检查 `git diff main..HEAD`，确认无云端/遥测/更新器/插件代码混入。
- [ ] 9. 质量门禁全通：`flutter analyze` (0 issue), `flutter test` (全部 pass), `cargo clippy -- -D warnings` (0 warning), `cargo test` (全部 pass)。
```

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

## 本地全端打包与 GitHub Releases 发布流程（SOP）

适用于在本地 Windows 开发机上打包全部客户端产物并归档发布到 GitHub Releases。

### 1. 产物输出规范（`dist/` 目录）

| 目标端 / 组件 | 构建方式 | 输出文件名 |
|---|---|---|
| **Windows 安装程序** | `flutter build windows --release` + Inno Setup (`ISCC.exe`) | `FluxDown-<version>-windows-x64-setup.exe` |
| **Windows 便携压缩包** | 打包 `build/windows/x64/runner/Release/*` | `FluxDown-<version>-windows-x64-portable.zip` |
| **CLI 命令行工具** | `cargo build --release -p fluxdown_cli` | `fluxdown.exe` 与 `FluxDown-<version>-windows-x64-cli.zip` |
| **Chrome 扩展 (MV3)** | `cd fluxDown && npm run build` 打包 `.output/chrome-mv3/*` | `FluxDown-<ext_version>-chrome.zip` |
| **Firefox 扩展** | `cd fluxDown && npm run build:firefox` 打包 `.output/firefox-mv2/*` | `FluxDown-<ext_version>-firefox.zip` |
| **Edge 专用扩展** | 复制 Chrome 产物并剔除 `manifest.json` 中的 `key` 字段后压缩 | `FluxDown-<ext_version>-edge.zip` |
| **油猴脚本** | 归档 `userscript/fluxdown.user.js` | `fluxdown.user.js` |

---

### 2. 标准打包命令

#### Step 1: 准备与代码生成
```bash
rinf gen
pwsh -Command "New-Item -ItemType Directory -Path dist -Force | Out-Null"
```

#### Step 2: 浏览器扩展构建与打包
```powershell
# 1. 构建 Chrome MV3 与 Firefox
cd fluxDown
npm run build
npm run build:firefox
cd ..

# 2. 压缩 Chrome 与 Firefox 包
pwsh -Command @"
  Compress-Archive -Path 'fluxDown\.output\chrome-mv3\*' -DestinationPath 'dist\FluxDown-0.1.29-chrome.zip' -Force
  Compress-Archive -Path 'fluxDown\.output\firefox-mv2\*' -DestinationPath 'dist\FluxDown-0.1.29-firefox.zip' -Force

  # 3. 生成 Edge 专用包（剔除 manifest key 字段）
  `$edgeTemp = Join-Path `$env:TEMP 'fluxdown_edge_build'
  if (Test-Path `$edgeTemp) { Remove-Item `$edgeTemp -Recurse -Force }
  Copy-Item 'fluxDown\.output\chrome-mv3' `$edgeTemp -Recurse
  `$edgeManifest = Join-Path `$edgeTemp 'manifest.json'
  `$json = Get-Content `$edgeManifest -Raw | ConvertFrom-Json
  `$json.PSObject.Properties.Remove('key')
  `$json | ConvertTo-Json -Depth 10 | Set-Content `$edgeManifest -Encoding utf8
  Compress-Archive -Path "`$edgeTemp\*" -DestinationPath 'dist\FluxDown-0.1.29-edge.zip' -Force
  Remove-Item `$edgeTemp -Recurse -Force
"@
```

#### Step 3: CLI 命令行工具构建与打包
```powershell
cargo build --release -p fluxdown_cli
pwsh -Command @"
  Copy-Item 'target\release\fluxdown.exe' 'dist\fluxdown.exe' -Force
  Compress-Archive -Path 'target\release\fluxdown.exe' -DestinationPath 'dist\FluxDown-0.1.44-windows-x64-cli.zip' -Force
"@
```

#### Step 4: Windows 桌面端构建与安装包/便携包生成
```powershell
# 运行内置打包脚本构建 Release 并生成 Inno Setup 安装包
pwsh -File scripts\build_custom_windows.ps1 -Version 0.1.44 -OutputDirectory dist

# 制作绿色免安装便携版 zip
pwsh -Command "Compress-Archive -Path 'build\windows\x64\runner\Release\*' -DestinationPath 'dist\FluxDown-0.1.44-windows-x64-portable.zip' -Force"
```

#### Step 5: 归档油猴用户脚本与校验
```powershell
pwsh -Command @"
  Copy-Item 'userscript\fluxdown.user.js' 'dist\fluxdown.user.js' -Force
  Get-FileHash dist\* -Algorithm SHA256 | Select-Object @{Name='File';Expression={Split-Path `$_.Path -Leaf}}, Hash
"@
```

---

### 3. 发布至 GitHub Releases 流程

1. **分支对齐**：确保 `main` 与 `stable` 分支已合并最新代码并推送到 remote（`origin`）。
2. **创建/更新 Release 并上传附件**：
   使用 GitHub REST API（带 `repo` 权限的 Personal Access Token / OAuth Token）：
   - `POST https://api.github.com/repos/{owner}/{repo}/releases` 创建 Release（指定 tag 如 `v0.1.44`，目标分支 `main`）。
   - 遍历 `dist/` 目录，逐个向 `https://uploads.github.com/repos/{owner}/{repo}/releases/{release_id}/assets?name={filename}` 发送 `POST` 请求上传二进制数据（设置对应 `Content-Type`）。
3. **验证**：访问仓库 Release 页面（例如 `https://github.com/<owner>/<repo>/releases`）核对附件清单与 SHA256 摘要。

---

## 设计文档实现状态（`docs/`）

> ⚠️ `docs/` 在 `.gitignore` 里（零文件入库），下列设计文档**只存在于本机工作副本**；契约与不变式一律写回 `AGENTS.md` / 本目录，别只留在 `docs/`。

避免混淆——**已实现** vs **仅设计**：
- **已实现**：多文件任务组（`multi-file-task-group-design.md`）、插件系统 + 去中心化市场（`fluxdown-plugin-marketplace-plan.md` 等）。
- **已移除**：FluxDown 官方账号、云设备、配置同步、更新、遥测与云 CDN 配置链路；局域网 `link/` 直连保留。
- **已实现（客户端）**：RSS 订阅自动下载（`rss-subscription-design.md`，issue #97）——引擎 `native/engine/src/rss/`、REST `/api/v1/rss/*`、hub 信号、桌面 UI（侧边栏区块 + 条目流 + 三 Tab 对话框 + 两步向导）、CLI `fluxdown rss`、MCP `rss_list`/`rss_add`/`rss_remove`。
- **已实现（免费层）**：webhook 任务事件通知（`webhook-notification-design.md`）——引擎 `native/engine/src/webhook.rs`（6 事件 × 8 预设 + 占位符模板 + HMAC 签名 + 环形投递日志）、REST `/api/v1/webhooks/{deliveries,test,simulate}`、hub 信号、桌面「通知」设置分类。端点表就是 config 键 `webhook.endpoints`，桌面 / CLI `--local` 共享。**付费托管 Relay（设计 §6）未实现**，客户端无任何 relay 代码。
- **命名歧义警告**：引擎里的 `tracker_subscription.rs` / `ed2k/server_subscription.rs` 指 **BT tracker 列表 / ED2K server.met 订阅**，与 `rss/` 的 feed 订阅是两回事；`engine/src/webhook.rs` 是任务事件推送。

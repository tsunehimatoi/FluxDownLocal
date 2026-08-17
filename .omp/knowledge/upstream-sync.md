# FluxDown 精简版：上游定期同步与发版标准操作规范（Agent Reusable SOP）

> 本文是 FluxDown 精简版本地分支与上游官方仓库（`https://github.com/zerx-lab/FluxDown.git`）进行**定期同步、提交审计与发版打包的标准可复用流程（SOP）**。
> 本分支杜绝粗暴的 `git merge`，强制采用 **Commit-by-Commit 逐条审计** 与 **沙盒隔离实施** 机制，确保在及时吸收上游引擎优化与协议修复的同时，100% 捍卫精简版产品红线。
>
> 提交审计全量台账参见：[`.omp/knowledge/upstream-sync-ledger.md`](upstream-sync-ledger.md)。
> 精简版产品红线与保留/移除矩阵参见：[`.omp/knowledge/streamlined-edition.md`](streamlined-edition.md)。
> 受保护本地专属修改清单参见：[`.omp/knowledge/protected-local-features.md`](protected-local-features.md)。

---

## 0. 核心铁律与不变式

1. **上游单向只读，严禁直接 Merge**：
   - `upstream` 仅用于 `git fetch` 获取最新提交与 Tag。
   - **绝对禁止**运行 `git merge upstream/main`、`git merge upstream/develop` 或 `git pull upstream`。
2. **以 Commit 为最小审查单元**：
   - 上游可能有大量提交，同步时必须按提交时间从旧到新（`--reverse`）**逐一确认**每个 commit 的改动范围。
3. **精简版优先与冲突解决原则**：
   - 冲突永远以精简版的产品边界为准。上游提交如果混合了核心修复与云端特性，**只提取核心改动，坚决丢弃云端部分**。
   - 绝不为了避免冲突而复原已删除的云端账号、遥测、更新器或插件代码。
4. **沙盒隔离实施**：
   - 所有 Cherry-pick 与冲突解决必须在独立的 `sync/*` 临时分支上进行，验证完全通过后方可 `--ff-only` 合入 `main`。
5. **台账强制同步更新**：
   - 每次同步必须在 [`.omp/knowledge/upstream-sync-ledger.md`](upstream-sync-ledger.md) 中登记每一个提交的判定结果与具体原因。
6. **本地专属提交冲突保护铁律（Local Conflict Guard）**：
   - **上游无关的本地专属提交（带 `(local)` 标识）**是精简版的核心资产。若后续同步上游时与此类提交发生代码冲突，**AI 严禁自行裁决覆盖、丢弃或回退，必须立即停手向用户请示决策！**
7. **受保护本地修改清单防丢弃守卫（Protected Local Features Guard）**：
   - 标题栏清空已完成按钮、Doctor 诊断、扩展角标与动画、aria2 无人值守等已在 [`.omp/knowledge/protected-local-features.md`](protected-local-features.md) 列明的本地特性，同步期间**绝对禁止遗漏或覆盖**，发版前必须逐条核对并通过注入脚本验证。

---

## 1. 提交分类与命名契约（从现在往后强制执行）

为清晰追溯代码血缘并在冲突时提供准确保护依据，所有新增提交必须遵循 Conventional Commits（`feat`/`fix`/`chore`/`docs`/`refactor`/`perf`/`test`），并严格按来源标记分类：

```
                              ┌────────────────────────┐
                              │    新增 Commit 来源    │
                              └───────────┬────────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        ▼                                 ▼                                 ▼
   1. 上游直接同步 (Pick)             2. 上游修改后纳入 (Adapt)         3. 上游无关的本地专属 (Local)
  纯下载/协议/API/修复               核心修复裁剪了云端/设置           本地架构/精简版修复/体验优化
        │                                 │                                 │
 ┌──────┴──────────────────────┐   ┌──────┴──────────────────────┐   ┌──────┴──────────────────────┐
 │ <type>(<scope>): <msg>      │   │ <type>(<scope>): <msg>      │   │ <type>(local/<scope>): <msg>│
 │ (upstream <hash>)           │   │ (adapted from <hash>)       │   │ 或 ... (local)              │
 └─────────────────────────────┘   └─────────────────────────────┘   └─────────────────────────────┘
```

- **🟢 类别 1：上游直接同步（Upstream Direct Pick）**：
  - 特征：纯下载引擎（`native/engine/*`）、底层接口（`native/api/*`）、CLI 工具（`native/cli/*`）、NMH 注册（`native/nmh/*`）、跨平台窗口/系统托盘基础修复、纯单元测试。
  - 命名格式：`<type>(<scope>): <msg> (upstream <hash>)`
  - 操作：直接 `git cherry-pick <commit-hash>`，并在 commit message 中附加上游 short hash。
- **🟡 类别 2：上游修改后纳入（Upstream Adapted Pick）**：
  - 特征：包含有价值的核心功能（如多选下载、分类目录、界面交互优化、错误诊断），但该 commit 同时碰了 `settings_page.dart`、`Cargo.toml`、`translations` 或已删除的云端/服务端模块。
  - 命名格式：`<type>(<scope>): <msg> (adapted from <hash>)`
  - 操作：
    1. `git cherry-pick -n <commit-hash>`
    2. 丢弃已删除文件修改：`git checkout HEAD -- <unwanted-file>` 或 `git rm <file>`
    3. 手工在精简版相应位置补齐核心改动，在 commit body 中简要说明裁剪内容并提交。
- **🔵 类别 3：上游无关的本地专属提交（Local Only）**：
  - 特征：精简版独有的功能（如免打扰下载、精简版浏览器扩展、自定义打包脚本、本地特有 Bug 修复）。
  - 命名格式：`<type>(local/<scope>): <msg>` 或 `<type>(<scope>): <msg> (local)`
  - ⚠️ **冲突保护**：**在后续上游同步发生冲突时，若冲突涉及此类提交，AI 必须立刻中断并向用户请示，严禁自行覆盖！**
- **🔴 类别 4：坚决排除的上游提交（Skip / Drop）**：
  - 特征：官方云账号/登录/Origin ID、套餐购买/微信/支付宝/加密货币支付、云端任务/配置同步、遥测上报、在线更新器、应用内 JS/`.fxplug` 插件系统、浏览器端 DOM 资源嗅探/拦截、官网推广/客服/机器人。
  - 操作：直接跳过，不创建 git 提交，并在 [`.omp/knowledge/upstream-sync-ledger.md`](upstream-sync-ledger.md) 中登记排除原因。

---

## 2. 上游基准版本 `<UpstreamVersion>` 自动判定阶梯

> ⚠️ **重要警告**：上游官方的 `pubspec.yaml` 历史上曾长期停滞（如滞留在 `0.1.44`），**绝对禁止**将其作为唯一版本事实源！AI Agent 必须按以下顺序自动解析出上游当前基准版本号（如 `0.4.7`）：

1. **第一优先级：GitHub Releases / Tags API**
   ```bash
   # 方式 A：curl GitHub API（无需鉴权）
   curl -s https://api.github.com/repos/zerx-lab/FluxDown/releases/latest | jq -r .tag_name
   # 方式 B：GitHub CLI
   gh release view -R zerx-lab/FluxDown --json tagName -q .tagName
   ```
2. **第二优先级：上游 Git Tags 与近期 Release/Chore 提交**
   ```bash
   git fetch upstream --tags
   git tag -l "v*" --sort=-v:refname | head -n 5
   ```
3. **第三优先级：浏览器扩展 / Web 模块 `package.json`**
   ```bash
   git show upstream/main:fluxDown/package.json | jq -r .version
   ```
4. **第四优先级：本地同步历史台账（兜底）**
   - 查阅 [`.omp/knowledge/upstream-sync-ledger.md`](upstream-sync-ledger.md) 顶部【同步水位线总览】记录的最新基线版本。

---

## 3. 端到端标准同步发版六阶段流程（Agent SOP）

### 阶段 1：远端校准与差异提取
```powershell
# 1. 确保工作区干净
git status

# 2. 检查并校准 upstream 远端 URL 为官方仓库
$upstreamUrl = git remote get-url upstream 2>$null
if ($upstreamUrl -ne 'https://github.com/zerx-lab/FluxDown.git') {
  git remote set-url upstream https://github.com/zerx-lab/FluxDown.git
}

# 3. 拉取上游最新提交与 Tags
git fetch upstream --tags

# 4. 查看当前台账水位线到 upstream/main 之间的待审提交
# （以当前水位线 86c6cf8 为例）
git log 86c6cf8..upstream/main --oneline --reverse
```

### 阶段 2：提交逐条审查与台账登记
1. 按 `--reverse` 时间顺序，逐个审查提交 diff：
   ```bash
   git show --stat <commit-hash>
   git show <commit-hash>
   ```
2. 依据三类判定矩阵归类，并同步更新 [`.omp/knowledge/upstream-sync-ledger.md`](upstream-sync-ledger.md) 中的表格与统计。

### 阶段 3：沙盒隔离 Cherry-pick 与适配
```powershell
# 1. 基于本地最新 main 创建隔离同步分支
git checkout -b sync/v0.4.7 main

# 2. 对 🟢 类别 1（直接拣选）：
git cherry-pick <commit-hash>

# 3. 对 🟡 类别 2（裁剪拣选）：
git cherry-pick -n <commit-hash>
# 剔除不需要的已删除模块文件修改（例如 web/、native/server/ 等）：
git checkout HEAD -- web native/server
# 解决冲突，保留核心逻辑后提交：
git commit -C <commit-hash>

# 4. 对 🔴 类别 3（彻底排除）：
# 直接跳过，不执行任何 git 命令。
```

### 阶段 4：全套质量门禁与自动化测试
在 `sync/*` 分支上完成所有选定提交后，严格运行以下门禁：
```powershell
# 1. 引擎与各 crate 编译检查
cargo check -p fluxdown_engine --lib
cargo check -p fluxdown_api --lib
cargo check -p fluxdown_cli --lib

# 2. 代码格式与 Clippy 零警告检查
cargo fmt --check
cargo clippy -- -D warnings

# 3. Flutter 前端静态分析与单测
flutter analyze
flutter test

# 4. Rust 核心单测
cargo test -p fluxdown_engine --lib
cargo test -p fluxdown_api
cargo test -p fluxdown_cli
# 5. 受保护本地专属修改自动检测与自愈注入
powershell -ExecutionPolicy Bypass -File scripts/inject_clear_completed.ps1
```

**受保护本地修改自检核对清单（SOP 必检项，详见 [`.omp/knowledge/protected-local-features.md`](protected-local-features.md)）**：
- [ ] 1. **标题栏清空已完成按钮**：`scripts/inject_clear_completed.ps1` 校验全通过，`_TitlebarToolButtons` 包含 trash2，`_TitlebarOverlayReservation` 为 5 按钮宽度。
- [ ] 2. **控制器清理逻辑**：`download_controller.dart` 中包含 `deleteCompletedTasks()` 方法。
- [ ] 3. **Doctor 环境诊断**：`settings_page.dart` 中存在 `SettingsCategory.doctor` 且 `DoctorReportView` 渲染正常。
- [ ] 4. **浏览器扩展角标与动画**：`icon-manager.ts` 包含 `formatDownloadingBadge` 且仅显示下载中任务数。
- [ ] 5. **aria2 无人值守直接下载**：`native/engine/src/download_manager.rs` 包含 `unattended_selection` 逻辑。
- [ ] 6. **负向红线审查**：检查 `git diff main..HEAD`，确认无 `cloud_auth`、`analytics`、`updater`、`pricing` 相关代码。
- [ ] 7. **Actor 分支上限**：检查 `native/hub/src/actors/download_actor.rs`，确认 `tokio::select!` 未超过 64 分支上限。
- [ ] 8. **i18n 基线**：确认 i18n 仅维护 `en` + `zh` 基线对，未破坏社区语言回退逻辑。
- [ ] 9. **本地 CDN 调度**：确认多 CDN 本地解析与断点续传能力完好。

### 阶段 5：版本号全量对齐、主干推进与打标
1. **版本号命名公式**：`v<UpstreamVersion>-local.<LocalBuild>`（例如 `v0.4.7-local.1`）。
2. **全项目 5 处版本号同步修改**：
   - `pubspec.yaml`：`version: 0.4.7-local.1+1`
   - `fluxDown/package.json`：`"version": "0.4.7"`
   - `fluxDown/wxt.config.ts`：`version: "0.4.7"`, `version_name: "0.4.7-local.1"`
   - `scripts/build_custom_windows.ps1`：`[string]$Version = '0.4.7-local.1'`
   - `README.md` 中的构建命令
   - 运行 `rinf gen` 刷新 Dart/Rust 绑定。
3. **主干合并与分支推进**：
   ```powershell
   # 提交版本对齐改动
   git commit -am "chore: bump version to 0.4.7-local.1"

   # 切回 main 并快进合并
   git checkout main
   git merge --ff-only sync/v0.4.7
   git branch -d sync/v0.4.7

   # 快进推进 stable 稳定分支
   git checkout stable
   git merge --ff-only main
   git checkout main

   # 打上 Release Tag
   git tag -a v0.4.7-local.1 -m "v0.4.7-local.1"

   # 推送分支与 Tag
   git push origin main
   git push origin stable
   git push origin v0.4.7-local.1
   ```

### 阶段 6：多端全量 Release 打包与 SHA256 校验
```powershell
# 1. 确保 dist 目录就绪
New-Item -ItemType Directory -Path dist -Force | Out-Null

# 2. 浏览器扩展打包（Chrome MV3, Firefox MV2, Edge MV3）
cd fluxDown
npm run build
npm run build:firefox
cd ..

Compress-Archive -Path 'fluxDown\.output\chrome-mv3\*' -DestinationPath 'dist\FluxDown-0.4.7-local.1-chrome.zip' -Force
Compress-Archive -Path 'fluxDown\.output\firefox-mv2\*' -DestinationPath 'dist\FluxDown-0.4.7-local.1-firefox.zip' -Force

$edgeTemp = Join-Path $env:TEMP 'fluxdown_edge_build'
if (Test-Path $edgeTemp) { Remove-Item $edgeTemp -Recurse -Force }
Copy-Item 'fluxDown\.output\chrome-mv3' $edgeTemp -Recurse
$edgeManifest = Join-Path $edgeTemp 'manifest.json'
$json = Get-Content $edgeManifest -Raw | ConvertFrom-Json
$json.PSObject.Properties.Remove('key')
$json | ConvertTo-Json -Depth 10 | Set-Content $edgeManifest -Encoding utf8
Compress-Archive -Path "$edgeTemp\*" -DestinationPath 'dist\FluxDown-0.4.7-local.1-edge.zip' -Force
Remove-Item $edgeTemp -Recurse -Force

# 3. CLI 命令行工具构建与打包
cargo build --release -p fluxdown_cli
Copy-Item 'target\release\fluxdown.exe' 'dist\fluxdown.exe' -Force
Compress-Archive -Path 'target\release\fluxdown.exe' -DestinationPath 'dist\FluxDown-0.4.7-local.1-windows-x64-cli.zip' -Force

# 4. Windows 桌面端构建与安装包/便携包生成
powershell -File scripts\build_custom_windows.ps1 -Version 0.4.7-local.1 -OutputDirectory dist
Compress-Archive -Path 'build\windows\x64\runner\Release\*' -DestinationPath 'dist\FluxDown-0.4.7-local.1-windows-x64-portable.zip' -Force

# 5. 油猴用户脚本归档与 SHA256 摘要生成
Copy-Item 'userscript\fluxdown.user.js' 'dist\fluxdown.user.js' -Force
Get-FileHash dist\* -Algorithm SHA256 | Select-Object @{Name='File';Expression={Split-Path $_.Path -Leaf}}, Hash | Format-Table -AutoSize
```

---

## 4. 常见冲突场景与应对技巧

| 冲突场景 | 典型表现 | 正确解法 |
|---|---|---|
| **设置页 `settings_page.dart`** | 上游在账号/云端/更新分区附近增加了新设置项 | 将新设置项移入精简版对应的分类（如通用设置、下载设置、高级设置），丢弃云端分区代码。 |
| **数据库 `db.rs` / `SQLITE_SCHEMA`** | 上游新增了表或列 | 核心下载相关的列（如限速、分类、站点凭据）必须同步进 `SQLITE_SCHEMA` + `POSTGRES_SCHEMA`；云端 token 相关列直接丢弃。 |
| **依赖文件 `Cargo.toml` / `pubspec.yaml`** | 上游添加了新 crate / package | 下载/协议/系统所需依赖正常保留；若为云端 SDK、第三方埋点上报库则坚决丢弃。遵循“不随意增加依赖”原则。 |
| **Actor 信号通道** | 上游为新特性增加了 Dart↔Rust 信号 | 检查 `download_actor.rs`，新信号必须合流进已有的 `AuxSignal` 泵，**严禁向主 `tokio::select!` 新增分支**（受限于 64 硬上限）。 |

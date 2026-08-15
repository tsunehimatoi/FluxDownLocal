# FluxDown 精简版：上游定期同步指导文档（SOP）

> 本文是 FluxDown 精简版本地分支与上游官方仓库（`upstream`）进行**定期同步的标准操作规范（SOP）**。
> 本分支杜绝粗暴的 `git merge`，采用**人工 / AI 逐条审查提交（Commit-by-Commit Audit）**机制，确保在及时吸收上游引擎优化与协议修复的同时，100% 捍卫精简版产品红线。

---

## 1. 核心准则与铁律

1. **上游单向只读，严禁直接 Merge**：
   - `upstream` 仅用于 `git fetch` 获取最新提交。
   - **绝对禁止**运行 `git merge upstream/main`、`git merge upstream/develop` 或 `git pull upstream`。
2. **以 Commit 为最小审查单元**：
   - 上游可能有大量提交，同步时必须从旧到新**逐一确认**每个 commit 的改动范围。
3. **精简版优先与冲突解决原则**：
   - 冲突永远以精简版的产品边界为准（参见 [.omp/knowledge/streamlined-edition.md](file:///d:/code/offlineFlux/FluxDown/.omp/knowledge/streamlined-edition.md)）。
   - 上游提交如果混合了核心修复与云端特性，**只提取核心改动，坚决丢弃云端部分**。
   - 绝不为了避免冲突而复原已删除的云端账号、遥测、更新器或插件代码。
4. **沙盒隔离实施**：
   - 所有 Cherry-pick 与冲突解决必须在独立的 `sync/*` 临时分支上进行，验证完全通过后方可 `--ff-only` 合入 `main`。

---

## 2. 提交分类与决策矩阵（三类判定法）

在审查上游提交时，对每个 Commit 归入以下三类之一：

```
                    ┌────────────────────────┐
                    │  审查上游 Commit Diff  │
                    └───────────┬────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
 🟢 1. 完全接纳 (Pick)   🟡 2. 裁剪接纳 (Adapt)   🔴 3. 彻底排除 (Skip)
  纯下载/协议/API/修复    核心修复混合了云端/设置    账号/套餐/遥测/更新/嗅探
        │                       │                       │
 ┌──────┴──────────────┐ ┌──────┴──────────────┐ ┌──────┴──────────────┐
 │ git cherry-pick     │ │ git cherry-pick -n  │ │ 直接跳过该 Commit   │
 │ 直接应用            │ │ 剔除云端代码后提交  │ │ 记录排除原因进台账  │
 └─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

### 🟢 类别 1：完全接纳（Pick As-Is）
- **特征**：纯下载引擎（`native/engine/*`）、底层接口（`native/api/*`）、CLI 工具（`native/cli/*`）、NMH 注册（`native/nmh/*`）、跨平台窗口/系统托盘基础修复、纯单元测试。
- **操作**：直接 `git cherry-pick <commit-hash>`。

### 🟡 类别 2：裁剪接纳（Pick & Adapt）
- **特征**：包含有价值的核心功能（如多选下载、分类目录、界面交互优化），但该 commit 同时碰了 `settings_page.dart`、`Cargo.toml`、`translations` 或已删除的云端模块。
- **操作**：
  1. 使用无提交模式拣选：`git cherry-pick -n <commit-hash>`
  2. 丢弃/重置被删文件的改动（如已移除的云服务文件直接 `git checkout HEAD -- <file>` 或 `git rm`）。
  3. 手工在精简版的相应位置补齐核心改动。
  4. 保持原 commit message 或附加 `(adapted for streamlined)` 后提交：`git commit -C <commit-hash>`。

### 🔴 类别 3：彻底排除（Skip / Drop）
- **特征**：
  - FluxDown 官方账号、注册、登录、Origin ID、套餐购买、微信/支付宝付款。
  - 云端任务同步、配置云同步、云端设备协同、云 CDN 配置与健康上报。
  - 遥测上报（`analytics`、`build_stats`）、在线更新器（`fluxdown_updater`）。
  - 应用内 JS/`.fxplug` 插件市场及管理 UI（注意：浏览器扩展 `fluxDown/` 属于核心能力，需保留）。
  - 浏览器端 DOM 资源嗅探、Fetch/XHR 拦截、悬浮球。
  - 纯官网商业化、推广链接、社区浮动入口。
- **操作**：**直接跳过，不执行 pick**。将 commit hash 与排除原因记录到文末台账。

---

## 3. 标准同步六步流程（SOP）

当需要同步上游时，请严格按以下 6 个步骤执行：

### 第一步：获取上游最新信息并提取差异
```bash
# 1. 确保本地工作区干净
git status

# 2. 拉取上游所有分支最新状态
git fetch upstream

# 3. 查看上次同步点（台账中的水位线）到 upstream/main 之间的所有新增提交
# （假设上次水位线为 86c6cf8）
git log 86c6cf8..upstream/main --oneline --reverse
```

### 第二步：生成待审清单并逐条审查
面对列出的提交列表，按提交时间**从旧到新（`--reverse` 顺序）**逐条审查：
```bash
# 查看单个 commit 涉及的文件统计
git show --stat <commit-hash>

# 查看具体代码改动
git show <commit-hash>
```
根据第 2 节的判定矩阵，在心中或临时草稿中明确每个 commit 是 🟢 Pick、🟡 Adapt 还是 🔴 Skip。

### 第三步：创建沙盒同步分支
```bash
# 基于本地最新的 main 创建同步分支（以当天日期命名）
git checkout -b sync/20260815 main
```

### 第四步：依序执行 Cherry-pick 与适配
按 `--reverse` 的时间顺序逐个应用：

- **对于 🟢 类别 1（直接拣选）**：
  ```bash
  git cherry-pick <commit-hash>
  ```

- **对于 🟡 类别 2（裁剪拣选）**：
  ```bash
  git cherry-pick -n <commit-hash>
  # 遇到不需要的已删除文件修改，直接丢弃：
  git checkout HEAD -- <unwanted-file>
  # 解决冲突，保留核心逻辑，完成后提交：
  git commit -C <commit-hash>
  ```

- **对于 🔴 类别 3（排除跳过）**：
  - 不做任何操作，继续下一个。

- **遇到冲突（Conflict）的标准处理**：
  ```bash
  git status
  # 查看冲突文件并编辑解决
  # 解决后暂存
  git add <resolved-file>
  git cherry-pick --continue
  ```

### 第五步：全套门禁与编译检查
在同步分支上完成所有待选提交后，运行以下编译和静态检查：

```bash
# 1. 引擎编译检查
cargo check -p fluxdown_engine --lib

# 2. 接口与其它 crate 检查
cargo check -p fluxdown_api --lib
cargo check -p fluxdown_server --lib
cargo check -p fluxdown_cli --lib

# 3. Rust 代码格式与 Clippy（提交前必过）
cargo fmt --check && cargo clippy -- -D warnings

# 4. Dart/Flutter 静态分析与测试
flutter analyze
flutter test
```

**红线人工核对清单（5 项确认）**：
- [ ] 检查 `git diff main..HEAD`，确认无 `cloud_auth`、`analytics`、`updater`、`pricing` 相关代码。
- [ ] 检查设置页，确认无云端登录、更新检查或插件市场入口。
- [ ] 检查 `native/hub/src/actors/download_actor.rs`，确认 `tokio::select!` 未超过 64 分支上限。
- [ ] 确认 i18n 仅维护 `en` + `zh` 基线对，未破坏社区语言回退逻辑。
- [ ] 确认多 CDN 本地解析与断点续传能力完好。

### 第六步：合入主干、更新台账与推送
```bash
# 1. 切回 main 并快速合并
git checkout main
git merge --ff-only sync/20260815

# 2. 推送更新到个人 Fork 仓库
git push origin main

# 3. 删除临时同步分支
git branch -d sync/20260815

# 4. （可选）若发版，将 stable 分支快进同步并推送
git checkout stable
git merge --ff-only main
git push origin stable
git checkout main
```

最后，将本次同步的水位线和清单记录到下方的**同步历史台账**中。

---

## 4. 常见冲突场景与应对技巧

| 冲突场景 | 典型表现 | 正确解法 |
|---|---|---|
| **设置页 `settings_page.dart`** | 上游在账号/云端/更新分区附近增加了新设置项 | 将新设置项移入精简版对应的分类（如通用设置、下载设置、高级设置），丢弃云端分区代码。 |
| **数据库 `db.rs` / `SQLITE_SCHEMA`** | 上游新增了表或列 | 核心下载相关的列（如限速、分类、站点凭据）必须同步进 `SQLITE_SCHEMA` + `POSTGRES_SCHEMA`；云端 token 相关列直接丢弃。 |
| **依赖文件 `Cargo.toml` / `pubspec.yaml`** | 上游添加了新 crate / package | 下载/协议/系统所需依赖正常保留；若为云端 SDK、第三方埋点上报库则坚决丢弃。遵循“不随意增加依赖”原则。 |
| **Actor 信号通道** | 上游为新特性增加了 Dart↔Rust 信号 | 检查 `download_actor.rs`，新信号必须合流进已有的 `AuxSignal` 泵，**严禁向主 `tokio::select!` 新增分支**（受限于 64 硬上限）。 |

---

## 5. 上游同步历史台账（Sync Ledger）

> **当前最新同步水位线 (Watermark)**: `86c6cf8`（上游 `upstream/main` 提交时间：2026-08-14）

### [2026-08-15 同步记录]
- **审查区间**: `ed33419` .. `86c6cf8`（共计 30 个上游提交）
- **已接纳提交（16 项）**:
  1. `7ce6a94` - fix: 剥掉 Content-Disposition 引号包裹的 ext-value（🟢 类别 1）
  2. `de756cd` - fix(engine): 默认下载目录改用系统 API 解析（🟢 类别 1）
  3. `d5c8928` - feat(api): 本机服务新增 CORS 豁免开关与局域网地址选择（🟢 类别 1）
  4. `81a2550` - fix(engine): webhook 预设统一改用 JSON 请求体（🟢 类别 1）
  5. `15d3a00` - chore: 统一行尾符策略为 LF(.gitattributes + .editorconfig)（🟢 类别 1）
  6. `faa3d30` - feat(downloader): 支持失效任务清理与重新下载（🟢 类别 1）
  7. `e4522c3` - feat(tasks): 支持复制落盘文件并完善文件跟踪同步（🟢 类别 1）
  8. `f4a7c62` - feat(settings): 一键分类目录并对齐 Web 落盘语义（🟡 类别 2 适配）
  9. `0bf33d4` - fix(settings): 输入框未回车离开即丢失编辑（🟡 类别 2 适配）
  10. `e1239c6` - feat(ui): RSS 条目标题悬浮显示全文（🟢 类别 1）
  11. `9e98d43` - feat(ui): 任务操作按钮补悬浮说明气泡（🟢 类别 1）
  12. `03efe74` - fix(linux): 补全 StatusNotifierItem 属性并监视托盘宿主（🟢 类别 1）
  13. `fa1e5d5` - feat(ui): 应用图标自定义扩展至 Linux/macOS 并同步快捷方式图标（🟢 类别 1）
  14. `8cc8fe9` - fix(ui): 修复 macOS 关闭到托盘后 Dock 图标常驻（🟢 类别 1）
  15. `37c7ecf` - feat(ui): 下载列表支持 Ctrl/Shift 多选与鼠标框选（🟢 类别 1）
  16. `9914ab7` - feat(hub): 设置页新增 Doctor 环境诊断与一键修复（🟡 类别 2 适配）
- **已排除提交（14 项）与理由**:
  1. `86c6cf8` - feat(cloud): 套餐徽标本地快照秒开与注册密码明文切换（🔴 排除：官方云与套餐）
  2. `eb9d758` - 简化定价模型说明，删除冗余项（🔴 排除：商业定价）
  3. `7e9d346` - feat(pricing): 更新定价模型说明与云端范围定义（🔴 排除：商业定价）
  4. `e0ef964` - feat(cloud): 客户端与官网同步买断制套餐降级拦截（🔴 排除：官方云与套餐降级）
  5. `c59df2f` - feat(account): 账户昵称自助修改与套餐徽标可配置视觉样式（🔴 排除：官方账号系统）
  6. `413db20` - feat(webbuy): 在二维码中添加微信支付logo（🔴 排除：官网支付）
  7. `6847099` - feat(cloud): 账户页支持自助修改 Origin ID（🔴 排除：官方云 ID）
  8. `722deee` - feat(account): 账户页接入云端套餐购买与官网动态定价（🔴 排除：官方账号与套餐）
  9. `b6cb923` - fix(website): 将客服入口并入社区菜单（🔴 排除：官网运营）
  10. `f8d37c6` - fix(website): 修复 LangBot 组件访问访客本机（🔴 排除：官网机器人）
  11. `2c4cc84` - feat(website): 调整翻译贡献流程并移除演示入口（🔴 排除：官网页面）
  12. `8c32d69` - feat(cloud): 完善 Web 与 PC 多设备任务协同（🔴 排除：官方云多端协同）
  13. `955f373` - feat(rules): Add no-meta-in-comments rule（🔴 排除：上游规则临时提交）
  14. `51387a7` - chore(rules): 移除 no-meta-in-comments 规则（🔴 排除：已在下一提交中撤销）

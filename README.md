# FluxDown (本地精简版)

本项目是基于 [FluxDown (zerx-lab/FluxDown)](https://github.com/zerx-lab/FluxDown) 维护的个人定制与本地精简分支。主要用于满足本地优先的下载需求，去除了云端与运营相关组件，并针对个人使用习惯（如类似 Motrix 的已完成任务清理体验）进行了少量微调。

本fork会定期同步上游，并构建，但是不做保证

> [!IMPORTANT]
> **致谢与声明**  
> FluxDown 及其主要工作由原项目作者和贡献者完成。若你喜欢这个项目，请优先考虑 Star、贡献或赞助原始 [FluxDown 项目](https://github.com/zerx-lab/FluxDown)。  
> 本项目与 FluxDown / zerx-lab 官方不存在隶属关系。

---

## 修改内容说明

### 1. 功能移除与精简
- **云端与账号体系**：移除官方登录、注册、设备同步、远程任务同步及官方云端配置分发。
- **数据遥测与上报**：移除下载统计上报、部署追踪、设备身份及 CDN 健康状态上报。
- **后台更新器**：移除常驻的后台在线更新组件（`fluxdown_updater.exe`）及自动更新检查。
- **应用内插件系统**：移除 JS/`.fxplug` 应用内扩展市场与运行环境。
- **浏览器扩展嗅探**：移除网页 DOM 扫描、MutationObserver、Fetch/XHR 注入及页面悬浮球，仅保留纯粹的下载接管功能。

### 2. 个人定制微调
- **标题栏清空已完成按钮**：参考 Motrix 的使用习惯，在主界面标题栏增加垃圾桶按钮，点击直接清空所有已完成任务记录（保留本地已下载文件），可在设置中控制显隐。
- **浏览器扩展状态与动画**：移植了 [Aria2-Explorer](https://github.com/alexhua/Aria2-Explorer) 的下载开始与完成工具栏图标动画，并将扩展角标修改为显示当前正在下载的任务数量。
- **aria2 RPC 无人值守兼容**：优化 aria2 RPC 与 RSS 创建任务时的无人值守行为，在开启跳过二次选择后，BT/磁力任务直接默认全选开始下载，不再弹窗阻断。

---

## 保留的核心能力

本项目持续跟进上游核心代码，完整保留了 FluxDown 的下载能力：

- **协议支持**：HTTP/HTTPS、FTP、BitTorrent、磁力链接（Magnet）、eD2K、HLS / DASH 流媒体。
- **下载性能**：动态分段、断点续传、连接数控制、智能代理、速度限制、本地多 CDN 节点调度。
- **任务管理**：列表多选与框选、文件复制到系统剪贴板、分类目录、失效任务清理与重下。
- **接口与自动化**：兼容 aria2 JSON-RPC、REST / MCP API、RSS 订阅自动下载。
- **客户端与形态**：Flutter 桌面/移动端、内置 Web UI 的 Headless 独立服务端、CLI 工具。

---

## 构建说明

### 环境要求
- Flutter SDK（版本见 `pubspec.yaml`）
- Rust stable 工具链
- Visual Studio 2022（Windows C++ 桌面开发） / CMake & Ninja
- [Inno Setup 6](https://jrsoftware.org/isinfo.php)（用于打包 Windows 安装程序）

### 构建 Windows 安装包
```powershell
flutter pub get
cargo check -p hub --lib

# 构建 Release 并生成安装包（输出到 dist/ 目录）
powershell -ExecutionPolicy Bypass -File scripts/build_custom_windows.ps1 `
  -Version 0.1.44 `
  -OutputDirectory dist
```

### 构建 Headless 服务端（内嵌 Web UI）
```powershell
# 1. 构建前端产物
cd web
bun run build

# 2. 构建服务端单二进制（前端静态资源内嵌于二进制中）
cd ..
cargo build --release -p fluxdown_server
```

---

## 许可与致谢

- 本项目遵循 [GNU Affero General Public License v3.0 (AGPLv3)](LICENSE) 协议。
- 软件名称、核心架构与下载引擎实现均来自 [zerx-lab/FluxDown](https://github.com/zerx-lab/FluxDown)。
- 浏览器扩展工具栏图标动画与配色移植/参考自 [Aria2-Explorer](https://github.com/alexhua/Aria2-Explorer)。

/**
 * 简体中文翻译
 */
const zhCN = {
  // Header
  "header.themeToggle": "切换主题",
  "header.checking": "检测中...",
  "header.connected": "已连接",
  "header.disconnected": "未连接",

  // Main switch
  "switch.label": "下载拦截",
  "switch.enabled": "已开启",
  "switch.disabled": "已关闭",

  // Stats
  "stats.title": "今日统计",
  "stats.sent": "已下载",
  "stats.failed": "失败",
  "stats.reset": "重置统计",
  "stats.resetDone": "统计已重置",

  // Quick settings
  "settings.title": "快捷设置",
  "settings.interceptMode": "拦截模式",
  "settings.modeSmart": "智能模式",
  "settings.modeAll": "拦截所有",
  "settings.hintSmart": "综合文件名、类型、大小智能判断",
  "settings.hintAll": "拦截所有下载（除排除域名外）",
  "settings.minFileSize": "最小文件大小",
  "settings.sizeNoLimit": "不限",
  "settings.interceptMagnet": "接管磁力链接",
  "settings.interceptMagnetHint": "关闭后交给系统默认磁力程序（如 qBittorrent）",
  "settings.altClickHint": "Alt+Shift+D 切换拦截",

  // Remote download source
  "remote.title": "远程下载源",
  "remote.mode": "模式",
  "remote.modeOff": "仅桌面",
  "remote.modeFallback": "桌面优先",
  "remote.modeAlways": "仅远程",
  "remote.modeHintOff": "仅通过 Native Messaging 发送到桌面应用",
  "remote.modeHintFallback": "优先使用桌面应用，不可达时投递到远程服务器",
  "remote.modeHintAlways": "始终投递到远程服务器，不再尝试连接桌面应用",
  "remote.serverUrl": "服务器地址",
  "remote.serverUrlPlaceholder": "如 http://192.168.1.10:17800",
  "remote.token": "访问令牌",
  "remote.tokenPlaceholder": "输入访问令牌",
  "remote.testConnection": "测试连接",
  "remote.testing": "测试中...",
  "remote.testSuccess": "已连接（{app} v{version}）",
  "remote.testAuthFailed": "鉴权失败，请检查访问令牌",
  "remote.testUnreachable": "无法连接到服务器，请检查地址和网络",
  "remote.testNotConfigured": "请先填写服务器地址",
  "remote.testFailed": "连接测试失败：{message}",
  "remote.verifyRequired": "远程模式需先在配置页测试连接通过后才能选择",
  "remote.openOptions": "配置服务器",

  // Options page
  "options.title": "FluxDown 设置",
  "options.remoteDesc":
    "配置 fluxdown_server 的地址与访问令牌，测试连接通过后即可在弹出窗中选择远程模式",
  "options.verifiedState": "状态：已通过连接验证",
  "options.unverifiedState": "状态：未验证（远程模式不可用）",
  "options.navSettings": "设置",
  "options.nav.general": "通用",
  "options.nav.remote": "远程服务器",
  "options.general.languageTitle": "界面语言",
  "options.general.languageDesc": "选择扩展界面的语言，独立于浏览器语言",
  "options.general.languageAuto": "自动（跟随浏览器）",
  "options.general.themeTitle": "外观",
  "options.general.themeDesc": "扩展界面的主题",
  "options.theme.system": "跟随系统",
  "options.theme.light": "浅色",
  "options.theme.dark": "深色",
  "options.tokenDesc": "服务端首次启动时生成的管理令牌",
  "footer.settings": "全部设置",

  // 任务发送通知开关
  "options.general.notifyLocalTitle": "本地任务通知",
  "options.general.notifyLocalDesc":
    "任务发送到本地桌面应用时弹出桌面通知（创建成功/失败）",
  "options.general.notifyRemoteTitle": "远程任务通知",
  "options.general.notifyRemoteDesc":
    "任务发送到远程服务器时弹出桌面通知（创建成功/失败）",

  // 拦截规则配置
  "options.nav.rules": "拦截规则",
  "options.rules.extTitle": "文件扩展名",
  "options.rules.extDesc":
    "命中这些扩展名的下载会被拦截（智能模式下作为正向匹配）。可在下方追加自定义扩展名；内置项不可删除",
  "options.rules.extPlaceholder": "如 .epub",
  "options.rules.add": "添加",
  "options.rules.builtinExts": "内置扩展名列表",
  "options.rules.extEmpty": "暂无自定义扩展名",
  "options.rules.extInvalid": "格式无效，示例：.epub",
  "options.rules.extExists": "{ext} 已在列表中",
  "options.rules.extAdded": "已添加 {ext}",
  "options.rules.mimeTitle": "MIME 类型",
  "options.rules.mimeDesc":
    "智能模式下命中这些 MIME 类型的响应会被拦截。以斜杠结尾表示匹配整个类别（如 video/）",
  "options.rules.mimePlaceholder": "如 application/epub+zip 或 video/",
  "options.rules.mimeInvalid": "格式无效，示例：application/epub+zip 或 video/",
  "options.rules.resetMime": "恢复默认",
  "options.rules.mimeResetDone": "已恢复默认 MIME 列表",


  // Domain exclusion
  "domain.title": "排除域名",
  "domain.addTitle": "手动添加域名",
  "domain.add": "添加",
  "domain.cancel": "取消",
  "domain.placeholder": "输入域名，如 example.com",
  "domain.currentSite": "当前站点",
  "domain.empty": "暂无排除域名",
  "domain.removed": "已移除 {domain}",
  "domain.exists": "{domain} 已在排除列表中",
  "domain.excluded": "已排除 {domain}",
  "domain.cannotGetDomain": "无法获取当前页面域名",
  "domain.excludeCurrent": "排除当前站点",

  // Notifications
  "notify.batchNoLinks": "未找到链接",
  "notify.batchNoLinksDetail": "当前页面未发现任何链接",
  "notify.batchNoDownloadableLinks": "当前页面未发现可下载的文件链接",
  "notify.batchComplete": "批量下载完成",
  "notify.batchResult": "共 {total} 个文件，成功 {sent} 个，失败 {failed} 个",
  "notify.batchExtractFailed": "提取页面链接失败，请检查页面权限",
  "notify.downloadSent": "下载已发送",
  "notify.sentToFluxDown": "{name} 已发送到 FluxDown",
  "notify.batchSentDetail": "{count} 个任务已发送到 FluxDown",
  "notify.sendFailed": "发送失败",
  "notify.connectionFailed": "无法连接到 FluxDown 应用: {message}",
  "notify.fallbackBrowser": "已回退到浏览器下载",
  "notify.fallbackBrowserDetail":
    "无法发送到 FluxDown，已交由浏览器继续下载: {url}",
  "notify.appUnavailable": "未检测到 FluxDown 应用",
  "notify.appUnavailableDetail":
    "已暂时改用浏览器自带下载。请确认 FluxDown 桌面端已启动，稍后将自动恢复接管。",

  // Shortcut toggle
  "shortcut.toggleTitle": "拦截切换",
  "shortcut.interceptOn": "下载拦截已开启",
  "shortcut.interceptOff": "下载拦截已关闭",

  // Context menu
  "contextMenu.sendToFluxDown": "使用 FluxDown 下载此链接",
  "contextMenu.sendImageToFluxDown": "使用 FluxDown 下载此图片",
  "contextMenu.sendVideoToFluxDown": "使用 FluxDown 下载此视频/音频",
  "contextMenu.sendPageToFluxDown": "使用 FluxDown 下载此页面",

  // Manifest
  "manifest.description":
    "拦截浏览器下载，发送到 FluxDown 桌面应用进行高速下载",

  // 顶部 tab（popup）
  "popup.tabs.tasks": "任务",
  "popup.tabs.settings": "设置",

  // 任务面板（popup）
  "popup.tasks.downloading": "下载中",
  "popup.tasks.completed": "最近完成",
  "popup.tasks.empty": "暂无下载任务",
  "popup.tasks.appNotRunning": "FluxDown 未运行",
  "popup.tasks.startApp": "启动 FluxDown",
  "popup.tasks.starting": "启动中…",
  "popup.tasks.statsToday": "今日：",
  "popup.tasks.statsLineTitle": "打开设置查看更多",
  "popup.task.pause": "暂停",
  "popup.task.resume": "继续",
  "popup.task.remove": "删除",
  "popup.task.open": "打开",
  "popup.task.reveal": "目录",
  "popup.task.paused": "已暂停",
  "popup.task.pending": "等待中",
  "popup.task.preparing": "准备中",
  "popup.task.errorGeneric": "下载出错",
  "popup.task.opFailed": "操作失败",

  // 空态快捷下载（popup）
  "popup.quickDownload.placeholder": "粘贴下载链接",
  "popup.quickDownload.button": "下载",
  "popup.quickDownload.invalidUrl": "请输入有效的下载链接",
  "popup.quickDownload.sent": "已发送到 FluxDown",
  "popup.quickDownload.failed": "发送失败",

  // Options 迁移项补充说明
  "options.general.statsDesc": "重置弹出窗口中显示的已下载/失败计数",
  "options.rules.minFileSizeDesc": "小于该大小的文件不会被拦截",
  "options.rules.domainDesc": "这些域名下的下载将不会被拦截",

  // 自定义协议（fluxdown://）
  "options.protocol.label": "FluxDown 自定义协议",
  "options.protocol.enabled": "已启用，经 fluxdown:// 唤起应用",
  "options.protocol.disabled": "关闭（默认）",
  "options.protocol.desc": "经 fluxdown:// 协议唤起应用下载，Windows / macOS / Linux / Android 均支持。本机通道功能更全，建议仅在其不可用时开启",

  // 任务完成通知（任务面板）
  "notify.taskCompletedTitle": "下载完成",
  "notify.taskCompletedDetail": "{name} 已下载完成",
  "notify.openFile": "打开文件",
  "notify.openFolder": "打开文件夹",
} as const;

export type MessageKey = keyof typeof zhCN;
export default zhCN;

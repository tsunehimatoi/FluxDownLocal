import Cocoa
import FlutterMacOS
import LaunchAtLogin

class MainFlutterWindow: NSWindow {
    override func awakeFromNib() {
        let flutterViewController = FlutterViewController()
        let windowFrame = self.frame
        self.contentViewController = flutterViewController
        self.setFrame(windowFrame, display: true)

        // launch_at_startup plugin requires platform channel bridging on macOS.
        // See: https://pub.dev/packages/launch_at_startup#macos-support
        FlutterMethodChannel(
            name: "launch_at_startup",
            binaryMessenger: flutterViewController.engine.binaryMessenger
        ).setMethodCallHandler { (_ call: FlutterMethodCall, result: @escaping FlutterResult) in
            switch call.method {
            case "launchAtStartupIsEnabled":
                result(LaunchAtLogin.isEnabled)
            case "launchAtStartupSetEnabled":
                if let arguments = call.arguments as? [String: Any],
                    let setEnabledValue = arguments["setEnabledValue"] as? Bool
                {
                    LaunchAtLogin.isEnabled = setEnabledValue
                }
                result(nil)
            default:
                result(FlutterMethodNotImplemented)
            }
        }

        // 悬浮球原生层（macOS）— MethodChannel `com.fluxdown/floating_ball`。
        // 详见 FloatingBallPanel.swift；协议参照 lib/src/services/floating_ball/floating_ball_service.dart。
        FloatingBallPanel.shared.register(with: flutterViewController.engine.binaryMessenger)

        // 外部唤起独立下载小窗（原生宿主，macOS）— MethodChannel `fluxdown/popup_host`。
        // 详见 PopupWindowHost.swift；协议参照跨端契约（外部唤起独立小窗 v1）。
        // 单例通过 static let 自持，弹窗窗口/引擎懒创建、常驻复用，不随本窗口生命周期回收。
        PopupWindowHost.shared.register(with: flutterViewController.engine.binaryMessenger)

        // 主窗口托盘状态 + 应用菜单原生动作通道（macOS）— MethodChannel
        // `com.fluxdown/window`。restore/hideToTray 成对切换 activation policy，
        // 并由 AppDelegate 保证窗口可见性、Dock 和焦点的操作顺序。
        // hide/hideOthers/showAll/zoom/front/toggleFullScreen：Flutter 的
        // PlatformMenuItem 无法绑定 AppKit 标准 selector，应用菜单栏的这些
        // 系统动作经本通道转发（见 lib/main.dart _buildMacMenus）。
        FlutterMethodChannel(
            name: "com.fluxdown/window",
            binaryMessenger: flutterViewController.engine.binaryMessenger
        ).setMethodCallHandler { [weak self] (_ call: FlutterMethodCall, result: @escaping FlutterResult) in
            switch call.method {
            case "restore":
                guard let appDelegate = NSApp.delegate as? AppDelegate else {
                    result(FlutterError(
                        code: "window_delegate_unavailable",
                        message: "AppDelegate is unavailable",
                        details: nil))
                    return
                }
                guard appDelegate.restoreMainWindow() else {
                    result(FlutterError(
                        code: "window_restore_failed",
                        message: "Failed to restore the main window",
                        details: nil))
                    return
                }
                result(nil)
            case "hideToTray":
                guard let appDelegate = NSApp.delegate as? AppDelegate else {
                    result(FlutterError(
                        code: "window_delegate_unavailable",
                        message: "AppDelegate is unavailable",
                        details: nil))
                    return
                }
                guard appDelegate.hideMainWindowToTray() else {
                    result(FlutterError(
                        code: "window_hide_to_tray_failed",
                        message: "Failed to hide the main window to the tray",
                        details: nil))
                    return
                }
                result(nil)
            case "hide":
                NSApp.hide(nil)
                result(nil)
            case "hideOthers":
                NSApp.hideOtherApplications(nil)
                result(nil)
            case "showAll":
                NSApp.unhideAllApplications(nil)
                result(nil)
            case "zoom":
                self?.performZoom(nil)
                result(nil)
            case "front":
                NSApp.arrangeInFront(nil)
                result(nil)
            case "toggleFullScreen":
                self?.toggleFullScreen(nil)
                result(nil)
            default:
                result(FlutterMethodNotImplemented)
            }
        }

        RegisterGeneratedPlugins(registry: flutterViewController)

        super.awakeFromNib()
    }
}

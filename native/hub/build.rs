//! 桌面宿主构建开关。插件系统已移除，`hub_plugins` 仅登记为合法 cfg，
//! 不再在任何平台启用。

fn main() {
    println!("cargo::rustc-check-cfg=cfg(hub_plugins)");
    println!("cargo::rustc-check-cfg=cfg(hub_link)");

    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let is_mobile = target_os == "android" || target_os == "ios";
    // 本地设备互联：桌面开启（mobile 关闭——mDNS 需原生权限，且引擎 link feature
    // 亦仅对桌面开启，见 hub/Cargo.toml target 依赖分裂）。
    if !is_mobile {
        println!("cargo::rustc-cfg=hub_link");
    }
}

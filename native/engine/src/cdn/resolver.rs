//! 多来源候选 IP 解析聚合器。
//!
//! 并发查询【系统 DNS】与【内置 DoH-JSON 端点】的 A/AAAA 记录，去重合并为
//! 候选集（系统 DNS 结果排前）。所有来源各自受单源超时约束（1.5s），故整体
//! 耗时有界（< 2s 预算）；任一来源超时/失败仅丢弃该源，绝不影响其余来源。
//!
//! 安全边界（方案 §1.2 规则 3）：内置 DoH 端点是 IP-literal HTTPS 地址，
//! 防止"解析器地址
//!   本身需要 DNS 解析"的鸡生蛋问题；证书按 IP SAN 严格校验。
//!
//! host 级结果做 5 分钟内存缓存——同一批任务（多文件下载）复用解析结果。

use std::collections::{HashMap, HashSet};
use std::net::IpAddr;
use std::sync::{Mutex as StdMutex, OnceLock};
use std::time::{Duration, Instant};

use serde::Deserialize;

use crate::logger::log_info;

/// 单来源（系统 DNS / 单个 DoH 端点）超时。
const PER_SOURCE_TIMEOUT: Duration = Duration::from_millis(1500);

/// host 级候选缓存 TTL。
const CACHE_TTL: Duration = Duration::from_secs(5 * 60);

/// 内置 DoH-JSON 端点 baseline（Google JSON API 格式，`?name=&type=`，
/// `Accept: application/dns-json`）。必须是 IP-literal HTTPS 端点：
/// - AliDNS `223.5.5.5`：`/resolve`，证书含 IP SAN，国内可达性最好，
///   支持 `edns_client_subnet` 参数（ECS）；
/// - Cloudflare `1.1.1.1`：`/dns-query`，证书含 IP SAN，海外兜底
///   （隐私立场明确不支持 ECS）。
///
fn builtin_endpoints() -> Vec<ResolverEndpoint> {
    vec![
        ResolverEndpoint {
            url: "https://223.5.5.5/resolve".to_string(),
        },
        ResolverEndpoint {
            url: "https://1.1.1.1/dns-query".to_string(),
        },
    ]
}

/// 固定的纯本地 DoH resolver 端点。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolverEndpoint {
    pub url: String,
}

/// 解析聚合结果。
#[derive(Debug, Clone, Default)]
pub struct CandidateSet {
    /// 去重后的候选 IP，系统 DNS 结果排前（保序）。
    pub ips: Vec<IpAddr>,
    /// 实际给出 ≥1 个应答的来源数（诊断用）。
    pub sources: u8,
    /// 每个候选 IP 的首次给出来源：`"sys"`（系统 DNS）/ `"doh:<端点IP>"` /
    /// `"ecs:<端点IP>"`。供多 CDN 事件（详情面板日志）做来源归因。
    pub origins: HashMap<IpAddr, String>,
}

/// host → (缓存时刻, 候选集) 的进程级缓存。
static RESOLVE_CACHE: OnceLock<
    StdMutex<std::collections::HashMap<String, (Instant, CandidateSet)>>,
> = OnceLock::new();

fn resolve_cache() -> &'static StdMutex<std::collections::HashMap<String, (Instant, CandidateSet)>>
{
    RESOLVE_CACHE.get_or_init(|| StdMutex::new(std::collections::HashMap::new()))
}

/// DoH 轻量 client（懒建一次）：无代理、短超时、严格 TLS。
/// 构建失败（极罕见）→ None，DoH 来源整体禁用，系统 DNS 仍工作。
static LIGHT_CLIENT: OnceLock<Option<reqwest::Client>> = OnceLock::new();

pub(crate) fn light_client() -> Option<&'static reqwest::Client> {
    LIGHT_CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .no_proxy()
                .timeout(PER_SOURCE_TIMEOUT)
                .connect_timeout(Duration::from_millis(1200))
                .http1_only()
                .build()
                .ok()
        })
        .as_ref()
}

/// Google JSON API 格式的 DoH 响应（只取需要的字段）。
#[derive(Deserialize)]
struct DohJson {
    #[serde(rename = "Answer", default)]
    answer: Vec<DohAnswer>,
}

#[derive(Deserialize)]
struct DohAnswer {
    #[serde(rename = "type")]
    rtype: u16,
    data: String,
}

/// 从 DoH JSON 应答中提取 A/AAAA 记录的 IP（容忍 CNAME 等其他记录混入）。
fn extract_ips(json: &DohJson) -> Vec<IpAddr> {
    json.answer
        .iter()
        .filter(|a| a.rtype == 1 || a.rtype == 28)
        .filter_map(|a| a.data.parse::<IpAddr>().ok())
        .collect()
}

/// 端点 URL → 主机部分（IP-literal），用作来源标记的可读后缀。
/// 解析失败（不应发生，端点已经过校验）→ 原 URL 兜底。
fn endpoint_host(url: &str) -> String {
    reqwest::Url::parse(url)
        .ok()
        .and_then(|u| u.host_str().map(str::to_string))
        .unwrap_or_else(|| url.to_string())
}

/// 合并多来源解析结果：`system` 保序排前，随后按来源顺序合并各标记来源
/// （`(来源标记, ips)`）的应答，全局去重并记录每 IP 的首次来源。
/// `sources` = 给出 ≥1 IP 的来源数。
fn merge_candidates(system: Vec<IpAddr>, labeled: Vec<(String, Vec<IpAddr>)>) -> CandidateSet {
    let mut seen: HashSet<IpAddr> = HashSet::new();
    let mut ips = Vec::new();
    let mut origins = HashMap::new();
    let mut sources = 0u8;
    if !system.is_empty() {
        sources += 1;
    }
    for ip in system {
        if seen.insert(ip) {
            ips.push(ip);
            origins.insert(ip, "sys".to_string());
        }
    }
    for (label, source_ips) in labeled {
        if !source_ips.is_empty() {
            sources = sources.saturating_add(1);
        }
        for ip in source_ips {
            if seen.insert(ip) {
                ips.push(ip);
                origins.insert(ip, label.clone());
            }
        }
    }
    CandidateSet {
        ips,
        sources,
        origins,
    }
}

/// 查询单个 DoH 端点的一种记录类型。任何失败（超时/非 2xx/解析失败）→ 空。
async fn query_doh(endpoint: &str, host: &str, rtype: &str) -> Vec<IpAddr> {
    let Some(client) = light_client() else {
        return Vec::new();
    };
    let url = format!("{endpoint}?name={host}&type={rtype}");
    let fut = async {
        let resp = client
            .get(&url)
            .header("accept", "application/dns-json")
            .send()
            .await
            .ok()?
            .error_for_status()
            .ok()?;
        let json: DohJson = resp.json().await.ok()?;
        Some(extract_ips(&json))
    };
    match tokio::time::timeout(PER_SOURCE_TIMEOUT, fut).await {
        Ok(Some(ips)) => ips,
        _ => Vec::new(),
    }
}

/// 系统 DNS 解析（tokio getaddrinfo）。broken resolver 场景可能悬挂，
/// 故同样受单源超时约束。
async fn query_system_dns(host: &str, port: u16) -> Vec<IpAddr> {
    let fut = tokio::net::lookup_host((host, port));
    match tokio::time::timeout(PER_SOURCE_TIMEOUT, fut).await {
        Ok(Ok(addrs)) => addrs.map(|a| a.ip()).collect(),
        _ => Vec::new(),
    }
}

/// 多来源并发解析 `host` 的候选 IP（含 5min 缓存）。
///
/// 永不失败：所有来源全灭时返回空集（调用方据此退单节点池）。
pub async fn resolve_candidates(host: &str, port: u16) -> CandidateSet {
    if let Ok(cache) = resolve_cache().lock()
        && let Some((at, set)) = cache.get(host)
        && at.elapsed() < CACHE_TTL
    {
        return set.clone();
    }

    let endpoints = builtin_endpoints();

    // 系统 DNS 与所有 DoH 端点（A + AAAA 各一请求）全并发；各自独立超时。
    let system_fut = query_system_dns(host, port);
    let doh_futs = endpoints.iter().map(|ep| {
        let url = ep.url.clone();
        let label = format!("doh:{}", endpoint_host(&ep.url));
        async move {
            let (v4, v6) =
                futures_util::join!(query_doh(&url, host, "A"), query_doh(&url, host, "AAAA"));
            let mut ips = v4;
            ips.extend(v6);
            (label, ips)
        }
    });
    let (system, doh) = futures_util::join!(system_fut, futures_util::future::join_all(doh_futs));

    let set = merge_candidates(system, doh);
    log_info!(
        "[cdn-resolver] host {} 聚合解析: {} 个候选 IP（{} 个来源应答）",
        host,
        set.ips.len(),
        set.sources
    );
    if let Ok(mut cache) = resolve_cache().lock() {
        cache.retain(|_, (at, _)| at.elapsed() < CACHE_TTL);
        cache.insert(host.to_string(), (Instant::now(), set.clone()));
    }
    set
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::{DohJson, ResolverEndpoint, builtin_endpoints, extract_ips, merge_candidates};
    use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

    fn v4(n: u8) -> IpAddr {
        IpAddr::V4(Ipv4Addr::new(1, 2, 3, n))
    }

    #[test]
    fn merge_dedups_and_keeps_system_first() {
        let system = vec![v4(1), v4(2)];
        let doh = vec![
            ("doh:223.5.5.5".to_string(), vec![v4(2), v4(3)]),
            ("doh:1.1.1.1".to_string(), vec![v4(3), v4(4)]),
        ];
        let set = merge_candidates(system, doh);
        assert_eq!(set.ips, vec![v4(1), v4(2), v4(3), v4(4)]);
        assert_eq!(set.sources, 3);
        // 来源归因：首个给出该 IP 的来源获胜（系统 DNS 排前）。
        assert_eq!(set.origins[&v4(1)], "sys");
        assert_eq!(set.origins[&v4(2)], "sys");
        assert_eq!(set.origins[&v4(3)], "doh:223.5.5.5");
        assert_eq!(set.origins[&v4(4)], "doh:1.1.1.1");
    }

    #[test]
    fn merge_counts_only_answering_sources() {
        let set = merge_candidates(
            Vec::new(),
            vec![
                ("doh:223.5.5.5".to_string(), Vec::new()),
                ("ecs:223.5.5.5".to_string(), vec![v4(9)]),
            ],
        );
        assert_eq!(set.ips, vec![v4(9)]);
        assert_eq!(set.sources, 1);
        assert_eq!(set.origins[&v4(9)], "ecs:223.5.5.5");
    }

    #[test]
    fn builtin_resolvers_are_fixed_https_ip_endpoints() {
        let endpoints = builtin_endpoints();
        assert_eq!(endpoints.len(), 2);
        assert!(endpoints.iter().all(|e| e.url.starts_with("https://")));
        assert_eq!(
            endpoints[0],
            ResolverEndpoint {
                url: "https://223.5.5.5/resolve".into()
            }
        );
    }

    #[test]
    fn doh_json_parses_a_and_aaaa_ignores_cname() {
        let raw = r#"{
            "Status": 0,
            "Answer": [
                {"name":"example.com","type":5,"TTL":60,"data":"cdn.example.com."},
                {"name":"cdn.example.com","type":1,"TTL":60,"data":"93.184.216.34"},
                {"name":"cdn.example.com","type":28,"TTL":60,"data":"2606:2800:220:1:248:1893:25c8:1946"},
                {"name":"cdn.example.com","type":1,"TTL":60,"data":"not-an-ip"}
            ]
        }"#;
        let json: DohJson = serde_json::from_str(raw).unwrap();
        let ips = extract_ips(&json);
        assert_eq!(
            ips,
            vec![
                IpAddr::V4(Ipv4Addr::new(93, 184, 216, 34)),
                IpAddr::V6(
                    "2606:2800:220:1:248:1893:25c8:1946"
                        .parse::<Ipv6Addr>()
                        .unwrap()
                ),
            ]
        );
    }

    #[test]
    fn doh_json_tolerates_missing_answer() {
        let json: DohJson = serde_json::from_str(r#"{"Status": 3}"#).unwrap();
        assert!(extract_ips(&json).is_empty());
    }
}

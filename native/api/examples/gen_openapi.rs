//! 输出 OpenAPI 3.1 规范到 stdout。
//!
//! 生成命令：
//!
//! ```bash
//! cargo run -p fluxdown_api --example gen_openapi > openapi.json
//! ```

fn main() {
    println!("{}", fluxdown_api::openapi::openapi_json());
}

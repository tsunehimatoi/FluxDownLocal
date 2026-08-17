#!/usr/bin/env python3
"""
FluxDown GitHub Release Publisher
发布 GitHub Release 并上传 dist/ 目录下的所有二进制制品与说明表格。
不包含 emoji、不包含额外冗余说明，仅保留文件名与说明表格。
"""

import os
import sys
import json
import subprocess
import urllib.request
import urllib.parse
import mimetypes

REPO = "tsunehimatoi/FluxDownLocal"
DIST_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist")

# 标准文件与中文说明映射表（按固定顺序排列）
FILE_SPEC_TEMPLATE = [
    ("FluxDown-{ver}-windows-x64-setup.exe", "Windows 64位 安装包（推荐）"),
    ("FluxDown-{ver}-windows-x64-portable.zip", "Windows 64位 绿色便携免安装版"),
    ("FluxDown-{ver}-windows-x64-cli.zip", "CLI 命令行客户端压缩包"),
    ("fluxdown.exe", "CLI 命令行独立二进制文件"),
    ("FluxDown-{ver}-chrome.zip", "Chrome 浏览器扩展 (MV3)"),
    ("FluxDown-{ver}-firefox.zip", "Firefox 浏览器扩展"),
    ("FluxDown-{ver}-edge.zip", "Edge 专用浏览器扩展"),
    ("fluxdown.user.js", "Tampermonkey 油猴用户脚本"),
]


def get_github_token() -> str:
    """动态获取 GitHub 认证 Token，严禁硬编码或持久化到磁盘"""
    env_token = os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN")
    if env_token:
        return env_token.strip()

    try:
        p = subprocess.Popen(
            ["git", "credential", "fill"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        out, _ = p.communicate("protocol=https\nhost=github.com\n\n")
        for line in out.splitlines():
            if line.startswith("password="):
                return line.split("=", 1)[1].strip()
    except Exception as e:
        print(f"[-] git credential error: {e}", file=sys.stderr)

    print("[-] Error: Unable to retrieve GitHub token from git credential helper.", file=sys.stderr)
    sys.exit(1)


def api_request(url: str, token: str, method: str = "GET", data: bytes = None, content_type: str = "application/json"):
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", "FluxDown-Release-Agent")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    if content_type:
        req.add_header("Content-Type", content_type)
    return urllib.request.urlopen(req)


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Publish FluxDown Release to GitHub")
    parser.add_argument("--tag", default="v0.4.7-local.1", help="Release Tag (e.g. v0.4.7-local.1)")
    parser.add_argument("--repo", default=REPO, help="GitHub repo (owner/repo)")
    parser.add_argument("--dist", default=DIST_DIR, help="Dist directory containing release files")
    args = parser.parse_args()

    tag = args.tag
    clean_ver = tag.lstrip("v")
    repo = args.repo
    dist_dir = os.path.abspath(args.dist)

    if not os.path.isdir(dist_dir):
        print(f"[-] Dist directory not found: {dist_dir}", file=sys.stderr)
        sys.exit(1)

    token = get_github_token()

    # 1. 匹配待上传文件并生成纯净表格（仅 文件名 与 说明）
    files_to_upload = []
    table_rows = []

    for pattern_tmpl, desc in FILE_SPEC_TEMPLATE:
        expected_name = pattern_tmpl.format(ver=clean_ver)
        fpath = os.path.join(dist_dir, expected_name)
        if os.path.isfile(fpath):
            files_to_upload.append((expected_name, fpath))
            table_rows.append(f"| {expected_name} | {desc} |")
        else:
            print(f"[!] Warning: Expected file not found in dist/: {expected_name}")

    if not files_to_upload:
        print(f"[-] No matching release files found in {dist_dir} for version {clean_ver}", file=sys.stderr)
        sys.exit(1)

    # 构造仅包含表格的 Release Body
    body = "| 文件名 | 说明 |\n|---|---|\n" + "\n".join(table_rows)

    print(f"[*] Prepared Release Body:\n{body}\n")

    # 2. 检查 Release 是否已存在
    release_url = f"https://api.github.com/repos/{repo}/releases"
    existing_release = None
    try:
        resp = api_request(f"{release_url}/tags/{tag}", token)
        existing_release = json.loads(resp.read().decode("utf-8"))
        print(f"[*] Found existing release for tag {tag} (ID: {existing_release['id']})")
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise

    if existing_release is None:
        print(f"[*] Creating new GitHub Release for {tag}...")
        payload = {
            "tag_name": tag,
            "target_commitish": "stable",
            "name": f"FluxDown {tag} (本地精简版)",
            "body": body,
            "draft": False,
            "prerelease": False,
        }
        resp = api_request(release_url, token, method="POST", data=json.dumps(payload).encode("utf-8"))
        release = json.loads(resp.read().decode("utf-8"))
        print(f"[+] Release created successfully (ID: {release['id']})")
    else:
        release = existing_release
        print(f"[*] Updating release metadata for ID {release['id']}...")
        payload = {
            "name": f"FluxDown {tag} (本地精简版)",
            "body": body,
        }
        resp = api_request(f"{release_url}/{release['id']}", token, method="PATCH", data=json.dumps(payload).encode("utf-8"))
        release = json.loads(resp.read().decode("utf-8"))
        print(f"[+] Release metadata updated.")

    # 3. 获取已有的 assets 列表并删除已存在的同名资产
    assets_url = f"https://api.github.com/repos/{repo}/releases/{release['id']}/assets"
    resp = api_request(assets_url, token)
    existing_assets = json.loads(resp.read().decode("utf-8"))
    existing_asset_map = {a["name"]: a["id"] for a in existing_assets}

    upload_url_template = release["upload_url"].split("{")[0]

    for fname, fpath in files_to_upload:
        if fname in existing_asset_map:
            asset_id = existing_asset_map[fname]
            print(f"[*] Deleting existing asset {fname} (ID: {asset_id})...")
            del_url = f"https://api.github.com/repos/{repo}/releases/assets/{asset_id}"
            api_request(del_url, token, method="DELETE", content_type="")

        mime_type, _ = mimetypes.guess_type(fpath)
        if not mime_type:
            if fname.endswith(".exe"):
                mime_type = "application/vnd.microsoft.portable-executable"
            elif fname.endswith(".zip"):
                mime_type = "application/zip"
            else:
                mime_type = "application/octet-stream"

        size_mb = os.path.getsize(fpath) / (1024 * 1024)
        print(f"[*] Uploading {fname} ({size_mb:.2f} MB, {mime_type})...")
        target_upload_url = f"{upload_url_template}?name={urllib.parse.quote(fname)}"
        with open(fpath, "rb") as f:
            file_data = f.read()

        api_request(target_upload_url, token, method="POST", data=file_data, content_type=mime_type)
        print(f"[+] Uploaded {fname} successfully.")

    print("\n=======================================================")
    print("[+] Successfully published release to GitHub!")
    print(f"[*] Release URL: {release.get('html_url', '')}")
    print("=======================================================")


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()

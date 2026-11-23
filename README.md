# Kindle for Agents

> 本地优先、可被多个 AI Agent 共用的 Kindle 投送能力。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-LTS%20(22%2F24)-339933.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-lightgrey.svg)](#支持范围与前置条件)

让你的 AI Agent 把本地的调研报告、读书笔记或长文章（Markdown / TXT / HTML / EPUB）自动整理为符合 Kindle 规范的可重排 EPUB，直接推送到你的 Kindle 设备或 Kindle App。

---

## 核心特性

- **多 Agent 一次配置、全局共用**：同一本机用户下，只需首次完成一次配置，后续任何 AI Agent 或命令行都能直接调用 `kindle send` 投送文档。
- **自动转换与排版校验**：内置转换管线，将 `.md` / `.txt` / `.html` / `.epub` 统一处理为适合 Kindle 阅读的可重排 EPUB。
- **本地优先，零中转服务器**：直接使用你自己的邮箱发出，不经过第三方中转邮箱，也不上传任何文档历史。
- **系统级凭据隔离**：邮箱授权码仅保存在 Windows DPAPI 保护区或 macOS 登录钥匙串中，不进入聊天记录或明文配置文件。

## 支持范围与前置条件

- **输入格式**：`.md`、`.txt`、`.html`、`.epub`（输出为可重排 EPUB）
- **操作系统**：Windows 10/11、macOS（需 Node.js LTS）
- **发件邮箱**：QQ 邮箱（使用 SMTP 授权码）
- **Kindle 账户**：Amazon.com 账户（通过 [Amazon 管理内容与设备](https://www.amazon.com/hz/mycd/myx) 配置可信发件人；暂不支持已停运的 Amazon.cn）

---

## 快速开始

### 方式一：直接交给 AI Agent（推荐）

把下面这句话发给你的 Agent 即可自动完成安装与引导配置：

> 请克隆 `https://github.com/haisean996/kindle-for-agents`，阅读 README，并帮我部署 Kindle 投送能力。部署完成以 `kindle --json capability` 返回 `ready: true` 为准。

<details>
<summary>Agent 执行要点（供 Agent 阅读）</summary>

1. 先识别当前操作系统，再运行对应安装脚本：Windows 运行 `scripts/bootstrap.ps1`，macOS 运行 `scripts/bootstrap.sh`（不要跨系统执行）。
2. 安装完成后检查 `kindle --json capability`；若未就绪，按 [`skills/kindle-setup/SKILL.md`](skills/kindle-setup/SKILL.md) 连续引导 QQ 邮箱、Amazon.com 可信发件人、测试投递与实机确认。
3. 测试邮件被服务商接收（`provider_accepted`）不等于部署完成；需等用户在 Kindle 上确认收到测试书后执行 `kindle --json confirm <jobId>`，直至 `kindle --json capability` 返回 `data.state: "ready"` 且 `data.ready: true`。

</details>

### 方式二：手动安装

克隆仓库后，在仓库根目录运行对应系统的安装脚本：

```powershell
# Windows
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap.ps1
```

```bash
# macOS
bash ./scripts/bootstrap.sh
```

脚本会为当前用户安装全局 `kindle` 命令及内置 Agent Skills。首次使用运行 `kindle setup` 完成配置，并在真实 Kindle / Kindle App 收到测试书后执行：

```bash
kindle --json confirm <jobId>
kindle --json capability
```

### 日常使用

配置完成后，可以直接让 Agent 调用 `$send-to-kindle`，或在终端运行：

```bash
# 预览校验（不实际发送）
kindle --json send "<文档绝对路径>" --dry-run

# 转换并投送到 Kindle
kindle --json send "<文档绝对路径>"
```

> 注：日常发送返回 `provider_accepted` 表示邮件服务商已接收邮件，具体送达时间取决于 Amazon Send-to-Kindle 同步延迟。

---

## CLI 命令

| 命令 | 说明 |
| --- | --- |
| `kindle capability` | 检查本机投送能力是否已 `ready` |
| `kindle setup` | 首次配置、重新授权与测试投递 |
| `kindle send <file>` | 转换、校验并发送文档到 Kindle |
| `kindle jobs [jobId]` | 查看历史投递任务状态 |
| `kindle confirm [jobId]` | 确认 Kindle 设备端已收到文档 |
| `kindle doctor` | 诊断本机环境、凭据与发送通道 |
| `kindle reset` | 清除当前用户的本地状态、加密凭据与任务历史 |

所有配置由 `kindle` CLI 统一维护，用户和 Agent 均无需手动编辑配置文件。

---

## 内置 Skills

仓库内置的 Agent Skills 位于 [`skills/`](skills)：

- [`kindle-for-agents`](skills/kindle-for-agents/SKILL.md)：主路由入口，根据本机状态自动分流首次配置与日常发送
- [`kindle-setup`](skills/kindle-setup/SKILL.md)：首次配置、授权与故障修复
- [`send-to-kindle`](skills/send-to-kindle/SKILL.md)：日常文档投送

<details>
<summary>历史版本兼容说明（kindle-bridge）</summary>

项目早期曾使用 `kindle-bridge` 作为名称。为平滑兼容已有安装：

- 内置保留了兼容路由 Skill [`kindle-bridge`](skills/kindle-bridge/SKILL.md) 以及旧命令别名（`connect` → `setup`、`status` → `jobs`）。
- 本地存储路径与钥匙串键名仍沿用 `kindle-bridge`，升级改名不会丢失已有配置、加密凭据或任务历史。

</details>

---

## 安全与隐私

- **凭据存储**：Windows 使用当前用户 DPAPI 加密保护；macOS 使用登录钥匙串（首次读写时系统可能弹出钥匙串授权提示）。
- **本地目录**：
  - 配置：Windows `%APPDATA%\kindle-bridge` ｜ macOS `~/Library/Application Support/kindle-bridge`
  - 缓存与任务：Windows `%LOCALAPPDATA%\kindle-bridge` ｜ macOS `~/Library/Caches/kindle-bridge`
- **交互边界**：Amazon 登录、OTP、验证码及 QQ 安全验证均只由用户在官方页面完成，不经由项目服务器中转。

---

## 本地开发

```bash
npm ci
npm run build
npm test
```

CI 会在 PR 和主分支更新时于 Windows（Node.js 22 / 24）上自动执行安装、构建、测试与打包检查（macOS 钥匙串路径目前通过模拟命令覆盖测试）。

---

## 问题反馈与许可

- 遇到安装、配置、转换或投送问题，请通过 [Bug 报告模板](https://github.com/haisean996/kindle-for-agents/issues/new?template=bug_report.yml) 提交；其他建议欢迎前往 [Issues](https://github.com/haisean996/kindle-for-agents/issues)。
- 提交前可运行 `kindle --json doctor` 辅助排查，**请务必先删除输出中的邮箱地址、本机用户名、文件路径与任务编号，切勿提交密码、授权码、OTP 或二维码等任何敏感凭据**。

本项目基于 [MIT License](LICENSE) 开源。

> 免责声明：Kindle for Agents 为非官方开源项目，与 Amazon 无隶属、赞助或背书关系。Kindle 是 Amazon.com, Inc. 或其关联公司的商标。

# Kindle for Agents

> 专为 Personal AI Agent 打造的本地优先 Kindle 投送原语（CLI + Skills）。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-LTS%20(22%2F24)-339933.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-lightgrey.svg)](#支持范围与前置条件)

它不是面向人类的电子书库管理软件，而是帮你打通“AI Agent 产出 → Kindle 无干扰深度阅读”最后一公里的能力底座：让你的 Agent 把调研报告、综合笔记或长篇总结（Markdown / TXT / HTML / EPUB）整理为可重排 EPUB，稳定推送到你的 Kindle 设备或 Kindle App。

---

## 为什么做它（以及它不是什么）

1. **面向 Agent 的确定性调用契约，而非人类图形界面**：提供纯净可解析的 `--json` 机器输出（参数置于子命令前后均可，过程日志绝不污染 `stdout`）、`capability` 就绪态检查，以及严格的 `provider_accepted`（邮件服务商已接收）与 `device_confirmed`（设备实机确认）状态边界——从源头避免 Agent 在对话中索要密码、明文落盘或虚报“设备已收到”。
2. **一次初始化、跨 Agent 共用、日常低维护**：将繁琐的 SMTP 授权与 Amazon 可信发件人核对收敛为本机一次性配置；凭据由系统级保护区（Windows DPAPI / macOS 登录钥匙串）隔离保存，无需自建或运维任何中转服务器；内置多宿主同步能力（`kindle skills install`），可自动将 Skills 分发至 `~/.agents/skills/` 及本机已安装的 `~/.claude/skills/`、`~/.gemini/config/skills/` 等目录。
3. **单一职责的轻量底座，与 Calibre 错位互补**：不引入重型浏览器自动化组件，仅保留文档解析转换（支持 Markdown GFM 表格、代码块与本地相对路径图片内嵌打包）、EPUB 结构校验与 SMTP 投递管线。它**不做本地书库管理、不做出版级复杂精排，也不试图替代 Calibre**。

> **适用与不适用说明**：如果你主要需要图形化管理电子书库、批量整理元数据或复杂排版转换，**Calibre（及其 CLI）仍是更好的选择**；本项目专门面向每天与 Personal Agent 深度协作、希望在对话结尾顺口说一句“发到我 Kindle”即可稳定送达的用户。

---

## 支持范围与前置条件

- **输入格式**：`.md`、`.txt`、`.html`、`.epub`（输出为可重排 EPUB；Markdown/HTML 支持 GFM 表格、代码块及本地相对路径图片自动打包）
- **操作系统**：Windows 10/11、macOS（需 Node.js LTS 22 / 24）
- **发件邮箱**：Agent 引导向导默认支持 QQ 邮箱（使用 SMTP 授权码）；手动运行 `kindle setup` 也支持 163、Gmail、Outlook 等自定义 SMTP 邮箱
- **Kindle 账户**：基于仍在正常运营的国际 Amazon Send-to-Kindle 邮箱通道（默认 `amazon.com`，可通过 [Amazon 管理内容与设备](https://www.amazon.com/hz/mycd/myx) 配置可信发件人，支持通过 `--region` 指定 `amazon.co.jp`、`amazon.co.uk`、`amazon.de` 等站点；**不支持已停运的中国区 `Amazon.cn`**）

---

## 快速开始

### 方式一：直接交给 AI Agent（推荐）

把下面这句话发给你的 Agent 即可自动完成安装与引导配置：

> 请克隆 `https://github.com/haisean996/kindle-for-agents`，阅读 README，并帮我部署 Kindle 投送能力。部署完成以 `kindle --json capability` 返回 `ready: true` 为准。

<details>
<summary>Agent 执行要点（供 Agent 阅读）</summary>

1. 先识别当前操作系统，再运行对应安装脚本：Windows 运行 `scripts/bootstrap.ps1`，macOS 运行 `scripts/bootstrap.sh`（不要跨系统执行）。
2. 安装脚本会自动安装全局 `kindle` 命令，并将 4 个内置 Skills 同步至 `~/.agents/skills/`（若本机存在 `~/.claude/skills/` 或 `~/.gemini/config/skills/` 也会自动同步）。
3. 安装完成后检查 `kindle --json capability`；若未就绪，按 [`skills/kindle-setup/SKILL.md`](skills/kindle-setup/SKILL.md) 连续引导 QQ 邮箱、Amazon 可信发件人（默认 `amazon.com`，可通过 `--region` 指定其他国际站点）、测试投递与实机确认。
4. 测试邮件被服务商接收（`provider_accepted`）不等于部署完成；需等用户在 Kindle 上确认收到测试书后执行 `kindle --json confirm <jobId>`，直至 `kindle --json capability` 返回 `data.state: "ready"` 且 `data.ready: true`。

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

脚本会为当前用户安装全局 `kindle` 命令，并将 4 个内置 Skills 同步到 `~/.agents/skills/`（若本机已安装 Claude Code / Gemini 等 Agent 宿主，也会自动同步至 `~/.claude/skills/` 与 `~/.gemini/config/skills/`）。首次使用可运行 `kindle setup` 进行通用 SMTP 配置（QQ 邮箱用户也可运行 `kindle setup --provider qq` 启动引导向导），并在真实 Kindle / Kindle App 收到测试书后执行：

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
| `kindle skills [install]` | 将内置 Skills 同步安装到本机已检测到的多个 Agent 宿主目录（支持 `--target`） |
| `kindle reset` | 清除当前用户的本地状态、加密凭据与任务历史 |

所有配置由 `kindle` CLI 统一维护，用户和 Agent 均无需手动编辑配置文件。全局选项 `--json` 和 `--debug` 放在子命令之前或之后均可识别（例如 `kindle --json capability` 与 `kindle capability --json` 等效）。

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
- 本地存储路径仍沿用 `kindle-bridge` 以保持向后兼容，升级改名不会丢失已有配置或任务历史；macOS 钥匙串服务名采用 `com.kindle-for-agents.smtp-credentials`。

</details>

---

## 安全与隐私

- **凭据存储**：Windows 使用当前用户 DPAPI 加密保护；macOS 使用登录钥匙串（首次读写时系统可能弹出钥匙串授权提示）。
- **本地目录**：
  - 配置：Windows `%APPDATA%\kindle-bridge` ｜ macOS `~/Library/Application Support/kindle-bridge`
  - 缓存与任务：Windows `%LOCALAPPDATA%\kindle-bridge` ｜ macOS `~/Library/Caches/kindle-bridge`
  - 临时转换目录：EPUB 转换产生的临时文件均隔离存放在系统缓存目录中（Windows `%LOCALAPPDATA%\kindle-bridge\temp` ｜ macOS `~/Library/Caches/kindle-bridge/temp`），不会污染你的当前工作目录。
- **交互边界**：Amazon 登录、OTP、验证码及 QQ 安全验证均只由用户在官方页面完成，不经由项目服务器中转。

---

## 卸载

如需完全移除本工具，可按以下步骤清理：

1. 运行 `kindle reset` 清除本地配置、加密凭据与任务历史。
2. 运行 `npm uninstall -g kindle-for-agents` 卸载全局 `kindle` 命令。
3. 删除 `~/.agents/skills/` 下对应的 4 个内置 Skill 目录（`kindle-for-agents`、`kindle-setup`、`send-to-kindle`、`kindle-bridge`）；若曾同步至其他 Agent 宿主目录，一并删除 `~/.claude/skills/` 与 `~/.gemini/config/skills/` 下的对应目录。

---

## 本地开发

```bash
npm ci
npm run build
npm test
```

GitHub Actions 会在 PR 和主分支更新时于 **Windows 与 macOS**（`windows-latest` & `macos-latest`，Node.js 22 / 24）双平台自动执行安装、构建、测试与 `npm pack --dry-run` 打包检查。

---

## 问题反馈与许可

- 遇到安装、配置、转换或投送问题，请通过 [Bug 报告模板](https://github.com/haisean996/kindle-for-agents/issues/new?template=bug_report.yml) 提交；其他建议欢迎前往 [Issues](https://github.com/haisean996/kindle-for-agents/issues)。
- 提交前可运行 `kindle --json doctor` 辅助排查，**请务必先删除输出中的邮箱地址、本机用户名、文件路径与任务编号，切勿提交密码、授权码、OTP 或二维码等任何敏感凭据**。

本项目基于 [MIT License](LICENSE) 开源。

> 免责声明：Kindle for Agents 为非官方开源项目，与 Amazon 无隶属、赞助或背书关系。Kindle 是 Amazon.com, Inc. 或其关联公司的商标。

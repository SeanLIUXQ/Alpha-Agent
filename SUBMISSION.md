# 提交材料清单

> 按题目 8.2 必填项整理。请在上传 GitHub 后补齐仓库链接、Demo 链接、视频链接和团队成员信息。

| 字段组 | 字段 | 本仓库材料位置 / 填写内容 |
| :-- | :-- | :-- |
| 基础信息 | 项目名称 / 课题 | 实现一个可以端到端交付全栈项目的“超级个体” |
| 基础信息 | 团队名称与成员名单 | 待填写：见 `document/submission-details.md` |
| 基础信息 | 分工说明（可选） | 待填写：见 `document/submission-details.md` |
| 功能说明 | 端到端使用流程 | `document/submission-details.md#端到端使用流程` |
| 交付材料 | 在线 Demo 链接（本地也行） | 本地默认：Workbench `http://localhost:5173`，API `http://localhost:3002`，Conduit `http://localhost:3000`；公开链接待填写 |
| 交付材料 | 演示视频链接 | 待填写；录制脚本见 `document/demo-recording-script.md` |
| 交付材料 | 源代码仓库链接 | 待填写；本目录包含 AI 系统主仓 + `apps/conduit-sandbox` Conduit fork 子仓源码 |
| 交付材料 | README / 运行说明 | `README.md`、`.env.example`、`apps/conduit-sandbox/.env.example`、`apps/conduit-sandbox/backend/.env.example` |
| 技术说明 | 系统架构图 | `document/architecture.md#system-diagram` |
| 技术说明 | 关键工程难点与解决方案 | `document/submission-details.md#关键工程难点与解决方案` |
| 技术说明 | 核心技术栈 | `document/submission-details.md#核心技术栈` |
| 结果说明 | 项目亮点 / 创新点 | `document/submission-details.md#项目亮点--创新点` |

## 材料目录

- `apps/web`：PM 工作台前端。
- `apps/server`：Node/Express API、事件流、PR 与 sandbox 接口。
- `packages/agent-core`：Clarify / Plan / Code / Review / Handoff Agents、Skill Registry、Orchestrator。
- `packages/context-engine`：Conduit 上下文检索与打包。
- `packages/model-provider`：Doubao Chat Completions 兼容调用。
- `packages/sandbox-runner`：真实 Conduit 仓库写入、命令白名单和验证。
- `apps/conduit-sandbox`：基于 Conduit RealWorld 的真实 sandbox 仓库源码。
- `document/`：架构、AI 使用记录、演示脚本、评测用例、工程说明。
- `artifacts/`：Workbench、可观测性、重放、Conduit 页面截图。

## 安全检查

已从上传目录排除 `.env`、API key、数据库、日志、`node_modules`、构建产物、`.git`、测试临时文件和原始题面文档。真实凭据只应保存在本地 `.env`，不要提交到 GitHub。

# 提交材料详情

## 基础信息

- 项目名称 / 课题：实现一个可以端到端交付全栈项目的“超级个体”
- 团队名称：Alpha-Agent
- 成员名单：刘新泉-香港大学-个人参赛
- 分工说明：前端 / 后端 / Agent / Skill / 上下文工程 / 测试 / 部署

## 端到端使用流程

1. PM 在 Workbench 中输入自然语言需求，例如“在文章详情页正文下方显示本文字数和预计阅读时间”。
2. 后端创建 Run，并由 Orchestrator 以事件溯源方式记录澄清、规划、编码、验证和交付阶段。
3. ClarifyAgent 将模糊需求结构化为 `RequirementDsl`；如需求缺少边界或自相矛盾，Run 会停在 `requires_input` 等待人工补充。
4. Skill Registry 根据 DSL 匹配可复用 Skill，例如文章派生指标、封面图字段、草稿流程或分享链接。
5. PlanAgent 输出实施方案和候选文件；Context Engine 只读取 Conduit sandbox 中与方案相关的文件。
6. CodeAgent 生成结构化 PatchSet，Sandbox Runner 将补丁写入真实 `apps/conduit-sandbox`，不是 mock 仓库。
7. Verification 执行白名单命令，例如 Conduit `npm run test` 与 `npm run build -w frontend`；失败时进入修复/复核链路。
8. HandoffAgent 汇总变更文件、验证结果、风险和 PR 文案；如启用 GitHub token，可继续创建 PR。

## Demo 与运行

- Workbench 本地地址：`http://localhost:5173`
- API 本地地址：`http://localhost:3002`
- Conduit 前端本地地址：`http://localhost:3000`
- 运行说明：见 `README.md`
- 录屏脚本：见 `document/demo-recording-script.md`
- P1 Demo Runbook：见 `document/p1-demo-runbook.md`
- 演示视频链接：https://drive.google.com/file/d/1945Hqs9i_q9GNwRZ2p4UZRCyEVkzKfpg/view?usp=sharing
- 公开仓库链接：https://github.com/SeanLIUXQ/Alpha-Agent.git

## 系统架构图

架构图见 `document/architecture.md#system-diagram`。该 Mermaid 图展示 Workbench 前端、Express API、SQLite Prisma Event Store、模型层、Skill Registry、Orchestrator、Context Engine、真实 Conduit sandbox、验证与 Memory Recall 的调用关系。

## 关键工程难点与解决方案

1. 上下文召回精度：没有把整个仓库粗暴塞给模型，而是由 Skill 候选文件、Plan 搜索提示、`rg` 检索和路径守卫共同形成 `PackedContext`，并记录每个文件被读取的理由。
2. Skill 抽象与可扩展性：需求模式以 Skill 模块注册，Skill 暴露 `match` 和 `plan` 能力；新增模式优先新增 `packages/agent-core/src/skills/*.ts`，避免改 Orchestrator 主流程。
3. 断点重放与可观测性：Run / RunEvent / ModelCall / Memory 持久化，前端可查看事件流、模型调用 tokens/延迟/失败信息，并通过 replay 从指定阶段生成新 Run。
4. 真实仓库写入与验证：Sandbox Runner 限制写入路径和命令白名单，补丁写入 `apps/conduit-sandbox` 后执行 Conduit 测试与前端构建，避免只展示模型输出。
5. 跨栈一致性：L2 `coverImage` 和草稿流程覆盖 Sequelize model/migration、API controller、前端 editor/list/detail 和样式，验证跨前后端链路。

## 核心技术栈

- 前端：React 18、Vite、TypeScript、SSE 事件流、Workbench UI。
- 后端：Node.js、Express 4、TypeScript、Prisma、SQLite 事件存储。
- AI / Agent：Doubao seed 2.0 lite 兼容 Chat Completions、ClarifyAgent、PlanAgent、CodeAgent、ReviewTestAgent、HandoffAgent、Skill Registry、Orchestrator。
- 上下文工程：ripgrep、文件候选集、路径守卫、按需打包上下文。
- Sandbox：Conduit RealWorld fork，React/Vite 前端、Express/Sequelize/PostgreSQL 后端、Vitest。
- 验证：TypeScript typecheck、ESLint、workspace build、Conduit `npm run test`、Conduit `npm run build -w frontend`。
- 部署 / 运行环境：Node.js 22+、npm workspaces、本地 SQLite、可选 PostgreSQL / Docker。

## 项目亮点 / 创新点

1. 抽象到位：需求模式通过 Skill 注册接入，已包含 L1 前端派生指标、L2 封面图跨栈字段、文章分享、草稿流程等模式。
2. 断点重放与过程留痕：Run 事件溯源、模型调用记录、Replay 和 AI 使用记录支撑答辩复盘。
3. 真实 Conduit 闭环：从 PM 输入到补丁写入、测试/构建验证和 PR handoff 的链路落在真实 `apps/conduit-sandbox`，不是纯聊天 UI。

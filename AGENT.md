# AGENT.md

## 项目定位

本项目目标是实现一个可以端到端交付全栈项目的 AI 超级个体。系统必须围绕真实 Conduit RealWorld 全栈仓库完成需求澄清、方案拆解、模块定位、代码生成、自动化验证和可提测交付。

## 硬性边界

- `document/alpha_agent_origin_doc.md` 是原始文档，不允许更改。
- 不允许把真实 API Key、EP、数据库密码、GitHub Token 或任何凭证写入代码、文档、测试快照或日志样例。
- 所有敏感配置必须通过 `.env` 注入，并在 `.env.example` 中只写变量名和占位说明。
- 不允许用与 Conduit 无关的 mock 仓库替代 `conduit-sandbox`。
- Agent 生成的代码必须写入真实 sandbox，并经过 lint、test、build 或等价验证后才能标记完成。
- 不允许只做套壳聊天 UI。前端、后端、AI 编排、sandbox 执行链路必须真实存在。
- 新增需求模式应通过 Skill 注册扩展，不能为了单个需求持续修改 Orchestrator 主干。
- 文件写入和命令执行必须限制在项目工作区和 sandbox 内，禁止越权访问系统目录。

## 技术选择

- 主系统使用 TypeScript + Node.js。
- 前端使用 React 18 + Vite。
- 后端使用 Express 或 Fastify，MVP 优先 Express。
- 持久化 MVP 使用 SQLite，P2 以后可迁移 PostgreSQL。
- ORM 推荐 Prisma。
- Schema 校验统一使用 Zod。
- 日志推荐 Pino，所有 run 必须有 `runId`。
- 模型主通道使用火山方舟 OpenAI Chat Completions 兼容接口。

## 工程原则

- 最小正确实现优先，先跑通闭环，再扩展亮点。
- 保留可审计痕迹：需求 DSL、计划、上下文、patch、测试日志、模型调用摘要都要落库或落 artifact。
- 上下文按需读取，禁止把整个仓库无差别塞给模型。
- 生成 patch 前必须读取目标文件，不能基于猜测修改文件。
- 自动修复最多 3 次，超过后必须失败并说明人工介入点。
- 任何跨栈字段变更必须同步考虑数据库 schema、Sequelize model、API serializer、前端表单、前端展示和测试。

## 验证要求

- L1 纯前端需求至少执行 `npm run test` 或仓库中等价测试命令。
- 涉及后端或数据库的需求必须执行后端测试和 migration 相关验证。
- 涉及前端构建链路的需求应执行 build 或类型/静态检查。
- 验证失败不得标记完成，必须进入修复或失败状态。

## 文档要求

- `document/goal.md` 是当前项目目标与技术蓝图，可持续更新。
- `document/alpha_agent_origin_doc.md` 只读保留，任何修改都视为违反项目边界。
- 关键架构、Prompt、Skill schema、演示脚本应沉淀到 `docs/` 或 `document/`。
- 文档中引用外部资料时保留 URL，方便后续直接获取原始资料。

## 默认目录约定

```text
apps/web                 # React + Vite 前端
apps/server              # Node 后端编排服务
apps/conduit-sandbox     # Conduit 实仓 sandbox
packages/agent-core      # Agent 与 Orchestrator
packages/skill-sdk       # Skill 接口与注册器
packages/model-provider  # Doubao/OpenAI 兼容模型客户端
packages/context-engine  # 上下文检索与打包
packages/sandbox-runner  # patch、命令、git 操作
packages/shared          # 公共类型与 schema
```

## 完成定义

一次需求 run 只有同时满足以下条件才算完成：

- 需求 DSL 已生成并通过 schema 校验。
- 计划说明了影响范围、目标文件、验证策略。
- 修改已应用到 Conduit sandbox。
- 验证命令已执行并记录结果。
- 最终输出包含变更摘要、测试结果、风险与后续建议。

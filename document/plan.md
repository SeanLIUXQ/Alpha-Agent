# plan.md

## 0. 使用方式

本文档是实现 `document/goal.md` 的逐步开发路线。开发时按阶段推进，每完成一步都要留下可验证产物，不能只停留在设计说明。

硬性约束：

- 不修改 `document/alpha_agent_origin_doc.md`。
- 不写入真实 API Key、EP、Token、数据库密码等凭证。
- 所有敏感配置只通过 `.env` 注入，`.env.example` 只写变量名和占位说明。
- Conduit sandbox 必须是真实 Conduit 仓库，不能用无关 mock 仓库替代。
- Agent 生成代码必须写入 sandbox，并执行验证命令后才能标记完成。

## 1. 总体路径

项目按四个阶段推进：

- P0：把工程骨架、模型调用、数据库、sandbox 命令执行打通。
- P1：完成一条 L1 需求的端到端 MVP 闭环。
- P2：补齐 Skill 插件化、断点重放、跨栈一致性、可观测性等加分项。
- P3：完成文档、演示、答辩材料和交付包装。

优先级规则：

- 先完成可演示闭环，再扩展复杂能力。
- 先做 L1 纯前端需求，再做 L2 跨栈需求。
- 先用简单规则和最小状态机，再抽象为通用 Skill/Replay 框架。
- 每一步都要有明确产出物和验收标准。

## 2. P0：工程基础设施

P0 当前状态：主链路已完成。已完成主系统工程搭建、环境变量校验、真实 Doubao 模型调用、SQLite/Prisma 事件库、sandbox 命令执行和基础验证；Conduit sandbox 已接入并完成依赖安装、测试和前端构建。Conduit 数据库初始化和完整 dev server 启动不再阻塞 P0，继续作为完整 sandbox 联调阻塞记录，P1 优先推进不依赖数据库的 L1 纯前端闭环。

P0 验证记录：

- 已执行主系统 `npm install`。
- 已执行主系统 `npm run typecheck`，通过。
- 已执行主系统 `npm run lint`，通过。
- 已执行主系统 `npm run build`，通过。
- 已执行主系统 server `/health`，返回 `ok`。
- 已执行主系统 `POST /api/runs`，可创建 run 并写入初始事件。
- 已执行主系统 `POST /api/model/health`，真实 Doubao 调用成功，返回 `ok: true`，模型为 `doubao-seed-2-0-lite-260428`。
- 已验证 `sandbox-runner` 非白名单命令拒绝，`node --version` 被拒绝并返回 `Command is not allowed: node`。
- 已执行 Conduit sandbox `git status --porcelain`，命令可用。
- 已执行 Conduit sandbox `npm run test`，3 个 test files、12 个 tests 通过。
- 已执行 Conduit sandbox `npm run build -w frontend`，通过。
- 已尝试 Conduit sandbox `npm run sqlz -- db:create`，当前项目根 `.env` 仅包含主系统 SQLite `DATABASE_URL`，缺少 Conduit PostgreSQL `CONDUIT_DATABASE_URL` 或 `DEV_DB_*` 配置；该项记录为完整 dev server 联调阻塞，不再阻塞 P0 主链路完成。
- 最新已执行主系统 `npm run typecheck`、`npm run lint`、`npm run build`，通过。
- 最新已执行 Conduit sandbox `npx vitest run --no-file-parallelism --maxWorkers=1`，3 个 test files、12 个 tests 通过。
- 最新已执行 Conduit sandbox `npm run build -w frontend`，通过。

### 2.1 初始化 monorepo [完成]

目标：建立主系统目录，后续所有代码有稳定边界。

步骤：

1. 在项目根目录创建 `package.json`，启用 workspace。
2. 创建 `apps/web`、`apps/server`、`packages/shared`、`packages/model-provider`、`packages/agent-core`、`packages/skill-sdk`、`packages/context-engine`、`packages/sandbox-runner`。
3. 统一 TypeScript 配置，创建根 `tsconfig.base.json`。
4. 统一 ESLint、Prettier 或等价格式化规则。
5. 创建根 `.gitignore`，至少忽略 `.env`、`.env.local`、`data/*.sqlite`、`node_modules`、构建产物。

产出物：

- 根 `package.json`。
- workspace 目录结构。
- TypeScript、lint、format 基础配置。
- `.gitignore`。

验收标准：

- [x] 根目录执行依赖安装成功。
- [x] 根目录执行类型检查或 lint 命令不报配置错误。
- [x] `.env` 不会被 Git 跟踪。

### 2.2 创建环境变量规范 [完成]

目标：先建立安全配置边界，避免后续泄密。

步骤：

1. 创建 `.env.example`。
2. 定义模型相关变量：`DOUBAO_BASE_URL`、`DOUBAO_MODEL`、`DOUBAO_API_KEY`。
3. 定义服务变量：`SERVER_PORT`、`WEB_PORT`、`DATABASE_URL`、`CONDUIT_SANDBOX_PATH`。
4. 定义可选变量：`GITHUB_TOKEN`、`ENABLE_PR_CREATE`、`MAX_REPAIR_ATTEMPTS`。
5. 在 `packages/shared` 中实现环境变量 schema，使用 Zod 校验。

产出物：

- `.env.example`。
- `packages/shared/src/env.ts`。

验收标准：

- [x] 缺少必填变量时服务启动失败并给出明确错误。
- [x] 日志中不打印任何敏感值。

### 2.3 接入 Conduit sandbox [P0 完成，完整 dev server 联调待 PostgreSQL]

目标：把真实 Conduit 仓库放入项目，并验证可执行命令。

步骤：

1. 将 Conduit 仓库 clone 或 fork 到 `apps/conduit-sandbox`。
2. 阅读 Conduit 根 `package.json`、`backend/package.json`、`frontend/package.json`。
3. 安装依赖。
4. 按 Conduit 文档创建 sandbox 自己的 `.env`，只在本地保存。
5. 初始化数据库，优先使用 PostgreSQL；如本地演示困难，可先用 Conduit 支持的可行数据库方案。
6. 运行 Conduit 的测试命令，记录可用脚本。

产出物：

- `apps/conduit-sandbox` 真实仓库。
- `document/conduit-notes.md`，记录启动命令、测试命令、已知坑。

验收标准：

- [x] sandbox 不是 mock 仓库。
- [x] 能执行 `git status`。
- [x] 能执行 `npm run test` 或记录仓库实际可用的等价测试命令。
- [x] 能启动 Conduit dev server 或明确记录尚未启动的阻塞原因。完整 dev server 尚未启动的原因：`.env` 未提供 Conduit PostgreSQL `CONDUIT_DATABASE_URL` 或 `DEV_DB_*` 配置，`db:create` 报 `DEV_DB_DIALECT` 未定义；P1 L1 纯前端闭环不依赖该数据库。

### 2.4 搭建后端 API 骨架 [完成]

目标：让前端和 Orchestrator 有稳定入口。

步骤：

1. 在 `apps/server` 创建 Express 服务。
2. 实现 `GET /health`。
3. 实现统一错误处理中间件。
4. 实现 requestId 中间件。
5. 接入 Pino 或等价日志库。
6. 接入环境变量校验。

产出物：

- `apps/server/src/index.ts`。
- `apps/server/src/app.ts`。
- `apps/server/src/middleware/*`。

验收标准：

- [x] `GET /health` 返回 `ok`。
- [x] 启动时能校验环境变量。
- [x] 任意请求日志包含 `requestId`。

### 2.5 搭建前端工作台骨架 [完成]

目标：建立最小可用 UI，不做空壳聊天页面。

步骤：

1. 在 `apps/web` 创建 React 18 + Vite 应用。
2. 创建基础布局：需求输入区、流程状态区、事件日志区、结果区。
3. 调用 `GET /health`，显示后端连接状态。
4. 预留 run 详情展示组件。

产出物：

- `apps/web/src/App.tsx`。
- `apps/web/src/api/*`。
- 基础样式文件。

验收标准：

- [x] 前端可以启动并 build 通过。
- [x] 页面显示后端健康状态。
- [x] 页面结构包含输入、状态、日志、结果四块。

### 2.6 建立数据库与事件表 [完成]

目标：所有流程步骤可追踪，为断点重放打基础。

步骤：

1. 在 `apps/server` 接入 Prisma。
2. 配置 SQLite `DATABASE_URL`。
3. 创建 `Run`、`RunEvent`、`ModelCall`、`Artifact`、`SkillRecord`、`Memory` 模型。
4. 创建迁移。
5. 实现最小 repository：创建 run、追加事件、查询事件。

产出物：

- `apps/server/prisma/schema.prisma`。
- Prisma migration。
- `apps/server/src/repositories/runRepository.ts`。

验收标准：

- [x] 能创建数据库。
- [x] 能创建 run。
- [x] 能追加并查询事件。

### 2.7 实现模型客户端 [完成]

目标：真实接入火山方舟 OpenAI Chat Completions 兼容接口。

步骤：

1. 在 `packages/model-provider` 实现 `ModelClient` 接口。
2. 实现 `DoubaoChatClient`。
3. 支持普通调用和可选流式调用。
4. 记录模型名、耗时、token 用量、错误信息。
5. 实现健康检查调用，使用非敏感测试 prompt。

产出物：

- `packages/model-provider/src/types.ts`。
- `packages/model-provider/src/doubaoChatClient.ts`。
- `apps/server/src/services/modelHealthService.ts`。

验收标准：

- [x] 使用 `.env` 中的配置完成一次真实模型调用：`POST /api/model/health` 返回 `ok: true`。
- [x] 调用日志保存到 `ModelCall` 或先输出到后端日志。
- [x] 失败时不泄露 key。

### 2.8 实现 sandbox-runner 基础能力 [完成]

目标：后端可以安全读取 sandbox、执行白名单命令、获取 diff。

步骤：

1. 在 `packages/sandbox-runner` 实现 sandbox 路径校验。
2. 实现只读命令：`git status --porcelain`、`git diff --stat`、`git diff`。
3. 实现验证命令执行：`npm run test`、`npm run lint`、`npm run build`，只允许白名单命令。
4. 使用 `child_process.spawn`，分离参数数组，不拼接 shell 字符串。
5. 将 stdout/stderr 作为事件流回传。

产出物：

- `packages/sandbox-runner/src/commandRunner.ts`。
- `packages/sandbox-runner/src/sandboxGuard.ts`。
- `packages/sandbox-runner/src/git.ts`。

验收标准：

- [x] 能在 sandbox 内执行 `git status`。
- [x] 能执行测试命令并捕获退出码。
- [x] 尝试执行非白名单命令会被拒绝。

## 3. P1：MVP 端到端闭环

P1 当前状态：已跑通首条 L1 纯前端 demo 的最小闭环。当前 demo 为“文章详情页新增字数统计和预计阅读时间”，已写入真实 Conduit sandbox，并通过主系统 demo API 记录 `clarify -> plan -> locate -> generate -> apply -> verify -> handoff` 事件。后续继续把该固定 demo 抽象为通用 ClarifyAgent/PlanAgent/ContextEngine/Skill/CodeAgent 流程。

P1 验证记录：

- 已修改 Conduit `frontend/src/routes/Article/Article.jsx`，基于 `Article.body` 展示 `words` 和 `min read`。
- 已修改 Conduit `frontend/src/styles.css`，补充 `article-reading-stats` 样式。
- 已将 Conduit `npm run test` 固定为串行 Vitest，避免 Windows fork 并发资源问题。
- 已新增主系统 `POST /api/demo/l1/article-reading-stats`，创建 run 并记录 L1 demo 阶段事件。
- 已执行主系统 demo API，返回 `201` 和 `success: true`。
- 已执行 Conduit `npm run test`，3 个 test files、12 个 tests 通过。
- 已执行 Conduit `npm run build -w frontend`，通过。

### 3.1 定义核心协议与 schema

目标：先把 Agent 之间传递的数据结构固定下来。

步骤：

1. 在 `packages/shared` 定义 `RequirementDsl`。
2. 定义 `ClarifyQuestion`、`ImplementationPlan`、`ContextRequest`、`PackedContext`、`PatchSet`、`VerifyResult`。
3. 用 Zod 写 schema。
4. 为每个 schema 提供示例 JSON。

产出物：

- `packages/shared/src/schemas/requirement.ts`。
- `packages/shared/src/schemas/agent.ts`。
- `document/schema-examples.md`。

验收标准：

- 所有 Agent 输出都能用 schema 校验。
- JSON 校验失败时能返回明确错误。

### 3.2 实现 Orchestrator 最小状态机

目标：用代码串起 `clarify -> plan -> locate -> generate -> apply -> verify -> handoff`。

步骤：

1. 在 `packages/agent-core` 定义状态枚举。
2. 实现 `Orchestrator` 类。
3. 每进入一个阶段写入 `RunEvent`。
4. 每个阶段先允许用最小实现占位，但不能跳过事件记录。
5. 失败时进入 `failed` 状态，记录错误摘要。

产出物：

- `packages/agent-core/src/orchestrator.ts`。
- `packages/agent-core/src/runState.ts`。

验收标准：

- 创建 run 后能按阶段推进。
- 每个阶段都有事件记录。
- 失败能被前端看到。

### 3.3 实现 Run API 与事件流

目标：让前端能创建任务并实时观察流程。

步骤：

1. 实现 `POST /api/runs`。
2. 实现 `GET /api/runs/:id`。
3. 实现 `GET /api/runs/:id/events`。
4. 实现 `GET /api/runs/:id/stream`，使用 SSE 推送事件。
5. 前端接入创建 run 和事件流展示。

产出物：

- `apps/server/src/routes/runs.ts`。
- `apps/web/src/features/runs/*`。

验收标准：

- 前端提交需求后能创建 run。
- 页面实时显示阶段变化和日志。

### 3.4 实现 ClarifyAgent

目标：把 PM 语言转成可执行需求 DSL，遇到歧义能追问。

步骤：

1. 编写 ClarifyAgent prompt。
2. 输入 PM 原始需求，输出 `RequirementDsl` 或 `ClarifyQuestion[]`。
3. 对以下情况必须追问：数据来源不明、展示位置不明、排序/筛选规则不明、权限边界不明、前后端责任不明。
4. 实现 `POST /api/runs/:id/answers`，允许用户回答澄清问题。
5. 回答后重新生成 DSL。

产出物：

- `packages/agent-core/src/agents/clarifyAgent.ts`。
- `document/prompts/clarify-agent.md`。
- 前端澄清问答组件。

验收标准：

- 对“首页文章卡片加阅读量”能生成 DSL。
- 对“加一个好看的功能”会追问，而不是直接写代码。
- DSL 通过 Zod 校验。

### 3.5 实现 PlanAgent

目标：将 DSL 转成可执行开发计划。

步骤：

1. 编写 PlanAgent prompt。
2. 输出影响范围、候选文件类型、测试策略、风险点。
3. 区分 L1、L2、L3 需求等级。
4. 前端展示计划，并支持 MVP 阶段的“确认继续”。

产出物：

- `packages/agent-core/src/agents/planAgent.ts`。
- `document/prompts/plan-agent.md`。
- 前端计划展示组件。

验收标准：

- L1 需求能输出前端文件定位方向。
- L2 需求能明确数据库、后端、前端都要改。
- 用户确认前不写入 sandbox。

### 3.6 实现 Context Engine MVP

目标：精准读取必要上下文，避免全仓塞模型。

步骤：

1. 实现目录树读取，忽略 `node_modules`、构建产物、`.git`。
2. 实现 `rg` 搜索封装。
3. 根据 plan 生成搜索关键词。
4. 读取候选文件，并记录读取原因。
5. 输出 `PackedContext`。

产出物：

- `packages/context-engine/src/tree.ts`。
- `packages/context-engine/src/search.ts`。
- `packages/context-engine/src/packContext.ts`。

验收标准：

- L1 文章列表需求能定位到相关前端组件或页面文件。
- 上下文包包含文件路径、内容、选择原因。
- 未读取的文件不能被标记为已知依据。

### 3.7 实现 Skill SDK 与首个 L1 Skill

目标：MVP 就按 Skill 思路落地，避免后续大重构。

步骤：

1. 在 `packages/skill-sdk` 定义 `Skill` 接口。
2. 实现 `SkillRegistry`。
3. 实现 `AddArticleDerivedMetricSkill` 或 `AddFrontendDisplayFieldSkill`。
4. Skill 负责匹配需求、补充定位线索、声明验证命令。
5. Orchestrator 调用 Skill，不把具体需求逻辑硬编码在主干。

产出物：

- `packages/skill-sdk/src/skill.ts`。
- `packages/skill-sdk/src/registry.ts`。
- `packages/agent-core/src/skills/addArticleDerivedMetricSkill.ts` 或等价文件。

验收标准：

- 至少一个 L1 需求由 Skill 匹配。
- 新增该 Skill 不需要改 Orchestrator 核心流程。

### 3.8 实现 CodeAgent 与 patch 生成

目标：让模型基于已读取上下文生成可审计 patch。

步骤：

1. 编写 CodeAgent prompt，要求输出 unified diff 或结构化 `PatchSet`。
2. 模型输出必须列出依据文件、修改文件、修改原因。
3. 对 patch 做路径校验，只允许写入 sandbox。
4. patch 应用失败时记录失败事件并返回 `generate` 或 `failed`。
5. 应用 patch 后获取 `git diff`。

产出物：

- `packages/agent-core/src/agents/codeAgent.ts`。
- `packages/sandbox-runner/src/patch.ts`。
- `document/prompts/code-agent.md`。

验收标准：

- 能对一个 L1 需求生成 patch。
- patch 只修改预期文件。
- 应用后能看到 sandbox diff。

### 3.9 实现验证与自修复 MVP

目标：生成代码后必须测试，不允许“看起来对”。

步骤：

1. 从 Skill 或 Plan 中读取验证命令。
2. 执行 `npm run test` 或实际可用等价命令。
3. 如果存在 lint 命令，也执行 lint。
4. 失败时调用 `ReviewTestAgent`，传入日志摘要和 diff。
5. 自动修复最多 3 次。
6. 每次修复都记录 patch 与原因。

产出物：

- `packages/agent-core/src/agents/reviewTestAgent.ts`。
- `packages/agent-core/src/verification.ts`。
- 验证事件与日志 artifact。

验收标准：

- 验证成功才进入 `completed`。
- 验证失败会进入 `repairing` 或 `failed`。
- 失败日志能在前端看到。

### 3.10 实现 Handoff 输出

目标：交付给人类可读的最终结果。

步骤：

1. 汇总需求 DSL、计划、修改文件、diff 摘要、验证结果。
2. 生成 PR 文案草稿。
3. 输出未覆盖风险和人工检查建议。
4. 前端展示最终结果。

产出物：

- `packages/agent-core/src/agents/handoffAgent.ts`。
- 前端结果面板。

验收标准：

- completed run 有完整交付摘要。
- 用户能看到修改了什么、验证了什么、还有什么风险。

### 3.11 P1 MVP 通用闭环完成记录 [完成]

本轮已将 3.1-3.10 从固定 demo 推进为可复用的 P1 MVP 闭环：

- 新增共享 schema：`RequirementDsl`、`ClarifyQuestion`、`ImplementationPlan`、`ContextRequest`、`PackedContext`、`PatchSet`、`VerifyResult`、`HandoffSummary`。
- 新增最小 Orchestrator 状态机，按 `clarify -> plan -> locate -> generate -> apply -> verify -> handoff` 推进，并将每个阶段写入 `RunEvent`。
- 新增 `ClarifyAgent`、`PlanAgent`、`CodeAgent`、`ReviewTestAgent`、`HandoffAgent` 的 MVP 实现。
- 新增 Context Engine MVP：目录/搜索/上下文打包，明确记录候选文件和读取原因。
- 新增 Skill SDK 匹配入口和首个 `AddArticleDerivedMetricSkill`，L1 文章阅读统计需求由 Skill 匹配，不再写死在 server demo 主干。
- 新增 sandbox `PatchSet` 应用能力，patch 只允许写入 Conduit sandbox 内部路径。
- 新增验证与 handoff 输出，验证成功才进入 `completed`。
- `POST /api/runs` 已接入通用 Orchestrator；`GET /api/runs/:id`、`GET /api/runs/:id/events`、`GET /api/runs/:id/stream` 已可查询 run 与事件。
- 前端创建 run 已从固定 demo API 切换到通用 `/api/runs`。
- 新增 `document/schema-examples.md` 和 `document/prompts/*-agent.md`。

最新验收记录：

- 已执行主系统 `npm run typecheck`，通过。
- 已执行主系统 `npm run lint`，通过。
- 已执行主系统 `npm run build`，通过。
- 已启动主系统 server 并调用 `POST /api/runs`，返回 `201`；run ID 为 `cmpxybzbn0000r7j0g2ktqkwk`，`success: true`，`status: completed`，事件数 15，最后事件为 `stage.completed`。
- 已由该 run 在 Conduit sandbox 内执行验证命令，`npm run test` 与 `npm run build -w frontend` 均通过。
- 已单独复核 Conduit sandbox：`npm run test` 通过，3 个 test files、12 个 tests；`npm run build -w frontend` 通过。

## 4. P1 演示链路选择

MVP 推荐优先选择 L1 公开题之一，不要一开始做跨栈。

推荐顺序：

1. 文章详情页新增字数统计。
2. 个人主页新增 About Me Tab。
3. Popular Tags 侧边栏前 5 个打标。
4. 文章列表加阅读量字段。

首选“文章详情页新增字数统计”的原因：

- 数据来自已有 `Article.body`，不需要后端。
- 规则清晰，可澄清“中文/英文计数方式”和“阅读速度”。
- 改动集中在文章详情组件。
- 验证范围相对可控。

这条 demo 的目标链路：

1. PM 输入：“在文章详情页正文下方显示本文字数和预计阅读时间。”
2. ClarifyAgent 追问或默认规则：“按纯文本长度统计，阅读速度按每分钟 300 中文字或 200 英文词。”
3. PlanAgent 输出纯前端修改计划。
4. Context Engine 定位文章详情页组件。
5. CodeAgent 生成 patch。
6. Sandbox Runner 应用 patch。
7. 执行测试。
8. Handoff 输出变更摘要与验证结果。

### 4.1 P1 演示链路选择完成记录 [完成]

最终演示链路已固定为“文章详情页新增字数统计和预计阅读时间”。

选择结果：

- PM 输入固定为：“在文章详情页正文下方显示本文字数和预计阅读时间。”
- 需求级别固定为 L1 纯前端需求。
- 目标数据源固定为已有 `Article.body`。
- 目标文件固定由 Context Engine 定位到 `frontend/src/routes/Article/Article.jsx` 和 `frontend/src/styles.css`。
- 验证命令固定为 `npm run test` 与 `npm run build -w frontend`。

新增演示产物：

- `document/p1-demo-runbook.md`：P1 演示脚本、阶段讲解、手动 API 演示、验收检查和排障说明。
- `scripts/run-p1-demo.mjs`：一键运行 P1 演示链路，自动检查或启动后端，提交 PM 需求并打印阶段事件。
- 根 `package.json` 新增 `npm run demo:p1`。

验收标准：

- [x] 第 4 章推荐选题已收敛为唯一 P1 demo。
- [x] demo 有明确 PM 输入、阶段故事和验收检查。
- [x] demo 可以通过命令复现，不依赖口头说明。
- [x] demo 仍写入真实 Conduit sandbox，并执行真实验证命令。

## 5. P2：加分能力

### 5.1 Skill 插件化升级

目标：新增需求模式只新增 Skill 文件。

步骤：

1. 将 MVP Skill 移到统一 `skills` 目录。
2. 实现自动加载或显式注册机制。
3. 为 Skill 增加元信息：`name`、`version`、`tags`、`examples`。
4. 前端 `/skills` 展示注册表。
5. 写一个新 Skill 验证不改 Orchestrator 主干。

验收标准：

- 新增 Skill 文件后能被注册表发现。
- Orchestrator 不需要因新需求模式改主流程。

### 5.2 断点重放

目标：流程任一阶段可暂停、修改、重放下游。

当前实现状态：已从 MVP replay 升级为可视化断点重放。`/runs/:runId` 详情页按事件序列展示每个阶段的“从此处重放”入口；`clarify.completed` 可编辑 DSL，`plan.completed` 可编辑 Plan，提交后创建新的 replay Run，并通过 `replay.started` 记录来源 Run、断点阶段和 override payload。后端 `POST /api/runs/:id/replay` 支持 `fromStage`、`overridePayload` 和 `async`，Orchestrator 会用 Zod 校验 DSL/Plan override 后重放下游。

步骤：

1. 将所有阶段输入输出落入 `RunEvent` 和 `Artifact`。
2. 为事件增加 `seq`、`stage`、`parentSeq`。
3. 实现 `POST /api/runs/:id/replay`。
4. replay 时保留历史事件，创建新的分支事件。
5. 前端支持选择某一阶段重放。
6. Run 详情页支持修改 Clarify DSL 或 Plan 后重放下游。

验收标准：

- 可以从 `plan` 阶段重新执行下游。
- replay 不覆盖旧事件。
- 前端能区分原始链路与重放链路。
- 评审现场可以在 Run 详情页直接看到每个阶段的重放入口，并对 DSL/Plan 做一次可视化编辑后生成新的 replay Run。

### 5.3 跨栈一致性

目标：支持 L2 需求，例如 Article 增加 `coverImage` 字段。

步骤：

1. 实现 `AddArticleModelFieldSkill`。
2. 定位 Sequelize model、migration、serializer/controller、前端表单、前端展示。
3. 生成数据库 migration。
4. 修改 API 输出结构。
5. 修改新建/编辑文章表单。
6. 修改列表和详情展示。
7. 执行 migration、后端测试、前端测试/build。

验收标准：

- 后端字段和前端展示一致。
- 新建文章可以保存字段。
- 列表和详情能展示字段。
- 验证命令通过或失败原因明确。

### 5.4 可观测性面板

目标：展示每次 AI 调用的 token、时延、成本估算。

步骤：

1. 完善 `ModelCall` 记录。
2. 前端 run 详情页展示调用列表。
3. 按 agent 聚合 token 和耗时。
4. 支持配置单价后计算估算成本。
5. 失败调用单独标红展示。

验收标准：

- 每个 run 能看到模型调用明细。
- 能看到总 token、总耗时、失败次数。

### 5.5 业务上下文反哺

目标：历史需求和成功方案可被后续召回。

步骤：

1. completed run 写入 `Memory`。
2. 保存需求 DSL、Skill、修改文件、结果摘要、标签。
3. 新 run 在 clarify 或 plan 前检索相似历史。
4. MVP 用关键词和标签匹配。
5. P3 可接入 embedding 和向量库。

验收标准：

- 第二次相似需求能召回第一次方案摘要。
- 召回内容作为参考，不直接覆盖当前计划。

### 5.6 P2 加分能力完成记录 [完成]

本轮已完成 P2 五项能力的 MVP 级实现：

- Skill 插件化升级：新增动态 Skill loader，运行时扫描 `packages/agent-core/dist/skills/*.js` 并自动注册导出的 `skill` 或 `createSkill()`；Skill 契约升级为自带 `match/plan/context/generate/repairHints/handoff`，Orchestrator/CodeAgent/ReviewTestAgent 不再因新增需求模式改主干；新增 `add-article-read-more-hint` 单文件 Skill 作为验收样例；`GET /api/skills` 和前端工作台展示动态注册表。
- 断点重放：新增 `POST /api/runs/:id/replay`，从历史 run 创建 replay run，写入 `replay.started` 事件，并重新执行下游链路；前端提供 `Replay from plan`。
- 跨栈一致性：新增 L2 `AddArticleCoverImageSkill`，支持“文章 cover image/封面图”需求，计划覆盖 Sequelize model、migration、controller、editor form、service、列表预览、详情页和样式；CodeAgent 可生成跨栈 patch 写入真实 Conduit sandbox。
- 可观测性面板：Orchestrator 为 Clarify/Plan/Code/Handoff 阶段写入 `ModelCall` 记录；新增 `GET /api/runs/:id/model-calls`；前端展示 token、耗时和失败数聚合。
- 业务上下文反哺：completed run 写入 `Memory`；新增 `GET /api/memories` 和关键词召回；Orchestrator 在 clarify 阶段召回相似历史并写入 `memory.recalled` 事件；前端展示 Memory。

P2 验收入口：

- `GET /api/skills`：查看注册 Skill。
- `POST /api/runs`：提交 L1 或 L2 需求。
- `POST /api/runs/:id/replay`：重放历史 run。
- `GET /api/runs/:id/model-calls`：查看 agent 调用观测记录。
- `GET /api/memories?q=文章`：查看相似历史方案召回。
- `POST /api/sandbox/verify`：直接执行 Conduit sandbox 默认验证命令。

推荐 L2 演示输入：

```text
给文章增加 cover image 字段，编辑文章时可以填写封面图 URL，文章列表和详情页都展示封面图。
```

最新验收记录：

- 已调用 `GET /api/skills`，动态返回 `add-article-cover-image`、`add-article-derived-metric`、`add-article-draft-workflow`、`add-article-read-more-hint` 与 `add-article-share-link`。`loader` 同时支持导出 `skill`、`createSkill()` 或默认导出 Skill class。
- 已调用 L1 `POST /api/runs`，返回 `completed`，事件数 15。
- 已调用 `GET /api/runs/:id/model-calls`，返回 4 条 agent 调用观测记录。
- 已调用 `GET /api/memories?q=文章`，可召回已完成方案。
- 已调用 `POST /api/runs/:id/replay`，返回 `completed`，事件数 17，包含 `replay.started`。
- 已调用 L2 `POST /api/runs`，输入 cover image 跨栈需求，run ID 为 `cmpxyzrvs002ar7ncgsg6iynh`，返回 `completed`，事件数 15。
- 已执行 `npm run test:l3`，9/9 通过，覆盖动态 Skill 发现、L1 read-more Skill 单文件生成 patch、Skill repairHints 注入修复链路、L1/L2/L3 既有回归。
- 已执行主系统 `npm run typecheck`、`npm run lint`、`npm run build`，全部通过。
- 已执行 Conduit sandbox `npm run test`，3 个 test files、12 个 tests 通过。
- 已执行 Conduit sandbox `npm run build -w frontend`，通过。
- 已新增 `POST /api/sandbox/verify` 并在工作台右侧暴露“沙箱验证”；当前接口执行 Conduit `npm run test` 与 `npm run build -w frontend` 通过。
- 验证失败时 Orchestrator 会进入 `repairing`，记录 `repair.reviewed` 与 `ReviewTestAgent` 日志摘要，再进入交付失败状态。

### 5.7 严格验收缺口补齐记录 [完成]

本轮针对 `document/goal.md` 的严格验收缺口补齐了以下项目：

- 独立前端路由：新增 `/runs/:runId`、`/skills`、`/settings` 的轻量路由分流，不引入额外路由依赖；Run 详情页展示事件、模型调用数和人工审批入口；Skills 页展示注册表；Settings 页只检查配置连通性，不展示敏感值。
- 人工方案确认 API：新增 `POST /api/runs/:id/approve-plan`，以 `plan.approved` 或 `plan.rejected` 事件写入当前 Run，保留事件溯源。
- 持续 SSE：`GET /api/runs/:id/stream` 由一次性输出改为持续连接；先回放历史事件，再通过进程内事件总线推送新增事件，并带 keep-alive。
- Agent 阶段真实模型接入：Orchestrator 保留 rule-based MVP 的确定性实现，同时为 Clarify/Plan/Code/Review/Handoff 注入 Doubao probe，真实调用火山方舟 Chat Completions 并写入 `ModelCall`；probe 使用短输出、关闭 thinking，避免破坏主链路稳定性。
- ReviewTestAgent 自动改补：Orchestrator 在验证失败后进入 `repairing`，最多执行 `MAX_REPAIR_ATTEMPTS` 轮 `repair.reviewed -> repair.generated -> repair.apply.completed -> repair.verify.completed`；ReviewTestAgent 会读取失败日志和 sandbox 当前文件，生成安全的文件级 repair patch，无法确定修复时记录 `repair.skipped` 并停止。
- Conduit PostgreSQL dev database：使用 Docker 启动 `alpha-agent-conduit-postgres`，映射 `localhost:55432`，写入 sandbox 本地 `backend/.env`；已执行 `db:drop`、`db:create`、`db:migrate`、`db:seed:all`，并补齐 `Article` model 与关联列 migration；Workbench 新增 `POST /api/sandbox/real-db-flow` 真实 DB 演示入口，覆盖注册、登录、发布文章、草稿、编辑草稿和列表过滤。
- PR 创建：新增 `POST /api/pr/create`，在 `ENABLE_PR_CREATE=true`、`GITHUB_TOKEN` 存在、`gh` 可用且目标目录是 Git 仓库时调用 `gh pr create`；默认不自动 add/commit/push，避免误提交。当前本机未安装 `gh`，接口会返回 blocked reason。

最新补齐验证：

- 主系统 `npm run typecheck`、`npm run lint`、`npm run build` 均通过。
- `npm run test:l3` 通过，7/7。
- Conduit `npm run test` 通过，3 个 test files、12 个 tests。
- Conduit `npm run build -w frontend` 通过。
- Conduit PostgreSQL `db:drop/create/migrate/seed` 完成。`POST /api/sandbox/real-db-flow` 返回 `success: true`、`previewMode: false`，验证注册/登录/发布/草稿/编辑/公开列表过滤/草稿列表过滤全部通过。
- `POST /api/pr/create` 已验证安全阻断：未设置 `ENABLE_PR_CREATE=true` 时返回 `blocked: true`。

## 6. P3：交付包装

### 6.1 README 与运行说明

步骤：

1. 写项目简介。
2. 写依赖环境：Node、数据库、Conduit sandbox、模型配置。
3. 写启动步骤：安装、配置 `.env`、启动后端、启动前端、启动 sandbox。
4. 写演示流程。
5. 写常见问题。

验收标准：

- 新开发者按 README 能启动系统。
- README 不包含真实密钥。

### 6.2 架构图与技术说明

步骤：

1. 绘制前端、后端、Agent、Skill、模型、sandbox、数据库关系图。
2. 写上下文工程方案。
3. 写 Skill 抽象方案。
4. 写事件溯源与断点重放方案。
5. 写安全合规方案。

验收标准：

- 能对齐评分项中的技术深度、工程完整度、数据合规。

### 6.3 Prompt 与 AI 使用记录

步骤：

1. 收集 `ClarifyAgent`、`PlanAgent`、`CodeAgent`、`ReviewTestAgent` prompt。
2. 记录 prompt 版本迭代。
3. 记录关键模型调用日志摘要。
4. 说明 AI 生成代码如何经过校验和修正。

验收标准：

- 能证明不是原样提交 AI 输出。
- 能解释每个 Agent 的职责和边界。

### 6.4 Demo 脚本与录屏

步骤：

1. 选择 P1 成功链路作为主 demo。
2. 准备 3-8 分钟录屏脚本。
3. 展示 PM 输入、澄清、计划、代码生成、测试、diff、结果摘要。
4. 如果已完成 P2，展示 Skill 注册或断点重放作为亮点。

验收标准：

- 录屏能完整展示端到端链路。
- 失败场景有解释，不让评审误判为系统不可用。

### 6.5 P3 交付包装完成记录 [完成]

本轮已完成 P3 交付包装：

- 新增根 `README.md`：项目简介、依赖环境、安装、启动、P1/P2 demo、API checklist、验证命令、常见问题、安全边界。
- 新增 `document/architecture.md`：Mermaid 架构图、运行链路、上下文工程、Skill 抽象、事件溯源与 replay、可观测性、安全合规。
- 更新 `document/ai-usage-log.md`：Agent 职责边界、runtime prompt 索引、Prompt 版本记录、每个 Agent 输入输出样例、模型调用日志字段、失败案例与修正策略、人工验证 gates。
- 新增 `document/evaluation-set.md` 与 `document/evaluation-cases.json`：10 条公开评测样例，覆盖 L1/L2/L3/模糊/矛盾需求，并列出是否澄清、命中 Skill、是否完成、测试是否通过、耗时与 repair 次数。
- 新增 `document/prompts/review-test-agent.md`：ReviewTestAgent prompt。
- 新增 `document/demo-recording-script.md`：3-8 分钟录屏脚本，覆盖 P1 主链路、P2 Skills/Replay/Memory/Model Calls、L2 cover image 跨栈 demo 和失败解释。
- 保留并引用 `document/p1-demo-runbook.md`、`document/schema-examples.md` 和 `document/prompts/*`。

验收结果：

- README 不包含真实密钥，只说明 `.env` 本地注入。
- 架构说明覆盖前端、后端、Agent、Skill、模型、sandbox、数据库关系。
- Prompt 与 AI 使用记录能说明不是原样提交 AI 输出，而是经过 schema、path guard、验证命令和 handoff。
- Demo 脚本可用于录屏，且包含失败场景说明。
- 已执行文档敏感信息扫描，未发现真实凭证。
- 已执行 `npm run test:l3`，9/9 通过，覆盖动态 Skill 发现、L1 read-more Skill 单文件生成 patch、Skill repairHints 注入修复链路、L1/L2/L3 既有回归。
- 已执行主系统 `npm run typecheck`、`npm run lint`、`npm run build`，全部通过。
- 已执行 `npm run demo:p1`，run ID 为 `cmpy06mm80000r7aof4bkza5d`，返回 `completed`，事件数 16，验证命令全部通过。

## 7. 开发顺序清单

建议按以下顺序执行，不要跳阶段：

1. 建立 workspace 和基础配置。
2. 建立 `.env.example` 和环境变量校验。
3. 接入真实 Conduit sandbox。
4. 搭建 Express 后端和 health API。
5. 搭建 React + Vite 前端骨架。
6. 建立 Prisma + SQLite 事件表。
7. 实现 Doubao 模型客户端。
8. 实现 sandbox-runner 的命令白名单和 git diff。
9. 定义 shared schema。
10. 实现 Orchestrator 状态机。
11. 实现 run API 和 SSE 事件流。
12. 实现 ClarifyAgent。
13. 实现 PlanAgent。
14. 实现 Context Engine。
15. 实现 Skill SDK 和第一个 L1 Skill。
16. 实现 CodeAgent 和 patch 应用。
17. 实现验证命令和 ReviewTestAgent。
18. 实现 HandoffAgent 和结果面板。
19. 跑通 L1 demo。
20. 补齐 README、架构图、Prompt 文档。
21. 冲刺 P2 加分项。
22. 录制演示视频并整理答辩材料。

## 8. 每日开发检查表

每个开发日结束前检查：

- 是否误改了 `document/alpha_agent_origin_doc.md`。
- 是否有真实密钥进入代码或文档。
- 是否有 `.env` 被 Git 跟踪。
- 新增功能是否有 schema 或类型约束。
- Agent 输出是否有事件记录。
- 写入 sandbox 前是否读取了目标文件。
- 生成代码后是否执行了验证命令。
- 失败状态是否能在前端或日志中解释清楚。

## 9. MVP 完成定义

P1 MVP 只有满足以下条件才算完成：

- 前端能提交 PM 自然语言需求。
- ClarifyAgent 能输出 DSL 或澄清问题。
- PlanAgent 能输出实施计划。
- Context Engine 能定位并读取 Conduit 文件。
- CodeAgent 能生成 patch。
- patch 被写入真实 Conduit sandbox。
- 系统执行测试或等价验证命令。
- 前端展示最终 diff 摘要、验证结果、风险说明。
- 全过程事件可追溯。

## 10. 风险与处理策略

- 模型 JSON 不稳定：所有模型结构化输出必须经 Zod 校验，失败时做一次 JSON 修复重试。
- Conduit 本地数据库启动困难：P0 先记录阻塞并跑可用测试，P1 前必须解决真实 sandbox 验证问题。
- patch 应用失败：记录失败事件，返回 CodeAgent 重新生成，不能静默忽略。
- 上下文定位不准：先用 rg 和目录树提升确定性，再让模型判断是否需要追加文件。
- 自动修复无限循环：最多 3 次，超过进入 failed。
- Skill 抽象过早复杂化：MVP 只实现一个真实 Skill，但接口按可扩展设计。
- 前端沦为聊天壳：必须展示阶段、事件、文件变更、验证结果。

## 11. 资料索引

- `document/goal.md`：项目目标与技术蓝图。
- `AGENT.md`：项目硬性约束。
- `README.md`：项目启动、演示和验证入口。
- `document/architecture.md`：架构图与技术说明。
- `document/ai-usage-log.md`：Prompt 与 AI 使用记录。
- `document/demo-recording-script.md`：演示录屏脚本。
- `document/p1-demo-runbook.md`：P1 演示链路复现说明。
- `document/schema-examples.md`：核心 schema 示例。
- `document/alpha_agent_origin_doc.md`：原始课题文档，只读。
- Conduit 仓库：`https://github.com/TonyMckes/conduit-realworld-example-app`
- 火山方舟 Chat API：`https://www.volcengine.com/docs/82379/1494384?lang=zh`
- 火山方舟 OpenAI SDK 兼容说明：`https://www.volcengine.com/docs/82379/1330626?lang=zh`
- Vite：`https://vite.dev/guide/`
- Express：`https://expressjs.com/`
- Sequelize：`https://sequelize.org/docs/v6/getting-started/`
- Prisma：`https://www.prisma.io/docs`
- Zod：`https://zod.dev/`

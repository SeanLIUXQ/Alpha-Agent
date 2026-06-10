# goal.md

## 1. 项目愿景

实现一个可以端到端交付全栈项目的“超级个体”。系统面向产品经理的自然语言需求输入，完成“需求澄清 -> 方案拆解 -> 模块定位 -> 代码生成 -> 自动化测试 -> 生成可提测变更/PR”的闭环。

实验仓库必须基于 Conduit RealWorld 全栈项目：`https://github.com/TonyMckes/conduit-realworld-example-app`。该仓库公开说明其技术栈为 React、Vite + SWC、Express.js、Sequelize、PostgreSQL，并包含 CRUD、认证、路由、分页等真实全栈能力。项目自身不得用与 Conduit 无关的 mock 仓库替代。

## 2. MVP 验收目标

- 跑通至少 1 条 L1 需求链路：PM 输入 -> Clarify Agent -> Plan Agent -> Module Locator -> Code Agent -> 写入 Conduit sandbox -> Lint/测试 -> 生成变更说明。
- 三端齐备：前端对话页、Node 后端编排服务、AI Orchestrator/Skill 层均有真实实现。
- 模型真实调用：主模型使用火山方舟 `doubao-seed-2.0 lite`，通过 OpenAI Chat Completions 兼容接口接入。
- 代码真实落地：后端必须能读写 `conduit-sandbox`，执行 `npm run test`、`npm run lint` 或仓库实际存在的等价脚本。
- 安全合规：所有 EP、API key、数据库密码、GitHub token 等凭证只允许通过 `.env` 注入，禁止写入仓库。

## 3. 推荐技术栈

### 3.1 系统主仓语言

- 首选语言：TypeScript。
- 运行时：Node.js 20 LTS 或更高版本。
- 包管理：npm workspaces 或 pnpm workspace，统一锁定一种，不混用。
- 模块格式：优先 ESM；如某些 CLI 依赖仅支持 CommonJS，在局部适配，不让混合模块污染全局。

选择 TypeScript 的原因：Agent 编排、事件状态、Skill 输入输出、模型 JSON 响应都需要强类型约束，TypeScript 能显著降低跨模块协议漂移风险。Conduit sandbox 自身是 JavaScript 项目，主系统可以用 TypeScript，生成到 sandbox 的代码遵循 Conduit 原有 JavaScript 风格。

### 3.2 前端

- 框架：React 18。
- 构建工具：Vite。Vite 官方定位是现代 Web 构建工具，提供开发服务器、基于原生 ESM 的快速 HMR、生产构建能力，适合快速搭建交互台。
- UI 形态：单页应用，分为对话区、流程区、变更区、日志区、成本区。
- 通信：REST 创建任务，WebSocket 或 Server-Sent Events 推送模型流、CLI 输出、阶段状态。
- 状态管理：MVP 用 Zustand 或 React 内置状态即可；只有当流程状态复杂到需要回放与分支时再引入 XState。
- 样式：CSS Modules 或 Tailwind CSS 二选一，优先少配置、易演示。

前端核心页面：

- `/`：需求工作台，输入 PM 需求，展示澄清问题、可执行方案、阶段状态。
- `/runs/:runId`：单次执行详情，展示事件流、Prompt 摘要、模型输出、文件变更、验证结果。
- `/skills`：Skill 注册表查看页，展示支持的需求模式、触发条件、能力边界。
- `/settings`：本地配置检查页，只展示配置是否存在，不展示敏感值。

### 3.3 后端

- 框架：Express 4 或 Fastify。若追求最小学习成本，用 Express；若追求 schema 校验和高性能，用 Fastify。
- API 风格：REST + WebSocket/SSE。
- 校验：Zod 作为请求、模型 JSON、Skill 参数、事件 payload 的统一 schema 校验层。
- 日志：Pino，所有请求带 `requestId`，所有 Agent run 带 `runId`。
- 子进程执行：Node `child_process.spawn`，禁止拼接未校验 shell 字符串；命令白名单化。
- Git 操作：优先直接调用 `git diff`、`git status --porcelain`、`git add`、`git commit`、`gh pr create`，MVP 可只生成 diff 与人工提交流程。

后端职责：

- 接收 PM 需求并创建 `run`。
- 调用 Orchestrator 状态机推进流程。
- 管理模型客户端、上下文检索、Skill 匹配、patch 应用、验证命令。
- 将每一步事件持久化，前端可订阅事件流。
- 管理 sandbox 路径与命令执行权限。

### 3.4 数据库与持久化

MVP 推荐 SQLite，P2 以后可迁移 PostgreSQL。

- SQLite 适合本地演示、零运维、可直接提交 schema 迁移。
- PostgreSQL 适合生产形态、并发 run、向量扩展和团队协作。
- ORM 推荐 Prisma 或 Drizzle。MVP 推荐 Prisma，因为迁移、类型生成、查询体验更完整。

核心表：

- `runs`：一次需求交付流程，字段包括 `id`、`title`、`status`、`currentStage`、`createdAt`、`updatedAt`。
- `run_events`：事件溯源主表，字段包括 `id`、`runId`、`seq`、`type`、`payloadJson`、`createdAt`。
- `model_calls`：模型调用日志，字段包括 `runId`、`agentName`、`model`、`promptTokens`、`completionTokens`、`latencyMs`、`success`、`error`。
- `artifacts`：产物表，保存需求 DSL、计划、上下文包、patch、测试日志摘要。
- `skills`：Skill 元信息，保存 `name`、`version`、`description`、`capabilityTags`、`enabled`。
- `memories`：历史需求与方案沉淀，MVP 可以保存文本和标签，P3 再接入 embedding。

### 3.5 Conduit Sandbox

目录建议：`apps/conduit-sandbox` 或 `conduit-sandbox`。

Conduit 官方 README 说明：

- Node.js 需要 `v18.11.0+`。
- 根目录执行 `npm install` 安装依赖。
- 需要创建 `.env` 并参考 `backend/.env.example` 配置。
- 执行 `npm run sqlz -- db:create` 创建数据库。
- 可执行 `npm run sqlz -- db:seed:all` 写入种子数据。
- `npm run dev` 后，前端默认在 `http://localhost:3000/`，API 默认在 `http://localhost:3001/api`。
- `npm run test` 运行测试。

本项目对 sandbox 的约束：

- 保留 Conduit 原始目录结构，不为迁就 Agent 随意重构。
- Agent 写入 sandbox 前必须先读取目标文件当前内容。
- 任何生成代码必须通过 patch 或文件级 diff 表达，保留可审计痕迹。
- 后端命令执行必须限制在 sandbox 根目录内，防止越权写入系统目录。

## 4. 推荐目录结构

```text
AlphaAgent/
  AGENT.md
  document/
    alpha_agent_origin_doc.md
    goal.md
  apps/
    web/                       # React 18 + Vite 前端工作台
    server/                    # Node/TypeScript 后端编排 API
    conduit-sandbox/           # Conduit fork 或 clone，不允许 mock 替代
  packages/
    agent-core/                # Orchestrator、Agent 基类、状态机
    model-provider/            # Doubao/OpenAI 兼容模型客户端
    skill-sdk/                 # Skill 接口、schema、注册器
    sandbox-runner/            # 文件读取、patch 应用、命令执行、git 操作
    context-engine/            # 目录索引、grep、AST/切片、上下文打包
    shared/                    # 通用类型、常量、Zod schema
  data/
    alpha-agent.sqlite         # 本地事件库，禁止存密钥
  docs/
    architecture.md
    prompts.md
    demo-script.md
```

## 5. 系统架构

### 5.1 分层

```text
PM/User
  -> React Workbench
  -> Orchestrator API
  -> Agent State Machine
  -> Skill Registry + Context Engine + Model Provider
  -> Sandbox Runner
  -> Conduit RealWorld Repo
  -> Verification + Diff/PR
```

### 5.2 前端交互层

必须支持：

- 输入自然语言需求。
- 展示 Clarify Agent 的追问，允许用户补充。
- 展示结构化需求 DSL。
- 展示执行阶段：`clarify`、`plan`、`locate`、`generate`、`apply`、`verify`、`review`、`handoff`。
- 实时展示 CLI 日志和测试结果。
- 展示文件变更摘要和最终 diff。

P2 加分能力：

- 暂停/恢复 run。
- 从某个事件节点重放下游。
- 修改某一步输入后重新执行。
- Token、时延、成本可视化。

### 5.3 后端编排层

关键 API：

- `POST /api/runs`：创建需求 run。
- `GET /api/runs/:id`：获取 run 当前状态。
- `GET /api/runs/:id/events`：获取事件列表。
- `GET /api/runs/:id/stream`：SSE 订阅事件与日志。
- `POST /api/runs/:id/answers`：提交澄清问题回答。
- `POST /api/runs/:id/approve-plan`：人工确认方案。
- `POST /api/runs/:id/replay`：从指定事件序号重放。
- `GET /api/skills`：查看 Skill 注册表。
- `POST /api/sandbox/verify`：执行验证命令。

状态机阶段：

- `created`：用户提交需求。
- `clarifying`：识别缺失信息，必要时阻塞等待用户回答。
- `planned`：产出执行计划、影响范围、测试策略。
- `located`：定位文件与上下文。
- `generated`：产出 patch。
- `applied`：patch 写入 sandbox。
- `verifying`：执行 lint/test/build。
- `repairing`：失败后最多自修复 3 次。
- `completed`：生成变更说明。
- `failed`：带错误原因、日志摘要、建议人工介入点。

### 5.4 AI 编排层

Agent 矩阵：

- `ClarifyAgent`：将 PM 需求转换为结构化需求 DSL。遇到目标不清、数据来源不明、展示规则模糊、权限边界不明时必须追问。
- `PlanAgent`：生成实施计划，包含前端、后端、数据库、测试、风险点。
- `ModuleLocatorAgent`：基于目录树、ripgrep、文件摘要定位上下文，不允许把整个仓库一次性塞入模型。
- `CodeAgent`：生成统一 diff 或文件 patch，必须解释改动意图和影响文件。
- `ReviewTestAgent`：读取 lint/test/build 失败日志，判断是否可自动修复；最多 3 次，超过后失败交给人工。
- `HandoffAgent`：输出最终变更摘要、验证结果、未覆盖风险、PR 文案草稿。

模型调用策略：

- 主模型：火山方舟 `doubao-seed-2.0 lite`。
- API：OpenAI Chat Completions 兼容接口，base URL 使用火山方舟文档中的 `/api/v3` 形式。
- 配置：`DOUBAO_BASE_URL`、`DOUBAO_EP`、`DOUBAO_API_KEY`、`DOUBAO_MODEL` 全部从 `.env` 读取。
- 输出：需要结构化结果时必须要求 JSON，并用 Zod 校验；校验失败进入一次“修复 JSON”重试。
- 流式：对前端展示可使用 stream；对核心决策优先非流式，便于记录完整响应。
- 观测：记录输入 token、输出 token、耗时、模型名、agent 名、失败原因。

## 6. Skill 设计

### 6.1 目标

新增高频需求模式时，只新增一个 Skill 文件或配置，不修改 Orchestrator 主干逻辑。

### 6.2 Skill 接口

```ts
export interface Skill<TInput, TPlan> {
  name: string;
  version: string;
  tags: string[];
  match(input: RequirementDsl): Promise<SkillMatchResult>;
  plan(input: TInput, context: SkillContext): Promise<TPlan>;
  locate(plan: TPlan, context: SkillContext): Promise<ContextRequest[]>;
  generate(plan: TPlan, context: PackedContext): Promise<PatchSet>;
  verify(plan: TPlan): Promise<VerifyCommand[]>;
}
```

### 6.3 MVP Skill 清单

- `AddFrontendDisplayFieldSkill`：文章列表/详情增加展示字段，支持前端计算或假数据。
- `AddProfileTabSkill`：Profile 页面新增 tab，例如 About Me。
- `AddArticleDerivedMetricSkill`：基于文章内容计算字数、阅读时间等派生指标。

### 6.4 P2 Skill 清单

- `AddArticleModelFieldSkill`：Article 增加数据库字段，联动 Sequelize model、migration、API serializer、前端表单与展示。
- `AddFilterSkill`：文章列表新增筛选条件，联动 URL query、API 参数、数据库查询。
- `AddInteractionSkill`：点赞、收藏等幂等交互，联动后端接口、前端状态、测试。

## 7. 上下文工程

### 7.1 检索顺序

- 读取目录树和 package scripts。
- 用 `rg` 搜索路由、组件名、模型名、API endpoint、测试文件。
- 读取候选文件摘要。
- 按需求类型选择最小上下文包。
- 仅当模型判断上下文不足时追加读取。

### 7.2 上下文包格式

```json
{
  "requirement": {},
  "repoSummary": {},
  "files": [
    {
      "path": "frontend/src/...",
      "reason": "article list component",
      "content": "..."
    }
  ],
  "constraints": ["preserve existing style", "do not touch unrelated files"]
}
```

### 7.3 幻觉防控

- 模型不得引用未读取过的文件路径作为已知事实。
- 生成 patch 前必须列出依据文件。
- patch 应用失败必须回到定位或生成阶段，不允许静默跳过。
- 如果需求需要数据库字段但用户只想前端假数据，必须在 DSL 中明确 `dataSource=fake|api|db`。

## 8. 自动验证链路

### 8.1 命令分层

- `npm run lint`：如果仓库存在则必须跑。
- `npm run test`：Conduit 官方 README 指明可用，MVP 必跑。
- `npm run build`：前端或全仓 build 可作为 P2 以上验证。
- `npm run sqlz -- db:migrate`：涉及 Sequelize migration 时必须跑。

### 8.2 验证策略

- L1 纯前端需求：至少跑相关测试或全量 `npm run test`，并生成 diff 摘要。
- L2 跨栈需求：必须跑 migration、后端测试、前端测试/build。
- 失败时把日志摘要、失败文件、失败命令喂给 `ReviewTestAgent`。
- 自动修复最多 3 轮，每轮必须记录原因与 patch。

## 9. 安全与合规

- `.env`、`.env.local`、`.env.*.local` 必须加入 `.gitignore`。
- 文档只允许写变量名，不允许写真实密钥。
- 前端不得展示 API key 的值，只显示是否配置。
- 后端启动时校验必需环境变量，缺失则 fail fast。
- 子进程命令必须白名单化，禁止用户输入直接进入 shell。
- 文件写入必须限制在 workspace 和 sandbox 目录内。
- `document/alpha_agent_origin_doc.md` 是原始文档，禁止修改。

## 10. 里程碑

### P0：基础设施跑通

- 初始化 monorepo：`apps/web`、`apps/server`、`packages/*`、`conduit-sandbox`。
- 配置 TypeScript、ESLint、Prettier、环境变量加载。
- 接入 Doubao Chat Completions 兼容 API，完成一次健康检查调用。
- 建立 SQLite/Prisma 事件表。
- 后端能执行 sandbox 内的只读命令：`git status`、`npm run test`。

### P1：MVP 闭环

- 实现需求输入与澄清问答。
- 实现需求 DSL、计划、上下文定位。
- 支持 L1 Skill：文章阅读量字段、Popular Tags 标记、About Me Tab、字数统计任选其一。
- 生成 patch 并写入 Conduit sandbox。
- 执行测试并输出最终变更说明。

### P2：加分能力

- 引入 Skill Registry，实现新增 Skill 不改 Orchestrator。
- 引入事件溯源重放，支持从任意阶段回滚并重放下游。
- 支持 L2 跨栈需求，例如 Article 增加 `coverImage` 字段。
- 实现 token/时延/成本监控面板。

### P3：交付包装

- 完成 README、部署说明、架构图、Prompt 策略说明。
- 准备 3-8 分钟演示视频脚本。
- 沉淀 3 个以上需求样例和验证日志。
- 输出答辩材料：技术难点、创新点、评分项对齐表。

## 11. 交付物清单

- 可运行代码仓库：主系统 + Conduit sandbox。
- `.env.example`：只包含变量名和占位说明。
- README：启动步骤、依赖环境、演示流程、模型配置说明。
- 架构图：前端、后端、Agent、Skill、sandbox、数据库关系。
- Prompt/Skill 文档：关键 prompt 版本、Skill schema、示例输入输出。
- Demo 脚本：至少 1 条 L1 成功链路。
- 验证记录：测试命令、结果、失败修复记录。

## 12. 资料入口

- Conduit RealWorld 示例仓库：`https://github.com/TonyMckes/conduit-realworld-example-app`
- RealWorld 规范入口：`https://realworld.io/`
- 火山方舟 Chat API：`https://www.volcengine.com/docs/82379/1494384?lang=zh`
- 火山方舟 OpenAI SDK 兼容说明：`https://www.volcengine.com/docs/82379/1330626?lang=zh`
- Vite Guide：`https://vite.dev/guide/`
- Express 文档：`https://expressjs.com/`
- Sequelize v6 文档：`https://sequelize.org/docs/v6/getting-started/`
- Prisma 文档：`https://www.prisma.io/docs`
- Zod 文档：`https://zod.dev/`

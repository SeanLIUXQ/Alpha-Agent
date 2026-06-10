# Alpha Agent

Alpha Agent 是一个事件溯源式编码 Agent 原型，用于把 PM 风格的自然语言需求转化为真实 Conduit sandbox 仓库中的可验证代码变更。

当前演示能力包括：

- P1 L1 前端链路：基于 `Article.body` 增加文章字数和预计阅读时间展示。
- P2 Skill 注册：已支持 `add-article-derived-metric`、`add-article-cover-image` 等需求模式。
- P2 断点重放、模型调用遥测和历史需求记忆召回。
- P2 L2 跨栈链路：为文章增加 `coverImage` 字段，覆盖 Sequelize、API、编辑器、列表预览、详情页和样式。
- 人工介入澄清：模糊需求会停在 `requires_input`，提交补充答案后继续生成关联 run。

## 环境要求

- Node.js 22 或更高版本。
- npm。
- PATH 中可用的 `rg` / ripgrep。
- 基于 `.env.example` 创建本地 `.env`。
- 真实 Conduit sandbox 位于 `apps/conduit-sandbox`。

不要提交真实 API key、token、数据库密码或私有 endpoint。所有密钥只放在本地 `.env`。

## 安装

```powershell
npm install
npm run db:generate
npm run db:push
```

SQLite 事件库通过 `DATABASE_URL` 配置。默认本地配置会把数据放在 `data/` 目录下。

## 启动

启动后端：

```powershell
npm run dev
```

另开一个终端启动 Workbench 前端：

```powershell
npm run dev:web
```

后端端口由 `SERVER_PORT` 控制，默认是 `3002`。前端使用 Vite，开发环境下会代理 API 请求。

## 演示

运行 P1 端到端演示：

```powershell
npm run build
npm run demo:p1
```

脚本会在需要时启动构建后的服务，提交 PM 需求，打印 run ID、事件链、验证结果和交付摘要。

P1 演示需求：

```text
在文章详情页正文下方显示本文字数和预计阅读时间。
```

P2 L2 演示需求：

```text
给文章增加 coverImage 字段，编辑文章时可以填写封面图 URL，文章列表和详情页都展示封面图。
```

运行 L3 级别评测：

```powershell
npm run test:l3
```

L3 评测覆盖：模糊需求澄清、自相矛盾需求拦截、跨模块草稿流程 DSL 生成，以及 L2 Skill 选择回归。

## API 清单

- `GET /health`
- `POST /api/runs`
- `GET /api/runs/:id`
- `GET /api/runs/:id/events`
- `GET /api/runs/:id/stream`
- `POST /api/runs/:id/replay`
- `POST /api/runs/:id/answers`
- `GET /api/runs/:id/model-calls`
- `GET /api/skills`
- `GET /api/memories?q=文章`
- `POST /api/model/health`

## 验证命令

主系统：

```powershell
npm run typecheck
npm run lint
npm run build
```

Conduit sandbox：

```powershell
npm run test
npm run build -w frontend
```

## 常见问题

- 缺少环境变量：复制 `.env.example` 为 `.env`，并只在本地填写真实值。
- 模型健康检查失败：检查 `.env` 中 Doubao 配置；不要打印或提交 API key。
- 上下文检索慢：确认已安装 `rg`，并且 `node_modules` 已被忽略。
- Conduit 数据库初始化失败：P1/P2 demo 的验证主要依赖 test/build；完整 dev server 联调需要有效的 Conduit 数据库配置。
- Run 失败：查看 `GET /api/runs/:id/events`，失败阶段会包含 payload 摘要和验证日志。

## 重要边界

- 不修改原始题面文档。
- 生成代码必须写入真实 `apps/conduit-sandbox`。
- Run 必须完成验证后才能视为交付完成。
- Sandbox 命令由 `packages/sandbox-runner` 白名单控制。

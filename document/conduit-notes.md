# conduit-notes.md

## Sandbox 来源

- 仓库：`https://github.com/TonyMckes/conduit-realworld-example-app`
- 本地路径：`apps/conduit-sandbox`
- 说明：该目录是真实 Conduit RealWorld 仓库 clone，不是 mock 仓库。

## 已确认脚本

- 根目录 `npm run dev`：并行启动 backend 和 frontend。
- 根目录 `npm run test`：执行 Vitest。
- 根目录 `npm run start`：构建 frontend 并启动 backend。
- 根目录 `npm run sqlz -- <args>`：调用 backend workspace 的 `sequelize-cli`。
- `backend` workspace `npm run dev`：`node --watch index.js`。
- `frontend` workspace `npm run dev`：启动 Vite。
- `frontend` workspace `npm run build`：执行 Vite build。

## 环境要求

- Conduit 后端默认依赖 PostgreSQL。
- sandbox 自己的 `.env` 只能本地创建，不能提交。
- 推荐在项目根 `.env` 或 `apps/conduit-sandbox/backend/.env` 中配置 `CONDUIT_DATABASE_URL`，避免与主系统 SQLite `DATABASE_URL` 混用。
- 也兼容 Conduit 原生 `DEV_DB_USERNAME`、`DEV_DB_PASSWORD`、`DEV_DB_NAME`、`DEV_DB_HOSTNAME`、`DEV_DB_DIALECT`、`DEV_DB_LOGGING` 变量。
- 数据库初始化可参考 Conduit README：`npm run sqlz -- db:create` 和 `npm run sqlz -- db:seed:all`。

## P0 验证记录

- 依赖安装：已执行 `npm install`。
- 安装后审计：上游依赖报告 12 个漏洞告警，暂不执行 `npm audit fix --force`，避免破坏原仓库依赖约束。
- 测试依赖：原仓库测试需要 `jsdom`，已在 sandbox 中以 devDependency 补齐。
- Git 状态：已执行 `git status --porcelain`，命令可用。
- 测试命令：已执行 `npm run test`，3 个 test files、12 个 tests 全部通过。
- 前端构建：已执行 `npm run build -w frontend`，构建通过。
- 数据库创建：已执行 `npm run sqlz -- db:create`，当前失败原因为本机未配置 sandbox `.env` 中的 `DEV_DB_DIALECT` 等 PostgreSQL 变量，Sequelize 报告 `Dialect undefined does not support db:create / db:drop commands`。
- 已补齐 Conduit backend dotenv 加载路径：`backend/.env`、`apps/conduit-sandbox/.env`、项目根 `.env`。
- 已补齐 `CONDUIT_DATABASE_URL` 支持；主系统 SQLite `DATABASE_URL` 不会被误用为 Conduit 数据库。
- 最新验证：项目根 `.env` 当前只包含主系统 SQLite `DATABASE_URL`，未包含 Conduit `CONDUIT_DATABASE_URL` 或 `DEV_DB_*` PostgreSQL 变量；再次执行 `npm run sqlz -- db:create` 仍失败于 `DEV_DB_DIALECT` 未定义。
- Conduit 数据库不再阻塞 P0 主链路完成；后续进入 L2 跨栈需求或完整 dev server 联调前，再配置 PostgreSQL 并执行数据库创建、seed 和完整 dev server 验证。

## 最新验证记录

- 主系统 `npm run typecheck`：通过。
- 主系统 `npm run lint`：通过。
- 主系统 `npm run build`：通过。
- 主系统 `POST /api/model/health`：真实 Doubao 调用通过，返回 `ok: true`。
- Conduit `npx vitest run --no-file-parallelism --maxWorkers=1`：3 个 test files、12 个 tests 通过。
- Conduit `npm run build -w frontend`：通过。
- 主系统 `POST /api/sandbox/verify`：通过；内部执行 Conduit `npm run test` 与 `npm run build -w frontend`。
- Conduit PostgreSQL dev database：已用 Docker 容器 `alpha-agent-conduit-postgres` 初始化，容器端口映射为 `localhost:55432`。
- Conduit `backend/.env`：已写入本地 PostgreSQL 连接变量；该文件受 `.gitignore` 保护，不提交。
- Conduit `npm run sqlz -- db:drop`、`db:create`、`db:migrate`、`db:seed:all`：已执行通过。
- 数据库修复：恢复 `backend/models/Article.js`，新增 `20260605000000-add-association-columns.js` 以补齐 Article/User/Comment 关联列；修复 Sequelize `logging` 字符串配置、Article/Tag `tagList` 关联别名、收藏/关注 helper 与真实 Sequelize mixin 名称不一致的问题。
- Conduit 真实 PostgreSQL dev flow：backend 当前以 `previewMode=false` 连接 Docker PostgreSQL，前端和 API 分别运行在 `http://localhost:3000` 与 `http://localhost:3001`；Workbench 新增真实 DB 流程检查，覆盖注册、登录、创建发布文章、创建草稿、编辑草稿、公开列表过滤草稿、作者草稿列表。
- P1 L1 demo：文章详情页新增字数统计和预计阅读时间，已写入真实 sandbox。
- P1 L1 demo 验证：主系统 `POST /api/demo/l1/article-reading-stats` 返回 `201` 和 `success: true`，内部执行 Conduit `npm run test` 与 `npm run build -w frontend` 成功。

- 最新真实 DB 验证：主系统 `POST /api/sandbox/real-db-flow` 返回 `success: true`、`previewMode: false`，最近一次生成 `publishedSlug=real-db-published-mq7i25p7`、`draftSlug=real-db-draft-mq7i25p7`。
- Playwright 截图验证：Conduit 首页和真实文章详情页可通过 `http://localhost:3000` 渲染真实 DB 返回的文章。

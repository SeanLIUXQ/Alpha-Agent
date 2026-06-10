# Conduit Sandbox

该目录是基于 [Conduit RealWorld Example App](https://github.com/TonyMckes/conduit-realworld-example-app) 的真实 sandbox 仓库源码，用于 Alpha Agent 的代码写入和验证。它不是 mock 仓库。

技术栈：

- 前端：React / Vite + SWC。
- 后端：Express.js / Sequelize。
- 数据库：PostgreSQL。
- 测试：Vitest。

## 启动前准备

需要安装：

- Git
- Node.js 18.11.0 或更高版本
- npm
- PostgreSQL 或兼容数据库

## 安装依赖

在 `apps/conduit-sandbox` 目录执行：

```bash
npm install
```

## 配置环境变量

复制配置模板：

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

根据本地数据库填写：

- `CONDUIT_DATABASE_URL`
- `PORT`
- `JWT_KEY`
- 或 Conduit 原生的 `DEV_DB_*` / `TEST_DB_*` / `PROD_DB_*` 变量

不要提交 `.env` 或真实数据库密码。

## 初始化数据库

```bash
npm run sqlz -- db:create
npm run sqlz -- db:migrate
npm run sqlz -- db:seed:all
```

`npm run sqlz` 是 `npx -w backend sequelize-cli` 的别名。

## 开发运行

```bash
npm run dev
```

默认访问地址：

- 前端：`http://localhost:3000/`
- API：`http://localhost:3001/api`

## 验证命令

运行测试：

```bash
npm run test
```

构建前端：

```bash
npm run build -w frontend
```

Alpha Agent 的 sandbox 验证默认也会执行这两条命令。

## 与 Alpha Agent 的关系

- Agent 生成的补丁会写入该目录。
- `packages/sandbox-runner` 会限制写入路径和可执行命令。
- L1/L2/L3 demo 都以该目录作为真实业务仓库。

## 许可证与来源

原项目使用 MIT License，详见 [LICENSE](LICENSE)。原始项目和 RealWorld 规范链接：

- https://github.com/TonyMckes/conduit-realworld-example-app
- https://realworld.io/
- https://github.com/gothinkster/realworld

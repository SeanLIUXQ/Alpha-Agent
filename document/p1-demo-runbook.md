# P1 Demo Runbook

## 选定链路

P1 demo 使用 L1 纯前端需求：

> 在文章详情页正文下方显示本文字数和预计阅读时间。

选择该需求的原因：数据已存在于 `Article.body`，改动集中在文章详情 UI，且无需数据库 migration 就能在真实 Conduit sandbox 中运行验证。

## 一条命令演示

在项目根目录执行：

```powershell
npm run demo:p1
```

脚本会读取 `.env` 中的 `SERVER_PORT`，在需要时启动构建后的服务，向 `POST /api/runs` 提交 PM 需求，并打印 run ID、最终状态、事件数量、阶段事件和验证摘要。

如果源码刚修改过，先重新构建：

```powershell
npm run build
npm run demo:p1
```

## 预期阶段故事线

1. `clarify.completed`：把 PM 句子转成 `RequirementDsl`。
2. `plan.completed`：选择 `AddArticleDerivedMetricSkill` 并生成 L1 前端方案。
3. `locate.completed`：打包 Conduit 上下文，包括 `frontend/src/routes/Article/Article.jsx` 和 `frontend/src/styles.css`。
4. `generate.completed`：输出文章详情组件和 CSS 的 `PatchSet`。
5. `apply.completed`：把补丁写入真实 Conduit sandbox，并记录 `git diff --stat`。
6. `verify.completed`：执行 `npm run test` 和 `npm run build -w frontend`。
7. `handoff.completed`：汇总变更文件、验证结果、风险和 PR 草稿。
8. `stage.completed`：只有验证成功后才标记 run 完成。

## 手动 API 演示

```powershell
$body = @{ requirement = '在文章详情页正文下方显示本文字数和预计阅读时间。' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:3002/api/runs' -Method Post -ContentType 'application/json; charset=utf-8' -Body $body
```

查看事件：

```powershell
Invoke-RestMethod -Uri 'http://localhost:3002/api/runs/<run-id>/events'
```

## 验收检查

- Run 以 `success: true` 和 `status: completed` 结束。
- 事件包含从 clarify 到 handoff 的完整阶段。
- Conduit sandbox 在 `frontend/src/routes/Article/Article.jsx` 和 `frontend/src/styles.css` 中出现 diff。
- 验证包含通过的 `npm run test` 和 `npm run build -w frontend`。
- Handoff payload 说明变更文件、验证、剩余风险和 PR 草稿内容。

## 排障

- 如果 `/health` 失败，运行 `npm run build`，并确认 `.env` 包含 `SERVER_PORT`、`DATABASE_URL` 和 `CONDUIT_SANDBOX_PATH`。
- 如果上下文打包慢，确认已安装 `rg`，并且 `apps/conduit-sandbox/node_modules` 只出现在忽略路径下。
- 如果验证失败，查看 `verify.completed` 事件 payload，其中包含每条命令的 stdout/stderr 尾部。

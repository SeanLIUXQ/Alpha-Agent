# AI 使用记录

本文档记录 Alpha Agent 在需求交付过程中的 AI 使用方式，供评审复盘：Agent 边界、Prompt 版本、样例输入输出、模型调用日志、失败场景和修正策略均在此说明。

## Agent 职责

| Agent | 是否使用模型 | 职责 | 边界 |
|---|---:|---|---|
| ClarifyAgent | 是，带规则兜底 | 将 PM 输入转换为 `RequirementDsl`，或提出阻塞式澄清问题。 | 不读文件、不写代码、不修改 sandbox。 |
| PlanAgent | 是，带 Skill 兜底 | 将已校验 DSL 和选中 Skill 转换为 `ImplementationPlan`。 | 不读取 sandbox 文件、不应用补丁。 |
| Context Engine | 否 | 从 Conduit sandbox 打包候选文件和搜索证据。 | 不根据未读取文件做推断。 |
| CodeAgent | 候选方案使用模型，最终写入由确定性/Skill 逻辑生成 | 让模型提出候选补丁意图，再生成可审计 `PatchSet`。 | 模型候选不会被直接应用；最终文件必须通过 schema、路径和验证门禁。 |
| ReviewTestAgent | MVP 主要是确定性逻辑 | 总结验证失败，并基于已知模式和 Skill hints 生成安全修复补丁。 | 修复次数有上限，不会静默无限重试。 |
| HandoffAgent | 否 | 输出交付摘要、变更文件、验证状态和剩余风险。 | 没有验证结果时不能标记成功。 |

## Prompt 文件

| 文件 | 用途 |
|---|---|
| `document/prompts/clarify-agent.md` | ClarifyAgent 的可读 prompt 契约。 |
| `document/prompts/plan-agent.md` | PlanAgent 的可读 prompt 契约。 |
| `document/prompts/code-agent.md` | CodeAgent 的可读 prompt 契约。 |
| `document/prompts/review-test-agent.md` | ReviewTestAgent 的失败复核契约。 |

运行时代码中的 prompt 来源：

| 运行时文件 | Prompt |
|---|---|
| `packages/agent-core/src/agents/clarifyAgent.ts` | `clarifySystemPrompt`、`clarifyRepairPrompt` |
| `packages/agent-core/src/agents/planAgent.ts` | `planSystemPrompt`、`planRepairPrompt` |
| `packages/agent-core/src/agents/codeAgent.ts` | `codeCandidateSystemPrompt`、`codeCandidateRepairPrompt` |

## Prompt 版本记录

| 版本 | 变更 | 原因 |
|---|---|---|
| v0.1 | 输出优先走 schema；模型输出通过 Zod 校验后才能进入流程；完成前必须验证。 | 防止自由文本直接进入编排管线。 |
| v0.2 | 增加 Skill 选择边界和模型调用遥测。 | 让需求扩展和运行观测更清楚。 |
| v0.3 | 增加澄清暂停和 `/api/runs/:id/answers`。 | 模糊需求不应直接变成不安全补丁。 |
| v0.4 | 修复 npm workspace 启动时 sandbox 路径解析。 | 防止补丁写入影子 sandbox。 |
| v0.5 | ClarifyAgent 和 PlanAgent 使用真实 Doubao JSON 输出，并增加一次 JSON 修复重试。 | 提升 Agent 智能度，并让模型行为对评审可见。 |
| v0.6 | CodeAgent 记录模型候选补丁，再应用系统审阅后的确定性/Skill 补丁。 | 展示 AI 贡献，同时避免直接信任未审阅模型文件内容。 |
| v0.7 | Replay override 标记 `source: replay-override`，并校验 DSL/Plan payload。 | 让断点重放可审计且安全。 |

## 运行时 Prompt 契约

### ClarifyAgent

系统意图：

- 只返回一个 JSON 对象。
- 将产品经理文本转换为 `RequirementDsl`，或提出阻塞式问题。
- 只有当目标、数据来源、验收标准、矛盾点或 Skill 支持无法安全推断时才追问。
- Prompt 中声明已知 Skills：L1 派生指标、L2 封面图、L2 分享链接、L3 草稿流程。
- JSON 无效时，用 `clarifyRepairPrompt` 修复一次。

输入样例：

```text
在文章列表卡片中显示每篇文章的标签数量。
```

期望输出形态：

```json
{
  "decision": "ready",
  "dsl": {
    "level": "L1",
    "intent": "add article list tag count metric",
    "targetSurface": "article list preview cards"
  },
  "questions": [],
  "rationale": "匹配已支持的前端文章指标 Skill。"
}
```

阻塞样例：

```text
让这个博客变得更好。
```

期望输出形态：

```json
{
  "decision": "requires_input",
  "dsl": null,
  "questions": [
    {
      "id": "clarify-target",
      "blocking": true
    }
  ],
  "rationale": "缺少目标页面和验收标准。"
}
```

### PlanAgent

系统意图：

- 只返回一个 JSON 对象。
- 生成具体的 `ImplementationPlan`。
- 使用选中 Skill 和 fallback plan 作为依据。
- `candidateFiles` 和 `verifyCommands` 必须准确且安全。
- 不编造无关文件。
- JSON 无效时，用 `planRepairPrompt` 修复一次。

输入样例：

```json
{
  "requirement": {
    "level": "L2",
    "intent": "add article cover image field"
  },
  "selectedSkill": {
    "name": "add-article-cover-image"
  },
  "fallbackPlan": {
    "candidateFiles": [
      "backend/models/Article.js",
      "frontend/src/components/ArticleEditorForm/ArticleEditorForm.jsx"
    ]
  }
}
```

期望输出形态：

```json
{
  "level": "L2",
  "summary": "为文章增加封面图持久化和展示。",
  "candidateFiles": [
    "backend/models/Article.js",
    "backend/controllers/articles.js",
    "frontend/src/components/ArticleEditorForm/ArticleEditorForm.jsx",
    "frontend/src/components/ArticlesPreview/ArticlesPreview.jsx",
    "frontend/src/routes/Article/Article.jsx"
  ],
  "verifyCommands": [
    "npm run test",
    "npm run build -w frontend"
  ]
}
```

### CodeAgent

系统意图：

- 只返回一个 JSON 对象。
- 生成候选补丁建议，不直接生成最终文件内容。
- 只能引用 packed context 中的文件，或 plan 中明确说明的 migration。
- 系统确定性逻辑会审计候选方案，并应用安全的规则补丁或 Skill 补丁。

输入样例：

```json
{
  "plan": {
    "summary": "增加文章复制链接动作。",
    "candidateFiles": ["frontend/src/routes/Article/Article.jsx"]
  },
  "contextFiles": [
    {
      "path": "frontend/src/routes/Article/Article.jsx",
      "preview": "import Markdown from ..."
    }
  ]
}
```

期望输出形态：

```json
{
  "summary": "在文章详情页增加复制链接动作。",
  "targetFiles": ["frontend/src/routes/Article/Article.jsx"],
  "operations": [
    {
      "path": "frontend/src/routes/Article/Article.jsx",
      "intent": "增加按钮，复制当前文章 URL，并渲染成功反馈。",
      "safetyNotes": ["仅前端改动；不需要数据库 migration。"]
    }
  ]
}
```

重要边界：

- 候选方案会保存为 `generate.candidate_patch`。
- 最终应用补丁由 Skill / 确定性代码生成，并再次验证。
- 这样做是刻意设计：评审能看到模型意图，但系统不会直接应用任意模型文件内容。

### ReviewTestAgent

当前行为：

- 总结捕获到的验证日志。
- 对已知失败模式应用安全修复，例如缺少 React import、重复封面图控件、Skill 提供的“阅读全文”提示缺失等。
- 修复时会产生 `repair.reviewed`、`repair.generated`、`repair.apply.completed`、`repair.verify.completed` 事件。

失败输入样例：

```text
npm run build -w frontend
useState is not defined
```

期望修复策略：

```json
{
  "summary": "ReviewTestAgent automatic repair attempt 1.",
  "operations": [
    {
      "path": "frontend/src/routes/Article/Article.jsx",
      "reason": "修复前端验证报告的 useState import 缺失。"
    }
  ]
}
```

## 模型调用记录

所有模型调用都会通过 `recordModelCall` 持久化到 `ModelCall`。

记录字段：

| 字段 | 含义 |
|---|---|
| `agentName` | 发起调用的 Agent，例如 `ClarifyAgent`、`PlanAgent`、`CodeAgent`。 |
| `model` | Doubao 模型名或 fallback 标记。 |
| `latencyMs` | 模型调用延迟。 |
| `promptTokens` | Provider 返回时记录输入 token 数。 |
| `completionTokens` | Provider 返回时记录输出 token 数。 |
| `totalTokens` | Provider 返回时记录总 token 数。 |
| `success` | 调用是否成功。 |
| `error` | 失败摘要。 |

相关 API：

```text
GET /api/runs/:id/model-calls
POST /api/model/health
```

模型调用证据样例：

| Run | 证据 |
|---|---|
| `cmq66d9s70032r7s87ieclrnz` | 完成 L1 标签数量 Run；记录 4 次模型调用。 |
| `cmq6p1fg40005r7xogrg69eu3` | 完成 L2 封面图 Run；记录 4 次模型调用。 |
| `cmq6j2lzf0000r72sm21k4fwu` | 完成复制链接 Run；记录 4 次模型调用。 |
| `cmq7izv9e0000r72cdqnsogwe` | Replay / 可观测性 Run；`ClarifyAgent` 和 `PlanAgent` 可展示 `source: replay-override`。 |

## 失败场景与修正

| 场景 | 表现 | 根因 | 修正 |
|---|---|---|---|
| PM 输入模糊 | Run 进入 `requires_input`。 | 缺少目标组件、数据源或验收标准。 | ClarifyAgent 生成阻塞问题；Workbench 允许用户回答并创建关联 continuation Run。 |
| 需求自相矛盾 | Clarify 追问后端和前端-only 边界。 | 需求要求持久化/数据库，同时禁止后端变更。 | ClarifyAgent 用 `clarify-contradiction` 和 `clarify-data-contract` 阻塞。 |
| 模型 JSON 无效 | Agent 兜底或修复一次。 | LLM 输出不符合 Zod schema。 | `runStructuredJson` 尝试一次 JSON 修复 prompt；仍失败则使用 Skill/规则兜底，并记录 fallback 错误。 |
| 模型补丁不安全 | 模型候选不会直接应用。 | 自由文件写入可能破坏 sandbox 或越界。 | CodeAgent 记录候选意图，再由确定性/Skill 补丁通过路径检查写入。 |
| 验证失败 | Run 进入 `repairing`，随后可能失败或完成。 | build/test 命令返回非零。 | ReviewTestAgent 总结日志，有限次数应用安全修复并重新验证。 |
| Replay 编辑 Plan | 历史 DSL 可能被破坏或编辑。 | 从自然语言重匹配 Skill 可能失败。 | Replay payload 携带/使用 `skill`，DSL/Plan override 会先经过 Zod 校验。 |

## 人工复核与验证门禁

AI 输出从不作为唯一验收信号。流程要求：

1. DSL、Plan、候选方案和 PatchSet 都经过 Zod schema 校验。
2. 必须匹配 Skill，或明确进入澄清。
3. 上下文来自真实 sandbox 文件。
4. 补丁应用有路径守卫。
5. 捕获 `git diff --stat`。
6. 执行白名单验证命令。
7. 可选有限自动修复。
8. Handoff 摘要必须包含变更文件、验证结果和风险。

## 当前证据清单

评审时可使用：

```powershell
npm run test:l3
npm run lint
npm run typecheck
npm run build
```

查看某个 Run 的模型调用：

```powershell
Invoke-RestMethod http://127.0.0.1:3002/api/runs/cmq66d9s70032r7s87ieclrnz/model-calls
```

查看事件轨迹：

```powershell
Invoke-RestMethod http://127.0.0.1:3002/api/runs/cmq66d9s70032r7s87ieclrnz/events
```

相关交付材料：

- `document/evaluation-set.md`
- `document/evaluation-cases.json`
- `document/architecture.md`
- `document/demo-recording-script.md`

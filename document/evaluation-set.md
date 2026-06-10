# Alpha Agent 公开评测集

本评测集用于演示和评审，覆盖 L1/L2/L3 成功链路、模糊需求澄清和自相矛盾需求拦截。评审可以同时看到系统的交付能力和安全停止能力。

机器可读版本存放在 [`document/evaluation-cases.json`](./evaluation-cases.json)。

## 评分列说明

- **Clarify**：系统是否应该提出阻塞式澄清问题。
- **Skill**：预期或实际匹配的 Skill。
- **Done**：当前基线是否完成任务，或是否按预期停在澄清阶段。
- **Tests**：验证是否通过。澄清类用例中的 `n/a` 表示设计上不进入实现阶段。
- **Time**：存在持久化 Run 时，从首个事件到末尾事件的耗时。
- **Repair**：`repair.reviewed` 事件数量。

## 公开用例

| ID | 类型 | 公开 PM 输入 | Clarify | Skill | Done | Tests | Time | Repair | 证据 |
|---|---|---|---:|---|---:|---:|---:|---:|---|
| EVAL-L1-001 | L1 | 在文章列表页每篇文章摘要后面显示“阅读全文”提示文案。 | 否 | `add-article-read-more-hint` | 是 | 通过 | n/a | 0 | `npm run test:l3` 验证 Skill 发现、计划、补丁和修复提示。历史完成 run：`cmq6buloe0047r7s8wfiaqji4`。 |
| EVAL-L1-002 | L1 | 在文章列表卡片中显示每篇文章的标签数量。 | 否 | `add-article-derived-metric` | 是 | 通过 | 9.1s | 0 | Run `cmq66d9s70032r7s87ieclrnz`，16 个事件，4 次模型调用。 |
| EVAL-L1-003 | L1 | 在文章详情页正文下方显示本文字数和预计阅读时间。 | 否 | `add-article-derived-metric` | 是 | 通过 | n/a | 0 | P1 demo 覆盖；可通过 `POST /api/demo/l1/article-reading-stats` 重跑。 |
| EVAL-L2-001 | L2 | 给文章增加 coverImage 字段，编辑文章时可以填写封面图 URL，文章列表和详情页都展示封面图。 | 否 | `add-article-cover-image` | 是 | 通过 | 11.7s | 0 | Run `cmq6p1fg40005r7xogrg69eu3`，15 个事件，4 次模型调用。 |
| EVAL-L2-002 | L2 | 在文章详情页增加“复制文章链接”按钮，点击后复制当前文章 URL，并显示成功提示。 | 否 | `add-article-share-link` | 是 | 通过 | 11.1s | 0 | Run `cmq6j2lzf0000r72sm21k4fwu`，16 个事件，4 次模型调用。 |
| EVAL-L2-003 | L2 保留 | 文章列表新增“仅看有封面图”的筛选开关，URL query、API 参数和数据库查询要保持一致。 | 是 | 待补 `AddFilterSkill` | 不计入 | n/a | n/a | n/a | 公开保留用例。当前系统应澄清或拒绝，直到 filter Skill 存在。 |
| EVAL-L3-001 | L3 | 增加文章草稿流程：编辑器可以保存草稿或发布文章；公开列表和详情页默认只展示已发布文章；作者个人主页需要一个仅作者可见的 Drafts tab。 | 否 | `add-article-draft-workflow` | 是 | 通过 | n/a | 0 | `npm run test:l3` 验证 DSL、Skill 选择、计划和跨栈补丁生成。 |
| EVAL-AMB-001 | 模糊需求 | 让这个博客变得更好。 | 是 | none | 停在澄清 | n/a | 0.1s | 0 | Run `cmq66d92s002or7s8twgqzekg`，状态 `requires_input`，6 个事件，1 次模型调用。 |
| EVAL-AMB-002 | 模糊保留 | 优化文章卡片体验，让它更高级一点。 | 是 | none | 不计入 | n/a | n/a | n/a | 公开模糊需求保留用例。预期行为是追问目标、具体改动和验收标准。 |
| EVAL-CON-001 | 矛盾需求 | 给文章增加封面图字段并持久化到数据库，但不要改后端，只做前端。 | 是 | none | 停在澄清 | 通过 | n/a | 0 | `npm run test:l3` 断言 `clarify-contradiction` 和 `clarify-data-contract` 阻塞问题。 |

## 当前基线汇总

| 分类 | 计入用例 | 通过 / 预期停止 | 说明 |
|---|---:|---:|---|
| L1 | 3 | 3/3 | 两个已实现产品功能，加 P1 阅读统计 demo。 |
| L2 | 2 | 2/2 | 封面图和复制链接流程均有持久化完成 Run。 |
| L3 | 1 | 1/1 | 草稿流程由回归测试覆盖。 |
| 模糊需求 | 1 | 1/1 | 正确停在澄清阶段。 |
| 矛盾需求 | 1 | 1/1 | 正确阻塞自相矛盾的数据契约需求。 |
| 保留用例 | 2 | 不计入 | 用于展示评测诚实性和后续 Skill backlog。 |

计入结果：**8/8 通过或按预期停止**，另有 **2 个 holdout 用例不计入**。

## 重跑命令

运行代码级回归覆盖：

```powershell
npm run test:l3
```

运行平台检查：

```powershell
npm run lint
npm run typecheck
npm run build
```

校验机器可读用例文件：

```powershell
$cases = Get-Content document/evaluation-cases.json -Raw -Encoding UTF8 | ConvertFrom-Json
$cases.Count
```

查询持久化 Run 证据：

```powershell
Invoke-RestMethod http://127.0.0.1:3002/api/runs/cmq66d9s70032r7s87ieclrnz/events
Invoke-RestMethod http://127.0.0.1:3002/api/runs/cmq6p1fg40005r7xogrg69eu3/events
Invoke-RestMethod http://127.0.0.1:3002/api/runs/cmq6j2lzf0000r72sm21k4fwu/events
```

## 建议演示顺序

1. 先演示 `EVAL-L1-002`，展示 L1 快速交付和验证。
2. 再演示 `EVAL-L2-001`，证明跨栈计划和 sandbox 验证能力。
3. 展示 `EVAL-L3-001` 的 `npm run test:l3`，证明复杂流程覆盖。
4. 展示 `EVAL-AMB-001` 和 `EVAL-CON-001`，证明需求不清或自相矛盾时不会强行写代码。
5. 保留 holdout 用例作为后续 benchmark，不宣称当前未支持能力。

# CodeAgent Prompt

只使用 `PackedContext` 中存在的文件作为证据，生成可审计的 `PatchSet`。

每个操作都必须限制在 Conduit sandbox 内，并列出修改路径和修改原因。MVP 补丁操作是 `replace-file`；后续版本可以增加 unified diff 应用能力。

对于 MVP 的文章阅读统计链路，需要新增本地 helper，从 `Article.body` 推导字数和预计阅读分钟数；在 Markdown 正文下方渲染指标行；并添加稳定的 `.article-reading-stats` 样式。

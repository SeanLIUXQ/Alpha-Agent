# Schema 示例

## RequirementDsl

```json
{
  "id": "demo-article-reading-stats",
  "rawText": "在文章详情页正文下方显示本文字数和预计阅读时间。",
  "level": "L1",
  "intent": "add article derived reading metrics",
  "targetSurface": "article detail page",
  "dataSources": ["existing Article.body on the frontend"],
  "displayRules": ["在文章正文下方展示字数和预计阅读时间。"],
  "acceptanceCriteria": [
    "Article.body 存在时，文章详情页渲染字数。",
    "Article.body 存在时，文章详情页渲染预计阅读时间。"
  ],
  "constraints": ["该 L1 需求不需要修改后端或数据库。"],
  "confidence": 0.9
}
```

## ImplementationPlan

```json
{
  "level": "L1",
  "summary": "仅前端修改：在文章详情组件中基于正文计算字数和预计阅读时间。",
  "impact": ["文章详情 React 组件", "全局文章页样式"],
  "candidateFiles": ["frontend/src/routes/Article/Article.jsx", "frontend/src/styles.css"],
  "searchHints": ["Article.body", "article-content", "ArticleTags", "article-page"],
  "verifyCommands": ["npm run test", "npm run build -w frontend"],
  "risks": ["当前 MVP 使用简单空白分词，适合英文或空格分隔正文。"]
}
```

## PatchSet

```json
{
  "summary": "在 Conduit 文章详情页增加字数和预计阅读时间。",
  "evidenceFiles": ["frontend/src/routes/Article/Article.jsx", "frontend/src/styles.css"],
  "operations": [
    {
      "type": "replace-file",
      "path": "frontend/src/routes/Article/Article.jsx",
      "content": "...",
      "reason": "文章详情组件负责渲染 Article.body。"
    }
  ]
}
```

## VerifyResult

```json
{
  "success": true,
  "commands": [
    {
      "command": "npm run test",
      "exitCode": 0,
      "stdout": "...",
      "stderr": ""
    }
  ],
  "attempts": 1
}
```

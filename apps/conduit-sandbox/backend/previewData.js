"use strict";

const author = {
  username: "exampleUser1",
  email: "example1@mail.com",
  bio: "Conduit 本地预览作者，负责演示文章列表、详情页和评论区效果。",
  image: "/src/assets/smiley-cyrus.jpeg",
  followersCount: 0,
  following: false,
  token: "preview-token",
};

const tagList = ["前端", "React", "Vite", "智能体"];

const articles = Array(12)
  .fill(null)
  .map((_, index) => ({
    slug: `preview-article-${index + 1}`,
    title: `预览文章 ${index + 1}`,
    description: "这是一篇用于检查生成效果的本地预览文章摘要。",
    body:
      "这是一段中文正文，用于验证文章详情页的排版、阅读时间和标签展示。Conduit 预览模式会返回稳定的数据，方便在本地检查生成后的 UI 是否符合需求。",
    tagList: tagList.slice(0, 2 + (index % 2)),
    createdAt: new Date(Date.now() - index * 3600_000).toISOString(),
    updatedAt: new Date(Date.now() - index * 1800_000).toISOString(),
    favorited: false,
    favoritesCount: index,
    author,
  }));

function sliceArticles(req) {
  const limit = Number.parseInt(req.query.limit ?? "3", 10);
  const offset = Number.parseInt(req.query.offset ?? "0", 10) * limit;
  return articles.slice(offset, offset + limit);
}

function registerPreviewRoutes(app) {
  app.post("/api/users/login", (req, res) => {
    res.json({ user: { ...author, email: req.body?.user?.email ?? author.email } });
  });

  app.post("/api/users", (req, res) => {
    res.status(201).json({
      user: {
        ...author,
        username: req.body?.user?.username ?? author.username,
        email: req.body?.user?.email ?? author.email,
      },
    });
  });

  app.get("/api/user", (_req, res) => {
    res.json({ user: author });
  });

  app.put("/api/user", (req, res) => {
    res.json({ user: { ...author, ...req.body?.user } });
  });

  app.get("/api/articles", (req, res) => {
    const rows = sliceArticles(req);
    res.json({ articles: rows, articlesCount: articles.length });
  });

  app.get("/api/articles/feed", (req, res) => {
    const rows = sliceArticles(req);
    res.json({ articles: rows, articlesCount: articles.length });
  });

  app.get("/api/articles/:slug", (req, res) => {
    const article = articles.find((item) => item.slug === req.params.slug);
    if (!article) {
      res.status(404).json({ errors: { body: ["文章不存在"] } });
      return;
    }

    res.json({ article });
  });

  app.get("/api/articles/:slug/comments", (req, res) => {
    const article = articles.find((item) => item.slug === req.params.slug);
    if (!article) {
      res.status(404).json({ errors: { body: ["文章不存在"] } });
      return;
    }

    res.json({ comments: [] });
  });

  app.post("/api/articles/:slug/comments", (req, res) => {
    const article = articles.find((item) => item.slug === req.params.slug);
    if (!article) {
      res.status(404).json({ errors: { body: ["文章不存在"] } });
      return;
    }

    res.status(201).json({
      comment: {
        id: Date.now(),
        body: req.body?.comment?.body ?? "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author,
      },
    });
  });

  app.delete("/api/articles/:slug/comments/:commentId", (req, res) => {
    const article = articles.find((item) => item.slug === req.params.slug);
    if (!article) {
      res.status(404).json({ errors: { body: ["文章不存在"] } });
      return;
    }

    res.status(204).send();
  });

  app.get("/api/tags", (_req, res) => {
    res.json({ tags: tagList });
  });

  app.get("/api/profiles/:username", (req, res) => {
    res.json({ profile: { ...author, username: req.params.username } });
  });
}

module.exports = { registerPreviewRoutes };

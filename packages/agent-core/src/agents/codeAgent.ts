import { z } from 'zod';
import { type ImplementationPlan, type PackedContext, type PatchSet, type RequirementDsl, patchSetSchema } from '@alpha-agent/shared';
import type { Skill } from '@alpha-agent/skill-sdk';
import { type AgentModelCall, type AgentModelInvoker, type AgentRunMetadata } from '../model.js';
import { runStructuredJson } from './jsonModel.js';

const articlePath = 'frontend/src/routes/Article/Article.jsx';
const articlesPreviewPath = 'frontend/src/components/ArticlesPreview/ArticlesPreview.jsx';
const stylesPath = 'frontend/src/styles.css';

export interface CodeCandidateResult {
  candidate?: {
    summary: string;
    targetFiles: string[];
    operations: Array<{
      path: string;
      intent: string;
      safetyNotes: string[];
    }>;
  };
  metadata?: AgentRunMetadata;
  modelCalls?: AgentModelCall[];
}

const codeCandidateSchema = z.object({
  summary: z.string().min(1),
  targetFiles: z.array(z.string().min(1)).min(1),
  operations: z
    .array(
      z.object({
        path: z.string().min(1),
        intent: z.string().min(1),
        safetyNotes: z.array(z.string().min(1)).default([])
      }),
    )
    .min(1)
});

const codeCandidateSystemPrompt = [
  'You are CodeAgent for Alpha Agent.',
  'Return one JSON object only. No Markdown.',
  'Generate a candidate patch proposal, not final file contents.',
  'The deterministic system will audit the proposal and apply a safe rule-based patch.',
  'Only reference files that exist in the packed context or are migrations explicitly justified by the plan.',
  'Output shape: {"summary":"...","targetFiles":["..."],"operations":[{"path":"...","intent":"...","safetyNotes":["..."]}]}'
].join('\n');

const codeCandidateRepairPrompt = `${codeCandidateSystemPrompt}\nYou are repairing invalid JSON. Return valid candidate proposal JSON only.`;

const articleContent = `import Markdown from "markdown-to-jsx";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import ArticleMeta from "../../components/ArticleMeta";
import ArticlesButtons from "../../components/ArticlesButtons";
import ArticleTags from "../../components/ArticleTags";
import BannerContainer from "../../components/BannerContainer";
import { useAuth } from "../../context/AuthContext";
import getArticle from "../../services/getArticle";

function getArticleReadingStats(body = "") {
  const plainText = body.replace(/[#>*_\`~\\-[\\]()]/g, " ").replace(/\\s+/g, " ").trim();
  const wordCount = plainText ? plainText.split(" ").length : 0;
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 200));

  return { wordCount, readingMinutes };
}

function Article() {
  const { state } = useLocation();
  const [article, setArticle] = useState(state || {});
  const { title, body, tagList, createdAt, author } = article || {};
  const { headers, isAuth } = useAuth();
  const navigate = useNavigate();
  const { slug } = useParams();
  const { wordCount, readingMinutes } = getArticleReadingStats(body);

  useEffect(() => {
    if (state) return;

    getArticle({ slug, headers })
      .then(setArticle)
      .catch((error) => {
        console.error(error);
        navigate("/not-found", { replace: true });
      });
  }, [isAuth, slug, headers, state, navigate]);

  return (
    <div className="article-page">
      <BannerContainer>
        <h1>{title}</h1>
        <ArticleMeta author={author} createdAt={createdAt}>
          <ArticlesButtons article={article} setArticle={setArticle} />
        </ArticleMeta>
      </BannerContainer>

      <div className="container page">
        <div className="row article-content">
          <div className="col-md-12">
            {body && <Markdown options={{ forceBlock: true }}>{body}</Markdown>}
            {body && (
              <p className="article-reading-stats">
                {wordCount} words &middot; {readingMinutes} min read
              </p>
            )}
            <ArticleTags tagList={tagList} />
          </div>
        </div>

        <hr />

        <div className="article-actions">
          <ArticleMeta author={author} createdAt={createdAt}>
            <ArticlesButtons article={article} setArticle={setArticle} />
          </ArticleMeta>
        </div>

        <Outlet />
      </div>
    </div>
  );
}

export default Article;
`;

function ensureReadingStatsStyle(content: string): string {
  if (content.includes('.article-reading-stats')) {
    return content;
  }

  return `${content.trimEnd()}

.article-reading-stats {
  color: var(--text-light);
  font-size: 0.9rem;
  font-weight: 500;
  margin: 1.5rem 0 0;
}
`;
}

export class CodeAgent {
  constructor(private readonly model?: AgentModelInvoker) {}

  async proposeCandidatePatch(plan: ImplementationPlan, context: PackedContext): Promise<CodeCandidateResult> {
    if (!this.model) {
      return { metadata: { source: 'fallback' } };
    }

    try {
      const structured = await runStructuredJson(this.model, {
        agentName: 'CodeAgent',
        messages: [
          { role: 'system', content: codeCandidateSystemPrompt },
          {
            role: 'user',
            content: JSON.stringify(
              {
                plan: {
                  summary: plan.summary,
                  level: plan.level,
                  candidateFiles: plan.candidateFiles,
                  risks: plan.risks
                },
                contextFiles: context.files.map((file) => ({
                  path: file.path,
                  reason: file.reason,
                  preview: file.content.slice(0, 1200)
                })),
                constraints: context.constraints
              },
              null,
              2,
            )
          }
        ],
        schema: codeCandidateSchema,
        repairSystemPrompt: codeCandidateRepairPrompt,
        temperature: 0,
        maxCompletionTokens: 900
      });

      return {
        candidate: {
          ...structured.data,
          operations: structured.data.operations.map((operation) => ({
            ...operation,
            safetyNotes: operation.safetyNotes ?? []
          }))
        },
        metadata: {
          source: 'model',
          model: structured.raw.model,
          repairAttempted: structured.repairAttempted
        },
        modelCalls: structured.calls
      };
    } catch (error) {
      return {
        metadata: {
          source: 'fallback',
          error: error instanceof Error ? error.message : 'Unknown CodeAgent candidate model error'
        }
      };
    }
  }

  async run(
    input:
      | PackedContext
      | {
          requirement: RequirementDsl;
          plan: ImplementationPlan;
          context: PackedContext;
          skill: Skill<RequirementDsl, ImplementationPlan, PackedContext>;
        },
  ): Promise<PatchSet> {
    const context = 'context' in input ? input.context : input;
    if ('skill' in input && input.skill.generate) {
      return patchSetSchema.parse(
        await input.skill.generate({
          requirement: input.requirement,
          plan: input.plan,
          context
        }),
      );
    }

    if (
      context.files.some((file) => file.path === articlePath) &&
      context.searchedTerms.some((term) => term.includes('navigator.clipboard'))
    ) {
      return this.runArticleShareLinkPatch(context);
    }

    if (
      context.files.some((file) => file.path === 'frontend/src/routes/Profile/ProfileArticles.jsx') &&
      context.files.some((file) => file.path === 'backend/controllers/articles.js')
    ) {
      return this.runDraftWorkflowPatch(context);
    }

    if (context.files.some((file) => file.path === 'backend/models/Article.js')) {
      return this.runCoverImagePatch(context);
    }

    if (context.files.some((file) => file.path === articlesPreviewPath)) {
      return this.runArticleTagCountPatch(context);
    }

    const stylesFile = context.files.find((file) => file.path === stylesPath);

    return patchSetSchema.parse({
      summary: 'Add derived word count and estimated reading time to the Conduit article detail page.',
      evidenceFiles: context.files.map((file) => file.path),
      operations: [
        {
          type: 'replace-file',
          path: articlePath,
          content: articleContent,
          reason: 'Article detail component owns Article.body rendering and can compute derived metrics locally.'
        },
        {
          type: 'replace-file',
          path: stylesPath,
          content: ensureReadingStatsStyle(stylesFile?.content ?? ''),
          reason: 'Global stylesheet contains article page styles and can style the derived metric line.'
        }
      ]
    });
  }

  private async runDraftWorkflowPatch(context: PackedContext): Promise<PatchSet> {
    const files = new Map(context.files.map((file) => [file.path, file.content]));
    const source = (filePath: string) => normalizeSource(files.get(filePath) ?? '');
    const operations = [
      this.replaceOperation(
        'backend/models/Article.js',
        addStatusToArticleModel(source('backend/models/Article.js')),
        'Article model defines persisted article fields and needs status.'
      ),
      this.replaceOperation(
        'backend/index.js',
        addStatusBackfillToBackendStartup(source('backend/index.js')),
        'Backend startup sync should backfill old articles without status to published.'
      ),
      this.replaceOperation(
        'backend/controllers/articles.js',
        addDraftWorkflowToArticleController(source('backend/controllers/articles.js')),
        'Article controller owns list/detail authorization and create/update status mapping.'
      ),
      this.replaceOperation(
        'backend/scripts/seed-preview-data.js',
        addStatusToSeedScript(source('backend/scripts/seed-preview-data.js')),
        'Seed data should keep existing demo articles published by default.'
      ),
      this.replaceOperation(
        'frontend/src/services/setArticle.js',
        addStatusToSetArticle(source('frontend/src/services/setArticle.js')),
        'Frontend article service sends status from editor actions.'
      ),
      this.replaceOperation(
        'frontend/src/services/getArticles.js',
        addDraftsQueryToGetArticles(source('frontend/src/services/getArticles.js')),
        'Article list service needs a draft query mode for profile Drafts tab.'
      ),
      this.replaceOperation(
        'frontend/src/components/ArticleEditorForm/ArticleEditorForm.jsx',
        addDraftActionsToEditorForm(source('frontend/src/components/ArticleEditorForm/ArticleEditorForm.jsx')),
        'Article editor form needs explicit save draft and publish actions.'
      ),
      this.replaceOperation(
        'frontend/src/routes/Profile/Profile.jsx',
        addDraftsTabToProfile(source('frontend/src/routes/Profile/Profile.jsx')),
        'Profile page owns article tab navigation and should expose Drafts.'
      ),
      this.replaceOperation(
        'frontend/src/routes/Profile/ProfileArticles.jsx',
        addDraftsModeToProfileArticles(source('frontend/src/routes/Profile/ProfileArticles.jsx')),
        'Profile article route needs to request draft articles when on Drafts tab.'
      ),
      this.replaceOperation(
        'frontend/src/main.jsx',
        addDraftsRouteToMain(source('frontend/src/main.jsx')),
        'Router outlet tree needs a route target for the Drafts tab.'
      ),
      this.replaceOperation(
        'backend/migrations/20260604000000-add-status-to-articles.js',
        statusMigration,
        'Migration adds Article.status and backfills existing articles to published.'
      )
    ];

    return patchSetSchema.parse({
      summary: 'Add L3 Article draft workflow across backend filtering, editor actions, profile drafts, and migration.',
      evidenceFiles: context.files.map((file) => file.path),
      operations
    });
  }

  private async runCoverImagePatch(context: PackedContext): Promise<PatchSet> {
    const files = new Map(context.files.map((file) => [file.path, file.content]));
    const operations = [
      this.replaceOperation(
        'backend/models/Article.js',
        addCoverImageToArticleModel(files.get('backend/models/Article.js') ?? ''),
        'Article model defines persisted article fields.'
      ),
      this.replaceOperation(
        'backend/controllers/articles.js',
        addCoverImageToArticleController(files.get('backend/controllers/articles.js') ?? ''),
        'Article controller owns create/update field mapping.'
      ),
      this.replaceOperation(
        'frontend/src/services/setArticle.js',
        addCoverImageToSetArticle(files.get('frontend/src/services/setArticle.js') ?? ''),
        'Frontend article service sends editor fields to the API.'
      ),
      this.replaceOperation(
        'frontend/src/components/ArticleEditorForm/ArticleEditorForm.jsx',
        addCoverImageToEditorForm(files.get('frontend/src/components/ArticleEditorForm/ArticleEditorForm.jsx') ?? ''),
        'Article editor form captures cover image URL.'
      ),
      this.replaceOperation(
        'frontend/src/components/ArticlesPreview/ArticlesPreview.jsx',
        addCoverImageToArticlesPreview(files.get('frontend/src/components/ArticlesPreview/ArticlesPreview.jsx') ?? ''),
        'Article preview renders the cover image in lists.'
      ),
      this.replaceOperation(
        'frontend/src/routes/Article/Article.jsx',
        addCoverImageToArticleDetail(files.get('frontend/src/routes/Article/Article.jsx') ?? articleContent),
        'Article detail page renders the cover image above the body.'
      ),
      this.replaceOperation(
        'frontend/src/styles.css',
        addCoverImageStyles(files.get('frontend/src/styles.css') ?? ''),
        'Global stylesheet contains Conduit article page and preview styles.'
      ),
      this.replaceOperation(
        'backend/migrations/20260603000000-add-cover-image-to-articles.js',
        coverImageMigration,
        'Migration adds the coverImage column for persisted articles.'
      )
    ];

    return patchSetSchema.parse({
      summary: 'Add cross-stack Article.coverImage support to the Conduit sandbox.',
      evidenceFiles: context.files.map((file) => file.path),
      operations
    });
  }

  private runArticleTagCountPatch(context: PackedContext): PatchSet {
    const files = new Map(context.files.map((file) => [file.path, file.content]));

    return patchSetSchema.parse({
      summary: 'Add frontend-only article tag counts to Conduit article list preview cards.',
      evidenceFiles: context.files.map((file) => file.path),
      operations: [
        this.replaceOperation(
          articlesPreviewPath,
          addTagCountToArticlesPreview(files.get(articlesPreviewPath) ?? ''),
          'Article preview cards already receive Article.tagList and can derive a display-only count locally.'
        ),
        this.replaceOperation(
          stylesPath,
          addTagCountStyles(files.get(stylesPath) ?? ''),
          'Global stylesheet contains article preview styles and can place the tag count near the existing Read more affordance.'
        )
      ]
    });
  }

  private runArticleShareLinkPatch(context: PackedContext): PatchSet {
    const files = new Map(context.files.map((file) => [file.path, file.content]));

    return patchSetSchema.parse({
      summary: 'Add frontend-only copy article link action to the Conduit article detail page.',
      evidenceFiles: context.files.map((file) => file.path),
      operations: [
        this.replaceOperation(
          articlePath,
          addCopyLinkToArticleDetail(files.get(articlePath) ?? ''),
          'Article detail page owns the current article URL and can provide a copy action without backend changes.'
        ),
        this.replaceOperation(
          stylesPath,
          addCopyLinkStyles(files.get(stylesPath) ?? ''),
          'Global stylesheet contains article action styles and can style copy feedback.'
        )
      ]
    });
  }

  private replaceOperation(path: string, content: string, reason: string) {
    return {
      type: 'replace-file' as const,
      path,
      content,
      reason
    };
  }
}

function addCoverImageToArticleModel(content: string): string {
  if (content.includes('coverImage: DataTypes.STRING')) {
    return content;
  }

  return content.replace('      description: DataTypes.TEXT,\n      body: DataTypes.TEXT,', '      description: DataTypes.TEXT,\n      coverImage: DataTypes.STRING,\n      body: DataTypes.TEXT,');
}

function addCoverImageToArticleController(content: string): string {
  let next = content;
  next = next.replace(
    '    const { title, description, body, tagList } = req.body.article;',
    '    const { title, description, body, coverImage, tagList } = req.body.article;',
  );
  next = next.replace(
    '      description: description,\n      body: body,',
    '      description: description,\n      coverImage: coverImage || "",\n      body: body,',
  );
  next = next.replace(
    '    const { title, description, body } = req.body.article;',
    '    const { title, description, body, coverImage } = req.body.article;',
  );
  next = next.replace(
    '    if (description) article.description = description;\n    if (body) article.body = body;',
    '    if (description) article.description = description;\n    if (coverImage !== undefined) article.coverImage = coverImage;\n    if (body) article.body = body;',
  );

  return next;
}

function addCoverImageToSetArticle(content: string): string {
  let next = content;
  next = next.replace(
    'async function setArticle({ body, description, headers, slug, tagList, title }) {',
    'async function setArticle({ body, coverImage, description, headers, slug, tagList, title }) {',
  );
  next = next.replace(
    '      data: { article: { title, description, body, tagList } },',
    '      data: { article: { title, description, coverImage, body, tagList } },',
  );

  return next;
}

function addCoverImageToEditorForm(content: string): string {
  let next = content;
  next = next.replace(
    'const emptyForm = { title: "", description: "", body: "", tagList: "" };',
    'const emptyForm = { title: "", description: "", coverImage: "", body: "", tagList: "" };',
  );
  next = next.replace(
    '  const [{ title, description, body, tagList }, setForm] = useState(',
    '  const [{ title, description, coverImage, body, tagList }, setForm] = useState(',
  );
  next = next.replace(
    '      .then(({ author: { username }, body, description, tagList, title }) => {',
    '      .then(({ author: { username }, body, coverImage, description, tagList, title }) => {',
  );
  next = next.replace('        setForm({ body, description, tagList, title });', '        setForm({ body, coverImage: coverImage || "", description, tagList, title });');
  next = next.replace(
    '    setArticle({ headers, slug, body, description, tagList, title })',
    '    setArticle({ headers, slug, body, coverImage, description, tagList, title })',
  );
  if (!next.includes('name="coverImage"')) {
    next = next.replace(
      '        <fieldset className="form-group">',
      `        <FormFieldset
          normal
          placeholder="Cover image URL"
          name="coverImage"
          value={coverImage}
          handler={inputHandler}
        ></FormFieldset>

        <fieldset className="form-group">`,
    );
  }

  return dedupeCoverImageFieldsets(next);
}

function addCoverImageToArticlesPreview(content: string): string {
  if (content.includes('article-preview-cover')) {
    return content;
  }

  return content.replace(
    '            <h1>{article.title}</h1>',
    '            {article.coverImage && <img className="article-preview-cover" src={article.coverImage} alt="" />}\n            <h1>{article.title}</h1>',
  );
}

function addTagCountToArticlesPreview(content: string): string {
  if (content.includes('article-tag-count')) {
    return content;
  }

  return content.replace(
    '            <ArticleTags tagList={article.tagList} />',
    '            <span className="article-tag-count">{article.tagList?.length ?? 0} tags</span>\n            <ArticleTags tagList={article.tagList} />',
  );
}

function addTagCountStyles(content: string): string {
  if (content.includes('.article-tag-count')) {
    return content;
  }

  return `${content.trimEnd()}

.article-preview .preview-link .article-tag-count {
  display: inline-flex;
  align-items: center;
  margin-left: 0.75rem;
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 600;
  vertical-align: middle;
}
`;
}

function addCopyLinkToArticleDetail(content: string): string {
  if (content.includes('copy-article-link') && content.includes('writeTextToClipboard')) {
    return content;
  }

  let next = content;

  if (!next.includes('writeTextToClipboard')) {
    next = next.replace(
      'function getArticleReadingStats(body = "") {\n',
      `${copyTextHelper}\n\nfunction getArticleReadingStats(body = "") {\n`,
    );
  }

  if (next.includes('  const copyArticleLink = async () => {')) {
    next = next.replace(
      /  const copyArticleLink = async \(\) => \{\n[\s\S]*?\n  \};/,
      copyArticleLinkHandler,
    );
  } else {
    next = next.replace(
      '  const { wordCount, readingMinutes } = getArticleReadingStats(body);',
      `  const { wordCount, readingMinutes } = getArticleReadingStats(body);
  const [copyStatus, setCopyStatus] = useState("");

${copyArticleLinkHandler}`,
    );
  }

  next = next.replace(
    '        <ArticleMeta author={author} createdAt={createdAt}>\n          <ArticlesButtons article={article} setArticle={setArticle} />\n        </ArticleMeta>\n      </BannerContainer>',
    `        <ArticleMeta author={author} createdAt={createdAt}>
          <ArticlesButtons article={article} setArticle={setArticle} />
        </ArticleMeta>
        <div className="article-share-actions">
          <button className="btn btn-sm btn-outline-secondary copy-article-link" type="button" onClick={copyArticleLink}>
            复制文章链接
          </button>
          {copyStatus && (
            <span className="copy-article-link-status" role="status">
              {copyStatus}
            </span>
          )}
        </div>
      </BannerContainer>`,
  );

  return next;
}

const copyTextHelper = `async function writeTextToClipboard(text) {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy copy path. Some embedded previews deny
      // navigator.clipboard even on localhost.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.padding = "0";
  textarea.style.border = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }

  return copied;
}`;

const copyArticleLinkHandler = `  const copyArticleLink = async () => {
    const articleUrl = window.location.href;
    const copied = await writeTextToClipboard(articleUrl);

    if (copied) {
      setCopyStatus("链接已复制");
    } else {
      setCopyStatus("复制失败，请手动复制地址栏链接");
    }

    window.setTimeout(() => setCopyStatus(""), 2200);
  };`;

function addCopyLinkStyles(content: string): string {
  if (content.includes('.article-share-actions')) {
    return content;
  }

  return `${content.trimEnd()}

.article-share-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

.copy-article-link-status {
  color: var(--text-light);
  font-size: 0.875rem;
  font-weight: 600;
}
`;
}

function addCoverImageToArticleDetail(content: string): string {
  let next = content;
  next = next.replace(
    '  const { title, body, tagList, createdAt, author } = article || {};',
    '  const { title, body, coverImage, tagList, createdAt, author } = article || {};',
  );
  if (next.includes('article-cover-image')) {
    return next;
  }

  return next.replace(
    '          <div className="col-md-12">\n            {body && <Markdown options={{ forceBlock: true }}>{body}</Markdown>}',
    '          <div className="col-md-12">\n            {coverImage && <img className="article-cover-image" src={coverImage} alt="" />}\n            {body && <Markdown options={{ forceBlock: true }}>{body}</Markdown>}',
  );
}

function addCoverImageStyles(content: string): string {
  if (content.includes('.article-cover-image')) {
    return content;
  }

  return `${content.trimEnd()}

.article-cover-image,
.article-preview-cover {
  display: block;
  width: 100%;
  max-height: 360px;
  object-fit: cover;
  border-radius: 6px;
  margin: 0 0 1.5rem;
}

.article-preview-cover {
  max-height: 180px;
  margin-bottom: 1rem;
}
`;
}

function normalizeSource(content: string): string {
  return content.replace(/\r\n/g, '\n');
}

const coverImageMigration = `"use strict";
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Articles", "coverImage", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("Articles", "coverImage");
  },
};
`;

function addStatusToArticleModel(content: string): string {
  if (content.includes('defaultValue: "published"')) {
    return content;
  }
  if (content.includes('status: DataTypes.STRING')) {
    return content.replace(
      '      status: DataTypes.STRING,',
      '      status: {\n        type: DataTypes.STRING,\n        defaultValue: "published",\n      },',
    );
  }

  return content.replace('      body: DataTypes.TEXT,', '      body: DataTypes.TEXT,\n      status: {\n        type: DataTypes.STRING,\n        defaultValue: "published",\n      },');
}

function addStatusBackfillToBackendStartup(content: string): string {
  let next = content;

  next = next.replace(
    '  const { sequelize } = require("./models");',
    '  const { sequelize, Sequelize } = require("./models");',
  );

  if (!next.includes('async function ensureArticleColumns') && !next.includes('async function ensureArticleStatusColumn')) {
    next = next.replace(
      '  (async () => {',
      `  async function ensureArticleStatusColumn() {
    const queryInterface = sequelize.getQueryInterface();
    const columns = await queryInterface.describeTable("Articles");

    if (!columns.status) {
      await queryInterface.addColumn("Articles", "status", {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "published",
      });
    }

    await sequelize.models.Article.update(
      { status: "published" },
      { where: { status: null } },
    );
  }

  (async () => {`,
    );
  }

  next = next.replace(
    '      await sequelize.sync({ alter: true });',
    '      await sequelize.sync();\n      await ensureArticleStatusColumn();',
  );

  if (!next.includes('await ensureArticleStatusColumn();') && !next.includes('await ensureArticleColumns();')) {
    next = next.replace(
      '      await sequelize.sync();',
      '      await sequelize.sync();\n      await ensureArticleStatusColumn();',
    );
  }

  return next;
}

function addDraftWorkflowToArticleController(content: string): string {
  let next = content;
  if (!next.includes('const { Op } = require("sequelize");')) {
    next = next.replace('} = require("../helper/helpers");', '} = require("../helper/helpers");\nconst { Op } = require("sequelize");');
  }
  if (!next.includes('function articleVisibilityWhere')) {
    next = next.replace(
      'const includeOptions = [\n',
      `function articleVisibilityWhere(loggedUser, extraWhere = {}, includeDrafts = false) {
  if (includeDrafts && loggedUser) {
    // Draft listing is intentionally opt-in and owner-scoped.
    return { ...extraWhere, userId: loggedUser.id };
  }

  return { ...extraWhere, [Op.or]: [{ status: "published" }, { status: null }] };
}

function normalizeArticleStatus(status) {
  return status === "draft" ? "draft" : "published";
}

const includeOptions = [\n`,
    );
  }
  next = next.replace(
    '    const { author, tag, favorited, limit = 3, offset = 0 } = req.query;',
    '    const { author, tag, favorited, status, limit = 3, offset = 0 } = req.query;',
  );
  if (!next.includes('where: articleVisibilityWhere(loggedUser')) {
    next = next.replace(
      '      order: [["createdAt", "DESC"]],\n    };',
      '      order: [["createdAt", "DESC"]],\n      where: articleVisibilityWhere(loggedUser, {}, status === "draft"),\n    };',
    );
  }
  next = next.replace(
    '    const { title, description, body, coverImage, tagList } = req.body.article;',
    '    const { title, description, body, coverImage, status, tagList } = req.body.article;',
  );
  next = next.replace(
    '      body: body,\n    });',
    '      body: body,\n      status: normalizeArticleStatus(status),\n    });',
  );
  if (!next.includes('where: articleVisibilityWhere(loggedUser, { userId: authors.map((author) => author.id) })')) {
    next = next.replace(
      '      where: { userId: authors.map((author) => author.id) },',
      '      where: articleVisibilityWhere(loggedUser, { userId: authors.map((author) => author.id) }),',
    );
  }
  if (!next.includes('if (article.status === "draft"')) {
    next = next.replace(
      '    if (!article) throw new NotFoundError("Article");\n\n    appendTagList(article.tagList, article);',
      '    if (!article) throw new NotFoundError("Article");\n    if (article.status === "draft" && loggedUser?.id !== article.author.id) throw new NotFoundError("Article");\n\n    appendTagList(article.tagList, article);',
    );
  }
  next = next.replace(
    '    const { title, description, body, coverImage } = req.body.article;',
    '    const { title, description, body, coverImage, status } = req.body.article;',
  );
  if (!next.includes('if (status) article.status = normalizeArticleStatus(status);')) {
    next = next.replace('    if (body) article.body = body;', '    if (body) article.body = body;\n    if (status) article.status = normalizeArticleStatus(status);');
  }

  return next;
}

function addStatusToSeedScript(content: string): string {
  if (content.includes('status: "published"')) {
    return content;
  }

  return content.replace('        userId: author.id,\n      },', '        userId: author.id,\n        status: "published",\n      },');
}

function addStatusToSetArticle(content: string): string {
  let next = content;
  next = next.replace(
    'async function setArticle({ body, coverImage, description, headers, slug, tagList, title }) {',
    'async function setArticle({ body, coverImage, description, headers, slug, status, tagList, title }) {',
  );
  next = next.replace(
    '      data: { article: { title, description, coverImage, body, tagList } },',
    '      data: { article: { title, description, coverImage, body, status, tagList } },',
  );

  return next;
}

function addDraftsQueryToGetArticles(content: string): string {
  if (content.includes('drafts:')) {
    return content;
  }

  return content.replace(
    '      profile: `api/articles?author=${username}&&limit=${limit}&&offset=${page}`,\n      tag:',
    '      profile: `api/articles?author=${username}&&limit=${limit}&&offset=${page}`,\n      drafts: `api/articles?author=${username}&&status=draft&&limit=${limit}&&offset=${page}`,\n      tag:',
  );
}

function addDraftActionsToEditorForm(content: string): string {
  let next = dedupeCoverImageFieldsets(content);
  if (!next.includes('status: "published"')) {
    next = next.replace(
      'const emptyForm = { title: "", description: "", coverImage: "", body: "", tagList: "" };',
      'const emptyForm = { title: "", description: "", coverImage: "", body: "", tagList: "", status: "published" };',
    );
  }
  next = next.replace(
    '  const [{ title, description, coverImage, body, tagList }, setForm] = useState(',
    '  const [{ title, description, coverImage, body, tagList, status }, setForm] = useState(',
  );
  next = next.replace(
    '      .then(({ author: { username }, body, coverImage, description, tagList, title }) => {',
    '      .then(({ author: { username }, body, coverImage, description, status, tagList, title }) => {',
  );
  next = next.replace(
    '        setForm({ body, coverImage: coverImage || "", description, tagList, title });',
    '        setForm({ body, coverImage: coverImage || "", description, status: status || "published", tagList, title });',
  );
  if (!next.includes('submitWithStatus')) {
    next = next.replace(
      '  const formSubmit = (e) => {\n    e.preventDefault();\n\n    setArticle({ headers, slug, body, coverImage, description, tagList, title })\n      .then((slug) => navigate(`/article/${slug}`))\n      .catch(setErrorMessage);\n  };',
      `  const submitWithStatus = (nextStatus) => {
    setArticle({ headers, slug, body, coverImage, description, status: nextStatus, tagList, title })
      .then((slug) => navigate(nextStatus === "draft" ? \`/profile/\${loggedUser.username}/drafts\` : \`/article/\${slug}\`))
      .catch(setErrorMessage);
  };

  const formSubmit = (e) => {
    e.preventDefault();

    submitWithStatus(status || "published");
  };`,
    );
  }
  if (!next.includes('Save Draft')) {
    next = next.replace(
      '        <button className="btn btn-lg pull-xs-right btn-primary" type="submit">\n          {slug ? "Update Article" : "Publish Article"}\n        </button>',
      `        <button
          className="btn btn-lg pull-xs-right btn-primary"
          type="button"
          onClick={() => submitWithStatus("published")}
        >
          {slug ? "Update Article" : "Publish Article"}
        </button>
        <button
          className="btn btn-lg pull-xs-right btn-outline-secondary"
          type="button"
          onClick={() => submitWithStatus("draft")}
        >
          Save Draft
        </button>`,
    );
  }

  return dedupeCoverImageFieldsets(next);
}

function dedupeCoverImageFieldsets(content: string): string {
  const pattern =
    / {8}<FormFieldset\n {10}normal\n {10}placeholder="Cover image URL"\n {10}name="coverImage"\n {10}value=\{coverImage\}\n {10}handler=\{inputHandler\}\n {8}><\/FormFieldset>\n\n/g;
  let seen = false;

  return content.replace(pattern, (match) => {
    if (seen) {
      return '';
    }

    seen = true;
    return match;
  });
}

function addDraftsTabToProfile(content: string): string {
  if (content.includes('text="Drafts"')) {
    return content;
  }

  return content.replace(
    '              <NavItem text="Favorited Articles" url="favorites" state={state} />',
    '              <NavItem text="Favorited Articles" url="favorites" state={state} />\n              <NavItem text="Drafts" url="drafts" state={state} />',
  );
}

function addDraftsModeToProfileArticles(content: string): string {
  if (content.includes('useLocation')) {
    return content;
  }

  let next = content.replace('import { useParams } from "react-router-dom";', 'import { useLocation, useParams } from "react-router-dom";');
  next = next.replace('  const { username } = useParams();', '  const { username } = useParams();\n  const { pathname } = useLocation();\n  const isDrafts = pathname.endsWith("/drafts");');
  next = next.replace('    location: "profile",', '    location: isDrafts ? "drafts" : "profile",');
  next = next.replace('        location="profile"', '        location={isDrafts ? "drafts" : "profile"}');
  next = next.replace("      <em>Loading {username} articles...</em>", '      <em>Loading {isDrafts ? "draft" : username} articles...</em>');
  next = next.replace('{username} doesn\'t have articles.', '{isDrafts ? "No drafts yet." : `${username} doesn\\\'t have articles.`}');

  return next;
}

function addDraftsRouteToMain(content: string): string {
  if (content.includes('path="drafts" element={<ProfileArticles />}')) {
    return content;
  }

  return content.replace(
    '              <Route path="favorites" element={<ProfileFavArticles />} />',
    '              <Route path="favorites" element={<ProfileFavArticles />} />\n              <Route path="drafts" element={<ProfileArticles />} />',
  );
}

const statusMigration = `"use strict";
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Articles", "status", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "published",
    });
    await queryInterface.sequelize.query("UPDATE \\"Articles\\" SET \\"status\\" = 'published' WHERE \\"status\\" IS NULL");
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("Articles", "status");
  },
};
`;

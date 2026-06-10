import {
  type ImplementationPlan,
  type PackedContext,
  type PatchSet,
  type RequirementDsl,
  implementationPlanSchema,
  patchSetSchema
} from '@alpha-agent/shared';
import type { Skill, SkillMatchResult } from '@alpha-agent/skill-sdk';

const stylesPath = 'frontend/src/styles.css';

const styleBlockStart = '/* Alpha Agent ByteDance-style visual system start */';
const styleBlockEnd = '/* Alpha Agent ByteDance-style visual system end */';

export class RestyleConduitBytedanceSkill implements Skill<RequirementDsl, ImplementationPlan, PackedContext, PatchSet> {
  name = 'restyle-conduit-bytedance';
  version = '0.1.0';
  description = 'Applies a cohesive ByteDance-inspired visual system to the Conduit frontend.';
  tags = ['L2', 'frontend', 'conduit', 'design-system', 'bytedance-style'];
  examples = [
    'Unify the whole Conduit UI into a clean ByteDance-style product design.',
    '让整个项目统一成更接近字节跳动的清爽视觉风格。'
  ];

  async match(input: RequirementDsl): Promise<SkillMatchResult> {
    const text = `${input.intent} ${input.targetSurface} ${input.rawText}`.toLowerCase();
    const matched =
      /conduit|项目|全站|整体|整个|统一|风格|视觉|ui|界面|design|style/.test(text) &&
      /字节|bytedance|抖音|清爽|现代|统一|产品感|科技感/.test(text);

    return {
      matched,
      score: matched ? 0.97 : 0,
      reason: matched
        ? 'Requirement asks for a cohesive ByteDance-style visual refresh across Conduit.'
        : 'Requirement does not target a global Conduit visual refresh.'
    };
  }

  async plan(input: RequirementDsl): Promise<ImplementationPlan> {
    return implementationPlanSchema.parse({
      requirement: input,
      level: 'L2',
      summary: 'Frontend-only visual-system change: unify Conduit with ByteDance-inspired spacing, color, card, nav, form, and feedback styles.',
      impact: [
        'Global design tokens',
        'Navigation and page shell',
        'Article cards and detail pages',
        'Forms, buttons, tabs, tags, pagination, profile and editor surfaces'
      ],
      candidateFiles: [stylesPath],
      searchHints: ['Conduit Minimal CSS', ':root', 'navbar', 'article-preview', 'form-control', 'btn-primary'],
      verifyCommands: ['npm run test', 'npm run build -w frontend'],
      risks: [
        'This is a visual refresh only and should not change routing, data loading, authentication, or API behavior.',
        'The style layer intentionally overrides broad existing selectors, so it should remain isolated in one marked block.'
      ]
    });
  }

  async context(plan: ImplementationPlan) {
    return {
      candidateFiles: plan.candidateFiles,
      searchHints: plan.searchHints
    };
  }

  generate(input: { context: PackedContext }): PatchSet {
    const styles = input.context.files.find((file) => file.path === stylesPath)?.content ?? '';

    return patchSetSchema.parse({
      summary: 'Apply ByteDance-inspired visual system overrides to Conduit.',
      evidenceFiles: input.context.files.map((file) => file.path),
      operations: [
        {
          type: 'replace-file',
          path: stylesPath,
          content: upsertBytedanceStyleBlock(styles),
          reason: 'Global stylesheet owns shared Conduit tokens and cross-page visual styles.'
        }
      ]
    });
  }

  repairHints() {
    return [
      {
        pattern: 'visual-style-block-missing',
        hint: 'Ensure styles.css contains the marked Alpha Agent ByteDance-style visual system block.',
        targetFiles: [stylesPath]
      }
    ];
  }

  handoff() {
    return {
      summary: 'Conduit now has a unified ByteDance-inspired visual system.',
      bullets: [
        '- Added a marked global CSS override block for tokens, navigation, cards, forms, buttons, tabs, tags, and responsive polish.',
        '- Kept the change frontend-only and isolated to styles.css.'
      ]
    };
  }
}

function upsertBytedanceStyleBlock(content: string): string {
  const nextBlock = bytedanceStyleBlock.trim();
  const pattern = new RegExp(`${escapeRegExp(styleBlockStart)}[\\s\\S]*?${escapeRegExp(styleBlockEnd)}`, 'm');

  if (pattern.test(content)) {
    return content.replace(pattern, nextBlock);
  }

  return `${content.trimEnd()}\n\n${nextBlock}\n`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const bytedanceStyleBlock = `
${styleBlockStart}
:root {
  --brand: #00b96b;
  --brand-hover: #00a35f;
  --brand-active: #008f54;
  --brand-dark: #08784a;
  --brand-light: #70e0ae;
  --byte-blue: #1677ff;
  --byte-blue-soft: #edf5ff;
  --byte-green-soft: #eafaf2;
  --byte-bg: #f6f8fb;
  --byte-surface: #ffffff;
  --byte-surface-raised: #ffffff;
  --byte-border: #e8edf5;
  --byte-border-strong: #d8e0ec;
  --byte-text: #142033;
  --byte-muted: #697386;
  --byte-subtle: #9aa4b2;
  --byte-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
  --byte-shadow-strong: 0 18px 46px rgba(15, 23, 42, 0.1);
  --border: var(--byte-border);
  --bg-light: var(--byte-bg);
  --text: var(--byte-text);
  --text-muted: var(--byte-muted);
  --text-light: var(--byte-subtle);
  --input-focus: var(--byte-blue);
}

body {
  color: var(--byte-text);
  background:
    radial-gradient(circle at 12% 0%, rgba(22, 119, 255, 0.06), transparent 28rem),
    linear-gradient(180deg, #fbfcff 0%, var(--byte-bg) 34rem, #f8fafc 100%);
  font-family:
    Inter,
    "PingFang SC",
    "Microsoft YaHei",
    "Source Sans Pro",
    Arial,
    sans-serif;
}

a {
  color: var(--byte-blue);
}

a:hover {
  color: #0f5fd4;
}

.container {
  max-width: 1120px;
}

.navbar {
  min-height: 72px;
  border-bottom: 1px solid rgba(232, 237, 245, 0.9);
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(14px);
}

.navbar .container {
  align-items: center;
  display: flex;
}

.navbar-brand,
.logo-font {
  color: #111827 !important;
  font-weight: 800;
  letter-spacing: 0;
}

.navbar-brand {
  font-size: 1.9rem;
}

.navbar-nav .nav-link {
  border-radius: 9px;
  color: var(--byte-muted);
  font-weight: 650;
  padding: 0.45rem 0.7rem;
  transition:
    background 0.18s ease,
    color 0.18s ease;
}

.navbar-nav .nav-link:hover,
.navbar-nav .nav-link.active {
  background: var(--byte-blue-soft);
  color: var(--byte-blue);
}

.home-page .banner,
.article-page .banner,
.profile-page .user-info {
  border: 1px solid var(--byte-border);
  background: linear-gradient(180deg, #ffffff 0%, #f9fbff 100%);
  box-shadow: var(--byte-shadow);
}

.home-page .banner {
  border-radius: 16px;
  margin: 1rem auto 1.5rem;
  padding: 2.35rem 1.5rem;
}

.home-page .banner h1,
.article-page .banner h1 {
  color: var(--byte-text);
  font-weight: 850;
  letter-spacing: 0;
}

.home-page .banner p {
  color: var(--byte-muted);
}

.home-page .sidebar {
  border: 1px solid var(--byte-border);
  border-radius: 14px;
  background: var(--byte-surface);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
  padding: 1rem;
}

.nav-pills {
  border-bottom: 1px solid var(--byte-border);
  gap: 0.35rem;
}

.nav-pills .nav-link {
  border: 0;
  border-radius: 10px 10px 0 0;
  color: var(--byte-muted);
  font-weight: 700;
  padding: 0.65rem 1rem;
}

.nav-pills .nav-link.active,
.nav-pills .nav-link:hover,
.nav-pills .nav-link.outline-active {
  background: var(--byte-blue-soft);
  border-bottom: 2px solid var(--byte-blue);
  color: var(--byte-blue);
}

.article-preview,
.card,
.auth-page form,
.editor-page form,
.settings-page form {
  border: 1px solid var(--byte-border);
  border-radius: 14px;
  background: var(--byte-surface);
  box-shadow: var(--byte-shadow);
}

.article-preview {
  padding: 1.35rem 1.45rem;
}

.article-preview:hover,
.card:hover {
  border-color: #d8e6ff;
  box-shadow: var(--byte-shadow-strong);
}

.article-preview .preview-link h1,
.profile-page .user-info h4 {
  color: var(--byte-text);
  font-weight: 820;
}

.article-preview:hover .preview-link h1 {
  color: var(--byte-blue);
}

.article-preview .preview-link p,
.card-text,
.profile-page .user-info p {
  color: var(--byte-muted);
}

.article-meta .info .author {
  color: var(--brand);
  font-weight: 760;
}

.article-meta .info .date {
  color: var(--byte-subtle);
}

.article-meta img,
.user-img,
.user-pic,
.comment-author-img {
  border: 1px solid var(--byte-border);
  background: #f3f6fa;
}

.btn {
  border-radius: 9px;
  font-weight: 750;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn-primary {
  border-color: var(--byte-blue);
  background: var(--byte-blue);
  color: #fff;
  box-shadow: 0 8px 18px rgba(22, 119, 255, 0.22);
}

.btn-primary:hover,
.btn-primary:focus {
  border-color: #0f5fd4;
  background: #0f5fd4;
}

.btn-outline-primary {
  border-color: #16c36f;
  color: #0a9f5a;
  background: #fff;
}

.btn-outline-primary:hover,
.btn-outline-primary.active {
  border-color: #16c36f;
  background: var(--byte-green-soft);
  color: #078449;
}

.btn-outline-secondary,
.btn-secondary {
  border-color: var(--byte-border-strong);
  background: #fff;
  color: var(--byte-muted);
}

.btn-outline-secondary:hover,
.btn-secondary:hover {
  border-color: #cbd6e5;
  background: #f7f9fc;
  color: var(--byte-text);
}

.form-control {
  border: 1px solid var(--byte-border-strong);
  border-radius: 10px;
  color: var(--byte-text);
  background: #fff;
  box-shadow: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.form-control:focus {
  border-color: var(--byte-blue);
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.12);
}

.tag-default,
.tag-default.tag-outline {
  border-color: var(--byte-border);
  background: #f7f9fc;
  color: #697386;
  font-weight: 650;
}

.tag-default:hover {
  background: var(--byte-blue-soft);
  color: var(--byte-blue);
}

.article-preview .preview-link .article-preview-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  margin-right: 0.75rem;
}

.article-preview .preview-link .article-read-more-hint {
  color: var(--byte-blue);
  font-size: 0.86rem;
  font-weight: 800;
}

.article-preview .preview-link .article-tag-count {
  border-radius: 999px;
  padding: 0.2rem 0.62rem;
  background: var(--byte-blue-soft);
  color: var(--byte-blue);
  font-weight: 760;
}

.article-page .container.page,
.editor-page .container.page,
.settings-page .container.page,
.auth-page .container.page {
  margin-top: 2rem;
}

.article-page .banner {
  border-radius: 0;
  margin-bottom: 2rem;
}

.article-content {
  color: var(--byte-text);
}

.article-reading-stats,
.copy-article-link-status {
  color: var(--byte-muted);
}

.article-publish-success-banner {
  border-color: #a8e7c8;
  background: #eafff3;
  color: #08784a;
  box-shadow: 0 12px 30px rgba(0, 185, 107, 0.12);
}

.page-link {
  border-color: var(--byte-border);
  color: var(--byte-blue);
  font-weight: 700;
}

.page-item.active .page-link,
.page-item.active .page-link:focus,
.page-item.active .page-link:hover {
  border-color: var(--byte-blue);
  background: var(--byte-blue);
  color: #fff;
}

.error-messages {
  color: #d14343;
  background: #fff2f0;
  border: 1px solid #ffd6d2;
  border-radius: 10px;
  padding: 0.75rem 1rem 0.75rem 2rem;
}

footer {
  border-top: 1px solid var(--byte-border);
  background: rgba(255, 255, 255, 0.82);
}

@media (max-width: 767px) {
  .navbar .container {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
  }

  .home-page .banner {
    border-radius: 12px;
    padding: 1.5rem 1rem;
  }

  .home-page .banner h1 {
    font-size: 2.4rem;
  }

  .article-preview {
    border-radius: 12px;
    padding: 1rem;
  }

  .article-preview .preview-link ul,
  .article-preview .preview-link .article-preview-actions {
    display: flex;
    margin: 0.45rem 0 0;
  }
}
${styleBlockEnd}
`;

export const skill = new RestyleConduitBytedanceSkill();

import {
  type ImplementationPlan,
  type PackedContext,
  type PatchSet,
  type RequirementDsl,
  implementationPlanSchema,
  patchSetSchema
} from '@alpha-agent/shared';
import type { Skill, SkillMatchResult } from '@alpha-agent/skill-sdk';

const articlesPreviewPath = 'frontend/src/components/ArticlesPreview/ArticlesPreview.jsx';
const stylesPath = 'frontend/src/styles.css';

export class AddArticleReadMoreHintSkill implements Skill<RequirementDsl, ImplementationPlan, PackedContext, PatchSet> {
  name = 'add-article-read-more-hint';
  version = '0.1.0';
  description = 'Adds a frontend-only read-more hint after each Conduit article list summary.';
  tags = ['L1', 'frontend', 'conduit', 'article', 'read-more'];
  examples = ['Show "阅读全文" after each article summary on the article list page.'];

  async match(input: RequirementDsl): Promise<SkillMatchResult> {
    const text = `${input.intent} ${input.targetSurface} ${input.rawText}`.toLowerCase();
    const matched =
      /article|文章/.test(text) &&
      /list|列表|card|卡片|summary|摘要/.test(text) &&
      /read more|阅读全文|继续阅读/.test(text);

    return {
      matched,
      score: matched ? 0.95 : 0,
      reason: matched
        ? 'Requirement asks for a read-more hint near article list summaries.'
        : 'Requirement does not match article list read-more hints.'
    };
  }

  async plan(input: RequirementDsl): Promise<ImplementationPlan> {
    return implementationPlanSchema.parse({
      requirement: input,
      level: 'L1',
      summary: 'Frontend-only change: show a read-more hint immediately after each article preview summary.',
      impact: ['Article preview list React component', 'Global article preview styles'],
      candidateFiles: [articlesPreviewPath, stylesPath],
      searchHints: ['ArticlesPreview', 'article.description', 'preview-link', '阅读全文'],
      verifyCommands: ['npm run test', 'npm run build -w frontend'],
      risks: ['The hint is display-only and relies on the existing article detail link wrapping the preview card.']
    });
  }

  async context(plan: ImplementationPlan) {
    return {
      candidateFiles: plan.candidateFiles,
      searchHints: [...plan.searchHints, 'Read more']
    };
  }

  generate(input: { context: PackedContext }): PatchSet {
    const files = new Map(input.context.files.map((file) => [file.path, file.content]));

    return patchSetSchema.parse({
      summary: 'Add frontend-only read-more hints to Conduit article list preview summaries.',
      evidenceFiles: input.context.files.map((file) => file.path),
      operations: [
        {
          type: 'replace-file',
          path: articlesPreviewPath,
          content: addReadMoreHintToArticlesPreview(files.get(articlesPreviewPath) ?? ''),
          reason: 'Article preview cards already render the summary and link to article details.'
        },
        {
          type: 'replace-file',
          path: stylesPath,
          content: addReadMoreHintStyles(files.get(stylesPath) ?? ''),
          reason: 'Global stylesheet contains article preview styles and can style the hint text.'
        }
      ]
    });
  }

  repairHints() {
    return [
      {
        pattern: 'missing-read-more-hint',
        hint: 'If verification or review shows the hint is missing, add article-read-more-hint after article.description in ArticlesPreview.',
        targetFiles: [articlesPreviewPath]
      }
    ];
  }

  handoff() {
    return {
      summary: 'Article list read-more hints were generated, applied, and verified in the Conduit sandbox.',
      bullets: [
        '- Add a "阅读全文" hint after each article preview summary.',
        '- Keep the change frontend-only and reuse the existing article detail link target.'
      ]
    };
  }
}

function addReadMoreHintToArticlesPreview(content: string): string {
  if (content.includes('article-read-more-hint') || content.includes('article-preview-actions')) {
    return content;
  }

  return content.replace(
    '            <p>{article.description}</p>',
    '            <p>{article.description}</p>\n            <span className="article-preview-actions">\n              <span className="article-read-more-hint">阅读全文</span>\n            </span>',
  );
}

function addReadMoreHintStyles(content: string): string {
  if (content.includes('.article-read-more-hint')) {
    return content;
  }

  return `${content.trimEnd()}

.article-preview .preview-link .article-read-more-hint {
  display: inline-flex;
  align-items: center;
  color: var(--primary-color);
  font-size: 0.85rem;
  font-weight: 700;
  margin-top: 0.35rem;
}
`;
}

export const skill = new AddArticleReadMoreHintSkill();

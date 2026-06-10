import { type ImplementationPlan, type RequirementDsl, implementationPlanSchema } from '@alpha-agent/shared';
import type { Skill, SkillMatchResult } from '@alpha-agent/skill-sdk';

export class AddArticleCoverImageSkill implements Skill<RequirementDsl, ImplementationPlan> {
  name = 'add-article-cover-image';
  version = '0.1.0';
  description = 'Adds a cross-stack coverImage field to Conduit articles.';
  tags = ['L2', 'full-stack', 'conduit', 'article', 'cover-image'];
  examples = ['Add a cover image URL field to articles and show it in lists and detail pages.'];

  async match(input: RequirementDsl): Promise<SkillMatchResult> {
    const text = `${input.intent} ${input.targetSurface} ${input.rawText}`.toLowerCase();
    const matched = /article|文章/.test(text) && /cover|image|封面|图片|图像/.test(text);

    return {
      matched,
      score: matched ? 0.91 : 0,
      reason: matched
        ? 'Requirement asks for an article cover image field across backend and frontend.'
        : 'Requirement does not match article cover image changes.'
    };
  }

  async plan(input: RequirementDsl): Promise<ImplementationPlan> {
    return implementationPlanSchema.parse({
      requirement: input,
      level: 'L2',
      summary: 'Cross-stack change: add coverImage to Article persistence, create/update API, editor form, previews, and detail page.',
      impact: [
        'Sequelize Article model and migration',
        'Article create/update controller',
        'Article editor service and form',
        'Article list preview and detail display',
        'Global article image styles'
      ],
      candidateFiles: [
        'backend/models/Article.js',
        'backend/controllers/articles.js',
        'frontend/src/services/setArticle.js',
        'frontend/src/components/ArticleEditorForm/ArticleEditorForm.jsx',
        'frontend/src/components/ArticlesPreview/ArticlesPreview.jsx',
        'frontend/src/routes/Article/Article.jsx',
        'frontend/src/styles.css'
      ],
      searchHints: ['coverImage', 'Article.init', 'createArticle', 'updateArticle', 'setArticle', 'ArticleEditorForm'],
      verifyCommands: ['npm run test', 'npm run build -w frontend'],
      risks: ['Database migration execution still depends on local Conduit database configuration.']
    });
  }
}

export const skill = new AddArticleCoverImageSkill();

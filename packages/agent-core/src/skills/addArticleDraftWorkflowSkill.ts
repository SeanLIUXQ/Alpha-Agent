import { type ImplementationPlan, type RequirementDsl, implementationPlanSchema } from '@alpha-agent/shared';
import type { Skill, SkillMatchResult } from '@alpha-agent/skill-sdk';

export class AddArticleDraftWorkflowSkill implements Skill<RequirementDsl, ImplementationPlan> {
  name = 'add-article-draft-workflow';
  version = '0.1.0';
  description = 'Adds an L3 article draft workflow across persistence, API filtering, editor UI, and profile drafts.';
  tags = ['L3', 'full-stack', 'conduit', 'article', 'draft', 'authorization'];
  examples = ['Add a draft workflow where authors can save drafts and public lists show only published articles.'];

  async match(input: RequirementDsl): Promise<SkillMatchResult> {
    const text = `${input.level} ${input.intent} ${input.targetSurface} ${input.rawText}`.toLowerCase();
    const matched = input.level === 'L3' && /draft|草稿|status/.test(text) && /article|文章/.test(text);

    return {
      matched,
      score: matched ? 0.96 : 0,
      reason: matched
        ? 'Requirement asks for article draft workflow with cross-module authorization and filtering.'
        : 'Requirement does not match the article draft workflow pattern.'
    };
  }

  async plan(input: RequirementDsl): Promise<ImplementationPlan> {
    return implementationPlanSchema.parse({
      requirement: input,
      level: 'L3',
      summary: 'Cross-stack L3 change: add Article.status, draft-aware API filtering, editor publish/draft actions, and profile Drafts tab.',
      impact: [
        'Sequelize Article model and status migration',
        'Article list/feed/detail authorization and filtering',
        'Article create/update status mapping',
        'Article editor draft and publish actions',
        'Profile Drafts tab and article query mode',
        'Seed data default published status'
      ],
      candidateFiles: [
        'backend/models/Article.js',
        'backend/index.js',
        'backend/controllers/articles.js',
        'backend/scripts/seed-preview-data.js',
        'frontend/src/services/setArticle.js',
        'frontend/src/services/getArticles.js',
        'frontend/src/components/ArticleEditorForm/ArticleEditorForm.jsx',
        'frontend/src/routes/Profile/Profile.jsx',
        'frontend/src/routes/Profile/ProfileArticles.jsx',
        'frontend/src/main.jsx',
        'backend/migrations/20260604000000-add-status-to-articles.js'
      ],
      searchHints: ['status', 'draft', 'Article.findAndCountAll', 'ArticleEditorForm', 'ProfileArticles', 'api/articles'],
      verifyCommands: ['npm run test', 'npm run build -w frontend'],
      risks: [
        'Runtime database migration still depends on sequelize sync or applying the generated migration in deployed environments.',
        'MVP authorization uses current loggedUser when available and keeps public endpoints published-only by default.'
      ]
    });
  }
}

export const skill = new AddArticleDraftWorkflowSkill();

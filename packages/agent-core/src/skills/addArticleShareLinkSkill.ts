import { type ImplementationPlan, type RequirementDsl, implementationPlanSchema } from '@alpha-agent/shared';
import type { Skill, SkillMatchResult } from '@alpha-agent/skill-sdk';

export class AddArticleShareLinkSkill implements Skill<RequirementDsl, ImplementationPlan> {
  name = 'add-article-share-link';
  version = '0.1.0';
  description = 'Adds a frontend-only copy article link action to Conduit article detail pages.';
  tags = ['L2', 'frontend', 'conduit', 'article', 'share'];
  examples = ['Add a copy article link button on the article detail page with success feedback.'];

  async match(input: RequirementDsl): Promise<SkillMatchResult> {
    const text = `${input.intent} ${input.targetSurface} ${input.rawText}`.toLowerCase();
    const matched = /article|文章/.test(text) && /copy|clipboard|share|复制|链接|分享/.test(text);

    return {
      matched,
      score: matched ? 0.92 : 0,
      reason: matched
        ? 'Requirement asks for a copy/share link action on an article surface.'
        : 'Requirement does not match article share link changes.'
    };
  }

  async plan(input: RequirementDsl): Promise<ImplementationPlan> {
    return implementationPlanSchema.parse({
      requirement: input,
      level: 'L2',
      summary: 'Frontend-only change: add a copy article link action and success feedback to the article detail page.',
      impact: ['Article detail React component', 'Global article action styles'],
      candidateFiles: ['frontend/src/routes/Article/Article.jsx', 'frontend/src/styles.css'],
      searchHints: ['article-actions', 'navigator.clipboard', 'ArticleMeta', 'article-page'],
      verifyCommands: ['npm run test', 'npm run build -w frontend'],
      risks: ['Clipboard API can require a secure browser context, so the implementation includes a fallback copy path.']
    });
  }
}

export const skill = new AddArticleShareLinkSkill();

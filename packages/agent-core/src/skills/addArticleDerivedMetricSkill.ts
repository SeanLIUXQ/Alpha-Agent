import { type ImplementationPlan, type RequirementDsl, implementationPlanSchema } from '@alpha-agent/shared';
import type { Skill, SkillMatchResult } from '@alpha-agent/skill-sdk';

export class AddArticleDerivedMetricSkill implements Skill<RequirementDsl, ImplementationPlan> {
  name = 'add-article-derived-metric';
  version = '0.1.0';
  description = 'Adds frontend-only derived metrics to Conduit article surfaces.';
  tags = ['L1', 'frontend', 'conduit', 'article'];
  examples = [
    'Show each article tag count on article list cards.',
    'Show article word count and estimated reading time on the detail page.'
  ];

  async match(input: RequirementDsl): Promise<SkillMatchResult> {
    const text = `${input.intent} ${input.targetSurface} ${input.rawText}`.toLowerCase();
    const matched = /article|文章/.test(text) && /read|阅读|word|字数|tag count|tags count|tagcount|标签数量|标签数/.test(text);

    return {
      matched,
      score: matched ? 0.94 : 0,
      reason: matched
        ? 'Requirement targets article metrics that can be derived from existing frontend article data.'
        : 'Requirement does not match article derived metrics.'
    };
  }

  async plan(input: RequirementDsl): Promise<ImplementationPlan> {
    const text = `${input.intent} ${input.targetSurface} ${input.rawText}`.toLowerCase();
    const isTagCountMetric = /tag count|tags count|tagcount|标签数量|标签数/.test(text);

    if (isTagCountMetric) {
      return implementationPlanSchema.parse({
        requirement: input,
        level: 'L1',
        summary: 'Frontend-only change: derive and display tag counts in article list preview cards.',
        impact: ['Article preview list React component', 'Global article preview styles'],
        candidateFiles: ['frontend/src/components/ArticlesPreview/ArticlesPreview.jsx', 'frontend/src/styles.css'],
        searchHints: ['article-preview', 'preview-link', 'ArticleTags', 'tagList'],
        verifyCommands: ['npm run test', 'npm run build -w frontend'],
        risks: ['Tag count is derived from the existing Article.tagList array and depends on API responses continuing to include tagList.']
      });
    }

    return implementationPlanSchema.parse({
      requirement: input,
      level: 'L1',
      summary: 'Frontend-only change: derive word count and estimated reading time in the article detail component.',
      impact: ['Article detail React component', 'Global article page styles'],
      candidateFiles: ['frontend/src/routes/Article/Article.jsx', 'frontend/src/styles.css'],
      searchHints: ['Article.body', 'article-content', 'ArticleTags', 'article-page'],
      verifyCommands: ['npm run test', 'npm run build -w frontend'],
      risks: ['Current MVP uses a simple whitespace-based word count for English-like article bodies.']
    });
  }
}

export const skill = new AddArticleDerivedMetricSkill();

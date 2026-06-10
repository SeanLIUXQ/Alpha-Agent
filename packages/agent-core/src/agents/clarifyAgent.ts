import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  type ClarifyQuestion,
  type RequirementDsl,
  clarifyQuestionSchema,
  requirementDslSchema
} from '@alpha-agent/shared';
import { type AgentModelCall, type AgentModelInvoker, type AgentRunMetadata } from '../model.js';
import { runStructuredJson } from './jsonModel.js';

export interface ClarifyResult {
  dsl?: RequirementDsl;
  questions: ClarifyQuestion[];
  metadata?: AgentRunMetadata;
  modelCalls?: AgentModelCall[];
}

const clarifyModelOutputSchema = z.object({
  dsl: requirementDslSchema.nullable(),
  questions: z.array(clarifyQuestionSchema).default([]),
  decision: z.enum(['ready', 'requires_input']),
  rationale: z.string().min(1)
});

const clarifySystemPrompt = [
  'You are ClarifyAgent for Alpha Agent, an autonomous coding workflow for the local Conduit RealWorld app.',
  'Return one JSON object only. No Markdown.',
  'Your job is to convert a product-manager requirement into RequirementDsl, or ask blocking clarification questions only when the target, data source, or acceptance criteria cannot be inferred safely.',
  'Known supported Conduit skills:',
  '- L1 article derived metrics: reading time, word count, tag count on list cards; frontend-only.',
  '- L2 article cover image: backend/model/API/editor/list/detail changes.',
  '- L2 article share link: copy current article URL on detail page; frontend-only.',
  '- L2 author hover card: show author name, bio, follower count, and profile entry when hovering article list author avatar/name; frontend-only with existing author/profile fields and safe follower-count fallback.',
  '- L2 article publish success banner: after publishing an article, show a temporary green success banner on article detail; frontend-only.',
  '- L2 Conduit ByteDance-style visual refresh: global frontend design-system CSS refresh; frontend-only.',
  '- L3 article draft workflow: status field, editor draft/publish, owner-only draft listing/detail.',
  'If a request matches one known skill, set decision="ready", provide dsl, and questions=[].',
  'If the request is contradictory or unsupported, set decision="requires_input", dsl=null, and include 1-2 blocking questions.',
  'Use Chinese in user-facing questions when the requirement is Chinese.',
  'Output shape: {"decision":"ready|requires_input","dsl": RequirementDsl|null,"questions": ClarifyQuestion[],"rationale":"..."}'
].join('\n');

const clarifyRepairPrompt = `${clarifySystemPrompt}\nYou are repairing invalid JSON. Preserve the original intent and return valid JSON only.`;

function tryKnownPublishSuccessBannerDsl(rawRequirement: string): RequirementDsl | undefined {
  const text = rawRequirement.trim();
  const lowerText = text.toLowerCase();
  const matched =
    /文章|article/.test(lowerText) &&
    /发布|publish|published/.test(lowerText) &&
    /成功|success|提示|横幅|banner|自动消失|消失/.test(lowerText);

  if (!text || !matched) {
    return undefined;
  }

  return requirementDslSchema.parse({
    id: randomUUID(),
    rawText: text,
    level: 'L2',
    intent: 'add article publish success banner',
    targetSurface: 'article editor publish flow and article detail page',
    dataSources: ['article editor publish action', 'article detail route state'],
    displayRules: [
      'After publishing an article, show a green success banner at the top of the article detail page.',
      'The banner text is "文章已发布" and it automatically disappears after a few seconds.'
    ],
    acceptanceCriteria: [
      'Publishing an article navigates to article detail and displays the "文章已发布" banner.',
      'The success banner automatically disappears after a few seconds.',
      'No backend or database change is required.'
    ],
    constraints: ['Frontend-only transient feedback using route state.'],
    confidence: 0.94
  });
}

function tryKnownReadMoreHintDsl(rawRequirement: string): RequirementDsl | undefined {
  const text = rawRequirement.trim();
  const lowerText = text.toLowerCase();
  const matched =
    /文章|article/.test(lowerText) &&
    /列表|卡片|摘要|list|card|summary/.test(lowerText) &&
    /阅读全文|继续阅读|read more/.test(lowerText);

  if (!text || !matched) {
    return undefined;
  }

  return requirementDslSchema.parse({
    id: randomUUID(),
    rawText: text,
    level: 'L1',
    intent: 'add article list read more hint',
    targetSurface: 'article list preview cards',
    dataSources: ['existing Article.description on the frontend'],
    displayRules: ['Show "阅读全文" immediately after each article preview summary.'],
    acceptanceCriteria: [
      'Article list preview cards render "阅读全文" after every summary.',
      'The hint is frontend-only and keeps the existing article detail link behavior.'
    ],
    constraints: ['No backend or database change is required.'],
    confidence: 0.95
  });
}

function tryKnownShareLinkDsl(rawRequirement: string): RequirementDsl | undefined {
  const text = rawRequirement.trim();
  const lowerText = text.toLowerCase();
  const matched =
    /文章|article/.test(lowerText) &&
    /详情|detail|当前/.test(lowerText) &&
    /复制|链接|分享|剪贴板|copy|clipboard|share|url|link/.test(lowerText);

  if (!text || !matched) {
    return undefined;
  }

  return requirementDslSchema.parse({
    id: randomUUID(),
    rawText: text,
    level: 'L2',
    intent: 'add article copy link action',
    targetSurface: 'article detail page',
    dataSources: ['current browser URL and Article.slug on the frontend'],
    displayRules: ['Show a copy article link button on the article detail page and display success feedback after copying.'],
    acceptanceCriteria: [
      'Article detail page renders a copy article link button.',
      'Clicking the copy button copies the current article URL and displays a success message.'
    ],
    constraints: ['No backend or database change is required; use frontend clipboard behavior with fallback.'],
    confidence: 0.93
  });
}

function tryKnownAuthorHoverCardDsl(rawRequirement: string): RequirementDsl | undefined {
  const text = rawRequirement.trim();
  const lowerText = text.toLowerCase();
  const matched =
    /文章|article/.test(lowerText) &&
    /列表|卡片|预览|list|card|preview/.test(lowerText) &&
    /作者|author/.test(lowerText) &&
    /悬浮|浮层|hover|popover|tooltip|信息卡|资料卡/.test(lowerText);

  if (!text || !matched) {
    return undefined;
  }

  return requirementDslSchema.parse({
    id: randomUUID(),
    rawText: text,
    level: 'L2',
    intent: 'add author hover card on article list',
    targetSurface: 'article list author meta',
    dataSources: [
      'existing article.author fields on the frontend',
      'author.username, author.bio, author.followersCount, and profile route'
    ],
    displayRules: [
      'Hovering or focusing the author avatar or author name on article list cards shows a compact author card.',
      'The card shows author name, bio, follower count, and a "查看主页" entry.',
      'If followersCount is missing, display 0 followers instead of blocking implementation.'
    ],
    acceptanceCriteria: [
      'Article list author avatar and name expose an author hover card on hover and keyboard focus.',
      'The card displays author name, bio or a fallback empty-state copy, follower count, and a profile link.',
      'The change is frontend-only and does not require a new backend API.'
    ],
    constraints: ['Use existing Conduit author/profile data and safe fallback values.'],
    confidence: 0.92
  });
}

function tryKnownBytedanceStyleDsl(rawRequirement: string): RequirementDsl | undefined {
  const text = rawRequirement.trim();
  const lowerText = text.toLowerCase();
  const matched =
    /conduit|项目|全站|整体|整个|统一|风格|视觉|ui|界面|design|style/.test(lowerText) &&
    /字节|bytedance|抖音|清爽|现代|统一|产品感|科技感/.test(lowerText);

  if (!text || !matched) {
    return undefined;
  }

  return requirementDslSchema.parse({
    id: randomUUID(),
    rawText: text,
    level: 'L2',
    intent: 'restyle conduit with bytedance inspired design system',
    targetSurface: 'global Conduit frontend visual system',
    dataSources: ['existing Conduit frontend CSS and component class names'],
    displayRules: [
      'Unify Conduit with a clean ByteDance-inspired visual system.',
      'Refresh navigation, article cards, tabs, buttons, forms, tags, profile/editor surfaces, and responsive polish.'
    ],
    acceptanceCriteria: [
      'The global stylesheet contains a marked ByteDance-style visual system block.',
      'The change is frontend-only and does not alter API, routing, authentication, or data behavior.',
      'Conduit tests and frontend build pass.'
    ],
    constraints: ['Keep the visual refresh isolated to styles.css where possible.'],
    confidence: 0.96
  });
}

export class ClarifyAgent {
  constructor(private readonly model?: AgentModelInvoker) {}

  async run(rawRequirement: string): Promise<ClarifyResult> {
    const knownPatternDsl =
      tryKnownPublishSuccessBannerDsl(rawRequirement) ??
      tryKnownReadMoreHintDsl(rawRequirement) ??
      tryKnownShareLinkDsl(rawRequirement) ??
      tryKnownAuthorHoverCardDsl(rawRequirement) ??
      tryKnownBytedanceStyleDsl(rawRequirement);

    if (this.model) {
      try {
        const structured = await runStructuredJson(this.model, {
          agentName: 'ClarifyAgent',
          messages: [
            { role: 'system', content: clarifySystemPrompt },
            { role: 'user', content: rawRequirement }
          ],
          schema: clarifyModelOutputSchema,
          repairSystemPrompt: clarifyRepairPrompt,
          temperature: 0,
          maxCompletionTokens: 900
        });
        const dsl = structured.data.dsl
          ? requirementDslSchema.parse({
              ...structured.data.dsl,
              id: structured.data.dsl.id || randomUUID(),
              rawText: structured.data.dsl.rawText || rawRequirement.trim()
            })
          : knownPatternDsl;

        return {
          dsl,
          questions:
            dsl || structured.data.decision === 'ready'
              ? []
              : (structured.data.questions ?? []).map((question) => clarifyQuestionSchema.parse(question)),
          metadata: {
            source: 'model',
            model: structured.raw.model,
            repairAttempted: structured.repairAttempted
          },
          modelCalls: structured.calls
        };
      } catch (error) {
        const fallback = this.runRuleBased(rawRequirement);
        return {
          ...fallback,
          metadata: {
            source: 'fallback',
            error: error instanceof Error ? error.message : 'Unknown ClarifyAgent model error'
          }
        };
      }
    }

    return {
      ...this.runRuleBased(rawRequirement),
      metadata: { source: 'fallback' }
    };
  }

  private runRuleBased(rawRequirement: string): ClarifyResult {
    const text = rawRequirement.trim();
    const lowerText = text.toLowerCase();
    const knownPatternDsl =
      tryKnownPublishSuccessBannerDsl(text) ??
      tryKnownReadMoreHintDsl(text) ??
      tryKnownShareLinkDsl(text) ??
      tryKnownAuthorHoverCardDsl(text) ??
      tryKnownBytedanceStyleDsl(text);

    if (knownPatternDsl) {
      return {
        dsl: knownPatternDsl,
        questions: []
      };
    }

    const mentionsArticle = /文章|article/.test(lowerText);
    const mentionsList = /列表|卡片|预览|list|card|preview/.test(lowerText);
    const mentionsTagCount = /标签数量|标签数|tag count|tags count|tagcount|tag-count/.test(lowerText);
    const mentionsStats = /字数|阅读|读时|阅读时间|预计|时间|read|word|minute|min/.test(lowerText);
    const mentionsCoverImage = /封面|图片|图像|cover|image/.test(lowerText);
    const mentionsShareLink = /复制|链接|分享|剪贴板|copy|clipboard|share|url|link/.test(lowerText);
    const mentionsDraft = /草稿|draft|发布|publish|published|status/.test(lowerText);
    const mentionsFilter = /筛选|过滤|filter|列表|list/.test(lowerText);
    const mentionsPermission = /权限|作者|本人|登录|permission|author|owner|login/.test(lowerText);
    const mentionsDatabase = /数据库|后端|接口|api|字段|持久|database|backend|model|migration/.test(lowerText);
    const asksNoBackend = /不改后端|不要后端|纯前端|no backend|frontend only/.test(lowerText);
    const asksPersisted = /保存|持久|数据库|字段|create|update|新建|编辑|persist|database/.test(lowerText);
    const isContradictory = asksNoBackend && (mentionsCoverImage || mentionsDraft || asksPersisted || mentionsDatabase);
    const isL3Pattern = mentionsArticle && mentionsDraft && (mentionsFilter || mentionsPermission || mentionsDatabase);
    const isTagCountPattern = mentionsArticle && mentionsList && mentionsTagCount;
    const isShareLinkPattern = mentionsArticle && mentionsShareLink;
    const isReadMorePattern = mentionsArticle && mentionsList && /阅读全文|继续阅读|read more/.test(lowerText);
    const recognizedPattern = mentionsArticle && (mentionsStats || mentionsCoverImage || isL3Pattern || isTagCountPattern || isShareLinkPattern || isReadMorePattern);

    if (!text) {
      return {
        questions: [
          {
            id: 'clarify-target',
            question: '请补充目标页面或组件、数据来源和验收标准。',
            reason: '当前需求没有匹配到已注册的 Skill 模式，无法确定安全实现路径。',
            blocking: true
          }
        ]
      };
    }

    if (isContradictory) {
      return {
        questions: [
          {
            id: 'clarify-contradiction',
            question: '这是需要后端持久化的改动，还是只做前端展示？',
            reason: '需求同时要求持久化或新增文章能力，又限制不能改后端，存在实现边界冲突。',
            blocking: true
          },
          {
            id: 'clarify-data-contract',
            question: '哪些 Article 字段和 API 响应允许改变？',
            reason: '需要先明确数据契约边界，才能保证前后端一致性。',
            blocking: true
          }
        ]
      };
    }

    if (!recognizedPattern) {
      return {
        questions: [
          {
            id: 'clarify-target',
            question: '请补充目标页面或组件、数据来源和验收标准。',
            reason: '当前需求没有匹配到已注册的 Skill 模式，无法确定安全实现路径。',
            blocking: true
          }
        ]
      };
    }

    const dsl = requirementDslSchema.parse({
      id: randomUUID(),
      rawText: text,
      level: isL3Pattern ? 'L3' : mentionsArticle && (mentionsStats || isTagCountPattern) && !mentionsCoverImage ? 'L1' : 'L2',
      intent: isL3Pattern
        ? 'add article draft workflow with cross-module rules'
        : mentionsArticle && mentionsCoverImage
        ? 'add article cover image field'
        : isShareLinkPattern
        ? 'add article copy link action'
        : isReadMorePattern
        ? 'add article list read more hint'
        : isTagCountPattern
        ? 'add article list tag count metric'
        : mentionsArticle && mentionsStats
          ? 'add article derived reading metrics'
          : text,
      targetSurface: isL3Pattern
        ? 'article editor, article lists, profile drafts, and article detail routing'
        : isTagCountPattern
          ? 'article list preview cards'
        : isShareLinkPattern
          ? 'article detail page'
        : isReadMorePattern
          ? 'article list preview cards'
        : mentionsArticle
          ? 'article detail page'
          : 'unknown application surface',
      dataSources: isL3Pattern
        ? ['new Article.status field persisted by backend API', 'current user identity from auth context']
        : mentionsArticle && mentionsCoverImage
        ? ['new Article.coverImage field persisted by backend API']
        : isShareLinkPattern
        ? ['current browser URL and Article.slug on the frontend']
        : isReadMorePattern
        ? ['existing Article.description on the frontend']
        : isTagCountPattern
        ? ['existing Article.tagList on the frontend']
        : mentionsArticle
          ? ['existing Article.body on the frontend']
          : [],
      displayRules: isL3Pattern
        ? [
            'Draft articles are visible only to their author.',
            'Public article lists show published articles by default.',
            'Profile page exposes a Drafts tab for the owner.'
          ]
        : mentionsCoverImage
        ? ['Show article cover image in editor, list preview, and detail page.']
        : isShareLinkPattern
        ? ['Show a copy article link button on the article detail page and display success feedback after copying.']
        : isReadMorePattern
        ? ['Show "阅读全文" immediately after each article preview summary.']
        : isTagCountPattern
        ? ['Show each article tag count on article list preview cards.']
        : ['Show word count and estimated reading time below the article body.'],
      acceptanceCriteria: [
        isL3Pattern
          ? 'Article editor can save draft and published status.'
          : mentionsCoverImage
          ? 'Article create/update payloads include coverImage.'
          : isShareLinkPattern
          ? 'Article detail page renders a copy article link button.'
          : isReadMorePattern
          ? 'Article list preview cards render "阅读全文" after every summary.'
          : isTagCountPattern
          ? 'Article list preview cards render a visible tag count derived from Article.tagList.'
          : 'Article detail page renders word count when Article.body is present.',
        isL3Pattern
          ? 'Unauthorized users cannot see another author draft in lists or detail.'
          : mentionsCoverImage
          ? 'Article list and detail pages render coverImage when present.'
          : isShareLinkPattern
          ? 'Clicking the copy button copies the current article URL and displays a success message.'
          : isReadMorePattern
          ? 'The hint is frontend-only and keeps the existing article detail link behavior.'
          : isTagCountPattern
          ? 'Articles without tags render 0 tags without backend changes.'
          : 'Article detail page renders estimated reading time when Article.body is present.'
      ],
      constraints: isL3Pattern
        ? [
            'Requires database, backend API, frontend routing, editor UI, list filtering, and authorization checks.',
            'Needs explicit handling for old articles without status.'
          ]
        : mentionsCoverImage
        ? ['Requires backend, database migration, and frontend changes.']
        : isShareLinkPattern
        ? ['No backend or database change is required; use frontend clipboard behavior with fallback.']
        : ['No backend or database change is required for this L1 requirement.'],
      confidence: isL3Pattern || mentionsArticle && (mentionsStats || mentionsCoverImage || isTagCountPattern || isShareLinkPattern) ? 0.9 : 0.55
    });

    return { dsl, questions: [] };
  }
}

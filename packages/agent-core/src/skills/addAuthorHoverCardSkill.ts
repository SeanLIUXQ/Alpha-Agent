import {
  type ImplementationPlan,
  type PackedContext,
  type PatchSet,
  type RequirementDsl,
  implementationPlanSchema,
  patchSetSchema
} from '@alpha-agent/shared';
import type { Skill, SkillMatchResult } from '@alpha-agent/skill-sdk';

const articleMetaPath = 'frontend/src/components/ArticleMeta/ArticleMeta.jsx';
const stylesPath = 'frontend/src/styles.css';

export class AddAuthorHoverCardSkill implements Skill<RequirementDsl, ImplementationPlan, PackedContext, PatchSet> {
  name = 'add-author-hover-card';
  version = '0.1.0';
  description = 'Adds a frontend-only author hover card to article list/detail author metadata.';
  tags = ['L2', 'frontend', 'conduit', 'author', 'hover-card'];
  examples = [
    '在文章列表增加作者悬浮信息卡，鼠标悬停作者头像或作者名时展示作者名、简介、粉丝数和查看主页入口。'
  ];

  async match(input: RequirementDsl): Promise<SkillMatchResult> {
    const text = `${input.intent} ${input.targetSurface} ${input.rawText}`.toLowerCase();
    const matched =
      /article|文章/.test(text) &&
      /author|作者/.test(text) &&
      /hover|popover|tooltip|悬浮|浮层|信息卡|资料卡/.test(text);

    return {
      matched,
      score: matched ? 0.96 : 0,
      reason: matched
        ? 'Requirement asks for an author hover information card on article author metadata.'
        : 'Requirement does not match author hover card behavior.'
    };
  }

  async plan(input: RequirementDsl): Promise<ImplementationPlan> {
    return implementationPlanSchema.parse({
      requirement: input,
      level: 'L2',
      summary: 'Frontend-only change: add a hover/focus author information card to Conduit article author metadata.',
      impact: ['Article author metadata component', 'Global author hover-card styles'],
      candidateFiles: [articleMetaPath, stylesPath],
      searchHints: ['ArticleMeta', 'author.bio', 'followersCount', 'profile', 'article-meta'],
      verifyCommands: ['npm run test', 'npm run build -w frontend'],
      risks: [
        'Article list payloads may omit bio or followersCount, so the UI must use fallback text and 0 followers.',
        'Hover content must stay keyboard accessible through focus-within styles.'
      ]
    });
  }

  async context(plan: ImplementationPlan) {
    return {
      candidateFiles: plan.candidateFiles,
      searchHints: [...plan.searchHints, 'author hover card']
    };
  }

  generate(input: { context: PackedContext }): PatchSet {
    const files = new Map(input.context.files.map((file) => [file.path, file.content]));

    return patchSetSchema.parse({
      summary: 'Add frontend-only author hover card to article author metadata.',
      evidenceFiles: input.context.files.map((file) => file.path),
      operations: [
        {
          type: 'replace-file',
          path: articleMetaPath,
          content: addAuthorHoverCard(files.get(articleMetaPath) ?? ''),
          reason: 'ArticleMeta already receives author profile fields and owns the avatar/name interaction surface.'
        },
        {
          type: 'replace-file',
          path: stylesPath,
          content: addAuthorHoverCardStyles(files.get(stylesPath) ?? ''),
          reason: 'Global stylesheet can implement hover/focus visibility, positioning, and responsive behavior.'
        }
      ]
    });
  }

  repairHints() {
    return [
      {
        pattern: 'missing-author-hover-card',
        hint: 'If the hover card is missing, add article-author-hover-card markup in ArticleMeta and reveal it with hover/focus-within CSS.',
        targetFiles: [articleMetaPath, stylesPath]
      }
    ];
  }

  handoff() {
    return {
      summary: 'Author hover cards were added to article metadata using existing Conduit author/profile fields.',
      bullets: [
        '- Hovering or focusing author avatar/name reveals author name, bio, follower count, and a profile entry.',
        '- Missing bio or followersCount now degrades to friendly frontend fallback values.'
      ],
      risks: ['The follower count depends on the article/profile payload; missing values display as 0.']
    };
  }
}

function addAuthorHoverCard(content: string): string {
  if (content.includes('article-author-hover-card')) {
    return content;
  }

  return `import { Link } from "react-router-dom";
import dateFormatter from "../../helpers/dateFormatter";
import Avatar from "../Avatar";

function ArticleMeta({ author, children, createdAt }) {
  const { bio, followersCount, following, image, username } = author || {};
  const profileState = { bio, followersCount, following, image, username };
  const displayName = username || "匿名作者";
  const displayBio = bio || "这位作者还没有填写简介。";
  const followerTotal = Number.isFinite(Number(followersCount)) ? Number(followersCount) : 0;

  return (
    <div className="article-meta article-meta-with-hover-card">
      <div className="article-author-hover-trigger">
        <Link
          aria-label={\`查看 \${displayName} 的主页\`}
          state={profileState}
          to={\`/profile/\${username}\`}
        >
          <Avatar alt={displayName} src={image} />
        </Link>
        <div className="info">
          <Link
            className="author"
            state={profileState}
            to={\`/profile/\${username}\`}
          >
            {displayName}
          </Link>
          <span className="date">{dateFormatter(createdAt)}</span>
        </div>
        <div className="article-author-hover-card" role="tooltip">
          <div className="article-author-hover-card-header">
            <Avatar alt={displayName} src={image} />
            <div>
              <strong>{displayName}</strong>
              <span>{followerTotal} 位粉丝</span>
            </div>
          </div>
          <p>{displayBio}</p>
          <Link className="article-author-hover-card-link" state={profileState} to={\`/profile/\${username}\`}>
            查看主页
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}

export default ArticleMeta;
`;
}

function addAuthorHoverCardStyles(content: string): string {
  if (content.includes('.article-author-hover-card')) {
    return content;
  }

  return `${content.trimEnd()}

.article-meta-with-hover-card {
  position: relative;
}

.article-author-hover-trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.article-author-hover-card {
  position: absolute;
  left: 0;
  top: calc(100% + 10px);
  z-index: 30;
  width: min(280px, calc(100vw - 32px));
  padding: 14px;
  border: 1px solid rgba(22, 119, 255, 0.16);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 18px 46px rgba(20, 28, 45, 0.15);
  color: var(--byte-text, #1f2937);
  opacity: 0;
  pointer-events: none;
  transform: translateY(6px);
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.article-author-hover-card::before {
  position: absolute;
  left: 18px;
  top: -6px;
  width: 10px;
  height: 10px;
  border-left: 1px solid rgba(22, 119, 255, 0.16);
  border-top: 1px solid rgba(22, 119, 255, 0.16);
  background: #fff;
  content: "";
  transform: rotate(45deg);
}

.article-author-hover-trigger:hover .article-author-hover-card,
.article-author-hover-trigger:focus-within .article-author-hover-card {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.article-author-hover-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.article-author-hover-card-header img {
  width: 38px;
  height: 38px;
}

.article-author-hover-card-header strong {
  display: block;
  color: var(--byte-text, #1f2937);
  font-size: 0.98rem;
  line-height: 1.2;
}

.article-author-hover-card-header span {
  color: var(--byte-muted, #6b7280);
  font-size: 0.82rem;
  font-weight: 650;
}

.article-author-hover-card p {
  margin: 10px 0 12px;
  color: var(--byte-muted, #6b7280);
  font-size: 0.86rem;
  line-height: 1.55;
}

.article-author-hover-card-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--byte-blue-soft, #eef5ff);
  color: var(--byte-blue, #1677ff);
  font-size: 0.84rem;
  font-weight: 760;
}

.article-author-hover-card-link:hover,
.article-author-hover-card-link:focus {
  background: var(--byte-blue, #1677ff);
  color: #fff;
  text-decoration: none;
}

@media (max-width: 767px) {
  .article-author-hover-card {
    left: -8px;
    width: min(260px, calc(100vw - 40px));
  }
}
`;
}

export const skill = new AddAuthorHoverCardSkill();

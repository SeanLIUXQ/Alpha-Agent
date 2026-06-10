import {
  type ImplementationPlan,
  type PackedContext,
  type PatchSet,
  type RequirementDsl,
  implementationPlanSchema,
  patchSetSchema
} from '@alpha-agent/shared';
import type { Skill, SkillMatchResult } from '@alpha-agent/skill-sdk';

const editorFormPath = 'frontend/src/components/ArticleEditorForm/ArticleEditorForm.jsx';
const articlePath = 'frontend/src/routes/Article/Article.jsx';
const stylesPath = 'frontend/src/styles.css';

export class AddArticlePublishSuccessBannerSkill implements Skill<RequirementDsl, ImplementationPlan, PackedContext, PatchSet> {
  name = 'add-article-publish-success-banner';
  version = '0.1.0';
  description = 'Shows a temporary success banner on article detail after publishing an article.';
  tags = ['L2', 'frontend', 'conduit', 'article', 'success-feedback'];
  examples = ['After publishing an article, show a green success banner on article detail and hide it after a few seconds.'];

  async match(input: RequirementDsl): Promise<SkillMatchResult> {
    const text = `${input.intent} ${input.targetSurface} ${input.rawText}`.toLowerCase();
    const matched =
      /article|文章/.test(text) &&
      /publish|发布|published/.test(text) &&
      /success|成功|banner|横幅|提示/.test(text);

    return {
      matched,
      score: matched ? 0.96 : 0,
      reason: matched
        ? 'Requirement asks for success feedback after publishing an article.'
        : 'Requirement does not match article publish success feedback.'
    };
  }

  async plan(input: RequirementDsl): Promise<ImplementationPlan> {
    return implementationPlanSchema.parse({
      requirement: input,
      level: 'L2',
      summary: 'Frontend-only change: pass publish success state from editor to article detail and show an auto-dismiss success banner.',
      impact: ['Article editor submit navigation', 'Article detail route state handling', 'Global article feedback styles'],
      candidateFiles: [editorFormPath, articlePath, stylesPath],
      searchHints: ['ArticleEditorForm', 'navigate(`/article/${nextSlug}`)', 'useLocation', 'BannerContainer'],
      verifyCommands: ['npm run test', 'npm run build -w frontend'],
      risks: ['The success banner is route-state based and intentionally appears only immediately after publish navigation.']
    });
  }

  async context(plan: ImplementationPlan) {
    return {
      candidateFiles: plan.candidateFiles,
      searchHints: plan.searchHints
    };
  }

  generate(input: { context: PackedContext }): PatchSet {
    const files = new Map(input.context.files.map((file) => [file.path, file.content]));

    return patchSetSchema.parse({
      summary: 'Add temporary publish success banner on article detail.',
      evidenceFiles: input.context.files.map((file) => file.path),
      operations: [
        {
          type: 'replace-file',
          path: editorFormPath,
          content: addPublishStateToEditor(files.get(editorFormPath) ?? ''),
          reason: 'Editor owns the publish action and can pass transient success feedback through route state.'
        },
        {
          type: 'replace-file',
          path: articlePath,
          content: addSuccessBannerToArticle(files.get(articlePath) ?? ''),
          reason: 'Article detail page is the landing page after publish and can render the temporary banner.'
        },
        {
          type: 'replace-file',
          path: stylesPath,
          content: addSuccessBannerStyles(files.get(stylesPath) ?? ''),
          reason: 'Global stylesheet can style article success feedback consistently.'
        }
      ]
    });
  }

  handoff() {
    return {
      summary: 'Article publish success banner was added and verified.',
      bullets: [
        '- Publishing an article navigates to detail with publishSuccess route state.',
        '- Article detail shows a green "文章已发布" banner and auto-dismisses it after a few seconds.'
      ]
    };
  }
}

function addPublishStateToEditor(content: string): string {
  if (content.includes('publishSuccess: true')) {
    return content;
  }

  return content.replace(
    '          navigate(`/article/${nextSlug}`);',
    '          navigate(`/article/${nextSlug}`, { state: { publishSuccess: true } });',
  );
}

function addSuccessBannerToArticle(content: string): string {
  let next = content;

  next = next
    .replace('      setCopyStatus("閾炬帴宸插鍒?);', '      setCopyStatus("链接已复制");')
    .replace('      setCopyStatus("澶嶅埗澶辫触锛岃鎵嬪姩澶嶅埗鍦板潃鏍忛摼鎺?);', '      setCopyStatus("复制失败，请手动复制地址栏链接");');

  if (!next.includes('publishSuccessVisible')) {
    next = next.replace(
      '  const [copyStatus, setCopyStatus] = useState("");',
      '  const [copyStatus, setCopyStatus] = useState("");\n  const [publishSuccessVisible, setPublishSuccessVisible] = useState(Boolean(state?.publishSuccess));',
    );
  }

  if (!next.includes('publishSuccessVisible) return;')) {
    next = next.replace(
      '  useEffect(() => {\n    if (state) return;',
      '  useEffect(() => {\n    if (!publishSuccessVisible) return;\n\n    const timer = window.setTimeout(() => setPublishSuccessVisible(false), 3200);\n    return () => window.clearTimeout(timer);\n  }, [publishSuccessVisible]);\n\n  useEffect(() => {\n    if (state) return;',
    );
  }

  if (!next.includes('article-publish-success-banner')) {
    next = next.replace(
      '      <BannerContainer>\n        <h1>{title}</h1>',
      '      {publishSuccessVisible && (\n        <div className="article-publish-success-banner" role="status">\n          文章已发布\n        </div>\n      )}\n      <BannerContainer>\n        <h1>{title}</h1>',
    );
  }

  return next;
}

function addSuccessBannerStyles(content: string): string {
  if (content.includes('.article-publish-success-banner')) {
    return content;
  }

  return `${content.trimEnd()}

.article-publish-success-banner {
  position: sticky;
  top: 0;
  z-index: 20;
  width: min(940px, calc(100% - 32px));
  margin: 0 auto;
  border: 1px solid #9ad2a0;
  border-radius: 6px;
  padding: 10px 14px;
  background: #e6f6e8;
  color: #1f6b34;
  font-weight: 800;
  text-align: center;
  box-shadow: 0 14px 28px -24px rgb(31 107 52 / 60%);
}
`;
}

export const skill = new AddArticlePublishSuccessBannerSkill();

import { type HandoffSummary, type PatchSet, type VerifyResult, handoffSummarySchema } from '@alpha-agent/shared';
import type { Skill } from '@alpha-agent/skill-sdk';

export class HandoffAgent {
  async run(input: {
    patchSet: PatchSet;
    verifyResult: VerifyResult;
    diffSummary: string;
    risks: string[];
    skill?: Skill;
  }): Promise<HandoffSummary> {
    const changedFiles = input.patchSet.operations.map((operation) => operation.path);
    const skillHandoff = await input.skill?.handoff?.({
      patchSet: input.patchSet,
      verifyResult: input.verifyResult,
      diffSummary: input.diffSummary,
      risks: input.risks
    });
    const isDraftWorkflow = input.patchSet.summary.includes('draft workflow');
    const isCoverImage = input.patchSet.summary.includes('coverImage');
    const isTagCount = input.patchSet.summary.includes('tag counts');
    const isShareLink = input.patchSet.summary.includes('copy article link');
    const successfulSummary = isDraftWorkflow
      ? 'Article draft workflow was generated, applied, and verified in the Conduit sandbox.'
      : isCoverImage
        ? 'Article cover image support was generated, applied, and verified in the Conduit sandbox.'
        : isShareLink
          ? 'Article copy link action was generated, applied, and verified in the Conduit sandbox.'
        : isTagCount
          ? 'Article list tag counts were generated, applied, and verified in the Conduit sandbox.'
          : 'Article detail reading metrics were generated, applied, and verified in the Conduit sandbox.';
    const failedSummary = isDraftWorkflow
      ? 'Article draft workflow was applied, but verification failed and needs review.'
      : isCoverImage
        ? 'Article cover image support was applied, but verification failed and needs review.'
        : isShareLink
          ? 'Article copy link action was applied, but verification failed and needs review.'
        : isTagCount
          ? 'Article list tag counts were applied, but verification failed and needs review.'
          : 'Article detail reading metrics were applied, but verification failed and needs review.';
    const summaryBullets = isDraftWorkflow
      ? [
          '- Add Article.status and published-only defaults for public article surfaces.',
          '- Add editor draft/publish actions plus owner-scoped profile Drafts routing.'
        ]
      : isCoverImage
        ? [
            '- Add Article.coverImage persistence through the backend API and database.',
            '- Render cover images in article lists and detail pages.'
          ]
        : isShareLink
          ? [
              '- Add a copy article link button to the article detail page.',
              '- Show user feedback after the URL is copied, with a fallback for clipboard restrictions.'
            ]
        : isTagCount
          ? [
              '- Add a tag count to article list preview cards.',
              '- Keep the change frontend-only by deriving the count from Article.tagList.'
            ]
        : [
            '- Add word count and estimated reading time to the article detail page.',
            '- Keep the change frontend-only by deriving values from Article.body.'
          ];

    return handoffSummarySchema.parse({
      summary: skillHandoff?.summary ?? (input.verifyResult.success ? successfulSummary : failedSummary),
      changedFiles,
      diffSummary: input.diffSummary,
      verification: input.verifyResult,
      risks: skillHandoff?.risks ?? input.risks,
      prDraft: [
        '## Summary',
        ...(skillHandoff?.bullets ?? summaryBullets),
        '',
        '## Verification',
        ...input.verifyResult.commands.map((command) => `- ${command.command}: exit ${command.exitCode}`)
      ].join('\n')
    });
  }
}

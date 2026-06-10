import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { type PatchSet, patchSetSchema, type VerifyResult } from '@alpha-agent/shared';
import type { SkillRepairHint } from '@alpha-agent/skill-sdk';

export class ReviewTestAgent {
  async summarizeFailure(logs: string): Promise<string> {
    const trimmedLogs = logs.trim();
    if (!trimmedLogs) {
      return '验证失败，但没有捕获到可用日志。';
    }

    return trimmedLogs.slice(-2000);
  }

  async createRepairPatch(input: {
    sandboxPath: string;
    verifyResult: VerifyResult;
    attempt: number;
    repairHints?: SkillRepairHint[];
  }): Promise<PatchSet | null> {
    const logs = input.verifyResult.commands
      .map((command) => `${command.command}\n${command.stdout}\n${command.stderr}`)
      .join('\n');
    const operations = [];
    const repairHints = input.repairHints ?? [];

    const articlePath = 'frontend/src/routes/Article/Article.jsx';
    if (/useState is not defined|useState.*not defined|React Hook "useState"/i.test(logs)) {
      const content = await this.safeRead(input.sandboxPath, articlePath);
      if (content && content.includes('useState(') && !content.includes('useState }') && content.includes('import { useEffect } from "react";')) {
        operations.push({
          type: 'replace-file' as const,
          path: articlePath,
          content: content.replace('import { useEffect } from "react";', 'import { useEffect, useState } from "react";'),
          reason: 'Repair missing useState import reported by frontend verification.'
        });
      }
    }

    const profileArticlesPath = 'frontend/src/routes/Profile/ProfileArticles.jsx';
    if (/useLocation is not defined|useLocation.*not defined/i.test(logs)) {
      const content = await this.safeRead(input.sandboxPath, profileArticlesPath);
      if (content && content.includes('useLocation(') && content.includes('import { useParams } from "react-router-dom";')) {
        operations.push({
          type: 'replace-file' as const,
          path: profileArticlesPath,
          content: content.replace('import { useParams } from "react-router-dom";', 'import { useLocation, useParams } from "react-router-dom";'),
          reason: 'Repair missing useLocation import reported by frontend verification.'
        });
      }
    }

    if (repairHints.some((hint) => hint.pattern === 'missing-read-more-hint')) {
      const previewPath = 'frontend/src/components/ArticlesPreview/ArticlesPreview.jsx';
      const content = await this.safeRead(input.sandboxPath, previewPath);
      if (content && !content.includes('article-read-more-hint') && content.includes('            <p>{article.description}</p>')) {
        operations.push({
          type: 'replace-file' as const,
          path: previewPath,
          content: content.replace(
            '            <p>{article.description}</p>',
            '            <p>{article.description}</p>\n            <span className="article-read-more-hint">阅读全文</span>',
          ),
          reason: 'Repair missing read-more hint requested by the selected Skill.'
        });
      }
    }

    const editorFormPath = 'frontend/src/components/ArticleEditorForm/ArticleEditorForm.jsx';
    const editorContent = await this.safeRead(input.sandboxPath, editorFormPath);
    if (editorContent) {
      const repairedEditor = this.repairEditorForm(editorContent);
      if (repairedEditor !== editorContent) {
        operations.push({
          type: 'replace-file' as const,
          path: editorFormPath,
          content: repairedEditor,
          reason: 'Repair duplicated cover image controls or missing editor imports.'
        });
      }
    }

    if (operations.length === 0) {
      return null;
    }

    return patchSetSchema.parse({
      summary: `ReviewTestAgent automatic repair attempt ${input.attempt}.`,
      evidenceFiles: input.verifyResult.commands.map((command) => command.command),
      operations
    });
  }

  private async safeRead(sandboxPath: string, relativePath: string): Promise<string | null> {
    try {
      return await readFile(path.join(sandboxPath, relativePath), 'utf8');
    } catch {
      return null;
    }
  }

  private repairEditorForm(content: string): string {
    let next = content;

    if (next.includes('<FormFieldset') && !next.includes('import FormFieldset from "../FormFieldset";')) {
      next = next.replace(
        /import (.+?) from "(.+?)";\n/,
        (match) => `${match}import FormFieldset from "../FormFieldset";\n`,
      );
    }

    const coverFieldPattern =
      / {8}<FormFieldset\n {10}normal\n {10}placeholder="Cover image URL"\n {10}name="coverImage"\n {10}value=\{coverImage\}\n {10}handler=\{inputHandler\}\n {8}><\/FormFieldset>\n\n/g;
    let seenCoverImage = false;
    next = next.replace(coverFieldPattern, (match) => {
      if (seenCoverImage) {
        return '';
      }
      seenCoverImage = true;
      return match;
    });

    return next;
  }
}

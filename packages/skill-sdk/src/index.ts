export interface SkillMatchResult {
  matched: boolean;
  score: number;
  reason: string;
}

export interface SkillContextRequest {
  candidateFiles?: string[];
  searchHints?: string[];
}

export interface SkillRepairHint {
  pattern: string;
  hint: string;
  targetFiles?: string[];
}

export interface SkillHandoffInput<TPatchSet = unknown, TVerifyResult = unknown> {
  patchSet: TPatchSet;
  verifyResult: TVerifyResult;
  diffSummary: string;
  risks: string[];
}

export interface SkillHandoffSummary {
  summary?: string;
  bullets?: string[];
  risks?: string[];
}

export interface Skill<TInput = unknown, TPlan = unknown, TContext = unknown, TPatchSet = unknown, TVerifyResult = unknown> {
  name: string;
  version: string;
  description?: string;
  tags: string[];
  examples?: string[];
  match(input: TInput): Promise<SkillMatchResult>;
  plan(input: TInput): Promise<TPlan>;
  context?(plan: TPlan): Promise<SkillContextRequest> | SkillContextRequest;
  generate?(input: { requirement: TInput; plan: TPlan; context: TContext }): Promise<TPatchSet> | TPatchSet;
  repairHints?(input: { plan: TPlan; error: string }): Promise<SkillRepairHint[]> | SkillRepairHint[];
  handoff?(input: SkillHandoffInput<TPatchSet, TVerifyResult>): Promise<SkillHandoffSummary> | SkillHandoffSummary;
}

export class SkillRegistry {
  private readonly skills = new Map<string, Skill>();

  register(skill: Skill): void {
    this.skills.set(skill.name, skill);
  }

  list(): Skill[] {
    return [...this.skills.values()];
  }

  async findBest<TInput>(input: TInput): Promise<{ skill: Skill<TInput>; match: SkillMatchResult } | null> {
    const matches = await Promise.all(
      this.list().map(async (skill) => ({
        skill: skill as Skill<TInput>,
        match: await (skill as Skill<TInput>).match(input)
      })),
    );

    return (
      matches
        .filter(({ match }) => match.matched)
        .sort((left, right) => right.match.score - left.match.score)[0] ?? null
    );
  }
}

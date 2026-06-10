import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SkillRegistry, type Skill } from '@alpha-agent/skill-sdk';

type SkillModule = {
  default?: unknown;
  skill?: unknown;
  createSkill?: unknown;
};

const sourceSkillsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'skills');

export async function createDefaultSkillRegistry(): Promise<SkillRegistry> {
  const registry = new SkillRegistry();
  const skills = await loadSkillsFromDirectory(sourceSkillsDir);

  for (const skill of skills) {
    registry.register(skill);
  }

  return registry;
}

export async function listDefaultSkills() {
  const registry = await createDefaultSkillRegistry();
  return registry.list().map((skill) => ({
    name: skill.name,
    version: skill.version,
    description: skill.description,
    tags: skill.tags,
    examples: skill.examples ?? []
  }));
}

export async function loadSkillsFromDirectory(directory: string): Promise<Skill[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const skillFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.d.js'))
    .map((entry) => entry.name)
    .sort();
  const skills: Skill[] = [];

  for (const fileName of skillFiles) {
    const moduleUrl = pathToFileURL(path.join(directory, fileName)).href;
    const module = (await import(moduleUrl)) as SkillModule;
    const skill = instantiateSkill(module);
    if (skill) {
      skills.push(skill);
    }
  }

  return skills;
}

function instantiateSkill(module: SkillModule): Skill | null {
  const exported = module.skill ?? module.default;

  if (isSkill(exported)) {
    return exported;
  }

  if (isSkillFactory(exported)) {
    const skill = exported();
    return isSkill(skill) ? skill : null;
  }

  if (isSkillClass(exported)) {
    const skill = new exported();
    return isSkill(skill) ? skill : null;
  }

  if (isSkillFactory(module.createSkill)) {
    const skill = module.createSkill();
    return isSkill(skill) ? skill : null;
  }

  return null;
}

function isSkillFactory(value: unknown): value is () => unknown {
  return typeof value === 'function' && !isClass(value);
}

function isSkillClass(value: unknown): value is new () => unknown {
  return isClass(value);
}

function isClass(value: unknown) {
  return typeof value === 'function' && /^class\s/.test(Function.prototype.toString.call(value));
}

function isSkill(value: unknown): value is Skill {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Skill>;
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.version === 'string' &&
    Array.isArray(candidate.tags) &&
    typeof candidate.match === 'function' &&
    typeof candidate.plan === 'function'
  );
}

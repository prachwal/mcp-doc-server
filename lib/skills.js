import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { cacheGet, cacheSet, cacheDel } from './redis.js';

const skillsDir = () => process.env.SKILLS_DIR || '';
const overlaysDir = () => process.env.OVERLAYS_DIR || '';

const CACHE_META = (name) => `skill:meta:${name}`;
const CACHE_CONTENT = (name) => `skill:content:${name}`;
const CACHE_ALL_META = 'skills:all:meta';

// Recursively collect all .md files under a directory
const scanDir = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await scanDir(full)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
};

// Parse a single SKILL.md file into metadata + content
export const parseSkillFile = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf-8');
  const { data, content } = matter(raw);
  return {
    meta: {
      name: data.name || path.basename(filePath, '.md'),
      description: data.description || '',
      group: data.group || '',
      version: data.version || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      path: filePath,
    },
    content: content.trim(),
  };
};

// Return metadata for all skills (no body) — cached
export const getAllSkillsMeta = async () => {
  const cached = await cacheGet(CACHE_ALL_META);
  if (cached !== null) return cached;

  const dir = skillsDir();
  if (!dir) return [];

  const files = await scanDir(dir).catch(() => []);
  const results = await Promise.all(files.map(async (f) => {
    try {
      const { meta } = await parseSkillFile(f);
      return meta;
    } catch {
      return null;
    }
  }));
  const metas = results.filter(Boolean);
  await cacheSet(CACHE_ALL_META, metas);
  return metas;
};

// Resolve file path for a skill by name
export const resolveSkillPath = async (name) => {
  const metas = await getAllSkillsMeta();
  const found = metas.find(m => m.name === name);
  return found?.path || null;
};

// Get metadata for a single skill — cached
export const getSkillMeta = async (name) => {
  const cached = await cacheGet(CACHE_META(name));
  if (cached) return cached;

  const filePath = await resolveSkillPath(name);
  if (!filePath) return null;

  const { meta } = await parseSkillFile(filePath);
  await cacheSet(CACHE_META(name), meta);
  return meta;
};

// Get body content for a single skill — cached separately (lazy load)
export const getSkillContent = async (name) => {
  const cached = await cacheGet(CACHE_CONTENT(name));
  if (cached !== null) return cached;

  const filePath = await resolveSkillPath(name);
  if (!filePath) return null;

  const { content } = await parseSkillFile(filePath);
  await cacheSet(CACHE_CONTENT(name), content);
  return content;
};

// Keyword search across name, description, tags, group
export const searchSkills = async (query) => {
  const metas = await getAllSkillsMeta();
  const q = query.toLowerCase();
  return metas.filter(m => {
    return (
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.group.toLowerCase().includes(q) ||
      m.tags.some(t => t.toLowerCase().includes(q))
    );
  });
};

// Invalidate cache for a skill (and the full list)
export const invalidateSkill = async (name) => {
  await cacheDel(CACHE_META(name), CACHE_CONTENT(name), CACHE_ALL_META);
};

// Install a skill from a source path
export const installSkill = async (sourcePath, destName) => {
  const dir = skillsDir();
  if (!dir) throw new Error('SKILLS_DIR not configured');
  const destFile = path.join(dir, `${destName}.md`);
  await fs.copyFile(sourcePath, destFile);
  await invalidateSkill(destName);
  return destFile;
};

// Remove a skill by name
export const removeSkill = async (name) => {
  const filePath = await resolveSkillPath(name);
  if (!filePath) throw new Error(`Skill not found: ${name}`);
  await fs.unlink(filePath);
  await invalidateSkill(name);
};

// List overlay files
export const listOverlayFiles = async () => {
  const dir = overlaysDir();
  if (!dir) return [];
  const files = await scanDir(dir).catch(() => []);
  return Promise.all(files.map(async (f) => {
    try {
      const { meta } = await parseSkillFile(f);
      return { ...meta, overlayPath: f };
    } catch {
      return { path: f, overlayPath: f };
    }
  }));
};

// Sync overlays → copy each overlay file into SKILLS_DIR
export const syncOverlays = async () => {
  const dir = skillsDir();
  if (!dir) throw new Error('SKILLS_DIR not configured');
  const overlays = await listOverlayFiles();
  const synced = [];
  for (const ov of overlays) {
    const dest = path.join(dir, path.basename(ov.overlayPath));
    await fs.copyFile(ov.overlayPath, dest);
    await invalidateSkill(ov.name || path.basename(ov.overlayPath, '.md'));
    synced.push(dest);
  }
  return synced;
};

// Promote overlay → move it to SKILLS_DIR as base skill
export const promoteSkill = async (name) => {
  const oDir = overlaysDir();
  if (!oDir) throw new Error('OVERLAYS_DIR not configured');
  const sDir = skillsDir();
  if (!sDir) throw new Error('SKILLS_DIR not configured');

  const overlays = await listOverlayFiles();
  const ov = overlays.find(o => o.name === name);
  if (!ov) throw new Error(`Overlay skill not found: ${name}`);

  const dest = path.join(sDir, path.basename(ov.overlayPath));
  await fs.rename(ov.overlayPath, dest);
  await invalidateSkill(name);
  return dest;
};

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import path from 'path';
import fs from 'fs/promises';
import { requireAuth } from '../auth.js';
import {
  installSkill,
  removeSkill,
  listOverlayFiles,
  syncOverlays,
  promoteSkill,
} from '../skills.js';

export const registerManageTools = (server) => {
  server.tool(
    'install_skills',
    'Install one or more skills by copying .md files from a source directory into SKILLS_DIR.',
    {
      _api_key: z.string().describe('API key for authentication'),
      source: z.string().describe('Absolute path to directory containing skill .md files'),
      names: z.array(z.string()).optional().describe('Skill names (without .md) to install. Installs all if omitted.'),
    },
    async ({ _api_key, source, names }) => {
      requireAuth({ _api_key });
      if (!source) throw new McpError(ErrorCode.InvalidParams, 'source is required');

      let files = await fs.readdir(source).catch(() => {
        throw new McpError(ErrorCode.InvalidParams, `Cannot read source directory: ${source}`);
      });
      files = files.filter(f => f.endsWith('.md'));
      if (names?.length) files = files.filter(f => names.includes(path.basename(f, '.md')));

      const installed = [];
      for (const file of files) {
        const srcPath = path.join(source, file);
        const skillName = path.basename(file, '.md');
        const dest = await installSkill(srcPath, skillName);
        installed.push({ name: skillName, path: dest });
      }
      return { content: [{ type: 'text', text: JSON.stringify({ installed }, null, 2) }] };
    }
  );

  server.tool(
    'update_skills',
    'Update installed skills by re-copying from a source directory.',
    {
      _api_key: z.string().describe('API key for authentication'),
      source: z.string().describe('Absolute path to directory containing updated skill .md files'),
      names: z.array(z.string()).describe('List of skill names to update'),
    },
    async ({ _api_key, source, names }) => {
      requireAuth({ _api_key });
      if (!source) throw new McpError(ErrorCode.InvalidParams, 'source is required');
      if (!names?.length) throw new McpError(ErrorCode.InvalidParams, 'names must not be empty');

      const updated = [];
      for (const name of names) {
        const srcPath = path.join(source, `${name}.md`);
        await fs.access(srcPath).catch(() => {
          throw new McpError(ErrorCode.InvalidParams, `Source file not found: ${srcPath}`);
        });
        const dest = await installSkill(srcPath, name);
        updated.push({ name, path: dest });
      }
      return { content: [{ type: 'text', text: JSON.stringify({ updated }, null, 2) }] };
    }
  );

  server.tool(
    'remove_skills',
    'Remove installed skills from SKILLS_DIR and invalidate their cache entries.',
    {
      _api_key: z.string().describe('API key for authentication'),
      names: z.array(z.string()).describe('List of skill names to remove'),
    },
    async ({ _api_key, names }) => {
      requireAuth({ _api_key });
      if (!names?.length) throw new McpError(ErrorCode.InvalidParams, 'names must not be empty');

      const removed = [];
      const errors = [];
      for (const name of names) {
        try {
          await removeSkill(name);
          removed.push(name);
        } catch (e) {
          errors.push({ name, error: e.message });
        }
      }
      return { content: [{ type: 'text', text: JSON.stringify({ removed, errors }, null, 2) }] };
    }
  );

  server.tool(
    'list_overlays',
    'List all skill overlay files (user customizations stored in OVERLAYS_DIR).',
    { _api_key: z.string().describe('API key for authentication') },
    async ({ _api_key }) => {
      requireAuth({ _api_key });
      const overlays = await listOverlayFiles();
      return { content: [{ type: 'text', text: JSON.stringify(overlays, null, 2) }] };
    }
  );

  server.tool(
    'sync_overlays',
    'Copy all overlay skill files from OVERLAYS_DIR into SKILLS_DIR, overwriting base skills.',
    { _api_key: z.string().describe('API key for authentication') },
    async ({ _api_key }) => {
      requireAuth({ _api_key });
      const synced = await syncOverlays();
      return { content: [{ type: 'text', text: JSON.stringify({ synced }, null, 2) }] };
    }
  );

  server.tool(
    'promote_skill',
    'Move an overlay skill into SKILLS_DIR, making it the permanent base skill.',
    {
      _api_key: z.string().describe('API key for authentication'),
      name: z.string().describe('Overlay skill name to promote'),
    },
    async ({ _api_key, name }) => {
      requireAuth({ _api_key });
      if (!name) throw new McpError(ErrorCode.InvalidParams, 'name is required');
      const dest = await promoteSkill(name);
      return { content: [{ type: 'text', text: JSON.stringify({ promoted: name, path: dest }, null, 2) }] };
    }
  );
};

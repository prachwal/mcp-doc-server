import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { requireAuth } from '../auth.js';
import { getAllSkillsMeta, getSkillMeta, getSkillContent, searchSkills } from '../skills.js';

export const registerQueryTools = (server) => {
  server.tool(
    'list_skills_info',
    'List all available skills with metadata only (name, description, group, tags, path). Does NOT return body content — call get_skill_content for that.',
    { _api_key: z.string().describe('API key for authentication') },
    async ({ _api_key }) => {
      requireAuth({ _api_key });
      const metas = await getAllSkillsMeta();
      return { content: [{ type: 'text', text: JSON.stringify(metas, null, 2) }] };
    }
  );

  server.tool(
    'get_skill_info',
    'Get full frontmatter metadata for a single skill by name.',
    {
      _api_key: z.string().describe('API key for authentication'),
      name: z.string().describe('Skill name'),
    },
    async ({ _api_key, name }) => {
      requireAuth({ _api_key });
      const meta = await getSkillMeta(name);
      if (!meta) throw new McpError(ErrorCode.InvalidParams, `Skill not found: ${name}`);
      return { content: [{ type: 'text', text: JSON.stringify(meta, null, 2) }] };
    }
  );

  server.tool(
    'get_skill_content',
    'Get the raw body content of a SKILL.md file (without frontmatter). Loaded lazily — only call when you need the full instructions.',
    {
      _api_key: z.string().describe('API key for authentication'),
      name: z.string().describe('Skill name'),
    },
    async ({ _api_key, name }) => {
      requireAuth({ _api_key });
      const content = await getSkillContent(name);
      if (content === null) throw new McpError(ErrorCode.InvalidParams, `Skill not found: ${name}`);
      return { content: [{ type: 'text', text: content }] };
    }
  );

  server.tool(
    'search_skills',
    'Search skills by keyword. Matches against name, description, group, and tags. Returns metadata only (no body).',
    {
      _api_key: z.string().describe('API key for authentication'),
      query: z.string().describe('Search keyword'),
    },
    async ({ _api_key, query }) => {
      requireAuth({ _api_key });
      if (!query?.trim()) throw new McpError(ErrorCode.InvalidParams, 'query must not be empty');
      const results = await searchSkills(query);
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }
  );
};

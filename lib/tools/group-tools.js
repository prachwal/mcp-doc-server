import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { requireAuth } from '../auth.js';
import { getAllSkillsMeta } from '../skills.js';

const buildGroupMap = async () => {
  const metas = await getAllSkillsMeta();
  const map = {};
  for (const m of metas) {
    const g = m.group || '(ungrouped)';
    if (!map[g]) map[g] = [];
    map[g].push(m);
  }
  return map;
};

export const registerGroupTools = (server) => {
  server.tool(
    'list_groups',
    'List all skill groups with skill counts and skill names.',
    { _api_key: z.string().describe('API key for authentication') },
    async ({ _api_key }) => {
      requireAuth({ _api_key });
      const map = await buildGroupMap();
      const groups = Object.entries(map).map(([group, skills]) => ({
        group,
        count: skills.length,
        skills: skills.map(s => s.name),
      }));
      return { content: [{ type: 'text', text: JSON.stringify(groups, null, 2) }] };
    }
  );

  server.tool(
    'get_group_info',
    'Get metadata for all skills in a specific group.',
    {
      _api_key: z.string().describe('API key for authentication'),
      group: z.string().describe('Group name'),
    },
    async ({ _api_key, group }) => {
      requireAuth({ _api_key });
      const map = await buildGroupMap();
      const skills = map[group];
      if (!skills) throw new McpError(ErrorCode.InvalidParams, `Group not found: ${group}`);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ group, count: skills.length, skills }, null, 2),
        }],
      };
    }
  );
};

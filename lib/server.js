import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerQueryTools } from './tools/query-tools.js';
import { registerGroupTools } from './tools/group-tools.js';
import { registerManageTools } from './tools/manage-tools.js';
import { initRedis } from './redis.js';

export const startServer = async () => {
  initRedis();

  const server = new McpServer({
    name: 'mcp-doc-server',
    version: '1.0.0',
  });

  registerQueryTools(server);
  registerGroupTools(server);
  registerManageTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[mcp-doc-server] started on stdio');
};

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const getValidKeys = () => {
  const raw = process.env.API_KEYS || '';
  return raw.split(',').map(k => k.trim()).filter(Boolean);
};

export const validateApiKey = (key) => {
  const keys = getValidKeys();
  if (!keys.length) return true; // no keys configured → open access
  return keys.includes(key);
};

export const requireAuth = (args) => {
  const key = args?._api_key;
  if (!key || !validateApiKey(key)) {
    throw new McpError(ErrorCode.InvalidRequest, 'Unauthorized: invalid or missing API key');
  }
};

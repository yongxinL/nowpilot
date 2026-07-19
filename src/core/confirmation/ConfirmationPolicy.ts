import { debugLog } from '../utils/debugLog';

export enum ConfirmationLevel {
  AutoExecute = 'auto',
  ConfirmInline = 'inline',
  RequirePermission = 'require',
}

/**
 * Static tool → ConfirmationLevel policy mapping (D-18).
 * Agent's discretion: exact mapping per tool.
 */
const CONFIRMATION_POLICY: Record<string, ConfirmationLevel> = {
  // Read-only local operations → auto-execute
  summarize_page: ConfirmationLevel.AutoExecute,
  extract_page: ConfirmationLevel.AutoExecute,
  // External lookups → inline confirm
  web_search: ConfirmationLevel.ConfirmInline,
  web_fetch: ConfirmationLevel.ConfirmInline,
  // Side-effect actions → require permission
  send_message: ConfirmationLevel.RequirePermission,
  create_record: ConfirmationLevel.RequirePermission,
  update_record: ConfirmationLevel.RequirePermission,
};

/**
 * Look up the ConfirmationLevel for a given tool name.
 * Defaults to RequirePermission (default-deny) for unknown tools.
 */
export function getConfirmationLevel(toolName: string): ConfirmationLevel {
  const level = CONFIRMATION_POLICY[toolName];
  if (!level) {
    debugLog('info', `[ConfirmationPolicy] No policy for tool: ${toolName}, defaulting to RequirePermission`);
    return ConfirmationLevel.RequirePermission;
  }
  return level;
}

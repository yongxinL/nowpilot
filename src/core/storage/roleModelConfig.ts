const STORAGE_KEY = 'np_role_models';

export interface RoleModelConfig {
  planner: string | null;
  renderer: string | null;
  memory: string | null;
}

export async function getRoleModelConfig(): Promise<RoleModelConfig> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as RoleModelConfig | undefined;
  return stored ?? { planner: null, renderer: null, memory: null };
}

export async function setRoleModelConfig(config: RoleModelConfig): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
}

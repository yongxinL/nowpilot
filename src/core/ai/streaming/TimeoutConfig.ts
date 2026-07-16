export interface TimeoutConfig {
  planner: number;
  executorTool: number;
  renderer: number;
}

export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  planner: 15000,
  executorTool: 30000,
  renderer: 30000,
};

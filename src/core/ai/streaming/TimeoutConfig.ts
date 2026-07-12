export interface TimeoutConfig {
  planner: number;
  executorTool: number;
  renderer: number;
}

export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  planner: 3000,
  executorTool: 10000,
  renderer: 5000,
};

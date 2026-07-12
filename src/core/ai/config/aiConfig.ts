import { DEFAULT_TIMEOUT_CONFIG } from '../streaming/TimeoutConfig';

export { DEFAULT_TIMEOUT_CONFIG };

export const AI_CONFIG = {
  timeout: DEFAULT_TIMEOUT_CONFIG,
  tierCap: { tiny: 1, small: 2, medium: 3, large: 5 } as const,
  maxFallbackAttempts: 3,
} as const;

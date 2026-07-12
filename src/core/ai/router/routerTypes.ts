export interface RouterConfig {
  preferredProviders: string[];
  tierAssignments: Record<string, string>;
  maxAttempts: number;
}

export interface FallbackEntry {
  providerId: string;
  modelId: string;
  tier: string;
}

export interface RetryPolicy {
  maxRetries: number;
  retryableErrors: string[];
  retryOnlyPreFirstToken: boolean;
}

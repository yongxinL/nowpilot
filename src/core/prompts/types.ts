export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  slash?: string;
  variables: Array<{
    name: string;
    kind: 'string' | 'number' | 'enum';
    values?: string[];
    default?: string | number;
    required: boolean;
  }>;
  systemTemplate: string;
  userTemplate: string;
}

export interface Macro {
  id: string;
  name: string;
  description: string;
  steps: Array<
    | { type: 'skill'; skillId: string; input: Record<string, unknown> }
    | { type: 'mcp'; toolName: string; input: Record<string, unknown> }
    | { type: 'save-note'; titleTemplate: string }
  >;
}

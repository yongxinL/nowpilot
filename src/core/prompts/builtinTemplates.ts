export interface BuiltinPromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  category: string;
  variables: string[];
}

export const builtinTemplates: BuiltinPromptTemplate[] = [
  {
    id: 'write',
    name: 'Write',
    description: 'Draft a response, document, or message based on your instructions',
    template: 'Write the following content:\n\n{{userInput}}',
    category: 'builtin',
    variables: ['userInput'],
  },
  {
    id: 'ask',
    name: 'Ask',
    description: 'Ask a general question and get an informative answer',
    template: 'Answer the following question:\n\n{{userInput}}',
    category: 'builtin',
    variables: ['userInput'],
  },
  {
    id: 'research',
    name: 'Research',
    description: 'Research a topic in depth using available tools and context',
    template: 'Research the following topic:\n\n{{userInput}}',
    category: 'builtin',
    variables: ['userInput'],
  },
  {
    id: 'summarize',
    name: 'Summarize',
    description: 'Summarize content concisely',
    template: 'Summarize the following:\n\n{{content}}',
    category: 'builtin',
    variables: ['content'],
  },
];

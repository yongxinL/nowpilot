export interface PromptStarter {
  id: string;
  category: 'Writing' | 'Analysis' | 'Research' | 'Coding' | 'Support';
  title: string;
  description: string;
  template?: string;
  icon?: string;
}

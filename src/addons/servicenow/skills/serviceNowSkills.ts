import type { PromptTemplate } from '../../../core/prompts/PromptManager';
import { promptManager } from '../../../core/prompts/PromptManager';

export const serviceNowSkillTemplates: PromptTemplate[] = [
  {
    id: 'servicenow-case-analyzer',
    name: 'CaseAnalyzer',
    description: 'Analyze a ServiceNow case to identify key issues and patterns',
    template:
      'Analyze ServiceNow case {{caseNumber}}. Case data:\n\n{{caseData}}\n\nProvide: 1) Issue summary 2) Root cause analysis 3) Recommended actions 4) Risk assessment.',
    category: 'ServiceNow',
    variables: ['caseNumber', 'caseData'],
    isBuiltin: false,
    scopes: ['reading'],
    hidden: false,
  },
  {
    id: 'servicenow-catchup',
    name: 'CatchUp',
    description: 'Get a quick summary of recent updates on a ServiceNow case',
    template:
      'Summarize recent activity for ServiceNow case {{caseNumber}}. Recent updates:\n\n{{recentUpdates}}\n\nProvide a concise catch-up summary highlighting what changed, current status, and any pending actions.',
    category: 'ServiceNow',
    variables: ['caseNumber', 'recentUpdates'],
    isBuiltin: false,
    scopes: ['reading'],
    hidden: false,
  },
  {
    id: 'servicenow-sentiment',
    name: 'Sentiment',
    description: 'Analyze the sentiment of comments on a ServiceNow case',
    template:
      'Analyze sentiment for ServiceNow case {{caseNumber}}. Comments:\n\n{{comments}}\n\nProvide: 1) Overall sentiment (positive/neutral/negative) 2) Key emotional drivers 3) Customer satisfaction indicators 4) Recommended response approach.',
    category: 'ServiceNow',
    variables: ['caseNumber', 'comments'],
    isBuiltin: false,
    scopes: ['reading'],
    hidden: false,
  },
];

export async function registerServiceNowSkills(): Promise<void> {
  for (const template of serviceNowSkillTemplates) {
    try {
      await promptManager.createTemplate(template);
    } catch {
      continue;
    }
  }
}

export class TemplateEngine {
  render(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? `{{${key}}}`);
  }

  extractVariables(template: string): string[] {
    const matches = template.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map((m) => m.slice(2, -2)))];
  }

  validate(template: string, availableVariables: string[]): { valid: boolean; missing: string[] } {
    const extracted = this.extractVariables(template);
    const missing = extracted.filter((v) => !availableVariables.includes(v));
    return { valid: missing.length === 0, missing };
  }
}

export const templateEngine = new TemplateEngine();

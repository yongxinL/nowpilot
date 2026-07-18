import { describe, it, expect, beforeEach } from 'vitest';
import { QuickActionService } from '../../../../src/core/ai/quickActions/QuickActionService';

describe('QuickActionService', () => {
  let service: QuickActionService;

  beforeEach(() => {
    service = new QuickActionService();
  });

  // Test 4: servicenow.com returns ServiceNow-specific actions
  it('getActions("servicenow.com") returns actions including "Summarize this case"', () => {
    const actions = service.getActions('servicenow.com');
    expect(actions.length).toBeGreaterThanOrEqual(2);
    const labels = actions.map((a) => a.label);
    expect(labels).toContain('Summarize this case');
    expect(labels).toContain('Draft a work note');
    expect(labels).toContain('Check similar cases');
  });

  // Test 5: github.com returns GitHub-specific actions
  it('getActions("github.com") returns actions including "Explain this code"', () => {
    const actions = service.getActions('github.com');
    expect(actions.length).toBeGreaterThanOrEqual(2);
    const labels = actions.map((a) => a.label);
    expect(labels).toContain('Explain this code');
    expect(labels).toContain('Write a script');
  });

  // Test 6: unknown hostname returns general-purpose fallback
  it('getActions("unknown-site.com") returns general-purpose fallback actions', () => {
    const actions = service.getActions('unknown-site.com');
    expect(actions.length).toBeGreaterThanOrEqual(2);
    const labels = actions.map((a) => a.label);
    expect(labels).toContain('Summarize this page');
    expect(labels).toContain('Extract key points');
  });

  // Test 7: undefined returns general-purpose fallback
  it('getActions(undefined) returns general-purpose fallback', () => {
    const actions = service.getActions(undefined);
    expect(actions.length).toBeGreaterThanOrEqual(2);
    const labels = actions.map((a) => a.label);
    expect(labels).toContain('Summarize this page');
    expect(labels).toContain('Extract key points');
  });

  // Additional: stackoverflow.com returns stackoverflow-specific actions
  it('getActions("stackoverflow.com") returns relevant actions', () => {
    const actions = service.getActions('stackoverflow.com');
    expect(actions.length).toBeGreaterThanOrEqual(2);
    const labels = actions.map((a) => a.label);
    expect(labels).toContain('Explain this error');
    expect(labels).toContain('Find alternative approach');
  });
});

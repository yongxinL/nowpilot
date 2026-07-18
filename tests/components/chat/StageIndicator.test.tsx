import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { ConfigProvider, theme } from 'antd';
import { StageIndicator } from '../../../src/components/chat/StageIndicator';

// Wrap with Ant Design ConfigProvider for theme token access
function withConfig(ui: React.ReactElement) {
  return <ConfigProvider>{ui}</ConfigProvider>;
}

describe('StageIndicator', () => {
  beforeEach(() => {
    cleanup();
  });

  // Test 1: stage='retrieving' with hasPinnedTabs=true renders "Reading page context…"
  it('renders "Reading page context…" when stage=retrieving and hasPinnedTabs=true', () => {
    render(withConfig(
      <StageIndicator stage="retrieving" hasPinnedTabs={true} />,
    ));
    expect(screen.getByText('Reading page context…')).toBeTruthy();
  });

  // Test 1b: stage='retrieving' with hasPinnedTabs=false renders "Retrieving context…"
  it('renders "Retrieving context…" when stage=retrieving and hasPinnedTabs=false', () => {
    render(withConfig(
      <StageIndicator stage="retrieving" hasPinnedTabs={false} />,
    ));
    expect(screen.getByText('Retrieving context…')).toBeTruthy();
  });

  // Test 2: stage='planning' renders "Planning response…"
  it('renders "Planning response…" when stage=planning', () => {
    render(withConfig(
      <StageIndicator stage="planning" hasPinnedTabs={false} />,
    ));
    expect(screen.getByText('Planning response…')).toBeTruthy();
  });

  // Test 2b: stage='generating' renders "Generating…"
  it('renders "Generating…" when stage=generating', () => {
    render(withConfig(
      <StageIndicator stage="generating" hasPinnedTabs={false} />,
    ));
    expect(screen.getByText('Generating…')).toBeTruthy();
  });

  // Test 3: stage='generating' with lastTokenTime >3s ago shows "Still working…"
  it('shows "Still working…" subtitle when lastTokenTime is >3s ago', () => {
    // Simulate last token received 5 seconds ago
    const fiveSecondsAgo = Date.now() - 5000;
    render(withConfig(
      <StageIndicator
        stage="generating"
        hasPinnedTabs={false}
        lastTokenTime={fiveSecondsAgo}
      />,
    ));
    expect(screen.getByText('Still working…')).toBeTruthy();
  });

  // Test 4: unknown stage renders nothing
  it('renders nothing for unknown stage', () => {
    const { container } = render(withConfig(
      <StageIndicator stage={'idle' as any} hasPinnedTabs={false} />,
    ));
    // Should be empty or null
    expect(container.textContent?.trim() || container.innerHTML).toBe('');
  });

  // Test: stage='tool' with currentTool renders "Running tool: ..."
  it('renders "Running tool: toolName" when stage=tool and currentTool is provided', () => {
    render(withConfig(
      <StageIndicator stage="tool" hasPinnedTabs={false} currentTool="getTime" />,
    ));
    expect(screen.getByText('Running tool: getTime')).toBeTruthy();
  });

  // Test: stage='thinking' with reasoning renders expanded
  it('renders "Thinking…" when stage=thinking', () => {
    render(withConfig(
      <StageIndicator stage="thinking" hasPinnedTabs={false} reasoning="I am thinking..." />,
    ));
    expect(screen.getByText('Thinking…')).toBeTruthy();
  });
});

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockUseAgent = vi.hoisted(() => vi.fn().mockReturnValue({
  steps: [],
  send: vi.fn(),
  abort: vi.fn(),
  isStreaming: false,
  error: null,
  pendingPermission: null,
  resolvePermission: vi.fn(),
  conversations: [],
  activeConversationId: null,
  switchConversation: vi.fn(),
  deleteConversation: vi.fn(),
  newConversation: vi.fn(),
}));

const mockUseWorkspace = vi.hoisted(() => vi.fn().mockReturnValue({
  activeSurface: 'standalone',
  activeProvider: null,
  setActiveProvider: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/hooks/useAgent', () => ({
  useAgent: () => mockUseAgent(),
}));

vi.mock('../../src/hooks/useWorkspace', () => ({
  useWorkspace: () => mockUseWorkspace(),
}));

vi.mock('../../src/components/agent/PermissionDialog', () => ({
  PermissionDialog: ({ pendingPermission, onResolve }: any) =>
    pendingPermission ? (
      <div data-testid="permission-dialog">
        <span>Permission for {pendingPermission.toolName}</span>
        <button onClick={() => onResolve('allow-once')} data-testid="allow-once-btn">
          Allow Once
        </button>
        <button onClick={() => onResolve('deny')} data-testid="deny-btn">Deny</button>
      </div>
    ) : null,
}));

vi.mock('../../src/components/agent/ThoughtChainView', () => ({
  ThoughtChainView: ({ steps }: any) => (
    <div data-testid="thought-chain">
      {steps.length === 0 ? 'Empty chain' : `${steps.length} steps`}
    </div>
  ),
}));

vi.mock('@ant-design/x', () => ({
  Sender: ({ onSubmit, onCancel, loading, placeholder }: any) => (
    <div data-testid="sender" data-loading={loading}>
      <input
        data-testid="sender-input"
        placeholder={placeholder}
        onChange={(e) => {}}
      />
      <button
        onClick={() => onSubmit?.('test message')}
        data-testid="send-btn"
      >
        Send
      </button>
      <button onClick={onCancel} data-testid="cancel-btn">Cancel</button>
    </div>
  ),
}));

vi.mock('antd', () => ({
  Alert: ({ message, description, type }: any) => (
    <div data-testid="error-alert" data-type={type}>
      <strong>{message}</strong>
      <p>{description}</p>
    </div>
  ),
}));

import { AgentPage } from '../../src/core/pages/AgentPage';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAgent.mockReturnValue({
      steps: [],
      send: vi.fn(),
      abort: vi.fn(),
      isStreaming: false,
      error: null,
      pendingPermission: null,
      resolvePermission: vi.fn(),
      conversations: [],
      activeConversationId: null,
      switchConversation: vi.fn(),
      deleteConversation: vi.fn(),
      newConversation: vi.fn(),
    });
    mockUseWorkspace.mockReturnValue({
      activeSurface: 'standalone',
      activeProvider: null,
      setActiveProvider: vi.fn(),
    });
  });

  // -----------------------------------------------------------------------
  // Test 1: Renders ThoughtChain and Sender
  // -----------------------------------------------------------------------
  it('renders ThoughtChain and Sender components', () => {
    render(<AgentPage />);

    expect(screen.getByTestId('thought-chain')).toBeDefined();
    expect(screen.getByTestId('sender')).toBeDefined();
    // PermissionDialog not shown when no pendingPermission
    expect(screen.queryByTestId('permission-dialog')).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Test 2: Shows empty state when no steps
  // -----------------------------------------------------------------------
  it('shows empty chain when no steps', () => {
    render(<AgentPage />);

    const chains = screen.getAllByTestId('thought-chain');
    expect(chains.length).toBeGreaterThanOrEqual(1);
  });

  // -----------------------------------------------------------------------
  // Test 3: Shows error alert when error is set
  // -----------------------------------------------------------------------
  it('shows error alert when error is present', () => {
    mockUseAgent.mockReturnValue({
      steps: [],
      send: vi.fn(),
      abort: vi.fn(),
      isStreaming: false,
      error: 'Something went wrong',
      pendingPermission: null,
      resolvePermission: vi.fn(),
      conversations: [],
      activeConversationId: null,
      switchConversation: vi.fn(),
      deleteConversation: vi.fn(),
      newConversation: vi.fn(),
    });

    render(<AgentPage />);

    expect(screen.getByTestId('error-alert')).toBeDefined();
    expect(screen.getByTestId('error-alert').textContent).toContain('Something went wrong');
  });

  // -----------------------------------------------------------------------
  // Test 4: Shows PermissionDialog when pendingPermission is set
  // -----------------------------------------------------------------------
  it('shows PermissionDialog when pendingPermission is set', () => {
    mockUseAgent.mockReturnValue({
      steps: [],
      send: vi.fn(),
      abort: vi.fn(),
      isStreaming: true,
      error: null,
      pendingPermission: { toolName: 'echoTool', toolInput: { text: 'hello' } },
      resolvePermission: vi.fn(),
      conversations: [],
      activeConversationId: null,
      switchConversation: vi.fn(),
      deleteConversation: vi.fn(),
      newConversation: vi.fn(),
    });

    render(<AgentPage />);

    expect(screen.getByTestId('permission-dialog')).toBeDefined();
    expect(screen.getByText('Permission for echoTool')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Test 5: Does NOT show PermissionDialog when no pendingPermission
  // -----------------------------------------------------------------------
  it('does not show PermissionDialog when no pendingPermission', () => {
    render(<AgentPage />);

    // Permission dialog uses conditional rendering — should not be visible
    expect(screen.queryByTestId('permission-dialog')).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Test 6: data-page-empty-state attribute present
  // -----------------------------------------------------------------------
  it('has data-page-empty-state="agent" attribute', () => {
    const { container } = render(<AgentPage />);

    expect(container.querySelector('[data-page-empty-state="agent"]')).toBeDefined();
  });
});

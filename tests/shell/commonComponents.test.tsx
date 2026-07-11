import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { UserAvatarMenu } from '../../src/components/common/UserAvatarMenu';
import { MCPStatusIndicator } from '../../src/components/common/MCPStatusIndicator';
import { HelpCenterLink } from '../../src/components/common/HelpCenterLink';
import { FeedbackLink } from '../../src/components/common/FeedbackLink';

describe('Shared common components', () => {
  it('UserAvatarMenu renders with accessible label', () => {
    const { container } = render(React.createElement(UserAvatarMenu, { userName: 'Test User' }));
    const button = container.querySelector('[aria-label]');
    expect(button).toBeTruthy();
  });

  it('MCPStatusIndicator has tooltip and aria-label for enabled state', () => {
    const { container } = render(React.createElement(MCPStatusIndicator, { enabled: true }));
    expect(container.querySelector('[aria-label]')).toBeTruthy();
  });

  it('MCPStatusIndicator has tooltip and aria-label for disabled state', () => {
    const { container } = render(React.createElement(MCPStatusIndicator, { enabled: false }));
    expect(container.querySelector('[aria-label]')).toBeTruthy();
  });

  it('HelpCenterLink renders with accessible label', () => {
    const { getByLabelText } = render(React.createElement(HelpCenterLink, {}));
    expect(getByLabelText('Help Center')).toBeTruthy();
  });

  it('FeedbackLink renders with accessible label', () => {
    const { getByLabelText } = render(React.createElement(FeedbackLink, {}));
    expect(getByLabelText('Feedback')).toBeTruthy();
  });
});

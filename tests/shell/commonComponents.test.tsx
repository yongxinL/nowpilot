import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { UserAvatarMenu } from '../../src/components/common/UserAvatarMenu';
import { HelpCenterLink } from '../../src/components/common/HelpCenterLink';
import { FeedbackLink } from '../../src/components/common/FeedbackLink';

describe('Shared common components', () => {
  it('UserAvatarMenu renders with accessible label', () => {
    const { container } = render(React.createElement(UserAvatarMenu, { userName: 'Test User' }));
    const button = container.querySelector('[aria-label]');
    expect(button).toBeTruthy();
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
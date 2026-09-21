import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ConfigProvider, theme } from 'antd';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DeferredNotice,
  type Phase1Backing,
} from '../../src/components/common/DeferredNotice';
import { format, t } from '../../src/core/i18n/strings';

/**
 * `DeferredNotice` suite (plan `01-12`, Task 1).
 *
 * The marking convention is one component, one type and one greppable DOM
 * attribute. This suite pins all three: the union's membership, both variants'
 * visible element, the full-sentence accessible label (never the short tag
 * copy), the absence case, the tooltip-removed case and the colour-token
 * discipline.
 */

const SOURCE_PATH = join(process.cwd(), 'src', 'components', 'common', 'DeferredNotice.tsx');

function renderWithAntd(ui: React.ReactElement) {
  return render(<ConfigProvider>{ui}</ConfigProvider>);
}

describe('DeferredNotice — Phase1Backing', () => {
  it('exports Phase1Backing as exactly the two backing literals', () => {
    const fixtures: Phase1Backing[] = ['fixture', 'deferred'];

    expect(fixtures).toEqual(['fixture', 'deferred']);

    // Compile-time half of the assertion: a third literal is not a member of
    // the union, so this line must be a type error.
    // @ts-expect-error — `'live'` is not a Phase1Backing; the union has two members.
    const third: Phase1Backing = 'live';
    expect(third).toBe('live');
  });
});

describe('DeferredNotice — inline variant', () => {
  it('renders a warning-toned tag carrying the fixture short copy, visible without hover', () => {
    renderWithAntd(<DeferredNotice backing="fixture" variant="inline" />);

    const tag = screen.getByText(t('deferred.fixtureTag'));
    expect(tag.className).toContain('ant-tag');
    expect(tag.getAttribute('aria-label')).toBe(t('deferred.reasonFixture'));
    expect(tag.style.background.length).toBeGreaterThan(0);
    expect(tag.style.color.length).toBeGreaterThan(0);
  });

  it('renders the deferred short copy when the backing value is deferred', () => {
    renderWithAntd(<DeferredNotice backing="deferred" variant="inline" />);

    const tag = screen.getByText(t('deferred.tag'));
    expect(tag.className).toContain('ant-tag');
    expect(tag.getAttribute('aria-label')).toBe(t('deferred.reasonDeferred'));
  });

  it('labels the marker with the full sentence, not the short tag copy', () => {
    renderWithAntd(<DeferredNotice backing="fixture" variant="inline" />);

    const label = screen.getByText(t('deferred.fixtureTag')).getAttribute('aria-label');

    expect(label).toBe(t('deferred.reasonFixture'));
    expect(label).not.toBe(t('deferred.fixtureTag'));
    expect((label ?? '').length).toBeGreaterThan(t('deferred.fixtureTag').length);
  });
});

describe('DeferredNotice — block variant', () => {
  it('renders a warning alert with an icon and the reason copy', () => {
    const { container } = renderWithAntd(
      <DeferredNotice backing="deferred" variant="block" />,
    );

    expect(container.querySelector('.ant-alert-warning')).not.toBeNull();
    expect(container.querySelector('.ant-alert-icon')).not.toBeNull();
    expect(screen.getByText(t('deferred.tag'))).toBeTruthy();
    expect(screen.getByText(t('deferred.reasonDeferred'))).toBeTruthy();
  });

  it('names the owning roadmap phase through the phase-body key when one is supplied', () => {
    const { container } = renderWithAntd(
      <DeferredNotice backing="deferred" variant="block" phase={15} />,
    );

    const alert = container.querySelector('.ant-alert');
    expect(alert?.textContent).toContain(format('deferred.phaseBody', { phase: 15 }));
    expect(alert?.getAttribute('aria-label')).toBe(
      `${t('deferred.reasonDeferred')} ${format('deferred.phaseBody', { phase: 15 })}`,
    );
  });

  it('omits the owning-phase sentence entirely when no phase is supplied', () => {
    const { container } = renderWithAntd(
      <DeferredNotice backing="deferred" variant="block" />,
    );

    const alert = container.querySelector('.ant-alert');
    expect(alert?.textContent).not.toContain('Phase');
    expect(alert?.getAttribute('aria-label')).toBe(t('deferred.reasonDeferred'));
  });
});

describe('DeferredNotice — absence is expressible', () => {
  it('renders nothing at all when no backing value is supplied', () => {
    const { container } = renderWithAntd(<DeferredNotice />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(t('deferred.tag'))).toBeNull();
    expect(screen.queryByText(t('deferred.fixtureTag'))).toBeNull();
  });

  it('renders no data-np-backing attribute of its own on either variant', () => {
    // The marker attribute belongs to the marked REGION, never to this
    // component — a false marker is as much a defect as a missing one.
    const inline = renderWithAntd(<DeferredNotice backing="fixture" variant="inline" />);
    expect(inline.container.querySelector('[data-np-backing]')).toBeNull();
    inline.unmount();

    const block = renderWithAntd(<DeferredNotice backing="deferred" variant="block" />);
    expect(block.container.querySelector('[data-np-backing]')).toBeNull();
  });
});

describe('DeferredNotice — tooltip is additive, never the only disclosure', () => {
  it('keeps the visible element and the accessible label when the tooltip is removed', () => {
    const withTooltip = renderWithAntd(
      <DeferredNotice backing="fixture" variant="inline" tooltip="Phase 18 owns this." />,
    );
    const tagged = screen.getByText(t('deferred.fixtureTag'));
    expect(tagged.getAttribute('aria-label')).toBe(t('deferred.reasonFixture'));
    expect(tagged.textContent).toBe(t('deferred.fixtureTag'));
    withTooltip.unmount();

    renderWithAntd(<DeferredNotice backing="fixture" variant="inline" />);
    const untagged = screen.getByText(t('deferred.fixtureTag'));
    expect(untagged).toBeTruthy();
    expect(untagged.getAttribute('aria-label')).toBe(t('deferred.reasonFixture'));
  });
});

describe('DeferredNotice — colour token discipline', () => {
  it('renders its colours from theme.useToken(), not from literals', () => {
    let tokens: { bg: string; border: string; text: string } | null = null;
    const TokenProbe: React.FC = () => {
      const { token } = theme.useToken();
      tokens = {
        bg: token.colorWarningBg,
        border: token.colorWarningBorder,
        text: token.colorWarningText,
      };
      return null;
    };

    const asCss = (value: string) => {
      const probe = document.createElement('div');
      probe.style.background = value;
      return probe.style.background;
    };

    renderWithAntd(
      <>
        <TokenProbe />
        <DeferredNotice backing="fixture" variant="inline" />
      </>,
    );

    const tag = screen.getByText(t('deferred.fixtureTag'));
    const resolved = tokens as { bg: string; border: string; text: string } | null;
    expect(resolved).not.toBeNull();
    expect(tag.style.background).toBe(asCss((resolved as { bg: string }).bg));
    expect(tag.style.color).toBe(asCss((resolved as { text: string }).text));
    expect(tag.style.borderColor).toBe(asCss((resolved as { border: string }).border));
  });

  it('hard-codes no colour literal in its own source', () => {
    const source = readFileSync(SOURCE_PATH, 'utf8');

    expect(source).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    expect(source).toMatch(/useToken\(\)/);
  });
});

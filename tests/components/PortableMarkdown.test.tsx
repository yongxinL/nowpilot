// tests/components/PortableMarkdown.test.tsx — the ONLY markdown renderer in
// the phase. Threat T-1-07 (XSS): sanitization is unconditional (defense in
// depth); trust is a styling-only hint; raw HTML is escaped to plain text.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PortableMarkdown } from '@/core/components/PortableMarkdown';

describe('PortableMarkdown', () => {
  it('renders markdown content', () => {
    const { container } = render(
      <PortableMarkdown content="**bold** and `code`" trust="retrieved" />,
    );
    expect(container.textContent).toContain('bold');
    expect(container.textContent).toContain('code');
  });

  it('renders null for empty content', () => {
    const { container } = render(<PortableMarkdown content="" />);
    expect(container.firstChild).toBeNull();
    const { container: ws } = render(<PortableMarkdown content="   " />);
    expect(ws.firstChild).toBeNull();
  });

  it('sets the data-trust attribute for styling hooks', () => {
    const { container } = render(<PortableMarkdown content="hi" trust="retrieved" />);
    const el = container.querySelector('[data-trust="retrieved"]');
    expect(el).not.toBeNull();
  });

  it('sanitizes raw HTML — strips event handlers and scripts (T-1-07)', () => {
    const { container } = render(
      <PortableMarkdown content='<img src="x" onerror="alert(1)"><script>bad()</script>' />,
    );
    expect(container.innerHTML).not.toContain('onerror');
    expect(container.innerHTML).not.toContain('<script');
    // DOMPurify default policy strips the script tag entirely
    expect(screen.queryByText(/bad\(\)/)).toBeNull();
  });

  it('sanitizes untrusted content the same as retrieved (sanitize is unconditional)', () => {
    const { container } = render(
      <PortableMarkdown content='<a href="javascript:alert(1)">click</a>' trust="untrusted" />,
    );
    expect(container.innerHTML).not.toContain('javascript:');
  });
});

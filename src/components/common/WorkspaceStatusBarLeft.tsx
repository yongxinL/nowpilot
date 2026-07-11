import { useThemeStore, type ThemeMode } from '../../core/stores/themeStore';

export function formatTokenCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export interface WorkspaceStatusBarLeftProps {
  providerName?: string;
  inputTokens?: number | null;
  sessionTokens?: number | null;
}

const modeLabel: Record<ThemeMode, string> = {
  auto: 'Auto',
  light: 'Light',
  dark: 'Dark',
};

export function WorkspaceStatusBarLeft({
  providerName,
  inputTokens,
  sessionTokens,
}: WorkspaceStatusBarLeftProps) {
  const mode = useThemeStore((s) => s.mode);
  const resolvedProvider = providerName ?? 'NowPilot';
  const parts: string[] = [`${resolvedProvider} · ${modeLabel[mode]}`];
  if (inputTokens != null) parts.push(`Input: ${formatTokenCount(inputTokens)} tokens`);
  if (sessionTokens != null) parts.push(`Session: ${formatTokenCount(sessionTokens)} tokens`);
  return <span aria-label="workspace status left">{parts.join(' · ')}</span>;
}

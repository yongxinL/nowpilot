// src/core/components/ErrorBoundary.tsx — §17.4 (line 2209): every page is
// wrapped in <ErrorBoundary> → on crash it renders a generic AntD Card fallback
// (STR.chat.errorRetry) with a retry button. Class component: render errors are
// caught and logged via debugLog with a canonical §C.2 code (Golden Rule 9).
// Threat T-1-08 / R-10: NEVER renders raw error text to the user — the
// fallback shows generic STR copy only; the details go to debugLog (redacted).
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Card } from 'antd';
import { debugLog } from '@/core/error/debugLog';
import { STR } from '@/core/i18n/strings';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional callback invoked when the user clicks "Try again". */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    debugLog('COMPONENT_RENDER', error.message, {
      error,
      context: errorInfo.componentStack ?? undefined,
      module: 'ErrorBoundary',
    });
  }

  private handleReset = (): void => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <Card>
        <p>{STR.chat.errorRetry}</p>
        <Button type="primary" onClick={this.handleReset}>
          Try again
        </Button>
      </Card>
    );
  }
}

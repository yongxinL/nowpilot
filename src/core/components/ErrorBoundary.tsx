import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button, Result } from 'antd';
import { debugLog } from '../utils/debugLog';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    debugLog('error', 'ErrorBoundary caught error', {
      error: error.message,
      componentStack: info.componentStack,
    });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="Something went wrong"
          subTitle={this.state.error?.message}
          extra={[
            <Button key="retry" type="primary" onClick={this.handleReset}>
              Try Again
            </Button>,
            <Button key="reload" onClick={() => window.location.reload()}>
              Reload Page
            </Button>,
          ]}
        />
      );
    }
    return this.props.children;
  }
}

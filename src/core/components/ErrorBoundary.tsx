import React from 'react';
import { Result, Button } from 'antd';
import { t } from '../i18n/strings';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <Result
          status="500"
          title={t('common.error')}
          subTitle={t('shell.error')}
          extra={
            <Button type="primary" onClick={this.handleReload}>
              {t('common.retry')}
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}

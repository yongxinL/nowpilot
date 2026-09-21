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

/**
 * Surface render-failure boundary (§17.4 / UI-SPEC "error | Shell render
 * failure"). Mounted at each surface root inside `AntdApp`, so a render
 * failure replaces the shell with an explicit, actionable fallback instead of
 * a blank panel. Context-free by design: the fallback must render even when
 * every provider below it failed.
 *
 * Copy is resolved through `t()` from the pinned Phase-1 keys
 * `shell.errorTitle` / `shell.errorBody` / `shell.errorReload` — never AntD's
 * locale defaults, which are unreachable because the strings are set
 * explicitly here.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleReload = (): void => {
    // Re-mount the subtree; the surface is re-rendered from scratch.
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <Result
          status="500"
          title={t('shell.errorTitle')}
          subTitle={t('shell.errorBody')}
          extra={
            <Button type="primary" onClick={this.handleReload}>
              {t('shell.errorReload')}
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}

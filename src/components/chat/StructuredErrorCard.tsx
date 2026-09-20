import React, { useState } from 'react';
import { Button, Tooltip, theme } from 'antd';
import {
  WarningOutlined,
  SettingOutlined,
  ReloadOutlined,
  DownOutlined,
  RightOutlined,
  CopyOutlined,
  CheckOutlined,
} from '@ant-design/icons';

export interface StructuredErrorDetails {
  title?: string;
  description?: string;
  canonicalCode: string;
  redactedSummary: string;
  correlationId: string;
}

interface StructuredErrorCardProps {
  error: StructuredErrorDetails;
  onOpenSettings?: () => void;
  onRetry?: () => void;
}

/**
 * Parses raw error strings (such as "Error generating response: Provider returned HTTP 401...")
 * into structured NowPilot error metadata.
 */
export function parseToStructuredError(rawError: string): StructuredErrorDetails {
  const correlationId = 'np-err-' + Math.random().toString(36).substring(2, 9);

  const clean = rawError
    .replace(/^(\*|\s)*Error generating response:\s*/i, '')
    .replace(/\*+$/g, '')
    .trim();

  // 401 / Unauthorized
  if (/401|api key|unauthorized|unauthenticated/i.test(clean)) {
    return {
      title: 'Provider configuration required',
      description: 'NowPilot could not connect to this provider with current credentials.',
      canonicalCode: 'ERR_PROVIDER_AUTH_REQUIRED',
      redactedSummary: 'HTTP 401: Authentication required. API key is missing, invalid, or expired.',
      correlationId,
    };
  }

  // 404 / Model not found
  if (/404|not found|model/i.test(clean)) {
    return {
      title: 'Configured model unavailable',
      description: 'The selected model is not available from this provider endpoint.',
      canonicalCode: 'ERR_MODEL_NOT_FOUND',
      redactedSummary: clean.length > 120 ? clean.substring(0, 120) + '...' : clean,
      correlationId,
    };
  }

  // 429 / Rate limit
  if (/429|quota|rate limit/i.test(clean)) {
    return {
      title: 'Provider rate limit reached',
      description: 'The AI provider returned a rate limit or quota exceeded response.',
      canonicalCode: 'ERR_PROVIDER_RATE_LIMITED',
      redactedSummary: 'HTTP 429: Requests throttled. Wait a moment before retrying.',
      correlationId,
    };
  }

  // Network / Connection
  if (/network|fetch|failed to fetch|econnrefused|timeout|connection/i.test(clean)) {
    return {
      title: 'Provider connection failed',
      description: 'NowPilot could not reach the configured provider service endpoint.',
      canonicalCode: 'ERR_PROVIDER_UNREACHABLE',
      redactedSummary: 'Endpoint connection failed or timed out. Check local proxy or network connectivity.',
      correlationId,
    };
  }

  // General fallback
  return {
    title: 'Provider request failed',
    description: 'NowPilot encountered an error while communicating with the provider.',
    canonicalCode: 'ERR_PROVIDER_REQUEST_FAILED',
    redactedSummary: clean.length > 120 ? clean.substring(0, 120) + '...' : clean,
    correlationId,
  };
}

export const StructuredErrorCard: React.FC<StructuredErrorCardProps> = ({
  error,
  onOpenSettings,
  onRetry,
}) => {
  const { token } = theme.useToken();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = `Error: ${error.canonicalCode}\nSummary: ${error.redactedSummary}\nCorrelation ID: ${error.correlationId}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        marginTop: 10,
        marginBottom: 10,
        width: '100%',
        maxWidth: 540,
        background: token.colorBgContainer,
        borderRadius: 12,
        border: `1px solid ${token.colorErrorBorder || '#fca5a5'}`,
        padding: '14px 16px',
        boxShadow: token.boxShadowSecondary,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 9999,
            background: token.colorErrorBg || '#fef2f2',
            color: token.colorError || '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <WarningOutlined style={{ fontSize: 15 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: token.colorText,
              lineHeight: 1.4,
            }}
          >
            {error.title || 'Provider configuration required'}
          </div>
          <div
            style={{
              fontSize: 12,
              color: token.colorTextSecondary,
              marginTop: 2,
              lineHeight: 1.45,
            }}
          >
            {error.description || 'NowPilot could not connect to this provider.'}
          </div>
        </div>
      </div>

      {/* Primary Action Buttons (Hit target ≥ 32px) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 38 }}>
        {onOpenSettings && (
          <Button
            size="small"
            icon={<SettingOutlined />}
            onClick={onOpenSettings}
            style={{
              height: 32,
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Open provider settings
          </Button>
        )}
        {onRetry && (
          <Button
            size="small"
            type="primary"
            icon={<ReloadOutlined />}
            onClick={onRetry}
            style={{
              height: 32,
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Retry
          </Button>
        )}
      </div>

      {/* Expandable Details Row */}
      <div
        style={{
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          paddingTop: 8,
          marginTop: 2,
        }}
      >
        <button
          type="button"
          onClick={() => setDetailsOpen(!detailsOpen)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            padding: '2px 4px',
            fontSize: 11,
            color: token.colorTextTertiary,
            cursor: 'pointer',
            borderRadius: 4,
          }}
          aria-expanded={detailsOpen}
        >
          <span>{detailsOpen ? <DownOutlined /> : <RightOutlined />}</span>
          <span>Diagnostic details</span>
        </button>

        {detailsOpen && (
          <div
            style={{
              marginTop: 8,
              padding: '10px 12px',
              borderRadius: 8,
              background: token.colorFillSecondary,
              fontSize: 11,
              fontFamily: 'monospace',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              color: token.colorTextSecondary,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                <strong style={{ color: token.colorText }}>Code:</strong> {error.canonicalCode}
              </span>
              <Tooltip title={copied ? 'Copied' : 'Copy diagnostic info'}>
                <button
                  type="button"
                  onClick={handleCopy}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: token.colorTextTertiary,
                    padding: 2,
                  }}
                  aria-label="Copy error details"
                >
                  {copied ? <CheckOutlined style={{ color: token.colorSuccess }} /> : <CopyOutlined />}
                </button>
              </Tooltip>
            </div>
            <div>
              <strong style={{ color: token.colorText }}>Summary:</strong> {error.redactedSummary}
            </div>
            <div>
              <strong style={{ color: token.colorText }}>Correlation ID:</strong>{' '}
              <span style={{ userSelect: 'all' }}>{error.correlationId}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

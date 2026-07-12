import React from 'react';
import type { CSSProperties } from 'react';

const cardStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
  padding: '0',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 32,
  fontWeight: 600,
  lineHeight: '40px',
};

const subtitleStyle: CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  color: 'var(--ant-color-text-secondary)',
};

export function ChatPage() {
  return (
    <div style={cardStyle} data-page-empty-state="chat">
      <h1 style={titleStyle}>Chat</h1>
      <p style={subtitleStyle}>Coming soon</p>
    </div>
  );
}
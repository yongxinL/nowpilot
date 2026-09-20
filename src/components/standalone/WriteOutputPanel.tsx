import React, { useState, useMemo } from 'react';
import { Tooltip, App } from 'antd';
import {
  ThunderboltOutlined,
  LeftOutlined,
  RightOutlined,
  CopyOutlined,
  ReloadOutlined,
  RedoOutlined,
  SoundOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';

interface WriteOutputPanelProps {
  currentOutput: string;
  selectedModelName: string;
  outputVersions: string[];
  currentVersionIndex: number;
  onPrevVersion: () => void;
  onNextVersion: () => void;
  isEditingOutput: boolean;
  editableOutputText: string;
  onChangeEditableOutputText: (val: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onCopy: () => void;
  onRegenerate: () => void;
  isPlayingAudio: boolean;
  onToggleSpeech: () => void;
  onSaveToNote?: () => void;
}

export const WriteOutputPanel: React.FC<WriteOutputPanelProps> = ({
  currentOutput,
  selectedModelName,
  outputVersions,
  currentVersionIndex,
  onPrevVersion,
  onNextVersion,
  isEditingOutput,
  editableOutputText,
  onChangeEditableOutputText,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onCopy,
  onRegenerate,
  isPlayingAudio,
  onToggleSpeech,
}) => {
  const { message: antMessage } = App.useApp();

  // Extract title if the text starts with a title line
  const parsed = useMemo(() => {
    if (!currentOutput) return { title: '', paragraphs: [] };
    const lines = currentOutput.split('\n');
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      if (firstLine.startsWith('# ')) {
        const title = firstLine.replace(/^#+\s*/, '');
        const rest = lines.slice(1).join('\n').trim();
        const paragraphs = rest.split(/\n\s*\n/).filter(Boolean);
        return { title, paragraphs };
      }
      if (lines.length > 1 && lines[1].trim() === '' && firstLine.length < 100 && !firstLine.endsWith('.')) {
        const title = firstLine;
        const rest = lines.slice(2).join('\n').trim();
        const paragraphs = rest.split(/\n\s*\n/).filter(Boolean);
        return { title, paragraphs };
      }
    }
    const paragraphs = currentOutput.split(/\n\s*\n/).filter(Boolean);
    return { title: '', paragraphs };
  }, [currentOutput]);

  if (!currentOutput) {
    return (
      <div
        style={{
          height: '100%',
          minHeight: 360,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          textAlign: 'center',
          color: '#8a99a4',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 500 }}>Output will appear here upon submission</span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        minHeight: 0,
        flex: 1,
        paddingLeft: 0,
      }}
    >
      {/* Output Top Header: Model Tag & Version Navigator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 8,
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 14,
            fontWeight: 700,
            color: '#12171a',
          }}
        >
          <ThunderboltOutlined style={{ color: '#12171a', fontSize: 13 }} />
          <span>{selectedModelName}</span>
        </div>

        {/* Version pagination (< 2/2 >) if multiple versions exist */}
        {outputVersions.length > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: '#8a99a4',
            }}
          >
            <button
              type="button"
              onClick={onPrevVersion}
              disabled={currentVersionIndex === 0}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '2px 4px',
                cursor: currentVersionIndex === 0 ? 'not-allowed' : 'pointer',
                color: currentVersionIndex === 0 ? '#cbd5e1' : '#8a99a4',
              }}
              title="Previous revision"
            >
              <LeftOutlined style={{ fontSize: 10 }} />
            </button>
            <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 500 }}>
              {currentVersionIndex + 1}/{outputVersions.length}
            </span>
            <button
              type="button"
              onClick={onNextVersion}
              disabled={currentVersionIndex === outputVersions.length - 1}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '2px 4px',
                cursor: currentVersionIndex === outputVersions.length - 1 ? 'not-allowed' : 'pointer',
                color: currentVersionIndex === outputVersions.length - 1 ? '#cbd5e1' : '#8a99a4',
              }}
              title="Next revision"
            >
              <RightOutlined style={{ fontSize: 10 }} />
            </button>
          </div>
        )}
      </div>

      {/* Output Title & Body or Full-Height Editing Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          paddingTop: 4,
          paddingBottom: 12,
          overflowY: 'auto',
        }}
      >
        {isEditingOutput ? (
          <textarea
            value={editableOutputText}
            onChange={(e) => onChangeEditableOutputText(e.target.value)}
            style={{
              width: '100%',
              height: '100%',
              minHeight: 380,
              flex: 1,
              background: '#f8fafc',
              padding: 16,
              borderRadius: 12,
              border: '1.5px solid #8b5cf6',
              outline: 'none',
              color: '#12171a',
              fontSize: 14,
              lineHeight: 1.65,
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              resize: 'none',
            }}
            autoFocus
            placeholder="Edit your response..."
          />
        ) : (
          <div>
            {parsed.title && (
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  color: '#12171a',
                  marginBottom: 18,
                  lineHeight: 1.3,
                }}
              >
                {parsed.title}
              </h2>
            )}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                fontSize: 14,
                lineHeight: 1.65,
                color: '#12171a',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {parsed.paragraphs.map((para, idx) => (
                <p key={idx} style={{ margin: 0 }}>
                  {para}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Output Footer Action Buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 16,
          marginTop: 'auto',
          flexShrink: 0,
        }}
      >
        {/* Left Action Icons: 1. Copy, 2. Regenerate, 3. Redo, 4. Sound */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          {/* 1. Copy */}
          <Tooltip title="Copy">
            <button
              type="button"
              onClick={onCopy}
              style={{
                padding: 4,
                color: '#8a99a4',
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#12171a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#8a99a4';
              }}
            >
              <CopyOutlined style={{ fontSize: 16 }} />
            </button>
          </Tooltip>

          {/* 2. Regenerate */}
          <Tooltip title="Regenerate">
            <button
              type="button"
              onClick={onRegenerate}
              style={{
                padding: 4,
                color: '#8a99a4',
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#12171a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#8a99a4';
              }}
            >
              <ReloadOutlined style={{ fontSize: 16 }} />
            </button>
          </Tooltip>

          {/* 3. Redo */}
          <Tooltip title="Re-run">
            <button
              type="button"
              onClick={onRegenerate}
              style={{
                padding: 4,
                color: '#8a99a4',
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#12171a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#8a99a4';
              }}
            >
              <RedoOutlined style={{ fontSize: 16 }} />
            </button>
          </Tooltip>

          {/* 4. Read aloud / Sound */}
          <Tooltip title={isPlayingAudio ? 'Stop speech' : 'Read aloud'}>
            <button
              type="button"
              onClick={onToggleSpeech}
              style={{
                padding: 4,
                color: isPlayingAudio ? '#7c3aed' : '#8a99a4',
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = isPlayingAudio ? '#6d28d9' : '#12171a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = isPlayingAudio ? '#7c3aed' : '#8a99a4';
              }}
            >
              <SoundOutlined style={{ fontSize: 16 }} />
            </button>
          </Tooltip>
        </div>

        {/* Right Action: Edit Button */}
        {isEditingOutput ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={onSaveEdit}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                height: 32,
                paddingLeft: 12,
                paddingRight: 12,
                background: '#6035f5',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 150ms ease',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              <CheckOutlined style={{ fontSize: 11 }} />
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                height: 32,
                paddingLeft: 12,
                paddingRight: 12,
                color: '#8a99a4',
                background: 'transparent',
                border: '1px solid #ebeff2',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              <CloseOutlined style={{ fontSize: 11 }} />
              <span>Cancel</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onStartEdit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 32,
              paddingLeft: 12,
              paddingRight: 12,
              borderRadius: 8,
              background: 'var(--card, #ffffff)',
              color: '#6035f5',
              border: '1px solid #ebeff2',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            <EditOutlined style={{ fontSize: 12 }} />
            <span>Edit</span>
          </button>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { theme } from 'antd';
import { CloseOutlined, PictureOutlined, ScissorOutlined, GlobalOutlined } from '@ant-design/icons';
import { Attachment } from '../../types';

interface AttachmentBarProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

export const AttachmentBar: React.FC<AttachmentBarProps> = ({
  attachments,
  onRemove,
}) => {
  const { token } = theme.useToken();
  if (!attachments || attachments.length === 0) return null;

  const baseBtnStyle: React.CSSProperties = {
    color: token.colorTextTertiary,
    cursor: 'pointer',
    flexShrink: 0,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8, width: '100%' }}>
      {attachments.map((att) => {
        if (att.type === 'quote') {
          return (
            <div
              key={att.id}
              style={{
                alignSelf: 'flex-end',
                maxWidth: '90%',
                border: `1px solid ${token.colorBorderSecondary}`,
                background: token.colorBgContainer,
                borderRadius: 16,
                padding: '6px 14px',
                fontSize: 12,
                color: token.colorTextTertiary,
                boxShadow: token.boxShadow,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={att.content || att.title}>
                {att.content || att.title}
              </span>
              <button
                type="button"
                onClick={() => onRemove(att.id)}
                style={{ ...baseBtnStyle, marginLeft: 4 }}
                title="Remove quote"
              >
                <CloseOutlined style={{ fontSize: 10 }} />
              </button>
            </div>
          );
        }

        if (att.type === 'image' || att.type === 'screen_cut') {
          return (
            <div
              key={att.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: 6,
                background: token.colorFillQuaternary,
                borderRadius: 12,
                border: `1px solid ${token.colorBorderSecondary}`,
                fontSize: 12,
                alignSelf: 'flex-start',
              }}
            >
              {att.thumbnail ? (
                <img src={att.thumbnail} alt="Attachment" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 8 }} />
              ) : (
                <div style={{ width: 36, height: 36, background: token.colorInfoBg, color: token.colorInfo, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
                  {att.type === 'screen_cut' ? <ScissorOutlined /> : <PictureOutlined />}
                </div>
              )}
              <span style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: token.colorTextSecondary, fontWeight: 500, fontSize: 12 }}>
                {att.title}
              </span>
              <button
                type="button"
                onClick={() => onRemove(att.id)}
                style={{ ...baseBtnStyle, padding: 4 }}
                title="Remove image"
              >
                <CloseOutlined style={{ fontSize: 10 }} />
              </button>
            </div>
          );
        }

        return (
          <div
            key={att.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              background: token.colorFillQuaternary,
              borderRadius: 8,
              border: `1px solid ${token.colorBorderSecondary}`,
              fontSize: 12,
              alignSelf: 'flex-start',
            }}
          >
            <GlobalOutlined style={{ color: token.colorInfo }} />
            <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: token.colorTextSecondary, fontWeight: 500 }}>{att.title}</span>
            <button
              type="button"
              onClick={() => onRemove(att.id)}
              style={{ ...baseBtnStyle, marginLeft: 4 }}
            >
              <CloseOutlined style={{ fontSize: 10 }} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

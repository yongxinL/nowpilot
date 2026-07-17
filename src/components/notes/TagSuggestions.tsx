import React from 'react';
import { Tag, Button, Typography, Space, Spin } from 'antd';
import { CheckOutlined } from '@ant-design/icons';

const { Text } = Typography;

export interface TagSuggestionsProps {
  suggestedTags: string[];
  acceptedTags: Set<string>;
  onAccept: (tag: string) => void;
  onReject: (tag: string) => void;
  loading?: boolean;
}

export function TagSuggestions({
  suggestedTags,
  acceptedTags,
  onAccept,
  onReject,
  loading = false,
}: TagSuggestionsProps) {
  if (loading) {
    return (
      <div style={{ padding: '8px 0' }}>
        <Spin size="small" />
        <Text type="secondary" style={{ marginLeft: 8 }}>
          Analyzing tags...
        </Text>
      </div>
    );
  }

  if (suggestedTags.length === 0) {
    return (
      <div style={{ padding: '8px 0' }}>
        <Text type="secondary">No suggestions yet</Text>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <Text type="secondary" strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
        Suggested tags
      </Text>
      <Space wrap size={[4, 4]}>
        {suggestedTags.map((tag) => {
          const isAccepted = acceptedTags.has(tag);
          return (
            <Tag
              key={tag}
              closable
              onClose={(e) => {
                e.preventDefault();
                onReject(tag);
              }}
              color={isAccepted ? 'green' : 'default'}
            >
              {tag}
              {!isAccepted && (
                <Button
                  type="text"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAccept(tag);
                  }}
                  style={{
                    marginLeft: 2,
                    padding: 0,
                    width: 14,
                    height: 14,
                    fontSize: 10,
                    lineHeight: '14px',
                  }}
                />
              )}
            </Tag>
          );
        })}
      </Space>
    </div>
  );
}

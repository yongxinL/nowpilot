import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Flex, Spin, theme } from 'antd';
import {
  FileTextOutlined,
  GlobalOutlined,
  FormOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { welcomeCardService, type WelcomeCard } from '../../core/ai/WelcomeCardService';
import { debugLog } from '../../core/utils/debugLog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface WelcomeCardsProps {
  onSelectCard: (templateId: string, promptText: string) => void;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Prompt text per card template — from UI-SPEC §Welcome Cards Copy
// ---------------------------------------------------------------------------
const CARD_PROMPT_TEXT: Record<string, string> = {
  summarize_page: 'Summarize the content of this page.',
  research_topic: 'Research: {topic}',
  draft_response: 'Draft a response to:',
  explain_code: 'Explain this code/error:',
  write_script: 'Write a script that:',
  analyze_data: 'Analyze this data:',
};

/**
 * Icon mapping: card template ID → antd icon component name → rendered icon.
 */
const getCardIcon = (iconName: string): React.ReactNode => {
  switch (iconName) {
    case 'FileTextOutlined':
      return <FileTextOutlined style={{ fontSize: 24, color: 'inherit' }} />;
    case 'GlobalOutlined':
      return <GlobalOutlined style={{ fontSize: 24, color: 'inherit' }} />;
    case 'FormOutlined':
      return <FormOutlined style={{ fontSize: 24, color: 'inherit' }} />;
    case 'CodeOutlined':
      return <CodeOutlined style={{ fontSize: 24, color: 'inherit' }} />;
    default:
      return <FileTextOutlined style={{ fontSize: 24, color: 'inherit' }} />;
  }
};

const { Text } = Typography;

// ---------------------------------------------------------------------------
// WelcomeCards component — 6-card capability grid (D-17/D-18/D-19/D-21)
// ---------------------------------------------------------------------------
export function WelcomeCards({ onSelectCard, onDismiss }: WelcomeCardsProps) {
  const { token } = theme.useToken();
  const [cards, setCards] = useState<WelcomeCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    welcomeCardService
      .getCards()
      .then((result) => {
        if (!cancelled) {
          setCards(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          debugLog('warn', '[WelcomeCards] failed to load cards', { error: err });
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCardClick = (card: WelcomeCard) => {
    const promptText = CARD_PROMPT_TEXT[card.templateId] ?? '';
    onSelectCard(card.templateId, promptText);
  };

  // ---- Loading state ----
  if (loading) {
    return (
      <div
        data-testid="welcome-cards-loading"
        style={{ display: 'flex', justifyContent: 'center', padding: token.paddingLG }}
      >
        <Spin />
      </div>
    );
  }

  // ---- Empty / error fallback ----
  if (cards.length === 0) {
    return null;
  }

  return (
    <div style={{ width: '100%' }}>
      {/* 6-card grid */}
      <Flex wrap="wrap" gap={token.marginLG} justify="center">
        {cards.map((card) => (
          <Card
            key={card.id}
            hoverable
            size="small"
            onClick={() => handleCardClick(card)}
            style={{
              flex: '1 1 180px',
              minWidth: 180,
              maxWidth: 240,
              background: token.colorBgElevated,
              borderColor: token.colorBorderSecondary,
              cursor: 'pointer',
            }}
            styles={{
              body: {
                display: 'flex',
                flexDirection: 'column',
                gap: token.marginXS,
                padding: token.paddingSM,
              },
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = token.colorPrimary;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = token.colorBorderSecondary;
            }}
          >
            {/* Icon */}
            <div style={{ color: token.colorPrimary, marginBottom: 4 }}>
              {getCardIcon(card.icon)}
            </div>
            {/* Title */}
            <Text strong style={{ fontSize: 16 }}>
              {card.title}
            </Text>
            {/* Description */}
            <Text type="secondary" style={{ fontSize: 14 }}>
              {card.description}
            </Text>
          </Card>
        ))}
      </Flex>

      {/* Dismiss button — below the card grid */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: token.margin,
        }}
      >
        <Button type="link" size="small" onClick={onDismiss}>
          Don't show again
        </Button>
      </div>
    </div>
  );
}

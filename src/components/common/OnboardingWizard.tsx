import React, { useState } from 'react';
import { Modal, Steps, Card, Button, Typography, Flex } from 'antd';
import { MessageOutlined, FileTextOutlined, BulbOutlined } from '@ant-design/icons';
import { t } from '../../core/i18n/strings';

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
}

const STEP_TITLES = [
  { title: t('onboarding.step1Title') },
  { title: t('onboarding.step2Title') },
  { title: t('onboarding.step3Title') },
];

interface CardContent {
  heading: string;
  body: string;
  Icon: React.ComponentType<{ style?: React.CSSProperties }>;
}

const STEP_CARDS: CardContent[] = [
  {
    heading: t('onboarding.step1Title'),
    body: t('onboarding.step1Body'),
    Icon: MessageOutlined,
  },
  {
    heading: t('onboarding.step2Title'),
    body: t('onboarding.step2Body'),
    Icon: FileTextOutlined,
  },
  {
    heading: t('onboarding.step3Title'),
    body: t('onboarding.step3Body'),
    Icon: BulbOutlined,
  },
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ open, onComplete }) => {
  const [step, setStep] = useState(0); // 0=welcome, 1=chat, 2=capture, 3=workspace
  const currentStep = Math.min(step, STEP_CARDS.length - 1);
  const isLastStep = step >= STEP_CARDS.length;

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handlePrevious = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleComplete = () => {
    onComplete();
  };

  return (
    <Modal open={open} closable={false} footer={null} width={480} centered>
      <Steps
        current={currentStep}
        items={STEP_TITLES}
        size="small"
        style={{ marginBottom: 24 }}
      />

      {/* Welcome banner — step 0 only */}
      {step === 0 && (
        <Card variant="outlined" style={{ marginBottom: 16 }}>
          <Typography.Title level={4}>
            {t('onboarding.welcomeHeading')}
          </Typography.Title>
          <Typography.Paragraph type="secondary">
            {t('onboarding.welcomeSubtext')}
          </Typography.Paragraph>
        </Card>
      )}

      {/* Content cards — render all but only show the current one */}
      {STEP_CARDS.map((card, i) => {
        const { Icon } = card;
        return (
          <Card
            key={i}
            style={{
              marginBottom: 16,
              display: i === currentStep ? 'block' : 'none',
            }}
          >
            <Flex vertical align="center" gap={8}>
              <div
                style={{
                  width: 200,
                  height: 120,
                  background: 'var(--ant-color-fill-secondary, #f0f0f0)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon style={{ fontSize: 48, color: 'var(--ant-color-text-tertiary, #999)' }} />
              </div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Illustration
              </Typography.Text>
            </Flex>
            <Typography.Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>
              {card.heading}
            </Typography.Title>
            <Typography.Paragraph type="secondary">
              {card.body}
            </Typography.Paragraph>
          </Card>
        );
      })}

      {/* Navigation */}
      <Flex justify="space-between" align="center" style={{ marginTop: 24 }}>
        <Button
          type="default"
          onClick={handlePrevious}
          disabled={step === 0}
        >
          {t('onboarding.previousStep')}
        </Button>
        <Flex gap={8} align="center">
          {isLastStep ? (
            <Button type="primary" onClick={handleComplete}>
              {t('onboarding.startExploring')}
            </Button>
          ) : (
            <Button type="primary" onClick={handleNext}>
              {t('onboarding.nextStep')}
            </Button>
          )}
          <Button type="link" onClick={handleComplete}>
            {t('onboarding.skip')}
          </Button>
        </Flex>
      </Flex>
    </Modal>
  );
};

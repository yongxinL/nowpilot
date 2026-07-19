import { useState } from 'react';
import { Card, Input, Radio, Segmented, Button, Typography, Flex, message, theme } from 'antd';
import { usePreferenceStore } from '../../core/memory/PreferenceMemoryStore';
import type { PreferencePayload } from '../../core/memory/memoryTypes';

const { Text, Paragraph } = Typography;

const TONE_OPTIONS = [
  { label: 'Professional', value: 'professional', subtitle: 'Direct, efficient, task-focused', preview: 'Got it. Here\'s the summary.' },
  { label: 'Professional + Approachable', value: 'professional_approachable', subtitle: 'Warm and supportive while staying focused', preview: 'I understand. Let me help you with that — here\'s what I found.' },
];

const BREVITY_OPTIONS = [
  { label: 'Concise', value: 'concise', description: 'Short, essential answers only' },
  { label: 'Balanced', value: 'balanced', description: 'Complete but not verbose (default)' },
  { label: 'Detailed', value: 'detailed', description: 'Thorough with examples and context' },
];

const BREVITY_PREVIEWS: Record<string, string> = {
  concise: 'Here\'s the summary: key point 1, key point 2.',
  balanced: 'Here\'s a complete overview of what I found. The main takeaway is that the system supports three deployment modes.',
  detailed: 'Let me break this down in detail. The system supports three deployment modes, each with distinct characteristics. First, the local mode runs entirely on your machine...',
};

export function PersonaPage() {
  const { token } = theme.useToken();
  const prefs = usePreferenceStore();
  const [aiName, setAiName] = useState(prefs.aiName ?? '');
  const [aiTone, setAiTone] = useState<string>(prefs.aiTone ?? 'professional_approachable');
  const [responseBrevity, setResponseBrevity] = useState<string>(prefs.responseBrevity ?? 'balanced');

  const handleSave = () => {
    usePreferenceStore.getState().setPreferences({
      aiName: aiName || undefined,
      aiTone: aiTone as 'professional' | 'professional_approachable',
      responseBrevity: responseBrevity as 'concise' | 'balanced' | 'detailed',
    } as Partial<PreferencePayload>);
    message.success('Persona settings saved');
  };

  return (
    <Flex vertical gap="middle" style={{ maxWidth: 600 }}>
      <Card title="AI Name" size="small">
        <Input
          placeholder="Enter a name for your AI assistant"
          value={aiName}
          onChange={(e) => setAiName(e.target.value)}
        />
        <Text type="secondary" italic style={{ display: 'block', marginTop: 8 }}>
          Hi, I'm <Text strong>{aiName || 'NowPilot'}</Text>. How can I help you today?
        </Text>
      </Card>

      <Card title="Tone" size="small">
        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          value={aiTone}
          onChange={(e) => setAiTone(e.target.value)}
          style={{ display: 'flex', gap: 8, marginBottom: 12 }}
        >
          {TONE_OPTIONS.map((opt) => (
            <Radio.Button
              key={opt.value}
              value={opt.value}
              style={{
                flex: 1,
                height: 'auto',
                padding: '8px 12px',
                whiteSpace: 'normal',
                textAlign: 'center',
              }}
            >
              <div style={{ fontWeight: 600 }}>{opt.label}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{opt.subtitle}</div>
            </Radio.Button>
          ))}
        </Radio.Group>
        <Paragraph type="secondary" italic style={{ fontSize: 12, margin: 0 }}>
          Preview: {TONE_OPTIONS.find((o) => o.value === aiTone)?.preview}
        </Paragraph>
      </Card>

      <Card title="Response Brevity" size="small">
        <Segmented
          block
          value={responseBrevity}
          onChange={(v) => setResponseBrevity(v as string)}
          options={BREVITY_OPTIONS.map((opt) => ({
            label: (
              <div style={{ padding: '2px 0' }}>
                <div style={{ fontWeight: 500 }}>{opt.label}{opt.value === 'balanced' ? ' (default)' : ''}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{opt.description}</div>
              </div>
            ),
            value: opt.value,
          }))}
        />
        <Paragraph type="secondary" italic style={{ fontSize: 12, margin: 8, marginBottom: 0 }}>
          Preview: {BREVITY_PREVIEWS[responseBrevity] ?? BREVITY_PREVIEWS.balanced}
        </Paragraph>
      </Card>

      <Button type="primary" onClick={handleSave} style={{ alignSelf: 'flex-start' }}>
        Save Changes
      </Button>
    </Flex>
  );
}

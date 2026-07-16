import React, { useState, useEffect } from 'react';
import { Select, Radio, App, theme, Typography, Button } from 'antd';

const { Title, Paragraph } = Typography;

export function TranslateSection() {
  const { token } = theme.useToken();
  const { message } = App.useApp();

  const [translationService, setTranslationService] = useState<string>('google');
  const [targetLanguage, setTargetLanguage] = useState<string>('english');
  const [displayMode, setDisplayMode] = useState<string>('bilingual');
  const [displayStyle, setDisplayStyle] = useState<string>('weaken');

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const result = await chrome.storage.local.get([
        'np_translate_service',
        'np_translate_target_lang',
        'np_translate_display_mode',
        'np_translate_display_style',
      ]);

      if (result.np_translate_service) setTranslationService(result.np_translate_service);
      if (result.np_translate_target_lang) setTargetLanguage(result.np_translate_target_lang);
      if (result.np_translate_display_mode) setDisplayMode(result.np_translate_display_mode);
      if (result.np_translate_display_style) setDisplayStyle(result.np_translate_display_style);
    } catch (err) {
      console.error('Failed to load translate settings:', err);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await chrome.storage.local.set({
        np_translate_service: translationService,
        np_translate_target_lang: targetLanguage,
        np_translate_display_mode: displayMode,
        np_translate_display_style: displayStyle,
      });
      message.success('Translation settings saved successfully');
    } catch {
      message.error('Failed to save translation settings');
    } finally {
      setLoading(false);
    }
  };

  const optionCard: React.CSSProperties = {
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  };

  const labelStyle: React.CSSProperties = {
    fontWeight: 600,
    fontSize: 15,
    color: token.colorText,
  };

  const descStyle: React.CSSProperties = {
    fontSize: 13,
    color: token.colorTextSecondary,
  };

  return (
    <div data-options-section="translate" style={{ maxWidth: 768, margin: '0 auto', paddingBottom: 48 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>Translate</Title>
          <Paragraph style={{ color: token.colorTextSecondary, marginTop: 8, fontSize: 14 }}>
            Configure translation models, default target languages, and comparison styles for bilingual reading.
          </Paragraph>
        </div>

        <div style={optionCard}>
          {/* Translation service */}
          <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: token.colorText }}>Translation service</div>
              <div style={descStyle}>Choose the model provider for performing translations</div>
            </div>
            <Select
              value={translationService}
              onChange={(val) => setTranslationService(val)}
              style={{ width: 220, height: 38 }}
              options={[
                { value: 'google', label: 'Google Gemini' },
                { value: 'openai', label: 'OpenAI GPT' },
                { value: 'anthropic', label: 'Anthropic Claude' },
                { value: 'deepl', label: 'DeepL API' },
              ]}
            />
          </div>

          <div style={{ height: 1, background: '#F3F4F6' }} />

          {/* Target language */}
          <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: token.colorText }}>Target language</div>
              <div style={descStyle}>Set your default destination language for translation</div>
            </div>
            <Select
              value={targetLanguage}
              onChange={(val) => setTargetLanguage(val)}
              style={{ width: 220, height: 38 }}
              options={[
                { value: 'english', label: 'English' },
                { value: 'spanish', label: 'Spanish' },
                { value: 'chinese', label: 'Chinese' },
                { value: 'japanese', label: 'Japanese' },
                { value: 'french', label: 'French' },
                { value: 'german', label: 'German' },
              ]}
            />
          </div>

          <div style={{ height: 1, background: '#F3F4F6' }} />

          {/* Display mode */}
          <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: token.colorText }}>Display mode</div>
              <div style={descStyle}>Determine how the translated text is displayed relative to source</div>
            </div>
            <Radio.Group
              value={displayMode}
              onChange={(e) => setDisplayMode(e.target.value)}
              style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 220 }}
            >
              <Radio value="bilingual">Bilingual comparison</Radio>
              <Radio value="translation-only">Translation only</Radio>
            </Radio.Group>
          </div>

          <div style={{ height: 1, background: '#F3F4F6' }} />

          {/* Display style */}
          <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: token.colorText }}>Display style</div>
              <div style={descStyle}>Styling variant applied to the original text in bilingual mode</div>
            </div>
            <Radio.Group
              value={displayStyle}
              onChange={(e) => setDisplayStyle(e.target.value)}
              style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 220 }}
            >
              <Radio value="none">None</Radio>
              <Radio value="weaken">Weaken</Radio>
              <Radio value="underline">Underline</Radio>
            </Radio.Group>
          </div>
        </div>

        {/* Save Button */}
        <div>
          <Button
            type="primary"
            onClick={handleSave}
            loading={loading}
            style={{ borderRadius: 9999, height: 40, paddingInline: 28, fontWeight: 600 }}
          >
            Save Translation Settings
          </Button>
        </div>
      </div>
    </div>
  );
}

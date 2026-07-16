import React, { useState, useEffect } from 'react';
import { Radio, Checkbox, App, theme, Typography, Button } from 'antd';

const { Title, Paragraph } = Typography;

export function SidebarSection() {
  const { token } = theme.useToken();
  const { message } = App.useApp();

  // State for all settings
  const [reopenBehavior, setReopenBehavior] = useState<string>('auto');
  const [scrollBehavior, setScrollBehavior] = useState<string>('auto-scroll');
  const [streamMode, setStreamMode] = useState<string>('fade-in');

  // Navigation menu items visibility state
  const [navVisible, setNavVisible] = useState<Record<string, boolean>>({
    chat: true,
    agent: true,
    write: true,
    notes: true,
    tools: true,
    tasks: true,
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const result = await chrome.storage.local.get([
        'np_sidebar_reopen_behavior',
        'np_sidebar_scroll_behavior',
        'np_sidebar_stream_mode',
        'np_nav_visible_chat',
        'np_nav_visible_agent',
        'np_nav_visible_write',
        'np_nav_visible_notes',
        'np_nav_visible_tools',
        'np_nav_visible_tasks',
      ]);

      if (result.np_sidebar_reopen_behavior) setReopenBehavior(result.np_sidebar_reopen_behavior);
      if (result.np_sidebar_scroll_behavior) setScrollBehavior(result.np_sidebar_scroll_behavior);
      if (result.np_sidebar_stream_mode) setStreamMode(result.np_sidebar_stream_mode);

      setNavVisible({
        chat: result.np_nav_visible_chat !== false,
        agent: result.np_nav_visible_agent !== false,
        write: result.np_nav_visible_write !== false,
        notes: result.np_nav_visible_notes !== false,
        tools: result.np_nav_visible_tools !== false,
        tasks: result.np_nav_visible_tasks !== false,
      });
    } catch (err) {
      console.error('Failed to load sidebar settings:', err);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await chrome.storage.local.set({
        np_sidebar_reopen_behavior: reopenBehavior,
        np_sidebar_scroll_behavior: scrollBehavior,
        np_sidebar_stream_mode: streamMode,
        np_nav_visible_chat: navVisible.chat,
        np_nav_visible_agent: navVisible.agent,
        np_nav_visible_write: navVisible.write,
        np_nav_visible_notes: navVisible.notes,
        np_nav_visible_tools: navVisible.tools,
        np_nav_visible_tasks: navVisible.tasks,
      });
      message.success('Sidebar settings saved successfully');
    } catch {
      message.error('Failed to save sidebar settings');
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

  const itemRowStyle: React.CSSProperties = {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  };

  const labelStyle: React.CSSProperties = {
    fontWeight: 600,
    fontSize: 15,
    color: token.colorText,
  };

  const descStyle: React.CSSProperties = {
    fontSize: 13,
    color: token.colorTextSecondary,
    marginBottom: 4,
  };

  return (
    <div data-options-section="sidebar" style={{ maxWidth: 768, margin: '0 auto', paddingBottom: 48 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>Sidebar</Title>
          <Paragraph style={{ color: token.colorTextSecondary, marginTop: 8, fontSize: 14 }}>
            Customize sidebar behaviors, navigation item visibility, and streaming effects.
          </Paragraph>
        </div>

        {/* 2.1 Reopen behavior */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={labelStyle}>Reopen Behavior</div>
          <div style={optionCard}>
            <div style={itemRowStyle}>
              <div style={descStyle}>When the sidebar reopens, choose the state of the chat view:</div>
              <Radio.Group
                value={reopenBehavior}
                onChange={(e) => setReopenBehavior(e.target.value)}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <Radio value="auto">
                  <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', marginLeft: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Automatic resume or restart</span>
                    <span style={{ fontSize: 12, color: token.colorTextSecondary }}>Intelligently decide whether to resume the last session or clean up based on idle time.</span>
                  </div>
                </Radio>
                <Radio value="resume">
                  <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', marginLeft: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Always resume the last chat</span>
                    <span style={{ fontSize: 12, color: token.colorTextSecondary }}>Pick up exactly where you left off in your previous conversation.</span>
                  </div>
                </Radio>
                <Radio value="new-chat">
                  <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', marginLeft: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Always start a new chat</span>
                    <span style={{ fontSize: 12, color: token.colorTextSecondary }}>Open with a fresh workspace and clean context every time.</span>
                  </div>
                </Radio>
              </Radio.Group>
            </div>
          </div>
        </div>

        {/* 2.2 Scrolling behavior */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={labelStyle}>Response Scrolling Behavior</div>
          <div style={optionCard}>
            <div style={itemRowStyle}>
              <div style={descStyle}>Control how the window scrolls as long responses are being printed:</div>
              <Radio.Group
                value={scrollBehavior}
                onChange={(e) => setScrollBehavior(e.target.value)}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <Radio value="pause">
                  <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', marginLeft: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Pause scrolling when the response reaches the top</span>
                    <span style={{ fontSize: 12, color: token.colorTextSecondary }}>Stop automatic scroll if you manually scroll up to read previous blocks.</span>
                  </div>
                </Radio>
                <Radio value="auto-scroll">
                  <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', marginLeft: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Automatically scroll to the end of the response</span>
                    <span style={{ fontSize: 12, color: token.colorTextSecondary }}>Keep tracking and auto-scrolling to the latest generated line.</span>
                  </div>
                </Radio>
              </Radio.Group>
            </div>
          </div>
        </div>

        {/* 2.3 Stream display mode */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={labelStyle}>Message Stream Effect</div>
          <div style={optionCard}>
            <div style={itemRowStyle}>
              <div style={descStyle}>Set the text appearance speed and transitional effect for the message stream:</div>
              <Radio.Group
                value={streamMode}
                onChange={(e) => setStreamMode(e.target.value)}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <Radio value="fade-in">
                  <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', marginLeft: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Fade in</span>
                    <span style={{ fontSize: 12, color: token.colorTextSecondary }}>Characters fade in gradually with an elegant transition.</span>
                  </div>
                </Radio>
                <Radio value="classic">
                  <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', marginLeft: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Classic</span>
                    <span style={{ fontSize: 12, color: token.colorTextSecondary }}>Characters print out typewriter style without extra opacity transitions.</span>
                  </div>
                </Radio>
              </Radio.Group>
            </div>
          </div>
        </div>

        {/* 2.4 Navigation menu items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={labelStyle}>Navigation Menu Items</div>
          <div style={optionCard}>
            <div style={itemRowStyle}>
              <div style={descStyle}>
                Choose which modules are visible in the primary navigation lists, including the navigation rail,
                collapsed navigation modal in side panel view, and navigation in standalone view.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px', marginTop: 8 }}>
                <Checkbox
                  checked={navVisible.chat}
                  onChange={(e) => setNavVisible({ ...navVisible, chat: e.target.checked })}
                >
                  <span style={{ fontWeight: 500 }}>Chat</span>
                </Checkbox>
                <Checkbox
                  checked={navVisible.agent}
                  onChange={(e) => setNavVisible({ ...navVisible, agent: e.target.checked })}
                >
                  <span style={{ fontWeight: 500 }}>Agent</span>
                </Checkbox>
                <Checkbox
                  checked={navVisible.write}
                  onChange={(e) => setNavVisible({ ...navVisible, write: e.target.checked })}
                >
                  <span style={{ fontWeight: 500 }}>Write</span>
                </Checkbox>
                <Checkbox
                  checked={navVisible.notes}
                  onChange={(e) => setNavVisible({ ...navVisible, notes: e.target.checked })}
                >
                  <span style={{ fontWeight: 500 }}>Note</span>
                </Checkbox>
                <Checkbox
                  checked={navVisible.tools}
                  onChange={(e) => setNavVisible({ ...navVisible, tools: e.target.checked })}
                >
                  <span style={{ fontWeight: 500 }}>Tools</span>
                </Checkbox>
                <Checkbox
                  checked={navVisible.tasks}
                  onChange={(e) => setNavVisible({ ...navVisible, tasks: e.target.checked })}
                >
                  <span style={{ fontWeight: 500 }}>Task</span>
                </Checkbox>
              </div>
            </div>
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
            Save Sidebar Settings
          </Button>
        </div>
      </div>
    </div>
  );
}

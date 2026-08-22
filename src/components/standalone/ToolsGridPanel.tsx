import React, { useState } from 'react';
import { Typography, Tag, Modal, Input, Button, Card, Row, Col, theme, App } from 'antd';
import {
  FireFilled,
  FilePdfOutlined,
  CompassOutlined,
  ReadOutlined,
  TranslationOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { ToolItem } from '../../types';

const { Title, Text, Paragraph } = Typography;

const TOOLS_LIST: ToolItem[] = [
  // Reading
  { id: 't1', name: 'ChatPDF', category: 'Reading', iconName: 'pdf', badge: 'hot', description: 'Analyze and ask questions directly to PDF documents' },

  // Agents
  { id: 't4', name: 'Deep research', category: 'Agents', iconName: 'compass', badge: 'hot', description: 'Conduct multi-source web research with cited syntheses' },
  { id: 't5', name: 'Scholar research', category: 'Agents', iconName: 'read', badge: 'new', description: 'Search academic papers, citations, and peer-reviewed journals' },
  { id: 't7', name: 'AI Essay writer', category: 'Agents', iconName: 'edit', description: 'Draft long-form essays, reports, and structured outlines' },

  // Translate
  { id: 't9', name: 'AI Translator', category: 'Translate', iconName: 'translate', description: 'Context-aware multilingual translation across 50+ languages' },
];

export const ToolsGridPanel: React.FC = () => {
  const { message: antMessage } = App.useApp();
  const { token } = theme.useToken();
  const [selectedTool, setSelectedTool] = useState<ToolItem | null>(null);
  const [toolPromptInput, setToolPromptInput] = useState('');
  const [toolResult, setToolResult] = useState('');

  const renderToolIcon = (iconName: string) => {
    switch (iconName) {
      case 'pdf': return <FilePdfOutlined style={{ color: '#ef4444', fontSize: 18 }} />;
      case 'compass': return <CompassOutlined style={{ color: '#7c3aed', fontSize: 18 }} />;
      case 'read': return <ReadOutlined style={{ color: '#2563eb', fontSize: 18 }} />;
      case 'edit': return <EditOutlined style={{ color: '#8b5cf6', fontSize: 18 }} />;
      case 'translate': return <TranslationOutlined style={{ color: '#9333ea', fontSize: 18 }} />;
      default: return <CompassOutlined style={{ color: '#8b5cf6', fontSize: 18 }} />;
    }
  };

  const handleRunTool = () => {
    if (!toolPromptInput.trim()) return;
    antMessage.loading({ content: `Running ${selectedTool?.name}...`, key: 'tool_run', duration: 1.5 });
    setTimeout(() => {
      setToolResult(`Analysis complete for ${selectedTool?.name}:\n\nKey Insights & Synthesis:\n• ${toolPromptInput}\n• Automated summary processed via AI engine.\n• Exportable to Notes & Workspace.`);
      antMessage.success({ content: 'Done!', key: 'tool_run' });
    }, 1500);
  };

  return (
    <div style={{
            height: '100%',
            overflowY: 'auto',
            padding: 24,
            maxWidth: 1024,
            marginLeft: 'auto',
            marginRight: 'auto',
            width: '100%',
          }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        Tools Directory
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 28 }}>
        Select a specialized assistant or generative tool to accelerate your workflow.
      </Paragraph>

      {(['Reading', 'Agents', 'Translate'] as const).map((cat) => (
        <div key={cat} style={{
            marginBottom: 32,
          }}>
          <Title level={5} type="secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
            {cat}
          </Title>
          <Row gutter={[16, 16]}>
            {TOOLS_LIST.filter((t) => t.category === cat).map((tool) => (
              <Col xs={24} sm={12} lg={8} key={tool.id}>
                <Card
                  hoverable
                  size="small"
                  onClick={() => {
                    setSelectedTool(tool);
                    setToolResult('');
                    setToolPromptInput('');
                  }}
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: token.borderRadiusLG,
                    borderColor: token.colorBorderSecondary,
                  }}
                >
                  <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}>
                    <div
                      style={{
            padding: 8,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            background: token.colorBgElevated,
          }}
                    >
                      {renderToolIcon(tool.iconName)}
                    </div>
                    <div style={{
            flex: 1,
            minWidth: 0,
          }}>
                      <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 4,
          }}>
                        <Text strong ellipsis style={{ fontSize: 13 }}>
                          {tool.name}
                        </Text>
                        {tool.badge === 'hot' && <FireFilled style={{ color: '#fa8c16', fontSize: 12 }} />}
                        {tool.badge === 'new' && (
                          <Tag color="blue" variant="filled" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                            NEW
                          </Tag>
                        )}
                      </div>
                      <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ fontSize: 12, margin: 0 }}>
                        {tool.description}
                      </Paragraph>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      ))}

      {/* Tool Runner Modal */}
      {selectedTool && (
        <Modal
          open={!!selectedTool}
          onCancel={() => setSelectedTool(null)}
          footer={null}
          width={540}
          title={
            <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
              {renderToolIcon(selectedTool.iconName)}
              <Text strong>{selectedTool.name}</Text>
            </div>
          }
        >
          <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 16 }}>
            {selectedTool.description}
          </Paragraph>

          <Input.TextArea
            rows={3}
            placeholder="Provide context, URL, document text, or prompt..."
            value={toolPromptInput}
            onChange={(e) => setToolPromptInput(e.target.value)}
            style={{ marginBottom: 16 }}
          />

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: 16,
          }}>
            <Button
              type="primary"
              onClick={handleRunTool}
              disabled={!toolPromptInput.trim()}
            >
              Run Tool
            </Button>
          </div>

          {toolResult && (
            <Card size="small" style={{ background: token.colorBgElevated }}>
              <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                {toolResult}
              </pre>
            </Card>
          )}
        </Modal>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import {
  Form,
  Typography,
  Button,
  Input,
  Select,
  Popconfirm,
  App,
  theme,
  Modal,
  Tooltip,
} from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  CloseOutlined,
  HolderOutlined,
  QuestionCircleOutlined,
  CodeOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { slashCommandRegistry } from '../../core/slash/SlashCommandRegistry';
import { promptManager } from '../../core/prompts/PromptManager';
import type { SlashCommand } from '../../core/slash/SlashCommandRegistry';
import type { PromptTemplate } from '../../core/prompts/PromptManager';

const { Title, Paragraph, Text } = Typography;

interface CommandCardProps {
  item: SlashCommand;
  isBuiltin: boolean;
  linkedTemplateName?: string;
  onDelete: (name: string) => void;
}

function CommandCard({ item, isBuiltin, linkedTemplateName, onDelete }: CommandCardProps) {
  const { token } = theme.useToken();
  const [isHovered, setIsHovered] = useState(false);

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    background: token.colorBgContainer,
    border: `1px solid ${isHovered ? token.colorPrimary : token.colorBorderSecondary}`,
    borderRadius: '12px',
    boxShadow: isHovered ? '0 4px 12px rgba(0, 0, 0, 0.05)' : 'none',
    transition: 'all 0.2s ease',
    marginBottom: '10px',
    width: '100%',
  };

  return (
    <div
      style={cardStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
        {/* Drag handle placeholder */}
        <HolderOutlined style={{ color: isHovered ? token.colorTextSecondary : token.colorBorder, fontSize: '13px', flexShrink: 0 }} />
        
        {/* Command indicator */}
        <span style={{ fontSize: '15px', color: token.colorTextSecondary, display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
          <CodeOutlined style={{ color: isHovered ? token.colorPrimary : token.colorTextDescription }} />
        </span>

        {/* Name and template details */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', color: token.colorPrimary, background: token.colorPrimaryBg, padding: '1px 6px', borderRadius: '4px' }}>
              {`/${item.name}`}
            </span>
            <span style={{ fontWeight: 600, fontSize: '13.5px', color: token.colorText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.label}
            </span>
          </div>
          {item.description && (
            <div style={{ fontSize: '12px', color: token.colorTextDescription, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.description}
            </div>
          )}
          {linkedTemplateName && (
            <div style={{ fontSize: '11px', color: token.colorTextSecondary, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: token.colorTextTertiary }}>→ Template:</span>
              <span style={{ fontWeight: 600, color: token.colorTextSecondary }}>{linkedTemplateName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Hover Panel */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          opacity: isHovered ? 1 : 0,
          pointerEvents: isHovered ? 'auto' : 'none',
          transition: 'opacity 0.15s ease',
          background: token.colorBgContainer,
          paddingLeft: '8px',
          borderRadius: '4px',
        }}
      >
        {!isBuiltin && (
          <Tooltip title="Delete command">
            <Popconfirm
              title="Delete this slash command?"
              description="This action cannot be undone."
              onConfirm={() => onDelete(item.name)}
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true, style: { background: '#EF4444', borderColor: '#EF4444' } }}
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined style={{ fontSize: '13px' }} />}
              />
            </Popconfirm>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export function SlashSection() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  // New Command Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTemplateId, setNewTemplateId] = useState<string | undefined>(undefined);

  const loadCommands = async () => {
    try {
      const all = slashCommandRegistry.list();
      setCommands(all);
      const allTemplates = await promptManager.getAllTemplates();
      setTemplates(allTemplates);
    } catch {
      setCommands([]);
      setTemplates([]);
    }
  };

  useEffect(() => {
    loadCommands();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await loadCommands();
      message.success('Slash commands refreshed');
    } catch {
      message.error('Failed to reload slash commands');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setNewName('');
    setNewLabel('');
    setNewDescription('');
    setNewTemplateId(undefined);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleAddCommand = async () => {
    if (!newName.trim()) {
      message.warning('Command name is required');
      return;
    }

    const name = newName.startsWith('/') ? newName.slice(1) : newName;

    if (slashCommandRegistry.has(name)) {
      message.warning(`Command "/${name}" already exists`);
      return;
    }

    try {
      slashCommandRegistry.register({
        name,
        label: newLabel || name,
        description: newDescription,
        templateId: newTemplateId,
      });
      await loadCommands();
      setIsModalOpen(false);
      message.success(`Command "/${name}" added`);
    } catch (err) {
      message.error('Failed to add command');
    }
  };

  const handleRemoveCommand = async (name: string) => {
    try {
      slashCommandRegistry.unregister(name);
      await loadCommands();
      message.success(`Command "/${name}" removed`);
    } catch {
      message.error('Failed to remove command');
    }
  };

  const templateOptions = templates.map((t) => ({
    value: t.id,
    label: t.name,
  }));

  const builtinCommands = commands.filter((c) =>
    ['write', 'ask', 'research'].includes(c.name),
  );
  const customCommands = commands.filter(
    (c) => !['write', 'ask', 'research'].includes(c.name),
  );

  // Pane Column Styles
  const paneContainerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '20px',
    marginTop: '20px',
    width: '100%',
  };

  const paneStyle: React.CSSProperties = {
    background: token.colorBgLayout,
    borderRadius: '16px',
    padding: '20px',
    border: `1px solid ${token.colorBorderSecondary}`,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '440px',
  };

  const emptyStateStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 16px',
    textAlign: 'center',
    color: token.colorTextSecondary,
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderStyle: 'dashed',
    borderRadius: '12px',
    height: '100%',
    flexGrow: 1,
    gap: '12px',
  };

  return (
    <div data-options-section="slash" style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 800 }}>Slash Commands</Title>
          <Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
            Manage slash command-to-template mappings. Type / in the chat composer to trigger a command.
          </Paragraph>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Refresh Button */}
          <Button
            shape="circle"
            icon={<ReloadOutlined spin={loading} />}
            onClick={handleRefresh}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            title="Refresh list"
          />
          
          {/* New Command Button */}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreateModal}
            style={{ borderRadius: '20px', fontWeight: 600 }}
          >
            New Command
          </Button>
        </div>
      </div>

      {/* Columns Grid Layout */}
      <div style={paneContainerStyle}>
        {/* Left Column: Custom Commands */}
        <div style={paneStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px', color: token.colorTextSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
            <CodeOutlined style={{ fontSize: '14px' }} />
            <span>Custom Commands ({customCommands.length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', maxHeight: '480px', flexGrow: 1 }}>
            {customCommands.length === 0 ? (
              <div style={emptyStateStyle}>
                <CodeOutlined style={{ fontSize: '24px', color: token.colorBorder }} />
                <span style={{ fontSize: '13px' }}>No custom slash commands. Click "New Command" to add one.</span>
              </div>
            ) : (
              customCommands.map((item) => {
                const linkedTemplate = templates.find((t) => t.id === item.templateId);
                return (
                  <CommandCard
                    key={item.name}
                    item={item}
                    isBuiltin={false}
                    linkedTemplateName={linkedTemplate?.name}
                    onDelete={handleRemoveCommand}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Built-in Commands */}
        <div style={paneStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px', color: token.colorTextSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
            <AppstoreOutlined style={{ fontSize: '14px' }} />
            <span>Built-in Commands ({builtinCommands.length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', maxHeight: '480px', flexGrow: 1 }}>
            {builtinCommands.length === 0 ? (
              <div style={emptyStateStyle}>
                <CodeOutlined style={{ fontSize: '24px', color: token.colorBorder }} />
                <span style={{ fontSize: '13px' }}>No built-in commands found.</span>
              </div>
            ) : (
              builtinCommands.map((item) => {
                const linkedTemplate = templates.find((t) => t.id === item.templateId);
                return (
                  <CommandCard
                    key={item.name}
                    item={item}
                    isBuiltin={true}
                    linkedTemplateName={linkedTemplate?.name}
                    onDelete={handleRemoveCommand}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Edit/Create Modal */}
      <Modal
        title={
          <span style={{ fontSize: '16px', fontWeight: 700 }}>
            New Slash Command
          </span>
        }
        open={isModalOpen}
        onCancel={handleCloseModal}
        footer={null}
        closeIcon={<CloseOutlined style={{ fontSize: '12px', color: token.colorTextSecondary }} />}
        width={480}
        centered
        styles={{ body: { paddingTop: '12px' } }}
      >
        <Form layout="vertical" onFinish={handleAddCommand}>
          {/* Command Name */}
          <Form.Item
            label={
              <span style={{ fontSize: '12px', fontWeight: 700, color: token.colorTextSecondary, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                <span style={{ color: token.colorError, marginRight: '4px' }}>*</span> Command Name
              </span>
            }
            style={{ marginBottom: '16px' }}
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., summarize"
              prefix="/"
              style={{ borderRadius: '8px', padding: '7px 12px' }}
            />
          </Form.Item>

          {/* Display Label */}
          <Form.Item
            label={
              <span style={{ fontSize: '12px', fontWeight: 700, color: token.colorTextSecondary, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Display Label
              </span>
            }
            style={{ marginBottom: '16px' }}
          >
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g., Summarize"
              style={{ borderRadius: '8px', padding: '7px 12px' }}
            />
          </Form.Item>

          {/* Description */}
          <Form.Item
            label={
              <span style={{ fontSize: '12px', fontWeight: 700, color: token.colorTextSecondary, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Description
              </span>
            }
            style={{ marginBottom: '16px' }}
          >
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Brief description"
              style={{ borderRadius: '8px', padding: '7px 12px' }}
            />
          </Form.Item>

          {/* Linked Template */}
          <Form.Item
            label={
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color: token.colorTextSecondary, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                <span>Linked Template</span>
                <Tooltip title="When you run this slash command, this prompt template will be loaded as context">
                  <QuestionCircleOutlined style={{ cursor: 'help', fontSize: '12px', color: token.colorTextSecondary }} />
                </Tooltip>
              </div>
            }
            style={{ marginBottom: '24px' }}
          >
            <Select
              value={newTemplateId}
              onChange={setNewTemplateId}
              options={templateOptions}
              placeholder="Select a prompt template"
              allowClear
              style={{ width: '100%' }}
              styles={{ popup: { root: { borderRadius: '8px' } } }}
            />
          </Form.Item>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'end', gap: '10px', paddingTop: '16px', borderTop: `1px solid ${token.colorBorderSecondary}` }}>
            <Button
              onClick={handleCloseModal}
              style={{ borderRadius: '6px', fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              style={{ borderRadius: '6px', fontWeight: 600 }}
            >
              Add Command
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

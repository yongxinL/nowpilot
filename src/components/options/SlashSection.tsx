import React, { useEffect, useState } from 'react';
import {
  Form,
  Typography,
  Button,
  Input,
  Select,
  Popconfirm,
  App,
  List,
  Empty,
  Space,
} from 'antd';
import { slashCommandRegistry } from '../../core/slash/SlashCommandRegistry';
import { promptManager } from '../../core/prompts/PromptManager';
import type { SlashCommand } from '../../core/slash/SlashCommandRegistry';
import type { PromptTemplate } from '../../core/prompts/PromptManager';

const { Title, Text } = Typography;

export function SlashSection() {
  const { message } = App.useApp();
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  // New command form state
  const [newName, setNewName] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTemplateId, setNewTemplateId] = useState<string | undefined>(undefined);
  const [showAddForm, setShowAddForm] = useState(false);

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
      setNewName('');
      setNewLabel('');
      setNewDescription('');
      setNewTemplateId(undefined);
      setShowAddForm(false);
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

  const handleSave = async () => {
    setLoading(true);
    try {
      // SlashCommandRegistry already persists internally
      message.success('Slash commands saved');
    } catch {
      message.error('Failed to save');
    } finally {
      setLoading(false);
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

  const renderCommandItem = (cmd: SlashCommand, isBuiltin: boolean) => {
    const linkedTemplate = templates.find((t) => t.id === cmd.templateId);

    return (
      <List.Item
        actions={
          isBuiltin
            ? []
            : [
                <Popconfirm
                  key="delete"
                  title="Delete this command?"
                  description="This action cannot be undone."
                  onConfirm={() => handleRemoveCommand(cmd.name)}
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger size="small" type="link">
                    Delete
                  </Button>
                </Popconfirm>,
              ]
        }
      >
        <List.Item.Meta
          title={
            <span>
              <Text code style={{ fontSize: 14 }}>{`/${cmd.name}`}</Text>
              <Text style={{ marginLeft: 8 }}>{cmd.label}</Text>
              {isBuiltin ? (
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 11 }}>
                  (built-in)
                </Text>
              ) : null}
            </span>
          }
          description={
            <span>
              {cmd.description ? <span>{cmd.description}</span> : null}
              {linkedTemplate ? (
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  → Template: {linkedTemplate.name}
                </Text>
              ) : null}
            </span>
          }
        />
      </List.Item>
    );
  };

  return (
    <div data-options-section="slash" style={{ maxWidth: 720 }}>
      <Title level={4}>Slash Commands</Title>
      <p style={{ marginBottom: 16 }}>
        Manage slash command-to-template mappings. Type / in the chat composer to trigger
        a command.
      </p>

      <div style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : '+ Add Command'}
        </Button>
      </div>

      {showAddForm ? (
        <div
          style={{
            border: '1px solid #f0f0f0',
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Title level={5} style={{ marginTop: 0 }}>
            New Slash Command
          </Title>
          <Form layout="vertical">
            <Form.Item label="Command Name" required>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., summarize"
                prefix="/"
              />
            </Form.Item>
            <Form.Item label="Display Label">
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g., Summarize"
              />
            </Form.Item>
            <Form.Item label="Description">
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Brief description"
              />
            </Form.Item>
            <Form.Item label="Linked Template">
              <Select
                value={newTemplateId}
                onChange={setNewTemplateId}
                options={templateOptions}
                placeholder="Select a prompt template"
                allowClear
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Button type="primary" onClick={handleAddCommand}>
              Add Command
            </Button>
          </Form>
        </div>
      ) : null}

      <Form layout="horizontal" labelAlign="left" onFinish={handleSave}>
        {commands.length === 0 ? (
          <Empty description="No slash commands configured." style={{ padding: 24 }} />
        ) : (
          <>
            {customCommands.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <Title level={5}>Custom Commands</Title>
                <List
                  dataSource={customCommands}
                  renderItem={(item) => renderCommandItem(item, false)}
                />
              </div>
            )}

            {builtinCommands.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <Title level={5}>Built-in Commands</Title>
                <List
                  dataSource={builtinCommands}
                  renderItem={(item) => renderCommandItem(item, true)}
                />
              </div>
            )}
          </>
        )}

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Save
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}

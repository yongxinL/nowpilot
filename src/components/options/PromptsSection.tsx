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
import { promptManager } from '../../core/prompts/PromptManager';
import { templateEngine } from '../../core/prompts/TemplateEngine';
import type { PromptTemplate } from '../../core/prompts/PromptManager';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

type ActiveView = 'list' | 'edit';

export function PromptsSection() {
  const { message } = App.useApp();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('list');
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});
  const [previewOutput, setPreviewOutput] = useState('');

  // Form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTemplate, setEditTemplate] = useState('');
  const [editCategory, setEditCategory] = useState('custom');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const all = await promptManager.getAllTemplates();
      setTemplates(all);
    } catch {
      setTemplates([]);
    }
  };

  const handleSelectTemplate = (tpl: PromptTemplate) => {
    setEditingTemplate(tpl);
    setEditName(tpl.name);
    setEditDescription(tpl.description ?? '');
    setEditTemplate(tpl.template);
    setEditCategory(tpl.category);
    setPreviewVariables({});
    setPreviewOutput('');
    setActiveView('edit');
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setEditName('');
    setEditDescription('');
    setEditTemplate('');
    setEditCategory('custom');
    setPreviewVariables({});
    setPreviewOutput('');
    setActiveView('edit');
  };

  const handleCloneTemplate = async (tpl: PromptTemplate) => {
    try {
      const cloneId = `${tpl.id}-clone-${Date.now()}`;
      const clone: PromptTemplate = {
        id: cloneId,
        name: `${tpl.name} (Clone)`,
        description: tpl.description,
        template: tpl.template,
        category: tpl.category,
        variables: tpl.variables,
        isBuiltin: false,
      };
      await promptManager.createTemplate(clone);
      await loadTemplates();
      handleSelectTemplate(clone);
      message.success('Template cloned');
    } catch (err) {
      message.error('Failed to clone template');
    }
  };

  const handleSaveTemplate = async () => {
    if (!editName.trim() || !editTemplate.trim()) {
      message.warning('Name and template content are required');
      return;
    }

    const extracted = templateEngine.extractVariables(editTemplate);
    setLoading(true);
    try {
      if (editingTemplate && !editingTemplate.isBuiltin) {
        await promptManager.updateTemplate({
          ...editingTemplate,
          name: editName,
          description: editDescription,
          template: editTemplate,
          category: editCategory,
          variables: extracted,
        });
        message.success('Template updated');
      } else {
        const newTpl: PromptTemplate = {
          id: `custom-${Date.now()}`,
          name: editName,
          description: editDescription,
          template: editTemplate,
          category: editCategory,
          variables: extracted,
          isBuiltin: false,
        };
        await promptManager.createTemplate(newTpl);
        message.success('Template created');
      }
      await loadTemplates();
      setActiveView('list');
    } catch (err) {
      message.error('Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await promptManager.deleteTemplate(id);
      await loadTemplates();
      message.success('Template deleted');
      if (editingTemplate?.id === id) {
        setActiveView('list');
      }
    } catch {
      message.error('Failed to delete template');
    }
  };

  const handlePreview = () => {
    const vars = templateEngine.extractVariables(editTemplate);
    const sampleVars: Record<string, string> = {};
    for (const v of vars) {
      sampleVars[v] = previewVariables[v] ?? `{{${v}}}`;
    }
    const rendered = templateEngine.render(editTemplate, sampleVars);
    setPreviewOutput(rendered);
  };

  useEffect(() => {
    if (activeView === 'edit' && editTemplate) {
      handlePreview();
    }
  }, [editTemplate, previewVariables, activeView]);

  if (activeView === 'edit') {
    const extractedVars = templateEngine.extractVariables(editTemplate);

    return (
      <div data-options-section="prompts" style={{ maxWidth: 800 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            {editingTemplate ? (editingTemplate.isBuiltin ? 'View Template' : 'Edit Template') : 'New Template'}
          </Title>
          <Button onClick={() => setActiveView('list')}>Back to List</Button>
        </div>

        <Form layout="vertical">
          <Form.Item label="Name" required>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Template name"
              disabled={editingTemplate?.isBuiltin}
            />
          </Form.Item>

          <Form.Item label="Description">
            <Input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Brief description"
              disabled={editingTemplate?.isBuiltin}
            />
          </Form.Item>

          <Form.Item label="Category">
            <Select
              value={editCategory}
              onChange={setEditCategory}
              options={[
                { value: 'custom', label: 'Custom' },
                { value: 'builtin', label: 'Built-in' },
                { value: 'utility', label: 'Utility' },
              ]}
              disabled={editingTemplate?.isBuiltin}
              style={{ width: 200 }}
            />
          </Form.Item>

          <Form.Item label="Template Content" required>
            <TextArea
              value={editTemplate}
              onChange={(e) => setEditTemplate(e.target.value)}
              rows={8}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
              placeholder="Enter template content with {{variable}} placeholders..."
              disabled={editingTemplate?.isBuiltin}
            />
          </Form.Item>

          {extractedVars.length > 0 ? (
            <Form.Item label="Variables">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {extractedVars.map((v) => (
                  <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Text code style={{ minWidth: 80 }}>{`{{${v}}}`}</Text>
                    <Input
                      size="small"
                      style={{ width: 160 }}
                      placeholder={`Value for ${v}`}
                      value={previewVariables[v] ?? ''}
                      onChange={(e) =>
                        setPreviewVariables((prev) => ({ ...prev, [v]: e.target.value }))
                      }
                      disabled={editingTemplate?.isBuiltin}
                    />
                  </div>
                ))}
              </div>
            </Form.Item>
          ) : null}

          {previewOutput ? (
            <Form.Item label="Preview">
              <div
                style={{
                  padding: 12,
                  border: '1px solid #f0f0f0',
                  borderRadius: 6,
                  background: '#fafafa',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  maxHeight: 200,
                  overflow: 'auto',
                }}
              >
                {previewOutput}
              </div>
            </Form.Item>
          ) : null}

          <Form.Item>
            <Space>
              {editingTemplate?.isBuiltin ? null : (
                <>
                  <Button type="primary" onClick={handleSaveTemplate} loading={loading}>
                    Save
                  </Button>
                  {editingTemplate ? (
                    <Popconfirm
                      title="Delete this template?"
                      description="This action cannot be undone."
                      onConfirm={() => handleDeleteTemplate(editingTemplate.id)}
                      okText="Delete"
                      okButtonProps={{ danger: true }}
                    >
                      <Button danger>Delete</Button>
                    </Popconfirm>
                  ) : null}
                </>
              )}
            </Space>
          </Form.Item>
        </Form>
      </div>
    );
  }

  // List view
  const builtinTemplates = templates.filter((t) => t.isBuiltin);
  const customTemplates = templates.filter((t) => !t.isBuiltin);

  return (
    <div data-options-section="prompts" style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          Prompt Templates
        </Title>
        <Button type="primary" onClick={handleNewTemplate}>
          + New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Empty description="No prompt templates yet. Create one to get started." />
      ) : (
        <>
          {customTemplates.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <Title level={5}>Custom Templates</Title>
              <List
                dataSource={customTemplates}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button key="edit" size="small" type="link" onClick={() => handleSelectTemplate(item)}>
                        Edit
                      </Button>,
                      <Popconfirm
                        key="delete"
                        title="Delete this template?"
                        description="This action cannot be undone."
                        onConfirm={() => handleDeleteTemplate(item.id)}
                        okText="Delete"
                        okButtonProps={{ danger: true }}
                      >
                        <Button danger size="small" type="link">
                          Delete
                        </Button>
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      title={item.name}
                      description={
                        <span>
                          {item.description}
                          {item.variables.length > 0 ? (
                            <span style={{ marginLeft: 8 }}>
                              {item.variables.map((v) => (
                                <Text key={v} code style={{ marginRight: 4 }}>
                                  {`{{${v}}}`}
                                </Text>
                              ))}
                            </span>
                          ) : null}
                        </span>
                      }
                    />
                  </List.Item>
                )}
              />
            </div>
          )}

          {builtinTemplates.length > 0 && (
            <div>
              <Title level={5}>Built-in Templates</Title>
              <List
                dataSource={builtinTemplates}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button
                        key="view"
                        size="small"
                        type="link"
                        onClick={() => handleSelectTemplate(item)}
                      >
                        View
                      </Button>,
                      <Button
                        key="clone"
                        size="small"
                        type="link"
                        onClick={() => handleCloneTemplate(item)}
                      >
                        Clone
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={<span>{item.name} <Text type="secondary" style={{ fontSize: 11 }}>(built-in)</Text></span>}
                      description={
                        <span>
                          {item.description}
                          {item.variables.length > 0 ? (
                            <span style={{ marginLeft: 8 }}>
                              {item.variables.map((v) => (
                                <Text key={v} code style={{ marginRight: 4 }}>
                                  {`{{${v}}}`}
                                </Text>
                              ))}
                            </span>
                          ) : null}
                        </span>
                      }
                    />
                  </List.Item>
                )}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

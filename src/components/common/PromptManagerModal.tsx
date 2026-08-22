import React, { useState } from 'react';
import { Modal, Input, Select, Switch, Button, Form, Typography, App } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, CloseOutlined } from '@ant-design/icons';
import { PromptItem, PromptCategory } from '../../types';

const { Text } = Typography;

interface PromptManagerModalProps {
  open: boolean;
  onClose: () => void;
  prompts: PromptItem[];
  onAddPrompt: (prompt: PromptItem) => void;
  onUpdatePrompt: (id: string, updates: Partial<PromptItem>) => void;
  onDeletePrompt: (id: string) => void;
}

export const PromptManagerModal: React.FC<PromptManagerModalProps> = ({
  open,
  onClose,
  prompts,
  onAddPrompt,
  onUpdatePrompt,
  onDeletePrompt,
}) => {
  const { message: antMessage } = App.useApp();
  const [activeCategory, setActiveCategory] = useState<PromptCategory>('Writing');
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form] = Form.useForm();

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingId) {
        onUpdatePrompt(editingId, values);
        antMessage.success('Prompt updated');
      } else {
        onAddPrompt({
          id: 'p_' + Date.now(),
          title: values.title,
          content: values.content,
          category: values.category || activeCategory,
          showInList: values.showInList ?? true,
        });
        antMessage.success('Prompt added');
      }
      form.resetFields();
      setIsCreating(false);
      setEditingId(null);
    } catch {
      // validation error
    }
  };

  const startEdit = (p: PromptItem) => {
    setEditingId(p.id);
    setIsCreating(true);
    form.setFieldsValue(p);
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closeIcon={<CloseOutlined style={{ color: 'var(--muted-foreground)' }} />}
      width={560}
      title={<span style={{ fontWeight: 700, fontSize: 16 }}>Prompt Manager</span>}
    >
      {/* Category Tabs & Add Button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {(['Chat/Ask', 'Reading', 'Writing'] as PromptCategory[]).map(cat => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  paddingLeft: 12,
                  paddingRight: 12,
                  paddingTop: 6,
                  paddingBottom: 6,
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                  background: isActive ? '#f3e8ff' : 'transparent',
                  color: isActive ? '#6b21a8' : 'var(--muted-foreground)',
                  border: 'none',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="small"
          onClick={() => {
            setEditingId(null);
            form.resetFields();
            form.setFieldsValue({ category: activeCategory, showInList: true });
            setIsCreating(true);
          }}
          style={{ backgroundColor: '#7c3aed', borderRadius: 8 }}
        >
          New Prompt
        </Button>
      </div>

      {/* Create / Edit Form Drawer */}
      {isCreating && (
        <div
          style={{
            padding: 16,
            background: 'var(--muted)',
            borderRadius: 12,
            marginBottom: 16,
            border: '1px solid var(--border)',
          }}
        >
          <Form form={form} layout="vertical" size="small">
            <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Please enter title' }]}>
              <Input placeholder="e.g. Summarize text" />
            </Form.Item>
            <Form.Item name="content" label="Prompt Content" rules={[{ required: true, message: 'Please enter content' }]}>
              <Input.TextArea rows={3} placeholder="Prompt template..." />
            </Form.Item>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <Form.Item name="category" label="Category">
                <Select
                  options={[
                    { value: 'Chat/Ask', label: 'Chat/Ask' },
                    { value: 'Reading', label: 'Reading' },
                    { value: 'Writing', label: 'Writing' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="showInList" label="Show in Quick Menu" valuePropName="checked">
                <Switch />
              </Form.Item>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 8,
              }}
            >
              <Button size="small" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button size="small" type="primary" onClick={handleSave} style={{ backgroundColor: '#7c3aed' }}>
                Save
              </Button>
            </div>
          </Form>
        </div>
      )}

      {/* Prompts List Columns: Show in list vs Hide from list */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          maxHeight: 320,
          overflowY: 'auto',
          paddingRight: 4,
        }}
      >
        <div>
          <Text
            type="secondary"
            style={{
              fontSize: 12,
              fontWeight: 600,
              display: 'block',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Show in list
          </Text>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {prompts
              .filter(p => p.category === activeCategory && p.showInList)
              .map(p => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 8,
                    background: 'var(--card)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 12,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 500,
                      color: 'var(--foreground)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      paddingRight: 4,
                    }}
                  >
                    {p.title}
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <button
                      onClick={() => startEdit(p)}
                      style={{
                        padding: 4,
                        color: 'var(--muted-foreground)',
                        cursor: 'pointer',
                        background: 'transparent',
                        border: 'none',
                      }}
                    >
                      <EditOutlined />
                    </button>
                    <button
                      onClick={() => onDeletePrompt(p.id)}
                      style={{
                        padding: 4,
                        color: 'var(--muted-foreground)',
                        cursor: 'pointer',
                        background: 'transparent',
                        border: 'none',
                      }}
                    >
                      <DeleteOutlined />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div>
          <Text
            type="secondary"
            style={{
              fontSize: 12,
              fontWeight: 600,
              display: 'block',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Hide from list
          </Text>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {prompts
              .filter(p => p.category === activeCategory && !p.showInList)
              .map(p => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 8,
                    background: 'var(--muted)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 12,
                    color: 'var(--muted-foreground)',
                  }}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      paddingRight: 4,
                    }}
                  >
                    {p.title}
                  </span>
                  <button
                    onClick={() => onUpdatePrompt(p.id, { showInList: true })}
                    style={{
                      fontSize: 10,
                      color: '#7c3aed',
                      cursor: 'pointer',
                      background: 'transparent',
                      border: 'none',
                      textDecoration: 'underline',
                      padding: 0,
                    }}
                  >
                    Show
                  </button>
                </div>
              ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

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
      closeIcon={<CloseOutlined className="text-zinc-400" />}
      width={560}
      title={<span className="font-bold text-base">Prompt Manager</span>}
    >
      {/* Category Tabs & Add Button */}
      <div className="flex items-center justify-between mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          {(['Chat/Ask', 'Reading', 'Writing'] as PromptCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                activeCategory === cat
                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {cat}
            </button>
          ))}
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
        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/80 rounded-xl mb-4 border border-zinc-200 dark:border-zinc-700">
          <Form form={form} layout="vertical" size="small">
            <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Please enter title' }]}>
              <Input placeholder="e.g. Summarize text" />
            </Form.Item>
            <Form.Item name="content" label="Prompt Content" rules={[{ required: true, message: 'Please enter content' }]}>
              <Input.TextArea rows={3} placeholder="Prompt template..." />
            </Form.Item>
            <div className="grid grid-cols-2 gap-3">
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
            <div className="flex justify-end gap-2 mt-2">
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
      <div className="grid grid-cols-2 gap-4 max-h-80 overflow-y-auto pr-1">
        <div>
          <Text type="secondary" className="text-xs font-semibold block mb-2 uppercase tracking-wider">
            Show in list
          </Text>
          <div className="space-y-1.5">
            {prompts
              .filter(p => p.category === activeCategory && p.showInList)
              .map(p => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs"
                >
                  <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate pr-1">{p.title}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(p)}
                      className="p-1 text-zinc-400 hover:text-violet-600 cursor-pointer"
                    >
                      <EditOutlined />
                    </button>
                    <button
                      onClick={() => onDeletePrompt(p.id)}
                      className="p-1 text-zinc-400 hover:text-red-500 cursor-pointer"
                    >
                      <DeleteOutlined />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div>
          <Text type="secondary" className="text-xs font-semibold block mb-2 uppercase tracking-wider">
            Hide from list
          </Text>
          <div className="space-y-1.5">
            {prompts
              .filter(p => p.category === activeCategory && !p.showInList)
              .map(p => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-500"
                >
                  <span className="truncate pr-1">{p.title}</span>
                  <button
                    onClick={() => onUpdatePrompt(p.id, { showInList: true })}
                    className="text-[10px] text-violet-600 hover:underline cursor-pointer"
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

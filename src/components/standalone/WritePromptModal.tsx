import React from 'react';
import { Modal, Form, Input, Button } from 'antd';

interface WritePromptModalProps {
  open: boolean;
  activeTab: 'write' | 'reply';
  onClose: () => void;
  onSubmit: (values: { title: string; content: string }) => void;
}

export const WritePromptModal: React.FC<WritePromptModalProps> = ({
  open,
  activeTab,
  onClose,
  onSubmit,
}) => {
  const [form] = Form.useForm();

  const handleFinish = (values: any) => {
    onSubmit(values);
    form.resetFields();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={<span style={{
            fontWeight: 700,
          }}>Add {activeTab === 'write' ? 'Write' : 'Reply'} Prompt</span>}
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} style={{
            marginTop: 16,
          }}>
        <Form.Item name="title" label="Title / Tag" rules={[{ required: true, message: 'Please enter a title' }]}>
          <Input placeholder="e.g. LinkedIn Post, Summary, Support Reply..." />
        </Form.Item>
        <Form.Item name="content" label="Prompt Instruction Template" rules={[{ required: true, message: 'Please enter prompt content' }]}>
          <Input.TextArea rows={4} placeholder="Draft a concise, engaging post about..." />
        </Form.Item>
        <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            paddingTop: 8,
          }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" style={{ backgroundColor: '#7c3aed' }}>
            Add Prompt
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

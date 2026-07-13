import React, { useCallback, useEffect, useState } from 'react';
import { Form, Table, Button, Switch, Modal, Input, Typography, Popconfirm, Select, App } from 'antd';

const { Title } = Typography;
const STORAGE_KEY = 'np_mcp_servers';

interface MCPServer {
  id: string;
  name: string;
  url: string;
  transport: 'stdio' | 'streamable-http';
  enabled: boolean;
}

export function MCPSection() {
  const { message } = App.useApp();
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      setServers((result[STORAGE_KEY] ?? []) as MCPServer[]);
    } catch {
      setServers([]);
    }
  };

  const persistServers = useCallback(
    async (updated: MCPServer[]) => {
      await chrome.storage.local.set({ [STORAGE_KEY]: updated });
      setServers(updated);
    },
    [],
  );

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    const updated = servers.map((s) => (s.id === id ? { ...s, enabled } : s));
    await persistServers(updated);
  };

  const handleAdd = () => {
    setEditingServer(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (server: MCPServer) => {
    setEditingServer(server);
    form.setFieldsValue(server);
    setModalOpen(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingServer) {
        const updated = servers.map((s) =>
          s.id === editingServer.id ? { ...s, ...values } : s,
        );
        await persistServers(updated);
        message.success('Server updated');
      } else {
        const newServer: MCPServer = {
          id: crypto.randomUUID(),
          ...values,
          enabled: true,
        };
        await persistServers([...servers, newServer]);
        message.success('Server added');
      }
      setModalOpen(false);
    } catch {
      // validation failed
    }
  };

  const handleDelete = async (id: string) => {
    const updated = servers.filter((s) => s.id !== id);
    await persistServers(updated);
    message.success('Server removed');
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: servers });
      message.success('MCP servers saved');
    } catch {
      message.error('Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (_: boolean, record: MCPServer) => (
        <Switch
          checked={record.enabled}
          onChange={(checked) => handleToggleEnabled(record.id, checked)}
        />
      ),
    },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'URL / Endpoint', dataIndex: 'url', key: 'url', ellipsis: true },
    { title: 'Transport', dataIndex: 'transport', key: 'transport', width: 120 },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: MCPServer) => (
        <span>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this server?"
            description="This action cannot be undone."
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button danger size="small" type="link">
              Delete
            </Button>
          </Popconfirm>
        </span>
      ),
    },
  ];

  return (
    <div data-options-section="mcp" style={{ maxWidth: 720 }}>
      <Title level={4}>MCP Servers</Title>
      <p style={{ marginBottom: 16 }}>
        Manage external Model Context Protocol servers for tool execution.
      </p>

      <div style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={handleAdd}>
          + Add Server
        </Button>
      </div>

      <Table
        dataSource={servers}
        columns={columns}
        rowKey="id"
        pagination={false}
        size="small"
      />

      <Modal
        title={editingServer ? 'Edit MCP Server' : 'Add MCP Server'}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={() => setModalOpen(false)}
        okText={editingServer ? 'Update' : 'Add'}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Server Name"
            rules={[{ required: true, message: 'Please enter a server name' }]}
          >
            <Input placeholder="e.g., my-mcp-server" />
          </Form.Item>
          <Form.Item
            name="url"
            label="URL / Endpoint"
            rules={[{ required: true, message: 'Please enter a URL' }]}
          >
            <Input placeholder="e.g., http://localhost:3001/mcp" />
          </Form.Item>
          <Form.Item
            name="transport"
            label="Transport Type"
            rules={[{ required: true, message: 'Please select a transport type' }]}
            initialValue="streamable-http"
          >
            <Select
              options={[
                { value: 'streamable-http', label: 'Streamable HTTP' },
                { value: 'stdio', label: 'STDIO' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Form layout="horizontal" labelAlign="left" style={{ marginTop: 16 }}>
        <Form.Item>
          <Button type="primary" onClick={handleSave} loading={loading}>
            Save
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}

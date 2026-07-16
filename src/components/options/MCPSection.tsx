import React, { useCallback, useEffect, useState } from 'react';
import { Form, Table, Button, Switch, Modal, Input, Typography, Popconfirm, Select, App, theme } from 'antd';

const { Title, Paragraph } = Typography;
const STORAGE_KEY = 'np_mcp_servers';

interface MCPServer {
  id: string;
  name: string;
  url: string;
  transport: 'stdio' | 'streamable-http';
  enabled: boolean;
}

export function MCPSection() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [form] = Form.useForm();

  // Skills state
  const [skills, setSkills] = useState({
    webSearch: true,
    imageGen: true,
    codeInterpreter: true,
    workspace: true,
  });

  useEffect(() => {
    loadServers();
    loadSkills();
  }, []);

  const loadServers = async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      setServers((result[STORAGE_KEY] ?? []) as MCPServer[]);
    } catch {
      setServers([]);
    }
  };

  const loadSkills = async () => {
    try {
      const result = await chrome.storage.local.get([
        'np_skill_enabled_web_search',
        'np_skill_enabled_image_gen',
        'np_skill_enabled_code_interpreter',
        'np_skill_enabled_workspace',
      ]);
      setSkills({
        webSearch: result.np_skill_enabled_web_search !== false,
        imageGen: result.np_skill_enabled_image_gen !== false,
        codeInterpreter: result.np_skill_enabled_code_interpreter !== false,
        workspace: result.np_skill_enabled_workspace !== false,
      });
    } catch (err) {
      console.error('Failed to load skills:', err);
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

  const handleToggleSkill = async (skillKey: keyof typeof skills, enabled: boolean) => {
    const newSkills = { ...skills, [skillKey]: enabled };
    setSkills(newSkills);
    const storageKeys = {
      webSearch: 'np_skill_enabled_web_search',
      imageGen: 'np_skill_enabled_image_gen',
      codeInterpreter: 'np_skill_enabled_code_interpreter',
      workspace: 'np_skill_enabled_workspace',
    };
    await chrome.storage.local.set({ [storageKeys[skillKey]]: enabled });
    message.success('Skill settings updated');
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

  const optionCard: React.CSSProperties = {
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  };

  const skillRowStyle: React.CSSProperties = {
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const skillLabelStyle: React.CSSProperties = {
    fontWeight: 600,
    fontSize: 14,
    color: token.colorText,
  };

  const skillDescStyle: React.CSSProperties = {
    fontSize: 12,
    color: token.colorTextSecondary,
  };

  return (
    <div data-options-section="mcp" style={{ maxWidth: 768, margin: '0 auto', paddingBottom: 48 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>Skills & MCP</Title>
          <Paragraph style={{ color: token.colorTextSecondary, marginTop: 8, fontSize: 14 }}>
            Manage built-in smart assistant skills and external Model Context Protocol (MCP) servers.
          </Paragraph>
        </div>

        {/* System Skills */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: token.colorText }}>System Skills</div>
          <div style={optionCard}>
            <div style={skillRowStyle}>
              <div>
                <div style={skillLabelStyle}>Web Search</div>
                <div style={skillDescStyle}>Enables the assistant to search the web for up-to-date information and events.</div>
              </div>
              <Switch checked={skills.webSearch} onChange={(checked) => handleToggleSkill('webSearch', checked)} />
            </div>
            <div style={{ height: 1, background: token.colorBorderSecondary }} />
            <div style={skillRowStyle}>
              <div>
                <div style={skillLabelStyle}>Image Generation</div>
                <div style={skillDescStyle}>Allows the assistant to generate or edit visual assets and illustrations.</div>
              </div>
              <Switch checked={skills.imageGen} onChange={(checked) => handleToggleSkill('imageGen', checked)} />
            </div>
            <div style={{ height: 1, background: token.colorBorderSecondary }} />
            <div style={skillRowStyle}>
              <div>
                <div style={skillLabelStyle}>Code Interpreter</div>
                <div style={skillDescStyle}>Enables the assistant to run computations, inspect scripts, and solve puzzles locally.</div>
              </div>
              <Switch checked={skills.codeInterpreter} onChange={(checked) => handleToggleSkill('codeInterpreter', checked)} />
            </div>
            <div style={{ height: 1, background: token.colorBorderSecondary }} />
            <div style={skillRowStyle}>
              <div>
                <div style={skillLabelStyle}>Workspace Integration</div>
                <div style={skillDescStyle}>Connects the assistant to workspace files, schemas, and databases securely.</div>
              </div>
              <Switch checked={skills.workspace} onChange={(checked) => handleToggleSkill('workspace', checked)} />
            </div>
          </div>
        </div>

        {/* MCP Servers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 16, color: token.colorText }}>MCP Servers</div>
            <Button type="primary" onClick={handleAdd}>
              + Add Server
            </Button>
          </div>
          
          <div style={optionCard}>
            <Table
              dataSource={servers}
              columns={columns}
              rowKey="id"
              pagination={false}
              size="small"
              style={{ padding: '8px' }}
            />
          </div>
        </div>

        <Modal
          title={editingServer ? 'Edit MCP Server' : 'Add MCP Server'}
          open={modalOpen}
          onOk={handleModalOk}
          onCancel={() => setModalOpen(false)}
          okText={editingServer ? 'Update' : 'Add'}
        >
          <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
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

        <Form layout="horizontal" labelAlign="left">
          <Form.Item style={{ margin: 0 }}>
            <Button type="primary" onClick={handleSave} loading={loading} style={{ borderRadius: 9999, height: 40, paddingInline: 28, fontWeight: 600 }}>
              Save MCP Config
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}

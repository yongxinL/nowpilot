import React, { useEffect, useState } from 'react';
import {
  Form,
  Button,
  Input,
  Popconfirm,
  App,
  Modal,
  Checkbox,
  Popover,
  Tooltip,
  theme,
  Typography,
} from 'antd';
import {
  MessageOutlined,
  FileTextOutlined,
  EditOutlined,
  CheckSquareOutlined,
  TranslationOutlined,
  LineHeightOutlined,
  SmileOutlined,
  UnorderedListOutlined,
  BulbOutlined,
  BookOutlined,
  FontColorsOutlined,
  FormOutlined,
  MailOutlined,
  CalendarOutlined,
  GlobalOutlined,
  HighlightOutlined,
  CommentOutlined,
  ThunderboltOutlined,
  StarOutlined,
  SettingOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  QuestionCircleOutlined,
  CloseOutlined,
  HolderOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { promptManager } from '../../core/prompts/PromptManager';
import { templateEngine } from '../../core/prompts/TemplateEngine';
import type { PromptTemplate } from '../../core/prompts/PromptManager';

const { Title, Paragraph, Text } = Typography;

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  message: MessageOutlined,
  fileText: FileTextOutlined,
  edit: EditOutlined,
  checkSquare: CheckSquareOutlined,
  translation: TranslationOutlined,
  lineHeight: LineHeightOutlined,
  smile: SmileOutlined,
  unorderedList: UnorderedListOutlined,
  bulb: BulbOutlined,
  book: BookOutlined,
  fontColors: FontColorsOutlined,
  form: FormOutlined,
  mail: MailOutlined,
  calendar: CalendarOutlined,
  global: GlobalOutlined,
  highlight: HighlightOutlined,
  comment: CommentOutlined,
  thunderbolt: ThunderboltOutlined,
  star: StarOutlined,
  setting: SettingOutlined,
};

const renderIcon = (name?: string, style?: React.CSSProperties) => {
  const IconComponent = ICON_MAP[name || 'fileText'] || FileTextOutlined;
  return <IconComponent style={style} />;
};

const SUBTITLES = {
  chat: "Prompts in 'Show in list' appear in the Chat tab.",
  reading: "Prompts in 'Show in list' appear in the Reading context menu.",
  writing: "Prompts in 'Show in list' appear in the Writing context menu.",
  reply: "Prompts in 'Show in list' appear in the Reply smart template choices.",
};

interface PromptCardProps {
  item: PromptTemplate;
  isHiddenList: boolean;
  onEdit: (item: PromptTemplate) => void;
  onDelete: (id: string) => void;
  onToggleHidden: (id: string, currentlyHidden: boolean) => void;
}

function PromptCard({ item, isHiddenList, onEdit, onDelete, onToggleHidden }: PromptCardProps) {
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
    cursor: 'pointer',
    marginBottom: '10px',
    width: '100%',
  };

  return (
    <div
      style={cardStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onEdit(item)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
        {/* Holder Outlined Dots */}
        <HolderOutlined style={{ color: isHovered ? token.colorTextSecondary : token.colorBorder, cursor: 'grab', fontSize: '13px', flexShrink: 0 }} />
        
        {/* Icon */}
        <span style={{ fontSize: '15px', color: token.colorTextSecondary, display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
          {renderIcon(item.icon)}
        </span>

        {/* Name */}
        <span style={{ fontWeight: 600, fontSize: '14px', color: token.colorText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
        </span>
      </div>

      {/* Actions */}
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
        onClick={(e) => e.stopPropagation()} // Prevent card click
      >
        {!isHiddenList ? (
          <>
            <Tooltip title={item.isBuiltin ? 'View details' : 'Edit'}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined style={{ fontSize: '13px' }} />}
                onClick={() => onEdit(item)}
              />
            </Tooltip>

            {!item.isBuiltin && (
              <Tooltip title="Delete">
                <Popconfirm
                  title="Delete this prompt?"
                  description="This action cannot be undone."
                  onConfirm={() => onDelete(item.id)}
                  onCancel={(e) => e?.stopPropagation()}
                  okText="Delete"
                  cancelText="Cancel"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined style={{ fontSize: '13px' }} />}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popconfirm>
              </Tooltip>
            )}

            <Tooltip title="Hide">
              <Button
                type="text"
                size="small"
                style={{ color: token.colorWarning }}
                icon={<EyeInvisibleOutlined style={{ fontSize: '13px' }} />}
                onClick={() => onToggleHidden(item.id, false)}
              />
            </Tooltip>
          </>
        ) : (
          <Tooltip title="Show">
            <Button
              type="text"
              size="small"
              style={{ color: token.colorSuccess }}
              icon={<EyeOutlined style={{ fontSize: '13px' }} />}
              onClick={() => onToggleHidden(item.id, true)}
            />
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export function PromptsSection() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'reading' | 'writing' | 'reply'>('chat');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formTemplate, setFormTemplate] = useState('');
  const [formScopes, setFormScopes] = useState<('chat' | 'reading' | 'writing' | 'reply')[]>([]);
  const [formIcon, setFormIcon] = useState('fileText');
  const [isIconSelectorOpen, setIsIconSelectorOpen] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const all = await promptManager.getAllTemplates();
      const sorted = all.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
      setTemplates(sorted);
    } catch {
      setTemplates([]);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await loadTemplates();
      message.success('Prompts refreshed');
    } catch {
      message.error('Failed to reload prompts');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setEditingTemplateId(null);
    setFormName('');
    setFormTemplate('');
    setFormScopes([activeTab]); // default to current active tab
    setFormIcon('fileText');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (tpl: PromptTemplate) => {
    setModalMode('edit');
    setEditingTemplateId(tpl.id);
    setFormName(tpl.name);
    setFormTemplate(tpl.template);
    setFormScopes(tpl.scopes ?? ['chat', 'reading', 'writing', 'reply']);
    setFormIcon(tpl.icon ?? 'fileText');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTemplateId(null);
  };

  const handleScopeCheckboxChange = (scope: 'chat' | 'reading' | 'writing' | 'reply', checked: boolean) => {
    if (checked) {
      setFormScopes((prev) => {
        const next = prev.includes(scope) ? prev : [...prev, scope];
        return next;
      });
    } else {
      setFormScopes((prev) => prev.filter((s) => s !== scope));
    }
  };

  const handleAllCheckboxChange = (checked: boolean) => {
    if (checked) {
      setFormScopes(['chat', 'reading', 'writing', 'reply']);
    } else {
      setFormScopes([]);
    }
  };

  const handleSaveTemplate = async () => {
    if (!formName.trim() || !formTemplate.trim()) {
      message.warning('Name and template content are required');
      return;
    }

    const extracted = templateEngine.extractVariables(formTemplate);
    setLoading(true);
    try {
      if (modalMode === 'edit' && editingTemplateId) {
        const original = templates.find((t) => t.id === editingTemplateId);
        if (original) {
          if (original.isBuiltin) {
            message.warning('Cannot edit system prompts');
            setIsModalOpen(false);
            return;
          }

          const updated: PromptTemplate = {
            ...original,
            name: formName.trim(),
            template: formTemplate.trim(),
            scopes: formScopes,
            icon: formIcon,
            variables: extracted,
          };
          await promptManager.updateTemplate(updated);
          message.success('Prompt updated');
        }
      } else {
        const newTpl: PromptTemplate = {
          id: `custom-${Date.now()}`,
          name: formName.trim(),
          template: formTemplate.trim(),
          category: 'custom',
          variables: extracted,
          isBuiltin: false,
          scopes: formScopes,
          hidden: false,
          icon: formIcon,
          order: templates.length,
        };
        await promptManager.createTemplate(newTpl);
        message.success('Prompt created');
      }
      await loadTemplates();
      setIsModalOpen(false);
    } catch {
      message.error('Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await promptManager.deleteTemplate(id);
      await loadTemplates();
      message.success('Prompt deleted');
    } catch {
      message.error('Failed to delete prompt');
    }
  };

  const handleToggleHidden = async (id: string, isCurrentlyHidden: boolean) => {
    const updated = templates.map((t) => {
      if (t.id === id) {
        return { ...t, hidden: !isCurrentlyHidden };
      }
      return t;
    });
    setTemplates(updated);

    try {
      const target = updated.find((t) => t.id === id);
      if (target) {
        await promptManager.updateTemplate(target);
        message.success(isCurrentlyHidden ? 'Prompt moved to active list' : 'Prompt moved to hidden list');
      }
    } catch {
      message.error('Failed to update status');
    }
  };

  // Filter lists based on the active tab's scope matches
  const activeTabTemplates = templates.filter((t) => {
    const scopes = t.scopes ?? ['chat', 'reading', 'writing', 'reply'];
    return scopes.includes(activeTab);
  });

  const showList = activeTabTemplates.filter((t) => !t.hidden);
  const hideList = activeTabTemplates.filter((t) => t.hidden);

  const tabs = [
    { key: 'chat', label: 'Chat' },
    { key: 'reading', label: 'reading' },
    { key: 'writing', label: 'Write' },
    { key: 'reply', label: 'Reply' },
  ] as const;

  const isEditingBuiltin = editingTemplateId
    ? templates.find((t) => t.id === editingTemplateId)?.isBuiltin
    : false;

  // Custom pill tab style
  const pillContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '6px',
    marginBottom: '14px',
    background: token.colorFillSecondary,
    padding: '5px',
    borderRadius: '24px',
    width: 'fit-content',
    border: `1px solid ${token.colorBorderSecondary}`,
  };

  const getPillStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '6px 16px',
    fontSize: '13px',
    fontWeight: 600,
    borderRadius: '20px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    background: isActive ? token.colorBgContainer : 'transparent',
    color: isActive ? token.colorPrimary : token.colorTextSecondary,
    boxShadow: isActive ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
  });

  // Pane Grid Column Style
  const paneContainerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '20px',
    marginTop: '16px',
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
    <div data-options-section="prompts" style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 800 }}>Prompts Settings</Title>
          <Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
            Configure and manage templates for AI operations.
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
          
          {/* New Prompt Button */}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreateModal}
            style={{ borderRadius: '20px', fontWeight: 600 }}
          >
            New Prompt
          </Button>
        </div>
      </div>

      {/* Tabs Menu in Pill Style */}
      <div style={pillContainerStyle}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={getPillStyle(isActive)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Description Help Text */}
      <div style={{ fontSize: '13px', color: token.colorTextSecondary, marginBottom: '20px', fontWeight: 500 }}>
        {SUBTITLES[activeTab]}
      </div>

      {/* Columns Grid Layout */}
      <div style={paneContainerStyle}>
        {/* Left Column: Show in list */}
        <div style={paneStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px', color: token.colorTextSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
            <BookOutlined style={{ fontSize: '14px' }} />
            <span>Show in list ({showList.length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', maxHeight: '480px', flexGrow: 1 }}>
            {showList.length === 0 ? (
              <div style={emptyStateStyle}>
                <EyeOutlined style={{ fontSize: '24px', color: token.colorBorder }} />
                <span style={{ fontSize: '13px' }}>No active prompts for this tab. Click "Show" from hidden list.</span>
              </div>
            ) : (
              showList.map((item) => (
                <PromptCard
                  key={item.id}
                  item={item}
                  isHiddenList={false}
                  onEdit={handleOpenEditModal}
                  onDelete={handleDeleteTemplate}
                  onToggleHidden={handleToggleHidden}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Column: Hide from list */}
        <div style={paneStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px', color: token.colorTextSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
            <InboxOutlined style={{ fontSize: '14px' }} />
            <span>Hide from list ({hideList.length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', maxHeight: '480px', flexGrow: 1 }}>
            {hideList.length === 0 ? (
              <div style={emptyStateStyle}>
                <EyeInvisibleOutlined style={{ fontSize: '24px', color: token.colorBorder }} />
                <span style={{ fontSize: '13px' }}>No hidden prompts for this tab. Hover items and click "Hide".</span>
              </div>
            ) : (
              hideList.map((item) => (
                <PromptCard
                  key={item.id}
                  item={item}
                  isHiddenList={true}
                  onEdit={handleOpenEditModal}
                  onDelete={handleDeleteTemplate}
                  onToggleHidden={handleToggleHidden}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Edit/Create Modal */}
      <Modal
        title={
          <span style={{ fontSize: '16px', fontWeight: 700 }}>
            {modalMode === 'create' ? 'New Prompt' : isEditingBuiltin ? 'View System Prompt' : 'Edit Prompt'}
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
        <Form layout="vertical" onFinish={handleSaveTemplate}>
          {/* Prompt Name */}
          <Form.Item
            label={
              <span style={{ fontSize: '12px', fontWeight: 700, color: token.colorTextSecondary, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {!isEditingBuiltin && <span style={{ color: token.colorError, marginRight: '4px' }}>*</span>} Prompt Name
              </span>
            }
            style={{ marginBottom: '16px' }}
          >
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Improve writing"
              style={{ borderRadius: '8px', padding: '7px 12px' }}
              disabled={isEditingBuiltin}
            />
          </Form.Item>

          {/* Prompt Content */}
          <Form.Item
            label={
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color: token.colorTextSecondary, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                <span>{!isEditingBuiltin && <span style={{ color: token.colorError, marginRight: '4px' }}>*</span>} Prompt Content</span>
                <Tooltip title="Use {{userInput}} as a placeholder for selected or custom text">
                  <QuestionCircleOutlined style={{ cursor: 'help', fontSize: '12px', color: token.colorTextSecondary }} />
                </Tooltip>
              </div>
            }
            style={{ marginBottom: '16px' }}
          >
            <Input.TextArea
              value={formTemplate}
              onChange={(e) => setFormTemplate(e.target.value)}
              rows={5}
              placeholder="e.g., Rewrite the following text: {{userInput}}"
              style={{ fontFamily: 'monospace', fontSize: '12px', borderRadius: '8px', padding: '8px 12px' }}
              disabled={isEditingBuiltin}
            />
          </Form.Item>

          {/* Used in */}
          <Form.Item
            label={
              <span style={{ fontSize: '12px', fontWeight: 700, color: token.colorTextSecondary, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Used in
              </span>
            }
            style={{ marginBottom: '16px' }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 16px', marginTop: '4px' }}>
              <Checkbox
                checked={formScopes.length === 4}
                onChange={(e) => handleAllCheckboxChange(e.target.checked)}
                style={{ fontSize: '13px', fontWeight: 600 }}
                disabled={isEditingBuiltin}
              >
                All
              </Checkbox>
              <Checkbox
                checked={formScopes.includes('chat')}
                onChange={(e) => handleScopeCheckboxChange('chat', e.target.checked)}
                style={{ fontSize: '13px', fontWeight: 600 }}
                disabled={isEditingBuiltin}
              >
                Chat
              </Checkbox>
              <Checkbox
                checked={formScopes.includes('reading')}
                onChange={(e) => handleScopeCheckboxChange('reading', e.target.checked)}
                style={{ fontSize: '13px', fontWeight: 600 }}
                disabled={isEditingBuiltin}
              >
                Read
              </Checkbox>
              <Checkbox
                checked={formScopes.includes('writing')}
                onChange={(e) => handleScopeCheckboxChange('writing', e.target.checked)}
                style={{ fontSize: '13px', fontWeight: 600 }}
                disabled={isEditingBuiltin}
              >
                Write
              </Checkbox>
              <Checkbox
                checked={formScopes.includes('reply')}
                onChange={(e) => handleScopeCheckboxChange('reply', e.target.checked)}
                style={{ fontSize: '13px', fontWeight: 600 }}
                disabled={isEditingBuiltin}
              >
                Reply
              </Checkbox>
            </div>
          </Form.Item>

          {/* Icon Selector */}
          <Form.Item
            label={
              <span style={{ fontSize: '12px', fontWeight: 700, color: token.colorTextSecondary, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Icon
              </span>
            }
            style={{ marginBottom: '24px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  border: `1px solid ${token.colorBorderSecondary}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  background: token.colorBgLayout,
                  color: token.colorTextSecondary,
                }}
              >
                {renderIcon(formIcon)}
              </div>
              <Popover
                content={
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', padding: '4px' }}>
                    {Object.keys(ICON_MAP).map((iconName) => {
                      const isSelected = formIcon === iconName;
                      return (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() => {
                            setFormIcon(iconName);
                            setIsIconSelectorOpen(false);
                          }}
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            border: `1px solid ${isSelected ? token.colorPrimary : token.colorBorderSecondary}`,
                            background: isSelected ? token.colorFillSecondary : token.colorBgContainer,
                            color: isSelected ? token.colorPrimary : token.colorTextSecondary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {renderIcon(iconName)}
                        </button>
                      );
                    })}
                  </div>
                }
                title={<span style={{ fontSize: '12px', fontWeight: 700, color: token.colorTextSecondary, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Select Icon</span>}
                trigger="click"
                open={isIconSelectorOpen}
                onOpenChange={setIsIconSelectorOpen}
                disabled={isEditingBuiltin}
              >
                <Button disabled={isEditingBuiltin} style={{ borderRadius: '6px' }}>Change Icon</Button>
              </Popover>
            </div>
          </Form.Item>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'end', gap: '10px', paddingTop: '16px', borderTop: `1px solid ${token.colorBorderSecondary}` }}>
            {isEditingBuiltin ? (
              <Button
                type="primary"
                onClick={handleCloseModal}
                style={{ borderRadius: '6px', fontWeight: 600 }}
              >
                Close
              </Button>
            ) : (
              <>
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
                  Save
                </Button>
              </>
            )}
          </div>
        </Form>
      </Modal>
    </div>
  );
}

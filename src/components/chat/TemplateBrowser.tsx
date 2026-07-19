import { useState, useEffect } from 'react';
import { Popover, Input, Button, Flex, Typography, theme } from 'antd';
import { SnippetsOutlined, SearchOutlined } from '@ant-design/icons';
import { templateBrowserService, type CategorizedTemplates } from '../../core/prompts/TemplateBrowserService';
import type { PromptTemplate } from '../../core/prompts/PromptManager';

const { Text } = Typography;

export interface TemplateBrowserProps {
  onInsert: (template: string) => void;
}

/**
 * TemplateBrowser — Sender toolbar popover for browsing and inserting
 * prompt templates. Shows categorized template sections, recently-used
 * templates at top, and real-time search filtering.
 *
 * Follows PATTERNS.md lines 477-550 exact pattern with antd theme tokens.
 */
export function TemplateBrowser({ onInsert }: TemplateBrowserProps) {
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<CategorizedTemplates[]>([]);

  // Load categories when popover opens or search changes
  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      const result = search.trim()
        ? [{ category: 'Search results', templates: await templateBrowserService.search(search) }]
        : await templateBrowserService.getByCategory();

      if (!cancelled) {
        setCategories(result);
      }
    }

    // Only load when popover is open
    if (open) {
      loadCategories();
    } else {
      setCategories([]);
      setSearch('');
    }

    return () => { cancelled = true; };
  }, [open, search]);

  const handleTemplateClick = (tpl: PromptTemplate) => {
    onInsert(tpl.template);
    templateBrowserService.trackRecentUse(tpl.id);
    setOpen(false);
  };

  const content = (
    <div style={{ width: 360, maxHeight: 400, overflowY: 'auto' }}>
      <Input
        prefix={<SearchOutlined />}
        placeholder="Search templates..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
        style={{ marginBottom: token.marginSM }}
      />
      {categories.map((cat) => (
        <div key={cat.category} style={{ marginBottom: token.marginSM }}>
          <Text
            type="secondary"
            style={{
              fontSize: 11,
              textTransform: 'uppercase' as const,
              padding: `0 ${token.paddingXS}px`,
            }}
          >
            {cat.category}
          </Text>
          <Flex vertical gap={2} style={{ marginTop: 4 }}>
            {cat.templates.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => handleTemplateClick(tpl)}
                style={{
                  padding: `${token.paddingXS}px ${token.paddingSM}px`,
                  borderRadius: token.borderRadius,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = token.colorBgTextHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <Text strong style={{ fontSize: 13 }}>{tpl.name}</Text>
                {tpl.description && (
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                    {tpl.description}
                  </Text>
                )}
              </div>
            ))}
          </Flex>
        </div>
      ))}
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="topLeft"
    >
      <Button
        type="text"
        icon={<SnippetsOutlined />}
        aria-label="Browse templates"
      />
    </Popover>
  );
}

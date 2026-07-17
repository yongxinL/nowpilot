import { useMemo, useState, type CSSProperties } from 'react';
import { Tag, Popover, Button, theme } from 'antd';
import { PushpinOutlined, CloseOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '../../core/stores/workspaceStore';

/**
 * PinTabBar — Hybrid footer strip + management popover (D-11)
 *
 * Renders as a compact, always-visible strip above the Side Panel composer area.
 * Shows the current page chip + up to 5 visible pinned tab chips.
 * Overflow tabs are accessible via a Popover with full management controls.
 *
 * ## Zustand selectors (Pitfall 5)
 * Individual field selectors prevent re-renders on unrelated workspace state
 * changes (conversation ID, drafts, surface, etc.).
 */
export function PinTabBar() {
  const { token } = theme.useToken();

  // Individual Zustand selectors — Pitfall 5 mitigation
  const currentPageContext = useWorkspaceStore((s) => s.currentPageContext);
  const pinnedTabs = useWorkspaceStore((s) => s.pinnedTabs);
  const removePinnedTab = useWorkspaceStore((s) => s.removePinnedTab);

  const [popoverOpen, setPopoverOpen] = useState(false);

  // D-12: detect if current page is pinned
  const isCurrentPinned = currentPageContext
    ? pinnedTabs.some((t) => t.url === currentPageContext.url)
    : false;

  // Display up to 5 visible chips; overflow in popover (D-11, D-12)
  const visibleTabs = pinnedTabs.slice(0, 5);
  const overflowCount = Math.max(0, pinnedTabs.length - 5);

  // Find the tabId for the current page (for unpin action)
  const currentTabId = isCurrentPinned
    ? pinnedTabs.find((t) => t.url === currentPageContext?.url)?.tabId
    : undefined;

  // Container style (footer strip — D-11)
  const containerStyle: CSSProperties = useMemo(
    () => ({
      display: 'flex',
      gap: token.marginXS,
      padding: `${token.paddingXXS}px ${token.paddingSM}px`,
      borderTop: `1px solid ${token.colorBorderSecondary}`,
      overflow: 'hidden',
      flexShrink: 0,
      alignItems: 'center',
      flexWrap: 'nowrap' as const,
    }),
    [token],
  );

  const chipStyle: CSSProperties = {
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  // Helper: truncate title to ~20 chars
  const truncateTitle = (title?: string, url?: string): string => {
    const source = title || url || '';
    return source.length > 20 ? source.slice(0, 20) + '…' : source;
  };

  // Empty state: no current page context and no pinned tabs
  if (!currentPageContext && pinnedTabs.length === 0) {
    return <div data-testid="pin-tab-bar" />;
  }

  return (
    <div style={containerStyle} data-testid="pin-tab-bar">
      {/* Current page chip — always visible when currentPageContext exists (D-12) */}
      {currentPageContext && (
        <Tag
          color="blue"
          icon={isCurrentPinned ? <PushpinOutlined /> : undefined}
          closable={isCurrentPinned}
          onClose={() => {
            if (currentTabId !== undefined) {
              removePinnedTab(currentTabId);
            }
          }}
          style={chipStyle}
        >
          {truncateTitle(currentPageContext.title, currentPageContext.url)}
        </Tag>
      )}

      {/* Pinned tab chips (D-12, D-13) */}
      {visibleTabs.map((tab) => (
        <Tag
          key={tab.tabId}
          color={tab.active === false ? undefined : undefined}
          closable
          onClose={() => removePinnedTab(tab.tabId)}
          style={{
            ...chipStyle,
            ...(tab.active === false
              ? { color: token.colorTextTertiary, borderColor: token.colorBorderSecondary }
              : {}),
          }}
        >
          {tab.active === false ? 'Closed: ' : ''}
          {truncateTitle(tab.title, tab.url)}
        </Tag>
      ))}

      {/* Overflow management popover (D-11) */}
      {overflowCount > 0 && (
        <Popover
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
          content={
            <div style={{ maxWidth: 300 }}>
              {pinnedTabs.map((tab) => (
                <div
                  key={tab.tabId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      ...(tab.active === false
                        ? { color: token.colorTextTertiary }
                        : {}),
                    }}
                  >
                    {tab.active === false ? 'Closed: ' : ''}
                    {tab.title || tab.url || `Tab ${tab.tabId}`}
                  </span>
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={() => {
                      removePinnedTab(tab.tabId);
                    }}
                    aria-label={`Unpin ${tab.title || `tab ${tab.tabId}`}`}
                  />
                </div>
              ))}
            </div>
          }
          trigger="click"
        >
          <Tag>+{overflowCount} more</Tag>
        </Popover>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { Button, Dropdown, theme } from 'antd';
import { DownOutlined, EllipsisOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useWorkspaceStore } from '../../core/stores/workspaceStore';
import { quickActionService, type QuickAction } from '../../core/ai/quickActions/QuickActionService';
import { ActionChipGroup, type ChipAction } from '../common/ActionChipGroup';

export interface QuickActionChipsProps {
  onSelectAction: (promptText: string) => void;
}

const MAX_VISIBLE = 3;

export function QuickActionChips({ onSelectAction }: QuickActionChipsProps) {
  const { token: antdToken } = theme.useToken();
  const currentPageContext = useWorkspaceStore((s) => s.currentPageContext);
  const [chips, setChips] = useState<ChipAction[]>([]);

  useEffect(() => {
    const hostname = currentPageContext?.hostname;
    if (!hostname) {
      setChips([]);
      return;
    }
    const actions: QuickAction[] = quickActionService.getActions(hostname);
    const mapped: ChipAction[] = actions.map((action, idx) => ({
      key: `qa-${idx}`,
      label: action.label,
      value: action.promptText,
    }));
    setChips(mapped);
  }, [currentPageContext?.hostname]);

  const overflowActions = chips.length > MAX_VISIBLE ? chips.slice(MAX_VISIBLE) : [];

  const handleOverflowSelect = useCallback((action: ChipAction) => {
    onSelectAction(action.value);
  }, [onSelectAction]);

  const dropdownItems: MenuProps['items'] = overflowActions.map((action) => ({
    key: action.key,
    label: action.label,
    onClick: () => handleOverflowSelect(action),
  }));

  if (!currentPageContext?.hostname || chips.length === 0) return null;

  return (
    <div style={{ padding: '0 16px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
      <ActionChipGroup
        actions={chips.slice(0, MAX_VISIBLE)}
        onSelect={onSelectAction}
        maxVisible={MAX_VISIBLE}
        variant="quickAction"
      />
      {overflowActions.length > 0 && (
        <Dropdown menu={{ items: dropdownItems }} trigger={['click']}>
          <Button
            type="link"
            size="small"
            icon={<EllipsisOutlined />}
            style={{ fontSize: 12, color: antdToken.colorTextSecondary, whiteSpace: 'nowrap' }}
          >
            +{overflowActions.length} more
          </Button>
        </Dropdown>
      )}
    </div>
  );
}

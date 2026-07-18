import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../../core/stores/workspaceStore';
import { quickActionService, type QuickAction } from '../../core/ai/quickActions/QuickActionService';
import { ActionChipGroup, type ChipAction } from '../common/ActionChipGroup';

export interface QuickActionChipsProps {
  onSelectAction: (promptText: string) => void;
}

/**
 * QuickActionChips — context-aware action strip above Sender (D-33/D-34).
 *
 * Reads workspaceStore.currentPageContext.hostname, maps to predefined
 * actions via QuickActionService, and renders as ActionChipGroup.
 * Shows 3 primary chips with horizontal scroll for overflow.
 */
export function QuickActionChips({ onSelectAction }: QuickActionChipsProps) {
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

  if (!currentPageContext?.hostname || chips.length === 0) return null;

  return (
    <div style={{ padding: '0 16px', marginBottom: 4 }}>
      <ActionChipGroup
        actions={chips}
        onSelect={onSelectAction}
        maxVisible={3}
        variant="quickAction"
      />
    </div>
  );
}

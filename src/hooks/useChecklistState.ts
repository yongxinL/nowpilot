import { useState, useCallback } from 'react';

type ChecklistState = Record<string, Set<number>>;

export function useChecklistState() {
  const [checklists, setChecklists] = useState<ChecklistState>({});

  const toggleItem = useCallback((messageId: string, index: number) => {
    setChecklists((prev) => {
      const current = prev[messageId] ?? new Set<number>();
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return { ...prev, [messageId]: next };
    });
  }, []);

  const getProgress = useCallback(
    (messageId: string, total: number): { completed: number; percent: number } => {
      const checked = checklists[messageId]?.size ?? 0;
      return {
        completed: checked,
        percent: total > 0 ? Math.round((checked / total) * 100) : 0,
      };
    },
    [checklists],
  );

  return { toggleItem, getProgress, checklists };
}

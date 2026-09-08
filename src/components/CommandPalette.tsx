import { useEffect, useMemo, useState } from 'react';
import { Input, List, Modal } from 'antd';
import {
  CommandRegistry,
  registerDefaultCommands,
  type Command,
} from '@/core/commands/CommandRegistry';
import { registerDefaultKeymaps } from '@/core/input/KeymapRegistry';
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const surface = useWorkspaceStore((s) => s.state.activeSurface);

  useEffect(() => {
    registerDefaultCommands();
    registerDefaultKeymaps();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const commands = useMemo(() => {
    const visible = CommandRegistry.getVisible(surface);
    if (!query.trim()) return visible;
    const q = query.toLowerCase();
    return visible.filter((c) => c.label.toLowerCase().includes(q));
  }, [query, surface]);

  const handleSelect = (command: Command) => {
    setOpen(false);
    setQuery('');
    void CommandRegistry.execute(command.id);
  };

  return (
    <Modal open={open} onCancel={() => setOpen(false)} footer={null} title="Command palette" width={480}>
      <Input
        placeholder="Type a command..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
        aria-label="Search commands"
      />
      <List
        dataSource={commands}
        renderItem={(command) => (
          <List.Item
            onClick={() => handleSelect(command)}
            style={{ cursor: 'pointer' }}
            role="button"
          >
            <List.Item.Meta title={command.label} description={command.description} />
          </List.Item>
        )}
      />
    </Modal>
  );
}

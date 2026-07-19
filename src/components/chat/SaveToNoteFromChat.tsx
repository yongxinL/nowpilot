import { useState } from 'react';
import { Modal, Button, Typography, App } from 'antd';
import { BookOutlined } from '@ant-design/icons';

const { Text } = Typography;

export interface SaveToNoteFromChatProps {
  conversationId: string;
  conversationTitle?: string;
  messages?: Array<{ role: string; content: string }>;
  onSaved?: (noteId: string) => void;
}

export function SaveToNoteFromChat({
  conversationId,
  conversationTitle,
  messages,
  onSaved,
}: SaveToNoteFromChatProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();

  const handleSave = async () => {
    setSaving(true);
    try {
      const title = conversationTitle || `Conversation — ${new Date().toLocaleDateString()}`;
      const markdownTranscript = (messages ?? [])
        .map((m) => `**${m.role}:** ${m.content}`)
        .join('\n\n');

      const { notesDB } = await import('../../core/storage/stores/NotesDB');
      const noteId = crypto.randomUUID();
      await notesDB.createNote({
        id: noteId,
        title,
        content: markdownTranscript,
        tags: ['conversation'],
        categoryPath: '',
        created: Date.now(),
        updated: Date.now(),
        sourceConversationId: conversationId,
      });

      message.success('Conversation saved as note');
      onSaved?.(noteId);
      setOpen(false);
    } catch (err) {
      message.error('Failed to save conversation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        type="default"
        size="small"
        icon={<BookOutlined />}
        onClick={() => setOpen(true)}
      >
        Save as Note
      </Button>

      <Modal
        title="Save Conversation as Note"
        open={open}
        onOk={handleSave}
        onCancel={() => setOpen(false)}
        confirmLoading={saving}
        okText="Save"
      >
        <Text>
          This will create a new note with the title "{conversationTitle || 'Conversation'}"
          containing the full conversation transcript.
        </Text>
      </Modal>
    </>
  );
}

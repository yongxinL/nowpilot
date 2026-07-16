import { CommentOutlined, FileTextOutlined } from '@ant-design/icons';
import { ChatPage } from '../pages/ChatPage';
import { NotesPage } from '../pages/NotesPage';
import { registerCorePages } from './registerCorePages';

registerCorePages({
  id: 'chat',
  label: 'Chat',
  icon: CommentOutlined,
  component: ChatPage,
  order: 1,
  registerOn: ['sidepanel', 'standalone'],
});

// registerCorePages({
//   id: 'agent',
//   label: 'Agent',
//   icon: RobotOutlined,
//   component: AgentPage,
//   order: 2,
//   registerOn: ['sidepanel', 'standalone'],
// });
//
// registerCorePages({
//   id: 'write',
//   label: 'Write',
//   icon: HighlightOutlined,
//   component: AgentPage,
//   order: 3,
//   registerOn: ['sidepanel', 'standalone'],
// });

registerCorePages({
  id: 'notes',
  label: 'Notes',
  icon: FileTextOutlined,
  component: NotesPage,
  order: 4,
  registerOn: ['standalone'],
});

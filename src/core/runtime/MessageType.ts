import { z } from 'zod';
import type { RuntimeSurface } from './RuntimeSurface';

export const MESSAGE_TYPES = [
  'workspace.mutation',
  'workspace.handoff.prepare',
  'workspace.handoff.ack',
  'workspace.handoff.commit',
  'workspace.relinquish',
  'workspace.rehydrate.request',
  'workspace.rehydrate.response',
  'standalone.open',
  'standalone.focus',
  'standalone.closed',
  'runtime.error',
] as const;

export type MessageType = (typeof MESSAGE_TYPES)[number];

export const MessageTypeSchema = z.enum(MESSAGE_TYPES);

export const MESSAGE_TYPE_ALLOWED_SOURCES: Readonly<
  Record<MessageType, readonly RuntimeSurface[]>
> = {
  'workspace.mutation': ['sidepanel', 'standalone'],
  'workspace.handoff.prepare': ['sidepanel', 'standalone'],
  'workspace.handoff.ack': ['sidepanel', 'standalone'],
  'workspace.handoff.commit': ['sidepanel', 'standalone'],
  'workspace.relinquish': ['sidepanel', 'standalone'],
  'workspace.rehydrate.request': ['sidepanel', 'standalone'],
  'workspace.rehydrate.response': ['sidepanel', 'standalone'],
  'standalone.open': ['sidepanel', 'standalone'],
  'standalone.focus': ['background', 'sidepanel', 'standalone'],
  'standalone.closed': ['standalone'],
  'runtime.error': ['background', 'sidepanel', 'standalone'],
};

import { z } from 'zod';

export const RUNTIME_SURFACES = ['background', 'sidepanel', 'standalone'] as const;

export type RuntimeSurface = (typeof RUNTIME_SURFACES)[number];

export const RuntimeSurfaceSchema = z.enum(RUNTIME_SURFACES);

export const RUNTIME_TARGETS = ['background', 'sidepanel', 'standalone', '*'] as const;

export type RuntimeTarget = (typeof RUNTIME_TARGETS)[number];

export const RuntimeTargetSchema = z.enum(RUNTIME_TARGETS);

export type WorkspaceWriterSurface = Exclude<RuntimeSurface, 'background'>;

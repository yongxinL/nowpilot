import { z } from 'zod';

export const OperationIdSchema = z.string().uuid();

export type OperationId = z.infer<typeof OperationIdSchema>;

export function createOperationId(): OperationId {
  return crypto.randomUUID();
}

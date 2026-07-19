/**
 * Discriminated types for TeamGQM entity hierarchy.
 *
 * Each entity stored in indexedDB 'gqm' store with type discriminator for querying.
 * Follows the PageContext.ts type-only export pattern — pure type exports, no runtime code.
 */

export interface Goal {
  type: 'goal';
  id: string;
  title: string;
  description?: string;
  order: number;
  parentId: null;       // goals are root nodes
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface Question {
  type: 'question';
  id: string;
  title: string;
  description?: string;
  order: number;
  parentId: string;     // references Goal.id
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface Metric {
  type: 'metric';
  id: string;
  title: string;
  description?: string;
  currentValue?: string;
  targetValue?: string;
  unit?: string;
  order: number;
  parentId: string;     // references Question.id
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export type GQMNode = Goal | Question | Metric;

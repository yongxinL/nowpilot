export type StageLabel = 'idle' | 'reading-page' | 'planning' | 'generating' | 'done';

export const STAGE_LABELS: Record<StageLabel, string> = {
  'idle': '',
  'reading-page': 'Reading page context…',
  'planning': 'Planning response…',
  'generating': 'Generating…',
  'done': '',
};

const VALID_TRANSITIONS: Record<StageLabel, StageLabel[]> = {
  'idle': ['reading-page', 'planning'],
  'reading-page': ['planning', 'done'],
  'planning': ['generating', 'done'],
  'generating': ['done'],
  'done': [],
};

export class ChunkBuffer {
  private buffer = '';
  private stage: StageLabel = 'idle';
  private tokenCount = 0;
  private rAFId: number | null = null;
  private onFlushCallback: ((text: string) => void) | null = null;

  write(text: string): void {
    this.buffer += text;
    if (this.rAFId === null) {
      this.rAFId = requestAnimationFrame(() => {
        const text = this.flush();
        if (text && this.onFlushCallback) {
          this.onFlushCallback(text);
        }
      });
    }
  }

  flush(): string {
    if (this.rAFId !== null) {
      cancelAnimationFrame(this.rAFId);
      this.rAFId = null;
    }
    const text = this.buffer;
    this.buffer = '';
    if (text && this.onFlushCallback) {
      this.onFlushCallback(text);
    }
    return text;
  }

  transition(stage: StageLabel): void {
    const validNext = VALID_TRANSITIONS[this.stage];
    if (validNext && validNext.includes(stage)) {
      this.stage = stage;
    } else {
      console.warn(`Invalid stage transition: ${this.stage} -> ${stage}`);
    }
  }

  getStage(): StageLabel {
    return this.stage;
  }

  getStageLabel(): string {
    return STAGE_LABELS[this.stage];
  }

  addTokens(prompt: number, completion: number): void {
    this.tokenCount += prompt + completion;
  }

  getTokenCount(): number {
    return this.tokenCount;
  }

  reset(): void {
    this.buffer = '';
    this.stage = 'idle';
    this.tokenCount = 0;
    if (this.rAFId !== null) {
      cancelAnimationFrame(this.rAFId);
      this.rAFId = null;
    }
  }

  setOnFlush(callback: ((text: string) => void) | null): void {
    this.onFlushCallback = callback;
  }

  destroy(): void {
    if (this.rAFId !== null) {
      cancelAnimationFrame(this.rAFId);
      this.rAFId = null;
    }
    this.buffer = '';
    this.stage = 'idle';
    this.tokenCount = 0;
    this.onFlushCallback = null;
  }
}

import { describe, it, expect, vi, beforeEach } from 'vitest';

// We'll use vi.mock to control Date.now() for predictable time-of-day testing
const MOCK_NOW = {
  morning: new Date(2026, 6, 19, 9, 0, 0).getTime(),   // hour 9
  afternoon: new Date(2026, 6, 19, 14, 0, 0).getTime(), // hour 14
  evening: new Date(2026, 6, 19, 19, 0, 0).getTime(),   // hour 19
};

// Import after potential mocks
const { generateGreeting } = await import('../../../src/core/greeting/GreetingService');

describe('GreetingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateGreeting', () => {
    it('at hour=9 with displayName returns morning greeting with name (Test 1)', () => {
      vi.setSystemTime(MOCK_NOW.morning);

      const result = generateGreeting({ displayName: 'George' });

      expect(result.greeting).toBe('Good morning, George');
      expect(result.timeOfDay).toBe('morning');
      expect(result.tagline).toBe('Your AI work co-pilot');
      expect(result.contextualLine).toBeUndefined();
    });

    it('at hour=14 without displayName returns afternoon greeting generic (Test 2)', () => {
      vi.setSystemTime(MOCK_NOW.afternoon);

      const result = generateGreeting({});

      expect(result.greeting).toBe('Good afternoon! How can I help?');
      expect(result.timeOfDay).toBe('afternoon');
      expect(result.contextualLine).toBeUndefined();
    });

    it('at hour=19 with displayName and pageTitle returns evening greeting + contextualLine (Test 3)', () => {
      vi.setSystemTime(MOCK_NOW.evening);

      const result = generateGreeting({ displayName: 'A', pageTitle: 'INC001' });

      expect(result.greeting).toBe('Good evening, A');
      expect(result.timeOfDay).toBe('evening');
      expect(result.contextualLine).toBe("You're working on: INC001");
    });

    it('timeOfDay is: morning for hour<12, afternoon for hour<17, evening for hour>=17 (Test 4)', () => {
      // Morning: hour 0-11
      vi.setSystemTime(new Date(2026, 6, 19, 0, 0, 0).getTime());
      expect(generateGreeting({}).timeOfDay).toBe('morning');

      vi.setSystemTime(new Date(2026, 6, 19, 11, 59, 59).getTime());
      expect(generateGreeting({}).timeOfDay).toBe('morning');

      // Afternoon: hour 12-16
      vi.setSystemTime(new Date(2026, 6, 19, 12, 0, 0).getTime());
      expect(generateGreeting({}).timeOfDay).toBe('afternoon');

      vi.setSystemTime(new Date(2026, 6, 19, 16, 59, 59).getTime());
      expect(generateGreeting({}).timeOfDay).toBe('afternoon');

      // Evening: hour 17-23
      vi.setSystemTime(new Date(2026, 6, 19, 17, 0, 0).getTime());
      expect(generateGreeting({}).timeOfDay).toBe('evening');

      vi.setSystemTime(new Date(2026, 6, 19, 23, 59, 59).getTime());
      expect(generateGreeting({}).timeOfDay).toBe('evening');
    });

    it('contextualLine is undefined when pageTitle is absent (Test 6)', () => {
      vi.setSystemTime(MOCK_NOW.morning);

      const result = generateGreeting({ displayName: 'George' });
      expect(result.contextualLine).toBeUndefined();

      const result2 = generateGreeting({});
      expect(result2.contextualLine).toBeUndefined();
    });
  });
});

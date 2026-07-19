// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GreetingInput {
  displayName?: string;
  pageTitle?: string;
}

export interface Greeting {
  greeting: string;        // e.g., "Good morning, George"
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  tagline: string;         // "Your AI work co-pilot"
  contextualLine?: string; // e.g., "You're working on: INC0012345"
}

// ---------------------------------------------------------------------------
// Pure function — time-of-day greeting computation
// ---------------------------------------------------------------------------

/**
 * Generate a time-of-day greeting with optional displayName and page context.
 * Pure computation — no I/O, no side effects, no dependencies.
 */
export function generateGreeting(input: GreetingInput): Greeting {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  const timePrefix = timeOfDay === 'morning'
    ? 'Good morning'
    : timeOfDay === 'afternoon'
      ? 'Good afternoon'
      : 'Good evening';

  const greeting = input.displayName
    ? `${timePrefix}, ${input.displayName}`
    : `${timePrefix}! How can I help?`;

  const contextualLine = input.pageTitle
    ? `You're working on: ${input.pageTitle}`
    : undefined;

  return {
    greeting,
    timeOfDay,
    tagline: 'Your AI work co-pilot',
    contextualLine,
  };
}

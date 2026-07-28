export const PROMPTS = {
  titleGen: 'Generate a short title (max 6 words) for this conversation based on the user\'s first message. Return ONLY the title, no quotes or explanation.',
  repairJson: 'The previous JSON output was malformed. Return ONLY valid JSON. Do not explain or apologize.',
} as const;

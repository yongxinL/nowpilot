import { useState, useCallback } from 'react';
import { referenceResolver } from '../core/references/referenceResolverRegistry';
import type { ReferenceToken } from '../core/references/ReferenceToken';

export interface MentionAutocompleteState {
  mentionTokens: ReferenceToken[];
  isAutocompleteOpen: boolean;
  cursorPosition: number;
  mentionQuery: string;
}

export function useMentionAutocomplete() {
  const [state, setState] = useState<MentionAutocompleteState>({
    mentionTokens: [],
    isAutocompleteOpen: false,
    cursorPosition: 0,
    mentionQuery: '',
  });

  const handleTextChange = useCallback((value: string, cursorPos?: number) => {
    const pos = cursorPos ?? value.length;
    const beforeCursor = value.slice(0, pos);
    const atIndex = beforeCursor.lastIndexOf('@');

    if (atIndex !== -1) {
      const afterAt = beforeCursor.slice(atIndex + 1);
      if (/^[\w]*$/.test(afterAt)) {
        setState((prev) => ({
          ...prev,
          isAutocompleteOpen: true,
          cursorPosition: pos,
          mentionQuery: afterAt,
        }));
        return;
      }
    }

    setState((prev) => ({ ...prev, isAutocompleteOpen: false, mentionQuery: '' }));
  }, []);

  const handleSelectMention = useCallback((token: ReferenceToken) => {
    setState((prev) => ({
      ...prev,
      mentionTokens: [...prev.mentionTokens, token],
      isAutocompleteOpen: false,
    }));
  }, []);

  const handleRemoveMention = useCallback((tokenId: string) => {
    setState((prev) => ({
      ...prev,
      mentionTokens: prev.mentionTokens.filter((t) => t.id !== tokenId),
    }));
  }, []);

  const handleValidateTokens = useCallback(async () => {
    const tokens = state.mentionTokens;
    const valid: ReferenceToken[] = [];
    for (const token of tokens) {
      const result = await referenceResolver.validate(token);
      if (result.valid) {
        valid.push(token);
      }
    }
    setState((prev) => ({ ...prev, mentionTokens: valid }));
    return valid;
  }, [state.mentionTokens]);

  return {
    ...state,
    handleTextChange,
    handleSelectMention,
    handleRemoveMention,
    handleValidateTokens,
    setMentionTokens: (tokens: ReferenceToken[]) =>
      setState((prev) => ({ ...prev, mentionTokens: tokens })),
  };
}

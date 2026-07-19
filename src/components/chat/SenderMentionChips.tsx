import { Flex } from 'antd';
import { MentionChip } from '../common/MentionChip';
import type { ReferenceToken } from '../../core/references/ReferenceToken';

export interface SenderMentionChipsProps {
  tokens: ReferenceToken[];
  onRemoveToken: (tokenId: string) => void;
}

export function SenderMentionChips({ tokens, onRemoveToken }: SenderMentionChipsProps) {
  if (tokens.length === 0) return null;

  return (
    <Flex gap={4} wrap="wrap" align="center">
      {tokens.map((token) => (
        <MentionChip
          key={token.id}
          token={token}
          onRemove={() => onRemoveToken(token.id)}
        />
      ))}
    </Flex>
  );
}

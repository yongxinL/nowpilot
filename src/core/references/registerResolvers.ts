import { referenceResolver } from './referenceResolver';
import { noteResolver } from './resolvers/NoteResolver';
import { tabResolver } from './resolvers/TabResolver';
import { promptResolver } from './resolvers/PromptResolver';

export function registerResolvers(): void {
  referenceResolver.register('note', noteResolver);
  referenceResolver.register('tab', tabResolver);
  referenceResolver.register('prompt', promptResolver);
}

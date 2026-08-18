import { useState, useRef } from 'react';
import { App } from 'antd';
import { useExtensionStore } from '../../store/useExtensionStore';
import { streamChatResponse } from '../../services/aiProvider';
import { Message, Attachment } from '../../types';

export function useChatStreaming() {
  const { message: antMessage } = App.useApp();
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    config,
    activeSession,
    createNewSession,
    addMessageToActiveSession,
    updateLastAssistantMessage,
  } = useExtensionStore();

  const handleSend = async (
    textToSend: string,
    attachments: Attachment[] = [],
    onAfterSend?: () => void
  ) => {
    if (!textToSend.trim() && attachments.length === 0) return;

    let currentSession = activeSession;
    if (!currentSession) {
      createNewSession();
      currentSession = useExtensionStore.getState().activeSession;
    }
    if (!currentSession) return;

    const currentAttachments = [...attachments];

    const userMessage: Message = {
      id: 'm_' + Date.now(),
      role: 'user',
      content: textToSend,
      timestamp: Date.now(),
      attachments: currentAttachments,
    };

    const assistantMsgId = 'm_ast_' + Date.now();
    const assistantMessage: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      thoughtProcess: 'Analyzing prompt and scanning context tabs...',
      timestamp: Date.now(),
      model: config.selectedModel,
      isThinking: true,
      versions: [''],
      currentVersionIndex: 0,
      followups: [
        'What are the core components of critical thinking?',
        'Can you provide a practical workplace example?',
      ],
    };

    addMessageToActiveSession(userMessage);
    addMessageToActiveSession(assistantMessage);
    onAfterSend?.();
    setIsGenerating(true);

    abortControllerRef.current = new AbortController();

    const currentHistory = useExtensionStore.getState().activeSession?.messages || [userMessage];

    await streamChatResponse({
      messages: currentHistory,
      prompt: textToSend,
      attachments: currentAttachments,
      modelId: config.selectedModel,
      config,
      onChunk: (textChunk, thoughtChunk) => {
        updateLastAssistantMessage(textChunk, thoughtChunk, false);
      },
      onDone: () => {
        updateLastAssistantMessage('', '', true);
        setIsGenerating(false);
      },
      onError: (err) => {
        updateLastAssistantMessage(`\n\n*Error generating response: ${err.message}*`, '', true);
        setIsGenerating(false);
      },
      signal: abortControllerRef.current.signal,
    });
  };

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      updateLastAssistantMessage('\n\n*(Generation stopped by user)*', '', true);
      antMessage.info('Generation stopped');
    }
  };

  return {
    isGenerating,
    handleSend,
    handleStopGenerating,
  };
}

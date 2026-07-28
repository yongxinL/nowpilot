import React, { useState, useRef, useEffect } from 'react';
import { Typography, App, Tooltip } from 'antd';
import {
  ClockCircleOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  MailOutlined,
  SendOutlined,
  StopOutlined,
  ExpandOutlined,
  CompassOutlined,
  HighlightOutlined,
  FilePptOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';

import { ThemeToggle } from '../common/ThemeToggle';
import { OnboardingWizard } from '../common/OnboardingWizard';
import { ModelSelector } from '../common/ModelSelector';
import { ThoughtProcessBlock } from './ThoughtProcessBlock';
import { ActionPanel } from '../common/ActionPanel';
import { AttachmentBar } from './AttachmentBar';
import { PinnedTabsBar } from './PinnedTabsBar';
import { TabContextSelector } from './TabContextSelector';
import { SlashCommandModal } from './SlashCommandModal';
import { FollowupSuggestions } from './FollowupSuggestions';
import { ChatHistoryModal } from '../history/ChatHistoryModal';
import { PromptManagerModal } from '../common/PromptManagerModal';
import { NowPilotAvatar } from '../common/NowPilotAvatar';

import { useExtensionStore } from '../../store/useExtensionStore';
import { streamChatResponse, AVAILABLE_MODELS, type StreamChatParams } from '../../services/aiProvider';
import { Message, PromptItem } from '../../types';

const { Text, Title } = Typography;

interface SidepanelChatProps {
  onOpenStandalone?: () => void;
  onOpenOptions?: () => void;
  isStandalone?: boolean;
}

export const SidepanelChat: React.FC<SidepanelChatProps> = ({
  onOpenStandalone,
  onOpenOptions,
  isStandalone = false,
}) => {
  const { message: antMessage } = App.useApp();
  const {
    config,
    updateConfig,
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    createNewSession,
    addMessageToActiveSession,
    updateLastAssistantMessage,
    regenerateMessageInActiveSession,
    switchMessageVersion,
    toggleStarSession,
    deleteSession,
    updateSessionTitle,
    clearAllSessions,
    prompts,
    addPrompt,
    updatePrompt,
    deletePrompt,
    activeAttachments,
    addAttachment,
    removeAttachment,
    setActiveAttachments,
    availableTabs,
    toggleTabSelection,
  } = useExtensionStore();

  const [inputPrompt, setInputPrompt] = useState('');
  const [slashOpen, setSlashOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [promptManagerOpen, setPromptManagerOpen] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chrome.storage.local.get('onboardingComplete').then((result) => {
      setOnboardingComplete(result.onboardingComplete !== false);
    });
  }, []);

  const handleOnboardingComplete = () => {
    chrome.storage.local.set({ onboardingComplete: true });
    setOnboardingComplete(true);
  };

  useEffect(() => {
    if (!activeSession) {
      createNewSession();
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeSession?.messages, isGenerating]);

  const getMessageFontSizeClass = (size?: string) => {
    switch (size) {
      case 'Small':
        return 'text-xs';
      case 'Large':
        return 'text-base';
      case 'Regular':
      case 'Auto':
      default:
        return 'text-sm';
    }
  };

  const handleSend = async (overridePrompt?: string) => {
    const textToSend = overridePrompt || inputPrompt;
    if (!textToSend.trim() && activeAttachments.length === 0) return;

    if (!activeSession) {
      createNewSession();
    }
    const currentSession = activeSession;
    if (!currentSession) return;

    const currentAttachments = [...activeAttachments];

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
      versions: ['1/1'],
      currentVersionIndex: 0,
      followups: [
        'What are the core components of critical thinking?',
        'Can you provide a practical workplace example?',
      ]
    };

    addMessageToActiveSession(userMessage);
    addMessageToActiveSession(assistantMessage);
    setInputPrompt('');
    setActiveAttachments([]);
    setIsGenerating(true);

    abortControllerRef.current = new AbortController();

    await streamChatResponse({
      messages: [...currentSession.messages, userMessage],
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

  const handleScreenCut = () => {
    antMessage.loading({ content: 'Capturing screen snippet...', key: 'screencut', duration: 1 });
    setTimeout(() => {
      addAttachment({
        id: 'cut_' + Date.now(),
        type: 'screen_cut',
        title: 'Screen snippet (Captured)',
        thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
      });
      antMessage.success({ content: 'Screen snippet attached!', key: 'screencut' });
    }, 1000);
  };

  const handleQuoteText = (text: string) => {
    if (activeAttachments.some(a => a.type === 'quote' && a.content === text)) {
      antMessage.info('This text is already quoted in composer');
      return;
    }
    addAttachment({
      id: 'quote_' + Date.now(),
      type: 'quote',
      title: 'Quoted Text',
      content: text,
    });
    antMessage.success('Text quoted into composer');
  };

  const handleSelectPrompt = (p: PromptItem) => {
    setInputPrompt(prev => {
      const cleaned = prev.replace(/\/$/, '').trim();
      return cleaned ? `${cleaned} ${p.content}` : p.content;
    });
    setSlashOpen(false);
  };

  if (onboardingComplete === null) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-zinc-900">
        <div className="text-zinc-400 text-sm">Loading workspace…</div>
      </div>
    );
  }

  if (onboardingComplete === false) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-zinc-900">
        <OnboardingWizard open={true} onComplete={handleOnboardingComplete} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 font-sans relative overflow-hidden select-none">
      {/* Header Toolbar */}
      {!isStandalone && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200/60 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            {/* Extension Avatar */}
            <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center border border-zinc-200/80 dark:border-zinc-700/80 shadow-xs">
              <NowPilotAvatar className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">NowPilot</span>
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            {/* Open Options */}
            <Tooltip title="Options">
              <button
                onClick={onOpenOptions}
                className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer text-xs flex items-center justify-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 60 60"><path fill="currentColor" fillRule="evenodd" d="M24.455 4.367h11.089c2.682 0 4.536-.002 6.236.55a11.25 11.25 0 0 1 4.051 2.34c1.329 1.196 2.255 2.802 3.595 5.125l.18.31 5.185 8.983.18.31c1.342 2.322 2.269 3.927 2.64 5.676a11.25 11.25 0 0 1 0 4.678c-.371 1.749-1.298 3.354-2.64 5.676l-.18.31-5.186 8.983-.179.31c-1.34 2.323-2.266 3.929-3.595 5.125a11.25 11.25 0 0 1-4.05 2.34c-1.701.552-3.555.55-6.236.55h-11.09c-2.682 0-4.535.002-6.235-.55a11.25 11.25 0 0 1-4.052-2.34c-1.328-1.196-2.254-2.802-3.594-5.125l-.18-.31-5.186-8.983-.18-.31c1.341-2.322-2.268-3.927-2.64-5.676a11.25 11.25 0 0 1 0-4.678c.372-1.749 1.299-3.354 2.64-5.676l.18-.31 5.186-8.983.18-.31c1.34-2.323 2.266-3.929 3.594-5.125a11.25 11.25 0 0 1 4.052-2.34c1.7-.552 3.553-.55 6.235-.55m.359 4.5c-3.18 0-4.268.026-5.204.33a6.75 6.75 0 0 0-2.43 1.404c-.732.659-1.298 1.587-2.889 4.341l-5.186 8.983c1.59 2.754-2.11 3.709-2.315 4.672a6.75 6.75 0 0 0 0 2.806c.204.963.725 1.918 2.315 4.672l5.186 8.983c1.59 2.754 2.157 3.682 2.888 4.34a6.75 6.75 0 0 0 2.431 1.404c.936.304 2.023.33 5.204.33h10.372c3.18 0 4.267-.026 5.203-.33A6.75 6.75 0 0 0 42.82 49.4c.732-.659 1.298-1.587 2.888-4.341l5.186-8.983c1.59-2.754 2.111-3.709 2.316-4.672a6.75 6.75 0 0 0 0-2.806c-.205-.963-.725-1.918-2.316-4.672l-5.186-8.983c-1.59-2.754-2.156-3.682-2.888-4.34a6.75 6.75 0 0 0-2.43-1.404c-.937-.305-2.023-.33-5.204-.33zM30 21.75a8.25 8.25 0 1 0 0 16.5 8.25 8.25 0 0 0 0-16.5M17.25 30c0-7.042 5.708-12.75 12.75-12.75S42.75 22.958 42.75 30 37.04 42.75 30 42.75 17.25 37.042 17.25 30" clipRule="evenodd"></path></svg>
              </button>
            </Tooltip>
            {/* Open Standalone Workspace */}
            <Tooltip title="Full page">
              <button
                onClick={onOpenStandalone}
                className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer text-xs flex items-center justify-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 14 14"><path fill="currentColor" d="M4.762 3.362a.525.525 0 0 1 .743.743L2.609 7l2.896 2.895a.525.525 0 1 1-.743.743L1.825 7.7a.99.99 0 0 1 0-1.402zm4.476 0a.525.525 0 0 0-.743.743L11.391 7 8.495 9.895a.525.525 0 0 0 .743.743L12.175 7.7a.99.99 0 0 0 0-1.402z"></path></svg>
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Chat Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-3 space-y-4">
        {!activeSession || activeSession.messages.length === 0 ? (
          /* Welcome View */
          <div className="flex flex-col justify-center items-start min-h-[320px] pt-8">
            <Title level={2} className="!mb-1 font-bold text-3xl tracking-tight text-zinc-900 dark:text-zinc-100">
              Hi,
            </Title>
            <Title level={4} className="!mt-0 !mb-6 font-semibold text-zinc-700 dark:text-zinc-300">
              How can I assist you today?
            </Title>

            {/* Quick Action Pills */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs mb-8">
              <button
                onClick={onOpenStandalone}
                className="flex items-center gap-2 p-2.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 rounded-xl border border-zinc-200/70 dark:border-zinc-700/70 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer transition-all shadow-2xs"
              >
                <ExpandOutlined className="text-violet-500 text-sm" />
                <span>Full Screen Chat</span>
              </button>

              <button
                onClick={() => handleSend('Perform Deep Research analysis on active page context')}
                className="flex items-center gap-2 p-2.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 rounded-xl border border-zinc-200/70 dark:border-zinc-700/70 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer transition-all shadow-2xs"
              >
                <CompassOutlined className="text-indigo-500 text-sm" />
                <span>Deep Research</span>
              </button>

              <button
                onClick={() => handleSend('Extract key highlights from this webpage')}
                className="flex items-center gap-2 p-2.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 rounded-xl border border-zinc-200/70 dark:border-zinc-700/70 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer transition-all shadow-2xs"
              >
                <HighlightOutlined className="text-amber-500 text-sm" />
                <span>My Highlights</span>
              </button>

              <button
                onClick={() => handleSend('Generate an AI slides outline for this topic')}
                className="flex items-center gap-2 p-2.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 rounded-xl border border-zinc-200/70 dark:border-zinc-700/70 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer transition-all shadow-2xs"
              >
                <FilePptOutlined className="text-emerald-500 text-sm" />
                <span>AI Slides</span>
              </button>
            </div>
          </div>
        ) : (
          /* Active Conversation Messages */
          (() => {
            if (!activeSession) return null;
            const lastAiMessageId = [...activeSession.messages].reverse().find(m => m.role === 'assistant')?.id;

            return activeSession.messages.map((msg, index) => {
              if (msg.role === 'user') {
                const isEditingThis = editingMsgId === msg.id;

                return (
                  <div key={msg.id} className="group flex flex-col items-end my-2.5 w-full">
                    <div className="max-w-[85%] w-fit">
                      {isEditingThis ? (
                        <div className="bg-zinc-100 dark:bg-zinc-800 p-2.5 rounded-2xl border border-violet-400 dark:border-violet-500 shadow-xs w-full">
                          <textarea
                            value={editingText}
                            onChange={e => setEditingText(e.target.value)}
                            className={`w-full bg-transparent border-none outline-none resize-none text-zinc-800 dark:text-zinc-100 font-sans ${getMessageFontSizeClass(config.fontSize)}`}
                            rows={2}
                            autoFocus
                          />
                          <div className="flex justify-end gap-1.5 mt-1.5">
                            <button
                              onClick={() => setEditingMsgId(null)}
                              className="px-2 py-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-md text-[11px] font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                if (editingText.trim()) {
                                  setEditingMsgId(null);
                                  handleSend(editingText.trim());
                                }
                              }}
                              className="px-2 py-1 bg-violet-600 text-white rounded-md text-[11px] font-semibold hover:bg-violet-700 cursor-pointer"
                            >
                              Save & Submit
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={`px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-2xl rounded-tr-xs font-normal leading-relaxed shadow-xs ${getMessageFontSizeClass(config.fontSize)}`}>
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mb-2 space-y-1">
                              {msg.attachments.map(att => (
                                <div key={att.id} className="text-[11px] bg-white/70 dark:bg-zinc-900/70 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 truncate">
                                  <PaperClipOutlined className="mr-1" />{att.title}
                                </div>
                              ))}
                            </div>
                          )}
                          <div>{msg.content}</div>
                        </div>
                      )}
                    </div>

                    {!isEditingThis && (
                      <ActionPanel
                        type="user"
                        content={msg.content}
                        onEdit={() => {
                          setEditingMsgId(msg.id);
                          setEditingText(msg.content);
                        }}
                        onQuote={handleQuoteText}
                        onShare={(text) => {
                          navigator.clipboard.writeText(text);
                          antMessage.success('Link copied to clipboard');
                        }}
                      />
                    )}
                  </div>
                );
              }

              const isLatestAI = msg.id === lastAiMessageId;
              const versions = msg.versions && msg.versions.length > 0 ? msg.versions : [msg.content];
              const currentVersionIdx = msg.currentVersionIndex ?? (versions.length - 1);

              return (
                <div key={msg.id} className="group flex flex-col items-start my-3 w-full">
                  {/* Assistant Name Header */}
                  <div className="flex items-center justify-between w-full mb-1.5 px-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center border border-zinc-200/80 dark:border-zinc-700/80 shadow-2xs">
                        <NowPilotAvatar className="w-full h-full object-cover" />
                      </div>
                      <span className="px-2 py-0.5 bg-[#6d3e23] text-white dark:bg-amber-900/90 dark:text-amber-100 rounded-md text-[11px] font-semibold tracking-tight shadow-2xs">
                        NowPilot
                      </span>
                    </div>

                    {/* Counter < 1/X > - ONLY shown when versions.length > 1 */}
                    {versions.length > 1 && (
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-full select-none border border-zinc-200/60 dark:border-zinc-700/60">
                        <button
                          type="button"
                          onClick={() => switchMessageVersion(msg.id, -1)}
                          disabled={currentVersionIdx <= 0}
                          className="hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold px-0.5 transition-colors"
                          title="Previous version"
                        >
                          &lt;
                        </button>
                        <span>
                          {currentVersionIdx + 1}/{versions.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => switchMessageVersion(msg.id, 1)}
                          disabled={currentVersionIdx >= versions.length - 1}
                          className="hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold px-0.5 transition-colors"
                          title="Next version"
                        >
                          &gt;
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Model Name Indicator above Thought process */}
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 font-medium my-0.5">
                    <span className="text-violet-500 text-xs">⚡</span>
                    <span>{msg.model || config.selectedModel}</span>
                  </div>

                  {/* Reasoning Thought Block */}
                  <ThoughtProcessBlock
                    thoughtText={msg.thoughtProcess || 'Thinking Process:\n\n1. **Analyze the Request**: Analyzing user prompt intent and context parameters.\n2. **Determine Identity and Context**: Scanning connected tabs and environment context.\n3. **Recall Core Knowledge**: Synthesizing optimal step-by-step resolution.\n4. **Formulate Response Strategy**:\n   - Structure explanation clearly\n   - Highlight key actionable takeaways\n5. **Draft Response & Refine**: Verifying accuracy before output generation.'}
                    isThinking={msg.isThinking}
                  />

                  {/* AI Text Response Body */}
                  <div className={`w-full leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap font-normal ${getMessageFontSizeClass(config.fontSize)}`}>
                    {msg.content}
                  </div>

                  {/* Action Panel */}
                  {!msg.isThinking && (
                    <>
                      <ActionPanel
                        type="ai"
                        content={msg.content}
                        isLatest={isLatestAI}
                        onRegenerate={() => regenerateMessageInActiveSession(msg.id)}
                        onQuote={handleQuoteText}
                        onSaveToNote={() => {
                          antMessage.success('Saved snippet to Notes');
                        }}
                        onShare={(text) => {
                          navigator.clipboard.writeText(text);
                          antMessage.success('Link copied to clipboard');
                        }}
                      />
                      {isLatestAI && (
                        <FollowupSuggestions
                          suggestions={msg.followups}
                          onSelectSuggestion={(s) => handleSend(s)}
                          onDeepResearch={() => handleSend('Go further with deep research')}
                        />
                      )}
                    </>
                  )}
                </div>
              );
            });
          })()
        )}

        {/* Floating Stop Generating Button */}
        {isGenerating && (
          <div className="flex justify-center my-2">
            <button
              onClick={handleStopGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 rounded-full text-xs font-semibold shadow-md hover:opacity-90 transition-opacity cursor-pointer"
            >
              <StopOutlined />
              <span>Stop generating</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Composer Bar (<Sender>) */}
      <div className="p-3 border-t border-zinc-100 dark:border-zinc-800/80 bg-white dark:bg-zinc-900">
        {/* Upper Controls Bar: Model selector, Attach folder, History, New Chat */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ModelSelector
              selectedModelId={config.selectedModel}
              onSelectModel={(m) => updateConfig({ selectedModel: m })}
            />
            <TabContextSelector
              availableTabs={availableTabs}
              onToggleTab={toggleTabSelection}
              onSelectScreenCut={handleScreenCut}
              onAddAttachment={addAttachment}
              onOpenPromptManager={() => setPromptManagerOpen(true)}
              hideTabs={isStandalone}
            />
          </div>

          <div className="flex items-center gap-1">
            <Tooltip title="Chat History">
              <button
                onClick={() => setHistoryOpen(true)}
                className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-300 text-xs cursor-pointer transition-colors flex items-center justify-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16">
                  <g fill="currentColor">
                    <path d="M8.6 4.667a.6.6 0 0 0-1.2 0v3.448l2.976 2.976a.6.6 0 0 0 .848-.848L8.6 7.617z"></path>
                    <path fillRule="evenodd" d="M8 .733a7.267 7.267 0 1 0 0 14.534A7.267 7.267 0 0 0 8 .733M1.933 8a6.067 6.067 0 1 1 12.134 0A6.067 6.067 0 0 1 1.933 8" clipRule="evenodd"></path>
                  </g>
                </svg>
              </button>
            </Tooltip>

            <Tooltip title="New Chat">
              <button
                onClick={createNewSession}
                className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-violet-600 dark:text-violet-400 cursor-pointer transition-colors flex items-center justify-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16" className="text-violet-600 dark:text-violet-400">
                  <path fill="currentColor" d="M10.319 1.133H5.681c-.65 0-1.175 0-1.6.035-.437.036-.821.111-1.176.292a3 3 0 0 0-1.311 1.311c-.181.356-.257.74-.293 1.177-.034.425-.034.95-.034 1.6v8.134c0 .206 0 .4.014.557.015.164.051.38.188.578.177.255.45.426.757.473.238.037.449-.026.602-.084.149-.056.322-.14.507-.231l1.2-.585c.41-.2.566-.274.725-.327a2.7 2.7 0 0 1 .46-.106c.165-.022.338-.024.795-.024h3.804c.65 0 1.175 0 1.6-.034.437-.036.82-.112 1.176-.293a3 3 0 0 0 1.311-1.31c.181-.356.257-.74.293-1.178.034-.424.034-.949.034-1.599V5.548c0-.65 0-1.175-.034-1.6-.036-.437-.112-.821-.293-1.177a3 3 0 0 0-1.31-1.31c-.356-.182-.74-.257-1.178-.293-.424-.035-.949-.035-1.599-.035" />
                  <path fill="#fff" d="M8.6 4.533a.6.6 0 0 0-1.2 0v2.334H5.067a.6.6 0 0 0 0 1.2H7.4V10.4a.6.6 0 1 0 1.2 0V8.067h2.334a.6.6 0 0 0 0-1.2H8.6z" />
                </svg>
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Input Box Frame with Slash Command Modal */}
        <SlashCommandModal
          prompts={prompts}
          onSelectPrompt={handleSelectPrompt}
          onOpenPromptManager={() => setPromptManagerOpen(true)}
          open={slashOpen}
          onOpenChange={setSlashOpen}
        >
          <div className="p-2.5 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-xs flex flex-col focus-within:border-violet-500 transition-colors">
            {/* Pinned Tabs Bar */}
            {!isStandalone && (
              <PinnedTabsBar
                pinnedTabs={availableTabs.filter(t => t.selected)}
                onUnpinTab={toggleTabSelection}
              />
            )}

            {/* Active Attachments Bar */}
            <AttachmentBar
              attachments={activeAttachments}
              onRemove={removeAttachment}
            />

            {/* Prompt Quick Chips toolbar inside composer - shown when a tab is pinned (in sidepanel mode), or when file is attached or text quoted */}
            {((!isStandalone && availableTabs.some(t => t.selected)) || activeAttachments.length > 0) && (
              <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1 text-xs scrollbar-none">
                {['For YouTube', 'Summarize', 'Explain'].map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInputPrompt(prev => prev + (prev ? ' ' : '') + chip)}
                    className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700/70 dark:hover:bg-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-200 font-medium whitespace-nowrap cursor-pointer transition-colors text-[11px] shrink-0"
                  >
                    {chip}
                  </button>
                ))}

                <SlashCommandModal
                  prompts={prompts}
                  onSelectPrompt={handleSelectPrompt}
                  onOpenPromptManager={() => setPromptManagerOpen(true)}
                />
              </div>
            )}

            {/* Textarea Input */}
            <textarea
              value={inputPrompt}
              onChange={e => {
                const val = e.target.value;
                setInputPrompt(val);
                if (val.includes('/')) {
                  setSlashOpen(true);
                } else {
                  setSlashOpen(false);
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask anything, @ models, / prompts"
              rows={2}
              className="w-full bg-transparent border-none outline-none resize-none text-xs text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 font-sans"
            />

            {/* Send Button */}
            <div className="flex justify-end mt-1">
              <Tooltip title="Send message (Enter)">
                <button
                  onClick={() => handleSend()}
                  disabled={!inputPrompt.trim() && activeAttachments.length === 0}
                  className={`p-2 rounded-xl transition-all cursor-pointer ${
                    inputPrompt.trim() || activeAttachments.length > 0
                      ? 'bg-violet-600 text-white shadow-xs hover:bg-violet-700'
                      : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-300 dark:text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  <SendOutlined className="text-xs" />
                </button>
              </Tooltip>
            </div>
          </div>
        </SlashCommandModal>

        {/* Footer Info Line */}
        <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-zinc-400">
          <span className="font-medium text-zinc-500 dark:text-zinc-400">
            {(() => {
              const selectedModelObj = AVAILABLE_MODELS.find(m => m.id === config.selectedModel) || AVAILABLE_MODELS[0];
              if (selectedModelObj) {
                if (selectedModelObj.group === 'Google Gemini' || selectedModelObj.provider === 'gemini') return 'Gemini';
                if (selectedModelObj.group) return selectedModelObj.group;
              }
              return 'OpenAI';
            })()}
          </span>
          <div className="flex items-center gap-2">
            <Tooltip title="Help center">
              <button className="hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer">
                <QuestionCircleOutlined />
              </button>
            </Tooltip>
            <Tooltip title="Feedback">
              <button className="hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer">
                <MailOutlined />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* History Modal */}
      <ChatHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onToggleStar={toggleStarSession}
        onDeleteSession={deleteSession}
        onUpdateTitle={updateSessionTitle}
        onClearAll={clearAllSessions}
      />

      {/* Prompt Manager Modal */}
      <PromptManagerModal
        open={promptManagerOpen}
        onClose={() => setPromptManagerOpen(false)}
        prompts={prompts}
        onAddPrompt={addPrompt}
        onUpdatePrompt={updatePrompt}
        onDeletePrompt={deletePrompt}
      />
    </div>
  );
};

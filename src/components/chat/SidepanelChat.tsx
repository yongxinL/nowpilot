import React, { useState, useRef, useEffect } from 'react';
import { App, Tooltip, theme } from 'antd';
import { StopOutlined, DownOutlined } from '@ant-design/icons';

import { OnboardingModal } from '../OnboardingModal';
import { ChatHistoryModal } from '../history/ChatHistoryModal';
import { PromptManagerModal } from '../common/PromptManagerModal';

import { ChatHeader } from './ChatHeader';
import { ChatMessageList } from './ChatMessageList';
import { ChatComposer } from './ChatComposer';
import { ChatExportBar } from './ChatExportBar';
import { useChatStreaming } from './useChatStreaming';
import { MirrorBanner } from '../common/MirrorBanner';

import { useExtensionStore } from '../../store/useExtensionStore';
import { useWorkspaceStore } from '../../core/workspace/WorkspaceStore';
import { onWorkspaceSync } from '../../core/workspace/WorkspaceSync';
import { PromptItem } from '../../types';

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
  const { token } = theme.useToken();

  const {
    config,
    updateConfig,
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    createNewSession,
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
    saveTextAsNote,
  } = useExtensionStore();

  const { isGenerating, handleSend: streamSend, handleStopGenerating } = useChatStreaming();

  const [inputPrompt, setInputPrompt] = useState('');
  const [slashOpen, setSlashOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [promptManagerOpen, setPromptManagerOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSelectedMsgIds, setExportSelectedMsgIds] = useState<string[]>([]);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number>(() => typeof window !== 'undefined' ? window.innerWidth : 400);
  // D-05 / REQ-F05: read-only mirror state — set true on WORKSPACE_HANDOFF
  // from the Standalone view, cleared by the user clicking "Refocus here"
  // inside MirrorBanner.
  const [mirrored, setMirrored] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mainContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect?.width) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(mainContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const checkScrollPosition = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isOverPage = scrollHeight > clientHeight + 40;
    const isNotAtBottom = scrollHeight - scrollTop - clientHeight > 40;
    setShowScrollBottom(isOverPage && isNotAtBottom);
  };

  const handleScroll = () => {
    checkScrollPosition();
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
      setTimeout(checkScrollPosition, 250);
    }
  };

  const handleStartExportSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    const storeSessions = useExtensionStore.getState().sessions;
    const session = storeSessions.find((s) => s.id === sessionId) || sessions.find((s) => s.id === sessionId);
    if (session) {
      setExportSelectedMsgIds(session.messages.map((m) => m.id));
    } else {
      setExportSelectedMsgIds([]);
    }
    setIsExporting(true);
  };

  const handlePerformExport = (format: 'txt' | 'json') => {
    if (!activeSession) return;
    const selectedMsgs = activeSession.messages.filter((m) => exportSelectedMsgIds.includes(m.id));
    if (selectedMsgs.length === 0) {
      antMessage.warning('Please select at least one message to export');
      return;
    }

    if (format === 'json') {
      const dataStr = JSON.stringify(selectedMsgs, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeSession.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'chat'}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const textContent = selectedMsgs
        .map((m) => `[${m.role === 'user' ? 'User' : 'NowPilot'}]:\n${m.content}\n`)
        .join('\n---\n\n');
      const blob = new Blob([textContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeSession.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'chat'}-export.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
    antMessage.success(`Exported ${selectedMsgs.length} message(s) as ${format.toUpperCase()}`);
  };

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.get('onboardingComplete').then((result) => {
        const isComplete = result.onboardingComplete === true;
        setOnboardingComplete(isComplete);
        if (!isComplete) {
          setOnboardingOpen(true);
        }
      });
    } else {
      const val = localStorage.getItem('onboardingComplete');
      const isComplete = val === 'true';
      setOnboardingComplete(isComplete);
      if (!isComplete) {
        setOnboardingOpen(true);
      }
    }
  }, []);

  const handleOnboardingComplete = () => {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.set({ onboardingComplete: true });
    } else {
      localStorage.setItem('onboardingComplete', 'true');
    }
    setOnboardingComplete(true);
    setOnboardingOpen(false);
  };

  // REQ-F19: Skip keeps `onboardingComplete=false` so the modal
  // re-triggers on next Side Panel open — it does NOT permanently
  // dismiss itself. This is the explicit distinction between
  // OnboardingModal's `onSkip` (close only) and `onComplete`
  // (close + mark complete).
  const handleOnboardingSkip = () => {
    setOnboardingOpen(false);
    // Do NOT set onboardingComplete=true — leave it false so the
    // storage-read effect at lines ~162-179 reopens the modal on the
    // next Side Panel mount.
  };

  // D-05 / REQ-F05: subscribe to WORKSPACE_HANDOFF so the Side Panel can
  // demote to a read-only mirror when the Standalone view takes primary
  // authorship. Only matches when the broadcast carries the same
  // workspaceId — a stale handoff for a different workspace must NOT
  // invoke mirror mode here.
  useEffect(() => {
    const unsubscribe = onWorkspaceSync((msg) => {
      if (msg.type !== 'WORKSPACE_HANDOFF') return;
      const localWsId = useWorkspaceStore.getState().workspaceId;
      if (msg.workspaceId === localWsId) {
        setMirrored(true);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!activeSession) {
      createNewSession();
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    const timer = setTimeout(checkScrollPosition, 100);
    return () => clearTimeout(timer);
  }, [activeSession?.messages, isGenerating]);

  const getMessageFontSizeClass = (size?: string) => {
    const effective = size || 'Auto';
    if (effective === 'Small') {
      return 'message-font-small';
    }
    if (effective === 'Large') {
      return 'message-font-large';
    }
    if (effective === 'Regular') {
      return 'message-font-regular';
    }
    // Auto: Auto adjust according to sidebar/container width
    if (containerWidth < 420) {
      return 'message-font-small';
    }
    if (containerWidth < 768) {
      return 'message-font-regular';
    }
    return 'message-font-regular';
  };

  const handleSend = (overridePrompt?: string) => {
    const textToSend = overridePrompt || inputPrompt;
    streamSend(textToSend, activeAttachments, () => {
      setInputPrompt('');
      setActiveAttachments([]);
    });
  };

  const handleScreenCut = () => {
    antMessage.loading({ content: 'Capturing screen snippet...', key: 'screencut', duration: 1 });
    setTimeout(() => {
      addAttachment({
        id: 'cut_' + Date.now(),
        type: 'screen_cut',
        title: 'Screen snippet (Captured)',
      });
      antMessage.success({ content: 'Screen snippet attached!', key: 'screencut' });
    }, 1000);
  };

  const handleQuoteText = (text: string) => {
    if (activeAttachments.some((a) => a.type === 'quote' && a.content === text)) {
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
    setInputPrompt((prev) => {
      const cleaned = prev.replace(/\/$/, '').trim();
      return cleaned ? `${cleaned} ${p.content}` : p.content;
    });
    setSlashOpen(false);
  };

  if (onboardingComplete === null) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          background: token.colorBgContainer,
        }}
      >
        <div style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>Loading workspace…</div>
      </div>
    );
  }

  return (
    <div
      ref={mainContainerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: token.colorBgContainer,
        color: token.colorText,
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Header Toolbar */}
      {!isStandalone && (
        <ChatHeader
          onOpenOptions={onOpenOptions}
          onOpenStandalone={onOpenStandalone}
          onOpenOnboarding={() => setOnboardingOpen(true)}
        />
      )}

      {/* D-05: Mirror banner appears between header and message area when
          the Side Panel has been demoted to a read-only mirror after
          WORKSPACE_HANDOFF. The Standalone surface never renders this —
          Standalone IS the primary surface. */}
      {!isStandalone && mirrored && (
        <MirrorBanner onRefocus={() => setMirrored(false)} />
      )}

      {/* Main Chat Flow Container */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          maxWidth: isStandalone ? 768 : undefined,
          marginLeft: isStandalone ? 'auto' : undefined,
          marginRight: isStandalone ? 'auto' : undefined,
          width: '100%',
        }}
      >
        <div
          style={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Chat Messages Area */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={{
              flex: 1,
              overflowY: 'auto',
              paddingLeft: 14,
              paddingRight: 14,
              paddingTop: 12,
              paddingBottom: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <ChatMessageList
              activeSession={activeSession}
              isStandalone={isStandalone}
              fontSizeClass={getMessageFontSizeClass(config.fontSize)}
              isExporting={isExporting}
              exportSelectedMsgIds={exportSelectedMsgIds}
              onToggleExportSelect={(msgId, selected) => {
                setExportSelectedMsgIds((prev) =>
                  selected ? [...prev, msgId] : prev.filter((id) => id !== msgId)
                );
              }}
              editingMsgId={editingMsgId}
              editingText={editingText}
              onStartEdit={(msgId, content) => {
                setEditingMsgId(msgId);
                setEditingText(content);
              }}
              onCancelEdit={() => setEditingMsgId(null)}
              onChangeEditText={setEditingText}
              onSubmitEdit={(text) => {
                setEditingMsgId(null);
                handleSend(text);
              }}
              onQuoteText={handleQuoteText}
              onRegenerate={(msgId) => regenerateMessageInActiveSession(msgId)}
              onSwitchVersion={(msgId, delta) => switchMessageVersion(msgId, delta)}
              onSaveToNote={(text) => {
                saveTextAsNote(text);
                antMessage.success('Saved to Notes');
              }}
              onShare={(text) => {
                navigator.clipboard.writeText(text);
                antMessage.success('Link copied to clipboard');
              }}
              onSend={handleSend}
              onCreateNewSession={createNewSession}
              onOpenStandalone={onOpenStandalone}
            />

            {/* Floating Stop Generating Button (Screenshots 1 & 2) */}
            {isGenerating && (
              <div
                style={{
                  position: 'sticky',
                  bottom: 8,
                  display: 'flex',
                  justifyContent: 'center',
                  zIndex: 30,
                  marginTop: 8,
                  marginBottom: 8,
                  pointerEvents: 'auto',
                }}
              >
                <button
                  type="button"
                  onClick={handleStopGenerating}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    paddingLeft: 14,
                    paddingRight: 14,
                    paddingTop: 6,
                    paddingBottom: 6,
                    background: 'var(--card)',
                    color: 'var(--muted-foreground)',
                    border: '1px solid var(--border)',
                    borderRadius: 9999,
                    fontSize: 12,
                    fontWeight: 500,
                    boxShadow: '0 4px 8px rgba(0,0,0,0.12)',
                    transition: 'all 200ms ease',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      background: 'var(--foreground)',
                      borderRadius: 2,
                      display: 'inline-block',
                    }}
                  />
                  <span>Stop generating</span>
                </button>
              </div>
            )}
          </div>

          {/* Floating Goto bottom button */}
          {showScrollBottom && (
            <div
              className="np-fade-in"
              style={{
                position: 'absolute',
                bottom: 10,
                right: 16,
                zIndex: 20,
                pointerEvents: 'auto',
                transition: 'all 200ms ease',
              }}
            >
              <Tooltip title="Scroll to bottom" placement="left">
                <button
                  type="button"
                  onClick={scrollToBottom}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9999,
                    background: 'var(--card)',
                    color: 'var(--muted-foreground)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 200ms ease',
                    cursor: 'pointer',
                    backdropFilter: 'blur(4px)',
                  }}
                  aria-label="Goto bottom"
                >
                  <DownOutlined style={{ fontSize: 12 }} />
                </button>
              </Tooltip>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Composer Area */}
      <div
        style={
          isStandalone
            ? {
                padding: 16,
                paddingTop: 0,
                background: 'transparent',
                maxWidth: 768,
                width: '100%',
                marginLeft: 'auto',
                marginRight: 'auto',
              }
            : {
                padding: 12,
                paddingTop: 0,
                background: 'transparent',
              }
        }
      >
        {isExporting ? (
          <ChatExportBar
            activeSession={activeSession}
            exportSelectedMsgIds={exportSelectedMsgIds}
            onToggleSelectAll={(selectAll) => {
              if (!activeSession) return;
              setExportSelectedMsgIds(selectAll ? activeSession.messages.map((m) => m.id) : []);
            }}
            onExitExport={() => setIsExporting(false)}
            onPerformExport={handlePerformExport}
          />
        ) : (
          <ChatComposer
            config={config}
            onUpdateConfig={updateConfig}
            isStandalone={isStandalone}
            disabled={mirrored}
            inputPrompt={inputPrompt}
            onChangeInputPrompt={setInputPrompt}
            onSend={handleSend}
            slashOpen={slashOpen}
            onOpenSlashChange={setSlashOpen}
            prompts={prompts}
            onSelectPrompt={handleSelectPrompt}
            availableTabs={availableTabs}
            onToggleTabSelection={toggleTabSelection}
            activeAttachments={activeAttachments}
            onRemoveAttachment={removeAttachment}
            onAddAttachment={addAttachment}
            onScreenCut={handleScreenCut}
            onOpenPromptManager={() => setPromptManagerOpen(true)}
            onOpenHistory={() => setHistoryOpen(true)}
            onCreateNewSession={createNewSession}
            onOpenOnboarding={() => setOnboardingOpen(true)}
            onOpenFeedback={() => antMessage.info('Feedback support opened')}
          />
        )}
      </div>

      {/* Onboarding Modal (D-01/D-02/D-03, REQ-F19) — thin 4-step modal
          matching 01-UI-SPEC's copy verbatim. Same two-prop contract
          plus an explicit onSkip for the "Skip for now" path (keeps
          onboardingComplete=false so the modal re-triggers on next
          Side Panel open). */}
      <OnboardingModal
        open={onboardingOpen}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />

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
        onStartExport={handleStartExportSession}
        isStandalone={isStandalone}
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

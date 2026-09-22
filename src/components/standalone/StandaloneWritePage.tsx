import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Tooltip, App } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { WriteHistoryDrawer } from './WriteHistoryDrawer';
import { WriteInputPanel } from './WriteInputPanel';
import { WriteOutputPanel } from './WriteOutputPanel';
import { WritePromptModal } from './WritePromptModal';
import { WriteHistoryItem, PromptItem } from '../../types';
import { DeferredNotice } from '../common/DeferredNotice';
import { useHandoffComposerDraftStore } from '../../core/workspace/handoff/composerDraft';
import { t } from '../../core/i18n/strings';

/** The canonical non-interactive workflow display (UI-SPEC § Composer control). */
const WORKFLOW_DISPLAY_LABEL = 'Auto';

/**
 * Generation is a later-phase provider operation, so this page never reports an
 * in-flight generation state to the input panel.
 */
const IS_GENERATING = false;

interface StandaloneWritePageProps {
  onOpenOptions?: () => void;
}

const DEFAULT_WRITE_PROMPTS = [
  'Essay',
  'Paragraph',
  'Email',
  'Idea',
  'Blog Post',
  'Outline',
  'Marketing Ads',
  'Comment',
  'Message',
  'Twitter',
];

const DEFAULT_REPLY_PROMPTS = [
  'Comment',
  'Message',
  'Twitter',
  'Email',
  'Paragraph',
  'Idea',
  'Blog Post',
  'Outline',
];

const INITIAL_WRITE_OUTPUT = `The Imperative of Accuracy: Addressing Discrepancy

The statement, "This is wrong page," transcends a simple declaration of error; it signifies a critical breach in contextual integrity. In any system, whether digital or conceptual, the accurate identification of a resource is fundamental to effective communication and successful navigation. When a page is misidentified, the immediate consequence is a disruption of the intended flow—a failure to deliver the required information or direct the user to the correct solution.

Such discrepancies introduce friction into the process. They challenge the user's trust in the system's reliability and demand immediate attention toward rectification. The error is not merely a typographical mistake, but a failure in the indexing or routing mechanism, which undermines the coherence of the entire structure. It highlights a vulnerability where the expected pathway diverges from the actual location, creating confusion and inefficiency.

Therefore, acknowledging that a page is incorrect is not merely an observation of failure, but a call for immediate corrective action. It serves as a vital signal that the established parameters have been violated. By promptly recognizing and addressing such errors, we uphold standards of precision and ensure that the intended objective—be it information retrieval, data processing, or user guidance—is achieved without delay or misdirection. The pursuit of accuracy is thus paramount to maintaining functional integrity.`;

export const StandaloneWritePage: React.FC<StandaloneWritePageProps> = ({ onOpenOptions }) => {
  const { message: antMessage } = App.useApp();
  // D-16 `fixture-preview` (owning roadmap phase 17): the preserved Write
  // presentation renders deterministic local fixtures only. Provider
  // generation, prompt persistence and the durable write history are
  // later-phase capabilities, so nothing here reaches a store, a provider or
  // the network — the custom prompt list lives in component state.
  const [customPrompts, setCustomPrompts] = useState<PromptItem[]>([]);

  // Mode: 'write' | 'reply'
  const [activeTab, setActiveTab] = useState<'write' | 'reply'>('write');

  // Selected format prompt - Default to Essay for write, Comment for reply
  const [selectedFormat, setSelectedFormat] = useState<string>('Essay');

  // Settings: Tone/Style, Length, Language (Default: Formal · Short · English)
  const [tone, setTone] = useState<string>('Formal');
  const [length, setLength] = useState<string>('Short');
  const [language, setLanguage] = useState<string>('English');

  // Inputs
  // WR-07 / D-13: the composer the workspace handoff carries a draft into. The
  // target's `apply` adapter writes the projection's `composerDraft` to the
  // in-memory slot, and the composer consumes it here — the field used to be
  // validated and then dropped. A handoff with no draft (the Phase-1 Side Panel
  // has no composer to type into) leaves this page's own content untouched.
  const handoffDraft = useHandoffComposerDraftStore((state) => state.draft);
  const [writeInput, setWriteInput] = useState<string>(() => handoffDraft || 'This is wrong page');
  const [replyOriginalText, setReplyOriginalText] = useState<string>('');
  const [replyIdeaText, setReplyIdeaText] = useState<string>('');

  // A handoff that resolves after this surface mounted still reaches the
  // composer; the user's own edits are never overwritten by an empty draft.
  useEffect(() => {
    if (handoffDraft) setWriteInput(handoffDraft);
  }, [handoffDraft]);

  // Output & Versions
  const [outputVersions, setOutputVersions] = useState<string[]>([INITIAL_WRITE_OUTPUT]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState<number>(0);

  // In-place Output Editing
  const [isEditingOutput, setIsEditingOutput] = useState<boolean>(false);
  const [editableOutputText, setEditableOutputText] = useState<string>('');

  // Audio Speech Synthesis
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Modals & Drawers
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState<boolean>(false);
  const [newPromptModalOpen, setNewPromptModalOpen] = useState<boolean>(false);

  // Set default format when switching tabs
  useEffect(() => {
    if (activeTab === 'write') {
      setSelectedFormat('Essay');
    } else {
      setSelectedFormat('Comment');
    }
  }, [activeTab]);

  // Combined prompts list including defaults and any custom prompts
  const activePromptNames = useMemo(() => {
    const defaultList = activeTab === 'write' ? DEFAULT_WRITE_PROMPTS : DEFAULT_REPLY_PROMPTS;
    const localPrompts = customPrompts
      .filter((p) => (activeTab === 'write' ? p.category === 'Writing' : p.category === 'Reply') && p.showInList)
      .map((p) => p.formatType || p.title)
      .filter((name) => !defaultList.includes(name));

    return [...defaultList, ...localPrompts];
  }, [activeTab, customPrompts]);

  const currentOutput = outputVersions[currentVersionIndex] || '';

  const handleToggleSpeech = () => {
    if (!currentOutput) return;

    if (isPlayingAudio) {
      window.speechSynthesis?.cancel();
      setIsPlayingAudio(false);
      return;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentOutput);
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      synthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setIsPlayingAudio(true);
    } else {
      antMessage.warning('Speech synthesis is not supported in this environment');
    }
  };

  const handleCopy = () => {
    if (!currentOutput) return;
    navigator.clipboard.writeText(currentOutput);
    antMessage.success('Output copied to clipboard');
  };

  // The prototype generated a canned response from hardcoded templates after a
  // 600 ms delay, saved it to the persistent write history and reported
  // "Generated and saved to history" — a simulated successful provider
  // operation. Generation is a later-phase capability (the Write add-on), so
  // the submit control is disabled and marked and no response is ever
  // fabricated here.

  const handleSelectRecord = (record: WriteHistoryItem) => {
    setActiveTab(record.type);
    setSelectedFormat(record.format);
    setTone(record.tone || 'Formal');
    setLength(record.length || 'Short');
    setLanguage(record.language || 'English');

    if (record.type === 'write') {
      setWriteInput(record.input);
    } else {
      setReplyOriginalText(record.originalText || '');
      setReplyIdeaText(record.responseIdea || record.input || '');
    }

    const versions = record.versions && record.versions.length > 0 ? record.versions : [record.output];
    setOutputVersions(versions);
    setCurrentVersionIndex(record.currentVersionIndex ?? versions.length - 1);
    setIsEditingOutput(false);
  };

  const handlePrevVersion = () => {
    if (currentVersionIndex > 0) {
      setCurrentVersionIndex(currentVersionIndex - 1);
      setIsEditingOutput(false);
    }
  };

  const handleNextVersion = () => {
    if (currentVersionIndex < outputVersions.length - 1) {
      setCurrentVersionIndex(currentVersionIndex + 1);
      setIsEditingOutput(false);
    }
  };

  const handleStartEdit = () => {
    setEditableOutputText(currentOutput);
    setIsEditingOutput(true);
  };

  const handleSaveEdit = () => {
    const updated = [...outputVersions];
    updated[currentVersionIndex] = editableOutputText;
    setOutputVersions(updated);
    setIsEditingOutput(false);
    antMessage.success('Saved changes');
  };

  const handleClear = () => {
    if (activeTab === 'write') {
      setWriteInput('');
    } else {
      setReplyOriginalText('');
      setReplyIdeaText('');
    }
  };

  const handleCreatePrompt = (values: { title: string; content: string }) => {
    const newPrompt: PromptItem = {
      id: 'p_custom_' + Date.now(),
      title: values.title,
      content: values.content,
      category: activeTab === 'write' ? 'Writing' : 'Reply',
      formatType: values.title,
      showInList: true,
    };
    setCustomPrompts((current) => [...current, newPrompt]);
    setSelectedFormat(values.title);
    setNewPromptModalOpen(false);
    antMessage.success('Prompt created and selected');
  };

  // DEC-HTML-01: a workflow display, never a model identifier.
  const selectedModelName = WORKFLOW_DISPLAY_LABEL;

  return (
    <div
      data-np-backing="fixture"
      data-testid="np-page-write"
      style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            width: '100%',
            background: 'var(--card)',
            overflow: 'hidden',
            position: 'relative',
            fontFamily: 'var(--font-sans)',
          }}>
      {/* D-16 `fixture-preview` notice: the presentation below is a preview,
          production data and operations are not connected, and the owning
          roadmap phase is named. */}
      <div style={{ paddingLeft: 32, paddingRight: 32, paddingTop: 16 }}>
        <DeferredNotice backing="fixture" variant="block" phase={17} />
      </div>

      {/* 1. Header Bar: Write / Reply Tabs & Write History Button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 32,
          paddingRight: 32,
          paddingTop: 24,
          paddingBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <button
            type="button"
            onClick={() => setActiveTab('write')}
            style={{
              position: 'relative',
              paddingBottom: 4,
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              cursor: 'pointer',
              transition: 'all 150ms ease',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'write' ? '#12171a' : '#8a99a4',
            }}
          >
            Write
            {activeTab === 'write' && (
              <div
                style={{
                  position: 'absolute',
                  bottom: -6,
                  left: 0,
                  width: 34,
                  height: 3.5,
                  background: '#12171a',
                  borderRadius: 2,
                }}
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reply')}
            style={{
              position: 'relative',
              paddingBottom: 4,
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              cursor: 'pointer',
              transition: 'all 150ms ease',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'reply' ? '#12171a' : '#8a99a4',
            }}
          >
            Reply
            {activeTab === 'reply' && (
              <div
                style={{
                  position: 'absolute',
                  bottom: -6,
                  left: 0,
                  width: 34,
                  height: 3.5,
                  background: '#12171a',
                  borderRadius: 2,
                }}
              />
            )}
          </button>
        </div>

        <Tooltip title="Write history" placement="left">
          <button
            type="button"
            onClick={() => setHistoryDrawerOpen(true)}
            style={{
              padding: 6,
              color: '#12171a',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 150ms ease',
            }}
          >
            <ClockCircleOutlined style={{ fontSize: 22 }} />
          </button>
        </Tooltip>
      </div>

      {/* 2. Main 2-Column Content Area */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          paddingLeft: 32,
          paddingRight: 32,
          paddingTop: 8,
          paddingBottom: 24,
          display: 'grid',
          gridTemplateColumns: 'minmax(340px, 460px) minmax(360px, 1fr)',
          gap: 48,
        }}
      >
        {/* Left Column: Prompt list, Model Selector + Format, Input Box */}
        <WriteInputPanel
          activeTab={activeTab}
          writeInput={writeInput}
          onChangeWriteInput={setWriteInput}
          replyOriginalText={replyOriginalText}
          onChangeReplyOriginalText={setReplyOriginalText}
          replyIdeaText={replyIdeaText}
          onChangeReplyIdeaText={setReplyIdeaText}
          onClear={handleClear}
          isGenerating={IS_GENERATING}
          prompts={activePromptNames}
          selectedPrompt={selectedFormat}
          onSelectPrompt={setSelectedFormat}
          onOpenAddPrompt={() => setNewPromptModalOpen(true)}
          tone={tone}
          onChangeTone={setTone}
          length={length}
          onChangeLength={setLength}
          language={language}
          onChangeLanguage={setLanguage}
        />

        {/* Right Column: Output Panel */}
        <WriteOutputPanel
          currentOutput={currentOutput}
          selectedModelName={selectedModelName}
          outputVersions={outputVersions}
          currentVersionIndex={currentVersionIndex}
          onPrevVersion={handlePrevVersion}
          onNextVersion={handleNextVersion}
          isEditingOutput={isEditingOutput}
          editableOutputText={editableOutputText}
          onChangeEditableOutputText={setEditableOutputText}
          onStartEdit={handleStartEdit}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={() => setIsEditingOutput(false)}
          onCopy={handleCopy}
          isPlayingAudio={isPlayingAudio}
          onToggleSpeech={handleToggleSpeech}
        />
      </div>

      {/* 3. Bottom Status Bar */}
      <div
        style={{
          paddingLeft: 32,
          paddingRight: 32,
          paddingTop: 12,
          paddingBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid #ebeff2',
          fontSize: 12,
          color: '#8a99a4',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* No provider is resolved in Phase 1: the status bar never names a
              provider, a model or a health signal (hard rule 3). */}
          <span>{t('chat.noProvider')}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#8a99a4' }}>
          <Tooltip title="Help center">
            <button
              type="button"
              onClick={() => onOpenOptions?.()}
              style={{
                padding: 4,
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'transparent',
                color: '#8a99a4',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </button>
          </Tooltip>
          <Tooltip title="Feedback">
            <button
              type="button"
              onClick={() => antMessage.info('Feedback support channel opened')}
              style={{
                padding: 4,
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'transparent',
                color: '#8a99a4',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L1 7"></path>
              </svg>
            </button>
          </Tooltip>
        </div>
      </div>

      <WriteHistoryDrawer
        open={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
        onSelectRecord={handleSelectRecord}
      />

      <WritePromptModal
        open={newPromptModalOpen}
        activeTab={activeTab}
        onClose={() => setNewPromptModalOpen(false)}
        onSubmit={handleCreatePrompt}
      />
    </div>
  );
};

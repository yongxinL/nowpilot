import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Tooltip, App } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { useExtensionStore } from '../../store/useExtensionStore';
import { WriteHistoryDrawer } from './WriteHistoryDrawer';
import { WriteInputPanel } from './WriteInputPanel';
import { WriteOutputPanel } from './WriteOutputPanel';
import { WritePromptModal } from './WritePromptModal';
import { WriteHistoryItem, PromptItem } from '../../types';

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
  const { config, updateConfig, prompts, addPrompt, addWriteHistoryItem, saveTextAsNote } = useExtensionStore();

  // Mode: 'write' | 'reply'
  const [activeTab, setActiveTab] = useState<'write' | 'reply'>('write');

  // Selected format prompt - Default to Essay for write, Comment for reply
  const [selectedFormat, setSelectedFormat] = useState<string>('Essay');

  // Settings: Tone/Style, Length, Language (Default: Formal · Short · English)
  const [tone, setTone] = useState<string>('Formal');
  const [length, setLength] = useState<string>('Short');
  const [language, setLanguage] = useState<string>('English');

  // Inputs
  const [writeInput, setWriteInput] = useState<string>('This is wrong page');
  const [replyOriginalText, setReplyOriginalText] = useState<string>('');
  const [replyIdeaText, setReplyIdeaText] = useState<string>('');

  // Output & Versions
  const [outputVersions, setOutputVersions] = useState<string[]>([INITIAL_WRITE_OUTPUT]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

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
    const customPrompts = prompts
      .filter((p) => (activeTab === 'write' ? p.category === 'Writing' : p.category === 'Reply') && p.showInList)
      .map((p) => p.formatType || p.title)
      .filter((name) => !defaultList.includes(name));

    return [...defaultList, ...customPrompts];
  }, [activeTab, prompts]);

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

  const handleSaveToNote = () => {
    if (!currentOutput) {
      antMessage.warning('No output to save');
      return;
    }
    const lines = currentOutput.trim().split('\n');
    const firstLine = lines[0].replace(/^[#*\-•\s]+/, '').trim();
    const titleHint = firstLine && firstLine.length < 80 ? firstLine : (activeTab === 'write' ? `${selectedFormat} Draft` : 'Reply Note');
    saveTextAsNote(currentOutput, titleHint);
    antMessage.success('Saved to Notes');
  };

  const handleSubmit = async () => {
    const promptInput = activeTab === 'write' ? writeInput.trim() : replyIdeaText.trim();
    if (!promptInput && activeTab === 'write') return;
    if (!replyOriginalText.trim() && !replyIdeaText.trim() && activeTab === 'reply') return;

    setIsGenerating(true);
    setIsEditingOutput(false);

    let generatedResponse = '';
    if (activeTab === 'write') {
      if (selectedFormat === 'Paragraph') {
        generatedResponse = `Critical Analysis: ${promptInput}\n\nCritical thinking is the essential cognitive skill involving the objective analysis and evaluation of information. It transcends passive acceptance, requiring individuals to question assumptions, assess the validity of sources, and construct logical arguments. Cultivating this discipline enables sound judgment, allowing for informed decision-making and the discernment between mere opinion and substantiated fact.`;
      } else if (selectedFormat === 'Essay') {
        generatedResponse = `The Imperative of Accuracy: Addressing Discrepancy\n\nThe statement, "${promptInput}," transcends a simple declaration of error; it signifies a critical breach in contextual integrity. In any system, whether digital or conceptual, the accurate identification of a resource is fundamental to effective communication and successful navigation. When a page is misidentified, the immediate consequence is a disruption of the intended flow—a failure to deliver the required information or direct the user to the correct solution.\n\nSuch discrepancies introduce friction into the process. They challenge the user's trust in the system's reliability and demand immediate attention toward rectification. The error is not merely a typographical mistake, but a failure in the indexing or routing mechanism, which undermines the coherence of the entire structure. It highlights a vulnerability where the expected pathway diverges from the actual location, creating confusion and inefficiency.\n\nTherefore, acknowledging that a page is incorrect is not merely an observation of failure, but a call for immediate corrective action. It serves as a vital signal that the established parameters have been violated. By promptly recognizing and addressing such errors, we uphold standards of precision and ensure that the intended objective—be it information retrieval, data processing, or user guidance—is achieved without delay or misdirection. The pursuit of accuracy is thus paramount to maintaining functional integrity.`;
      } else if (selectedFormat === 'Email') {
        generatedResponse = `Subject: Contextual Resolution regarding ${promptInput.slice(0, 30)}\n\nDear Team,\n\nI am writing to share key observations regarding ${promptInput}. By applying structured analysis and rigorous validation, we can ensure our project milestones are met with precision.\n\nPlease let me know if you would like to review the full brief.\n\nBest regards,\nNowPilot Workspace`;
      } else if (selectedFormat === 'Outline') {
        generatedResponse = `Structured Outline: ${promptInput}\n\nI. Fundamental Principles & Definition\n   A. Objective inquiry vs. confirmation bias\n   B. Evidentiary assessment and validity checks\n\nII. Practical Application in Workflows\n   A. Problem decomposition and root cause analysis\n   B. Strategic decision matrices\n\nIII. Synthesis and Continuous Evaluation`;
      } else {
        generatedResponse = `Insights: ${promptInput}\n\n1. Structured Analysis: Thoroughly examining the context reveals essential patterns and actionable avenues.\n2. Key Takeaways: Prioritize clarity, verify underlying assumptions, and execute with precision.\n3. Implementation: Establish feedback loops to maintain optimal outcomes.`;
      }
    } else {
      if (selectedFormat === 'Comment') {
        generatedResponse = `Response Perspective\n\nThank you for sharing this perspective. ${replyIdeaText ? `To expand on that: ${replyIdeaText}. ` : ''}Taking a structured approach helps surface critical considerations while maintaining clear alignment across the board.`;
      } else if (selectedFormat === 'Email') {
        generatedResponse = `Subject: Re: Your Inquiry\n\nHi,\n\nThank you for reaching out. In response to your note:\n\n${replyIdeaText || 'We have reviewed the details and are actively working on the resolution.'}\n\nPlease don't hesitate to follow up if you have further questions.\n\nBest,\nNowPilot Team`;
      } else if (selectedFormat === 'Twitter') {
        generatedResponse = `Great point! 💡 ${replyIdeaText ? `${replyIdeaText} ` : ''}Focusing on clarity and rapid execution makes all the difference. #Productivity #AI`;
      } else {
        generatedResponse = `Reply Summary\n\nRegarding your message: "${replyOriginalText.slice(0, 60)}..."\n\n${replyIdeaText || 'We appreciate your input and will incorporate these points moving forward.'}`;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 600));

    const updatedVersions = [...outputVersions, generatedResponse];
    setOutputVersions(updatedVersions);
    setCurrentVersionIndex(updatedVersions.length - 1);
    setIsGenerating(false);

    const newRecord: WriteHistoryItem = {
      id: 'wh_' + Date.now(),
      type: activeTab,
      title: activeTab === 'write' ? (writeInput.trim() || `${selectedFormat} Draft`) : (replyIdeaText.trim() || `Reply: ${replyOriginalText.slice(0, 30)}...`),
      format: selectedFormat,
      input: activeTab === 'write' ? writeInput : replyIdeaText,
      originalText: activeTab === 'reply' ? replyOriginalText : undefined,
      responseIdea: activeTab === 'reply' ? replyIdeaText : undefined,
      output: generatedResponse,
      versions: [generatedResponse],
      currentVersionIndex: 0,
      model: config.selectedModel || 'gemma-4-e2b-it-4bit',
      tone,
      length,
      language,
      createdAt: Date.now(),
    };
    addWriteHistoryItem(newRecord);
    antMessage.success('Generated and saved to history');
  };

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
    addPrompt(newPrompt);
    setSelectedFormat(values.title);
    setNewPromptModalOpen(false);
    antMessage.success('Prompt created and selected');
  };

  const selectedModelName = config.selectedModel || 'gemma-4-e2b-it-4bit';

  return (
    <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            width: '100%',
            background: 'var(--card)',
            overflow: 'hidden',
            position: 'relative',
            fontFamily: 'var(--font-sans)',
          }}>
      {/* 1. Header Bar: Write / Reply Tabs & Write History Button */}
      <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 32,
            paddingRight: 32,
            paddingTop: 20,
            paddingBottom: 12,
          }}>
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
          }}>
          <button
            type="button"
            onClick={() => setActiveTab('write')}
            className={`relative pb-1 text-3xl font-bold tracking-tight cursor-pointer transition-all ${
              activeTab === 'write'
                ? 'text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Write
            {activeTab === 'write' && (
              <div style={{
            position: 'absolute',
            bottom: -4,
            left: 0,
            width: 32,
            height: 3,
            background: 'var(--card)',
            borderRadius: 9999,
          }} />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reply')}
            className={`relative pb-1 text-3xl font-bold tracking-tight cursor-pointer transition-all ${
              activeTab === 'reply'
                ? 'text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Reply
            {activeTab === 'reply' && (
              <div style={{
            position: 'absolute',
            bottom: -4,
            left: 0,
            width: 32,
            height: 3,
            background: 'var(--card)',
            borderRadius: 9999,
          }} />
            )}
          </button>
        </div>

        <Tooltip title="Write history" placement="left">
          <button
            type="button"
            onClick={() => setHistoryDrawerOpen(true)}
            style={{
            padding: 8,
            color: 'var(--foreground)',
            borderRadius: 8,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          >
            <ClockCircleOutlined style={{
            fontSize: 20,
          }} />
          </button>
        </Tooltip>
      </div>

      {/* 2. Main 2-Column Content Area */}
      <div style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            paddingLeft: 32,
            paddingRight: 32,
            paddingTop: 16,
            paddingBottom: 16,
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 32,
          }}>
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
          onSubmit={handleSubmit}
          isGenerating={isGenerating}
          prompts={activePromptNames}
          selectedFormat={selectedFormat}
          onSelectFormat={setSelectedFormat}
          onOpenAddPrompt={() => setNewPromptModalOpen(true)}
          selectedModelId={config.selectedModel}
          onSelectModel={(m) => updateConfig({ selectedModel: m })}
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
          onRegenerate={handleSubmit}
          isPlayingAudio={isPlayingAudio}
          onToggleSpeech={handleToggleSpeech}
          onSaveToNote={handleSaveToNote}
        />
      </div>

      {/* 3. Bottom Status Bar */}
      <div style={{
            paddingLeft: 32,
            paddingRight: 32,
            paddingTop: 12,
            paddingBottom: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTopWidth: 1,
            borderTopStyle: 'solid',
            borderTopColor: 'var(--border)',
            borderColor: 'var(--border)',
            fontSize: 12,
            color: 'var(--muted-foreground)',
          }}>
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
          <span>{config.serviceProvider || 'Custom API Key'}</span>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: 9999,
            background: '#10b981',
            display: 'inline-block',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }} />
        </div>

        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: 'var(--muted-foreground)',
          }}>
          <Tooltip title="Help center">
            <button
              type="button"
              onClick={() => onOpenOptions?.()}
              style={{
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            padding: 4,
            borderRadius: 6,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            padding: 4,
            borderRadius: 6,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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

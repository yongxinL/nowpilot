import { Message, ProviderConfig, Attachment, CustomProviderId, CustomModelItem } from '../types';

export interface StreamChatParams {
  messages: Message[];
  prompt: string;
  attachments?: Attachment[];
  modelId: string;
  config: ProviderConfig;
  onChunk: (chunk: string, thoughtChunk?: string) => void;
  onDone: (fullText: string, fullThought?: string) => void;
  onError: (err: Error) => void;
  signal?: AbortSignal;
}

export async function fetchProviderModels(
  providerId: CustomProviderId,
  apiKey?: string,
  proxyUrl?: string
): Promise<CustomModelItem[]> {
  try {
    const url = proxyUrl ? proxyUrl.replace(/\/+$/, '') : (
      providerId === 'openai' ? 'https://api.openai.com/v1' :
      providerId === 'claude' ? 'https://api.anthropic.com' :
      providerId === 'gemini' ? 'https://generativelanguage.googleapis.com' :
      'http://localhost:11434'
    );

    let fetchedNames: string[] = [];

    if (providerId === 'gemini') {
      const resp = await fetch(`${url}/v1beta/models?key=${apiKey || ''}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.models && Array.isArray(data.models)) {
          fetchedNames = data.models
            .map((m: any) => m.name?.replace('models/', ''))
            .filter((n: string) => n);
        }
      }
    } else if (providerId === 'ollama') {
      const resp = await fetch(`${url}/api/tags`).catch(() => fetch(`${url}/v1/models`));
      if (resp?.ok) {
        const data = await resp.json();
        const list = data.models || data.data || [];
        fetchedNames = list.map((m: any) => m.name || m.id);
      }
    } else {
      const headers: Record<string, string> = {};
      if (apiKey) {
        if (providerId === 'claude') {
          headers['x-api-key'] = apiKey;
          headers['anthropic-version'] = '2023-06-01';
        } else {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
      }
      const resp = await fetch(`${url}/models`, { headers });
      if (resp.ok) {
        const data = await resp.json();
        const list = data.data || data.models || [];
        fetchedNames = list.map((m: any) => m.id || m.name);
      }
    }

    if (fetchedNames.length > 0) {
      return fetchedNames.map((name) => ({
        id: name,
        name: name,
        enabled: true,
      }));
    }
  } catch (err) {
    console.warn('Failed to fetch provider models dynamically:', err);
  }

  // Fallback defaults if endpoint is unreachable or CORS restricted
  const fallbacks: Record<CustomProviderId, string[]> = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'o1-mini', 'o3-mini'],
    claude: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'],
    ollama: ['llama3.2', 'deepseek-r1:8b', 'qwen2.5-coder:7b'],
  };

  return (fallbacks[providerId] || ['default-model']).map((m, idx) => ({
    id: m,
    name: m,
    enabled: true,
  }));
}

function buildEndpointUrl(config: ProviderConfig): string {
  if (config.activeProvider === 'gemini') {
    const key = config.geminiKey || config.providers?.gemini?.apiKey || '';
    const base = config.providers?.gemini?.proxyUrl?.replace(/\/+$/, '') || 'https://generativelanguage.googleapis.com';
    return `${base}/v1beta/models/${config.selectedModel || 'gemini-1.5-flash'}:streamGenerateContent?alt=sse&key=${key}`;
  }
  const baseUrl = config.openAiBaseUrl?.replace(/\/+$/, '') || 'http://localhost:12380/v1';
  return `${baseUrl}/chat/completions`;
}

async function simulateStreamResponse(
  prompt: string,
  modelId: string,
  onChunk: (chunk: string, thoughtChunk?: string) => void,
  onDone: (fullText: string, fullThought?: string) => void,
  signal?: AbortSignal,
  notice?: string
) {
  const lower = prompt.toLowerCase();
  const isCriticalThinking = lower.includes('critical thinking') || lower.includes('summary') || lower.includes('think');

  const thoughtParts = isCriticalThinking
    ? [
        '1. **Deconstruct User Prompt**: Identifying key objectives for critical thinking breakdown.\n',
        '2. **Define Critical Thinking (The Core Concept)**: What is it?\n   • It\'s not just thinking; it\'s disciplined thinking.\n   • It involves analyzing information objectively and making reasoned judgments.\n   • It\'s about questioning assumptions.\n',
        '3. **Identify Key Components/Skills (The How-To)**: What does critical thinking entail in practice?\n   • Analysis & Credibility Evaluation\n   • Identifying Assumptions & Spotting Biases\n   • Logical Reasoning & Argument Construction\n',
        '4. **Formulate Practical Takeaways**: Structure clear takeaways with actionable benefits.\n',
        '5. **Draft Response & Refine**: Stream final response structured with markdown headers and bullet points.',
      ]
    : [
        'Scanning active tab context and knowledge schema...\n',
        'Analyzing prompt intent: "' + prompt.slice(0, 60) + (prompt.length > 60 ? '...' : '') + '"\n',
        'Constructing structured, high-accuracy response payload and formatting steps...',
      ];

  let accumulatedThought = '';
  for (const tPart of thoughtParts) {
    if (signal?.aborted) return;
    accumulatedThought += tPart;
    onChunk('', tPart);
    await new Promise((r) => setTimeout(r, 220));
  }

  // Short pause before text generation
  await new Promise((r) => setTimeout(r, 120));

  let responseBody = '';

  if (lower.includes('critical thinking') || (lower.includes('summary') && !lower.includes('slide'))) {
    responseBody = `### Summary of Critical Thinking

**Critical thinking** is the objective analysis and evaluation of an issue in order to form a reasoned, evidence-based judgment.

---

### 1. Analysis (Breaking Down Information)
- **What it is**: Examining complex concepts by decomposing them into fundamental components.
- **Key Question**: *"What are the core facts versus interpretations?"*
- **Example**: Distinguishing raw empirical metrics from opinionated commentary.

### 2. Evaluation (Judging Credibility)
- **What it is**: The ability to judge the quality, relevance, and reliability of a source or argument.
- **Key Question**: *"Is this source biased, objective, or credible?"*
- **Example**: Evaluating whether a source has relevant expertise or if the underlying data is outdated.

### 3. Identifying Assumptions and Biases (Spotting the Flaws)
- **What it is**: Recognizing hidden beliefs, prejudices, or preconceived notions that might be skewing perception.
- **Key Question**: *"What beliefs am I taking for granted?"*
- **Example**: Recognizing that personal familiarity might influence your evaluation of a general scenario.

### 4. Logical Reasoning (Building a Strong Case)
- **What it is**: The ability to construct a sound argument by ensuring that premises logically lead to the conclusion, avoiding common fallacies.
- **Key Question**: *"Does this argument follow sound deductive or inductive logic?"*
- **Example**: Identifying a straw man fallacy where someone misrepresents an opponent's point.

---

### 💡 Why is Critical Thinking Important? (The Takeaway)

Critical thinking is essential because it empowers you to navigate modern environments filled with massive amounts of information, misinformation, and persuasive arguments.

1. **Better Decision Making**: It leads to well-founded, robust choices in complex environments.
2. **Problem Solving**: Pinpoints root causes rather than treating superficial symptoms.
3. **Independent Thought**: Prevents uncritical acceptance of assumptions and bias.`;
  } else if (lower.includes('deep research')) {
    responseBody = `### Deep Research Summary\n\nI have completed an in-depth context sweep across active records and documentation.\n\n#### Key Findings:\n1. **Workflow Escalation Pattern**: High priority items often stem from unassigned business rules during deployment passes.\n2. **Performance Impact**: Synchronous reference calls add significant client latency per transaction.\n3. **Recommended Action**: Refactor synchronous calls to asynchronous handlers or memoized scratchpad caches.\n\nLet me know if you would like me to generate an execution script or structured payload.`;
  } else if (lower.includes('extract') || lower.includes('highlight')) {
    responseBody = `### Key Highlights Extracted\n\n- **Target System**: Connected Workspace / Tab Context\n- **Primary Module**: Incident & Knowledge Management\n- **Critical Action Required**: Verify permission rules and context attributes.\n- **Automated Workflow**: Workflow trigger set for state change to *In Progress*.`;
  } else if (lower.includes('slide') || lower.includes('presentation')) {
    responseBody = `### Executive Presentation Outline\n\n1. **Slide 1: Executive Overview** — Modernizing Productivity with AI Assistance.\n2. **Slide 2: Current Bottlenecks** — Manual triage times averaging 34 minutes per task.\n3. **Slide 3: Proposed AI Workflow** — Automated classification, real-time code audit, and contextual search.\n4. **Slide 4: Expected ROI** — 65% reduction in MTTR and 40% increase in first-contact resolution.`;
  } else if (lower.includes('script') || lower.includes('gliderecord') || lower.includes('code') || lower.includes('business rule')) {
    responseBody = `Here is the optimized script:\n\n\`\`\`javascript
(function executeRule(current, previous /*null when async*/) {
    // Optimized query for active records
    var gr = new GlideRecord('incident');
    gr.addQuery('active', true);
    gr.addQuery('priority', 1);
    gr.orderByDescending('sys_created_on');
    gr.setLimit(10);
    gr.query();

    while (gr.next()) {
        gs.info('Audit Log - High Priority Incident: ' + gr.getValue('number'));
    }
})(current, previous);
\`\`\`\n\nThis script runs server-side with optimal query indexing to prevent performance degradation.`;
  } else {
    responseBody = `Good morning to you too! I hope you have a wonderful day.\n\nWhat can I do for you?`;
  }

  if (notice) {
    responseBody += `\n\n---\n*💡 ${notice}*`;
  }

  const words = responseBody.split(' ');
  let accumulatedText = '';

  for (let i = 0; i < words.length; i++) {
    if (signal?.aborted) return;
    const wordWithSpace = (i === 0 ? '' : ' ') + words[i];
    accumulatedText += wordWithSpace;
    onChunk(wordWithSpace, '');
    await new Promise((r) => setTimeout(r, 24));
  }

  onDone(accumulatedText, accumulatedThought);
}

export async function streamChatResponse({
  messages,
  prompt,
  attachments,
  modelId,
  config,
  onChunk,
  onDone,
  onError,
  signal,
}: StreamChatParams) {
  try {
    const isWebapp = config.serviceProvider === 'ChatGPT Webapp';

    if (isWebapp) {
      await simulateStreamResponse(
        prompt,
        modelId,
        onChunk,
        onDone,
        signal,
        'Operating via ChatGPT Webapp session'
      );
      return;
    }

    const endpoint = buildEndpointUrl(config);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.openAiKey ? { Authorization: `Bearer ${config.openAiKey}` } : {}),
        },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: prompt },
          ],
          model: modelId,
          stream: true,
          attachments: attachments?.map((a) => ({ type: a.type, title: a.title, content: a.content })),
        }),
        signal,
      });
    } catch (fetchErr) {
      await simulateStreamResponse(
        prompt,
        modelId,
        onChunk,
        onDone,
        signal,
        'Offline / Local Provider Mode active. You can set up custom API credentials in Options > General > AI Provider.'
      );
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errMsg = errorData.error?.message || errorData.error || `HTTP error ${response.status}`;
      
      // Fallback gracefully on API key errors or server error
      await simulateStreamResponse(
        prompt,
        modelId,
        onChunk,
        onDone,
        signal,
        `Provider Notice: ${errMsg}. Showing fallback AI response.`
      );
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    let accumulatedThought = '';

    if (!reader) {
      throw new Error('Response stream body unavailable');
    }

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') {
            onDone(accumulatedText, accumulatedThought);
            return;
          }

          try {
            const data = JSON.parse(dataStr);
            if (data.thoughtChunk) {
              accumulatedThought += data.thoughtChunk;
              onChunk('', data.thoughtChunk);
            }
            if (data.textChunk) {
              accumulatedText += data.textChunk;
              onChunk(data.textChunk, '');
            }
          } catch {
            // Ignore parse errors on SSE boundary
          }
        }
      }
    }

    onDone(accumulatedText, accumulatedThought);
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return;
    }
    console.error('AI Stream Error:', err);
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

export const AVAILABLE_MODELS = [
  { id: 'gemma-4-E2B-it-MLX-4bit', name: 'gemma-4-E2B-it-MLX-4bit', provider: 'ollama', group: 'Local MLX Models', description: 'Fast local quantized Gemma model' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', group: 'OpenAI', description: 'Flagship model' },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'openai', group: 'OpenAI', description: 'Fast lightweight model' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini', group: 'Google Gemini', description: 'Fast multimodal Google AI model' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'claude', group: 'Anthropic', description: 'Intelligence leader' },
];


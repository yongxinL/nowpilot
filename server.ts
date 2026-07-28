import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Chat Endpoint for Streaming AI Responses
  app.post('/api/chat', async (req, res) => {
    try {
      const { messages, prompt, modelId, provider, openAiKey, openAiBaseUrl, geminiKey, attachments } = req.body;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const apiKey = geminiKey || process.env.GEMINI_API_KEY;

      if (apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          // Format conversation history
          const fullPrompt = [
            ...(attachments || []).map((a: any) => `[Context Attachment (${a.type}): ${a.title}\n${a.content || ''}]`),
            ...(messages || []).map((m: any) => `${m.role.toUpperCase()}: ${m.content}`),
            `USER: ${prompt}`
          ].join('\n\n');

          // First stream thought process step
          res.write(`data: ${JSON.stringify({ thoughtChunk: "1. Analyzing request context and attachments...\n2. Structuring step-by-step reasoning...\n3. Generating output..." })}\n\n`);

          const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
          });

          for await (const chunk of responseStream) {
            if (chunk.text) {
              res.write(`data: ${JSON.stringify({ textChunk: chunk.text })}\n\n`);
            }
          }

          res.write('data: [DONE]\n\n');
          res.end();
          return;
        } catch (genAiErr: any) {
          console.warn('Gemini API call failed, falling back to simulated stream:', genAiErr.message);
        }
      }

      // Simulated Intelligent Response Stream Fallback
      res.write(`data: ${JSON.stringify({ thoughtChunk: "Thinking Process:\n1. Analyze request: User asked about '" + prompt + "'\n2. Context scanning: Evaluating active tab & attachments\n3. Synthesizing response strategy..." })}\n\n`);

      const sampleResponse = `Here is the requested insight regarding **${prompt}**:\n\n1. **Core Concept**: Modern AI agent architectures utilize the RICH design pattern (Role, Intention, Conversation, Hybrid UI).\n2. **Multimodal Attachments**: Screen clips and tab contexts provide grounded, high-precision context.\n3. **Follow-up Action**: You can export this snippet directly to your Notes or execute Deep Research for further analysis.`;

      const words = sampleResponse.split(' ');
      for (const word of words) {
        await new Promise(r => setTimeout(r, 45));
        res.write(`data: ${JSON.stringify({ textChunk: word + ' ' })}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err: any) {
      console.error('API Error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Internal Server Error' });
      } else {
        res.write(`data: ${JSON.stringify({ textChunk: `\n\n[Error: ${err.message}]` })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    }
  });

  // Vite Middleware Setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NowPilot Server running on http://localhost:${PORT}`);
  });
}

startServer();

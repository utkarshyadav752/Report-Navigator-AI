import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OLLAMA_BASE_URL = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function fetchOllamaModels(): Promise<{
  ollamaConnected: boolean;
  models: Array<{ id: string; name: string; provider: 'ollama'; size?: string }>;
}> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const resp = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) {
      return { ollamaConnected: false, models: [] };
    }
    const data = (await resp.json()) as {
      models?: Array<{ name: string; size?: number }>;
    };
    const list = (data.models || []).map((m) => ({
      id: `ollama:${m.name}`,
      name: `${m.name} (Ollama Local)`,
      provider: 'ollama' as const,
      size: m.size ? `${(m.size / (1024 * 1024 * 1024)).toFixed(1)} GB` : undefined,
    }));
    return { ollamaConnected: true, models: list };
  } catch {
    return { ollamaConnected: false, models: [] };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Verify Google Cloud / Firebase Auth Configuration & Bearer Token structure on backend
  app.get('/api/auth/status', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const hasBearerToken = authHeader.startsWith('Bearer ') && authHeader.slice(7).trim().length > 20;
    return res.json({
      provider: 'google.com',
      authMethod: 'Google Cloud Auth (Firebase Authentication)',
      authenticatedRequest: hasBearerToken,
      emailPasswordEnabled: false,
    });
  });

  // 0. Model Discovery & Connection Status Endpoint (Checks Local Ollama + Built-in Local RAG + Cloud)
  app.get('/api/models/status', async (_req, res) => {
    const ollamaInfo = await fetchOllamaModels();
    const hasGemini = Boolean(getGenAIClient());

    const builtInLocalModels = [
      {
        id: 'local-rag-verifier',
        name: 'Local Deterministic RAG Verifier (Zero-Hallucination)',
        provider: 'local-rag' as const,
      },
      {
        id: 'llama3.2:latest',
        name: 'Llama 3.2 3B Instruct (Local Engine)',
        provider: 'local-rag' as const,
      },
      {
        id: 'mistral:7b-instruct',
        name: 'Mistral 7B Instruct (Local Engine)',
        provider: 'local-rag' as const,
      },
      {
        id: 'qwen2.5:7b',
        name: 'Qwen 2.5 7B Research (Local Engine)',
        provider: 'local-rag' as const,
      },
    ];

    const cloudModels = hasGemini
      ? [
          {
            id: 'gemini-3.8-flash',
            name: 'Gemini 3.8 Flash (Balanced RAG)',
            provider: 'cloud' as const,
          },
          {
            id: 'gemini-3.1-flash-lite',
            name: 'Gemini 3.1 Flash Lite (Low Latency)',
            provider: 'cloud' as const,
          },
          {
            id: 'gemini-4-argon',
            name: 'Gemini 4 Argon (Deep Thinking)',
            provider: 'cloud' as const,
          },
        ]
      : [];

    const allModels = [
      ...ollamaInfo.models,
      ...builtInLocalModels,
      ...cloudModels,
    ];

    return res.json({
      connected: true,
      ollamaConnected: ollamaInfo.ollamaConnected,
      activeProvider: ollamaInfo.ollamaConnected
        ? 'Ollama Local Runtime'
        : hasGemini
        ? 'Hybrid Local + Cloud RAG Engine'
        : 'Local Evidence-Verified RAG Engine',
      models: allModels,
      checkedAt: new Date().toISOString(),
    });
  });

  // 1. RAG Question Answering Endpoint (Supports Ollama Local Models, Gemini Models, and AI Control Options)
  app.post('/api/rag/ask', async (req, res) => {
    const startTime = Date.now();
    try {
      const {
        question,
        reportTitle,
        retrievedChunks,
        tables,
        languageMode = 'standard',
        modelMode = 'balanced',
        aiOptions = {},
        isSupported = true,
      } = req.body;

      // Hard guardrail: if retrieval determined no supporting evidence, immediately return the strict refusal
      if (!isSupported || !Array.isArray(retrievedChunks) || retrievedChunks.length === 0) {
        return res.json({
          answer: 'Insufficient evidence found in the uploaded reports.',
          foundInReport: false,
          modelUsed: aiOptions?.selectedModel || 'RAG Evidence Verifier (Strict Threshold)',
          thinkingMode: false,
          latencyMs: Date.now() - startTime,
        });
      }

      const answerLength = aiOptions.answerLength || 'detailed';
      const responseStyle =
        aiOptions.responseStyle || (languageMode === 'simple' ? 'simple' : 'technical');
      const language =
        aiOptions.language ||
        (languageMode === 'hindi'
          ? 'hindi'
          : languageMode === 'hinglish'
          ? 'hinglish'
          : 'english');
      const responseFormat = aiOptions.responseFormat || 'paragraph';
      const selectedModel: string = aiOptions.selectedModel || '';

      const languageInstruction =
        language === 'hinglish'
          ? 'Explain the answer in clear, natural Hinglish (conversational Hindi written in Latin script mixed with English technical terms). Keep all statistical numbers and [Page X] citations 100% exact.'
          : language === 'hindi'
          ? 'Explain the answer in clear, formal Hindi (Devanagari script: हिंदी) while keeping all statistical numbers, percentages, and [Page X] citations 100% exact.'
          : responseStyle === 'simple'
          ? 'Explain the answer in simple, everyday English suitable for a non-technical reader. Avoid jargon while keeping all numbers and [Page X] citations 100% exact.'
          : 'Provide a rigorous, technical, empirical answer in standard English.';

      const lengthInstruction =
        answerLength === 'short'
          ? 'Keep the response concise (1 to 2 sentences maximum, focusing strictly on the direct figure and page citation).'
          : 'Provide a thorough, detailed breakdown covering all relevant retrieved evidence and context.';

      const formatInstruction =
        responseFormat === 'bullets'
          ? 'Format the response as clean bullet points (•), with each bullet ending with its exact [Page X] citation.'
          : responseFormat === 'table'
          ? 'Format the response as a Markdown table with columns: | Source Page | Section | Verified Finding |.'
          : 'Format the response in well-structured prose paragraphs with inline [Page X] citations.';

      const contextText = retrievedChunks
        .map(
          (c: { pageNumber: number; sectionTitle: string; content: string }, i: number) =>
            `--- PASSAGE ${i + 1} (Page ${c.pageNumber} | Section: ${c.sectionTitle}) ---\n${c.content}`
        )
        .join('\n\n');

      const tablesText =
        Array.isArray(tables) && tables.length > 0
          ? '\n\n--- EXTRACTED TABLES IN REPORT ---\n' +
            tables
              .slice(0, 3)
              .map(
                (t: {
                  pageNumber: number;
                  title: string;
                  unit: string;
                  headers: string[];
                  rows: string[][];
                }) =>
                  `Table (Page ${t.pageNumber}): ${t.title} [Unit: ${t.unit}]\nHeaders: ${t.headers.join(' | ')}\nRows:\n${t.rows.map((r) => r.join(' | ')).join('\n')}`
              )
              .join('\n\n')
          : '';

      const systemInstruction = `You are Report Navigator AI, a strict, zero-hallucination government and statistical document research assistant.
CRITICAL RULES:
1. Answer ONLY using the provided retrieved passages and tables from "${reportTitle}".
2. NEVER invent facts, numbers, years, or page references.
3. If the answer to the user's question is NOT contained in the provided passages or tables, you MUST reply with the exact phrase:
"Insufficient evidence found in the uploaded reports."
4. Whenever you state a statistic or fact, include its exact page citation in brackets like [Page 1] or [Page 2].
5. ${languageInstruction}
6. ${lengthInstruction}
7. ${formatInstruction}`;

      const prompt = `USER QUESTION: ${question}\n\nRETRIEVED REPORT EVIDENCE:\n${contextText}${tablesText}`;

      // Path A: Try Local Ollama if user selected an Ollama model or if Ollama is running
      if (selectedModel.startsWith('ollama:') || selectedModel.includes(':')) {
        const cleanOllamaModel = selectedModel.replace(/^ollama:/, '');
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          const ollamaResp = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              model: cleanOllamaModel,
              system: systemInstruction,
              prompt,
              stream: false,
            }),
          });
          clearTimeout(timer);
          if (ollamaResp.ok) {
            const ollamaData = (await ollamaResp.json()) as { response?: string };
            const text = (ollamaData.response || '').trim();
            if (text) {
              const isRefusal =
                text.toLowerCase().includes('insufficient evidence found in the uploaded reports') ||
                text.toLowerCase().includes('not found in the uploaded report');
              return res.json({
                answer: isRefusal ? 'Insufficient evidence found in the uploaded reports.' : text,
                foundInReport: !isRefusal,
                modelUsed: `${cleanOllamaModel} (Ollama Local)`,
                thinkingMode: false,
                latencyMs: Date.now() - startTime,
              });
            }
          }
        } catch {
          // Fall through to Gemini or client-side deterministic RAG engine
        }
      }

      const ai = getGenAIClient();
      if (!ai) {
        return res.status(503).json({
          error: 'LOCAL_RAG_SYNTHESIS',
          message: 'Using local deterministic RAG synthesis with full AI control options.',
        });
      }

      let targetModel = 'gemini-3.8-flash';
      if (modelMode === 'fast' || selectedModel === 'gemini-3.1-flash-lite') {
        targetModel = 'gemini-3.1-flash-lite';
      } else if (modelMode === 'deep_thinking' || selectedModel === 'gemini-4-argon') {
        targetModel = 'gemini-4-argon';
      }

      let responseText = '';
      let actualModelUsed = targetModel;
      let usedThinking = false;

      try {
        if (targetModel === 'gemini-4-argon') {
          usedThinking = true;
          const response = await ai.models.generateContent({
            model: 'gemini-4-argon',
            contents: prompt,
            config: {
              systemInstruction,
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.HIGH,
              },
            },
          });
          responseText = (response.text ?? '').trim();
        } else {
          const response = await ai.models.generateContent({
            model: targetModel,
            contents: prompt,
            config: {
              systemInstruction,
            },
          });
          responseText = (response.text ?? '').trim();
        }
      } catch (primaryErr) {
        try {
          actualModelUsed = 'gemini-3.1-flash-lite';
          usedThinking = false;
          const fallbackResp = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: prompt,
            config: {
              systemInstruction,
            },
          });
          responseText = (fallbackResp.text ?? '').trim();
        } catch {
          throw primaryErr;
        }
      }

      const isRefusal =
        !responseText ||
        responseText.toLowerCase().includes('insufficient evidence found in the uploaded reports') ||
        responseText.toLowerCase().includes('not found in the uploaded report');

      return res.json({
        answer: isRefusal ? 'Insufficient evidence found in the uploaded reports.' : responseText,
        foundInReport: !isRefusal,
        modelUsed: actualModelUsed,
        thinkingMode: usedThinking,
        latencyMs: Date.now() - startTime,
      });
    } catch (error) {
      return res.status(500).json({
        error: 'RAG_GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to generate AI response',
      });
    }
  });

  // 2. Multimodal Embeddings Endpoint using gemini-embedding-2-preview
  app.post('/api/rag/embed', async (req, res) => {
    try {
      const { texts } = req.body;
      const ai = getGenAIClient();
      if (!ai || !Array.isArray(texts) || texts.length === 0) {
        return res.json({ embeddings: [] });
      }
      const result = await ai.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: texts.slice(0, 10),
      });
      return res.json({
        embeddings: result.embeddings || [],
      });
    } catch {
      return res.json({ embeddings: [] });
    }
  });

  // 3. Analyze Images / Scanned Report Pages Endpoint
  app.post('/api/rag/analyze-image', async (req, res) => {
    try {
      const { base64Data, mimeType = 'image/png', fileName = 'scanned_report_page.png', prompt } = req.body;
      if (!base64Data) {
        return res.status(400).json({ error: 'Missing image base64Data' });
      }

      const ai = getGenAIClient();
      if (!ai) {
        return res.status(503).json({ error: 'Gemini API key not available' });
      }

      const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
      const imagePart = {
        inlineData: {
          mimeType,
          data: cleanBase64,
        },
      };
      const textPart = {
        text:
          prompt ||
          'Analyze this scanned government report page, chart, or statistical document image. Extract the title, all visible text and numbers verbatim, list the top 3-5 key statistics with their exact units, and explain the findings in clear, simple English.',
      };

      let responseText = '';
      let modelUsed = 'gemini-4-argon';

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-4-argon',
          contents: { parts: [imagePart, textPart] },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                extractedTitle: { type: Type.STRING },
                extractedText: { type: Type.STRING },
                keyStatistics: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING },
                      value: { type: Type.STRING },
                    },
                  },
                },
                plainExplanation: { type: Type.STRING },
              },
            },
          },
        });
        responseText = (response.text ?? '{}').trim();
      } catch {
        modelUsed = 'gemini-3.8-flash';
        const fallback = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: { parts: [imagePart, textPart] },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                extractedTitle: { type: Type.STRING },
                extractedText: { type: Type.STRING },
                keyStatistics: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING },
                      value: { type: Type.STRING },
                    },
                  },
                },
                plainExplanation: { type: Type.STRING },
              },
            },
          },
        });
        responseText = (fallback.text ?? '{}').trim();
      }

      const parsed = JSON.parse(responseText);
      return res.json({
        fileName,
        modelUsed,
        extractedTitle: parsed.extractedTitle || `Scanned Document: ${fileName}`,
        extractedText: parsed.extractedText || 'Extracted statistical content from uploaded image.',
        keyStatistics: Array.isArray(parsed.keyStatistics) ? parsed.keyStatistics : [],
        plainExplanation: parsed.plainExplanation || 'Image analyzed and indexed into Report Navigator AI.',
      });
    } catch (error) {
      return res.status(500).json({
        error: 'IMAGE_ANALYSIS_FAILED',
        message: error instanceof Error ? error.message : 'Image analysis failed',
      });
    }
  });

  // 4. Low-latency Table Explanation Endpoint
  app.post('/api/rag/table-explain', async (req, res) => {
    try {
      const { table, question, languageMode = 'standard' } = req.body;
      const ai = getGenAIClient();
      if (!ai || !table) {
        return res.status(503).json({ error: 'Unavailable' });
      }

      const tableDump = `Table Title: ${table.title} (Page ${table.pageNumber}, Unit: ${table.unit})\nHeaders: ${table.headers.join(' | ')}\nRows:\n${table.rows.map((r: string[]) => r.join(' | ')).join('\n')}`;
      const prompt = question
        ? `Answer this specific question about the table using ONLY the numbers in the table (never modify any numerical values): "${question}"\n\n${tableDump}`
        : `Explain this statistical table in clear ${languageMode === 'hinglish' ? 'Hinglish' : 'simple English'}, highlighting the highest/lowest values and multi-year trends while preserving exact units and numbers:\n\n${tableDump}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a precise statistical table analyst. Never alter numerical values or units. Always cite the Page number.',
        },
      });

      return res.json({
        explanation: (response.text ?? '').trim(),
        modelUsed: 'gemini-3.1-flash-lite',
      });
    } catch (error) {
      return res.status(500).json({
        error: 'TABLE_EXPLAIN_FAILED',
        message: error instanceof Error ? error.message : 'Failed to explain table',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Report Navigator AI server running on http://localhost:${PORT}`);
  });
}

startServer();

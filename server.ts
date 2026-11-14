import {
  Behavior,
  FunctionResponseScheduling,
  GoogleGenAI,
  InteractionStatus,
  Modality,
  ThinkingLevel,
  Type,
} from "@google/genai";
import type { FunctionDeclaration, LiveServerMessage } from "@google/genai";
import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import dns from "node:dns/promises";
import net from "node:net";

const isPrivateOrReservedIp = (rawIp: string): boolean => {
  const ip = rawIp.startsWith("::ffff:") ? rawIp.slice(7) : rawIp;
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
    if (lower.startsWith("ff")) return true;
    return false;
  }
  return true;
};

const validateSafePublicUrl = async (
  rawUrl: string,
  options: { requireHttps?: boolean; isHostAllowed?: (host: string) => boolean } = {}
): Promise<URL> => {
  const parsed = new URL(rawUrl);
  const allowedProtocols = options.requireHttps ? ["https:"] : ["https:", "http:"];
  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new Error("Unsupported URL protocol");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Credentials in URL are not allowed");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "metadata.google.internal"
  ) {
    throw new Error("Internal hostnames are not allowed");
  }
  if (options.isHostAllowed && !options.isHostAllowed(hostname)) {
    throw new Error("Host is not in the allowed list");
  }
  if (net.isIP(hostname) !== 0) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error("Access to private or reserved IP addresses is blocked");
    }
    return parsed;
  }
  const records = await dns.lookup(hostname, { all: true });
  if (!records.length || records.some((r) => isPrivateOrReservedIp(r.address))) {
    throw new Error("Target host resolves to a restricted IP address");
  }
  return parsed;
};

const safeFetchWithRedirectGuard = async (
  rawUrl: string,
  options: { requireHttps?: boolean; isHostAllowed?: (host: string) => boolean; timeoutMs?: number } = {}
): Promise<Response> => {
  let currentUrl = rawUrl;
  for (let redirects = 0; redirects < 3; redirects++) {
    const validated = await validateSafePublicUrl(currentUrl, options);
    const res = await fetch(validated.toString(), {
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs ?? 20000),
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("Redirect missing location header");
      currentUrl = new URL(location, validated).toString();
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects");
};

const AUDIO_ALLOWED_HOSTS = new Set([
  "everyayah.com",
  "www.everyayah.com",
  "cdn.islamic.network",
  "verses.quran.com",
  "audio.qurancdn.com",
  "mirrors.quranicaudio.com",
  "download.quranicaudio.com",
]);

const isAllowedAudioHost = (host: string): boolean =>
  AUDIO_ALLOWED_HOSTS.has(host) ||
  host.endsWith(".mp3quran.net") ||
  host.endsWith(".quranicaudio.com") ||
  host.endsWith(".islamic.network");

const PROVIDER_ALLOWED_HOSTS: Record<string, string[]> = {
  groq: ["api.groq.com"],
  openrouter: ["openrouter.ai"],
  mistral: ["api.mistral.ai"],
  routeway: ["api.routeway.ai"],
  deepseek: ["api.deepseek.com"],
  kilo: ["api.kilo.ai", "ai-gateway.kilo.ai"],
  huggingface: ["router.huggingface.co", "api-inference.huggingface.co"],
  stability: ["api.stability.ai"],
  gemini: ["generativelanguage.googleapis.com"],
  pollinations: ["image.pollinations.ai", "gen.pollinations.ai", "text.pollinations.ai", "pollinations.ai"],
};

const resolveSafeProviderUrl = (provider: string, rawBaseURL: string | undefined, rawEndpoint: string | undefined, fallbackBaseURL: string, defaultEndpoint: string): string => {
  const allowedHosts = PROVIDER_ALLOWED_HOSTS[provider];
  if (!allowedHosts) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  const candidateBase = (rawBaseURL && typeof rawBaseURL === "string" && rawBaseURL.trim()) ? rawBaseURL.trim() : fallbackBaseURL;
  const parsedBase = new URL(candidateBase);
  if (parsedBase.protocol !== "https:" || parsedBase.username || parsedBase.password) {
    throw new Error("Invalid upstream baseURL protocol");
  }
  if (!allowedHosts.includes(parsedBase.hostname.toLowerCase())) {
    throw new Error(`Untrusted baseURL host for provider ${provider}`);
  }
  const ep = (rawEndpoint && typeof rawEndpoint === "string" && rawEndpoint.trim()) ? rawEndpoint.trim() : defaultEndpoint;
  if (!ep.startsWith("/") || ep.includes("://") || ep.includes("@") || ep.includes("..")) {
    throw new Error("Invalid upstream endpoint path");
  }
  const cleanBase = candidateBase.replace(/\/+$/, "");
  if (cleanBase.includes("/images/generations") || cleanBase.includes("/chat/completions") || cleanBase.includes("/completions")) {
    return cleanBase;
  }
  return `${cleanBase}${ep}`;
};

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  const getEnvKey = (v: any) => (v && typeof v === 'string' && v.trim() !== '') ? v.trim() : '';

  const getFinalKey = (apiKey: string | undefined): string | undefined => {
    const val = apiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (val && typeof val === 'string' && val.trim() !== '') {
      const v = val.trim();
      if (v.startsWith('YOUR_') || v.startsWith('MY_') || v.length < 10) return undefined;
      return v;
    }
    return undefined;
  };

  const extractErrorMessage = (e: any, defaultMsg: string): string => {
    try {
      let msg = e?.message || "";
      if (typeof e === 'object' && e !== null) {
        if (e.message) msg = e.message;
        else msg = JSON.stringify(e);
      }
      let maxDepth = 3;
      while (maxDepth > 0) {
        const jsonMatch = msg.match(/\{.*\}/s);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.error?.message) {
              msg = parsed.error.message;
              maxDepth--;
              continue; // try to parse again in case it's nested stringified JSON
            }
          } catch (innerErr) {
            break; // not a valid JSON, stop trying
          }
        }
        break;
      }
      
      const lowerMsg = typeof msg === 'string' ? msg.toLowerCase() : '';
      if (lowerMsg.includes("quota") || lowerMsg.includes("exhausted") || lowerMsg.includes("429") || lowerMsg.includes("limit") || lowerMsg.includes("resource_exhausted")) {
        return "⚠️ لقد تم تجاوز حد الاستخدام الحالي للنموذج (الحصة المجانية المؤقتة نفدت أو تم تجاوز معدل الطلبات المسموح به). يرجى الانتظار لدقيقة واحدة وإعادة المحاولة، أو يمكنك إدخال مفتاح API الخاص بك من الإعدادات ⚙️ لتفادي أي قيود على الاستخدام.";
      }

      return msg || defaultMsg;
    } catch {
      return e?.message || defaultMsg;
    }
  };

  const createGeminiClient = (apiKey: string, timeoutMs?: number) =>
    new GoogleGenAI({
      apiKey,
      apiVersion: 'v1beta',
      httpOptions: {
        apiVersion: 'v1beta',
        ...(timeoutMs ? { timeout: timeoutMs } : {}),
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

  const supportsThinking = (mName: string): boolean => {
    const m = mName.toLowerCase();
    if (m.includes('-tts') || m.includes('-image') || m.includes('-live') || m.includes('-transcribe') || m.includes('embedding') || m.startsWith('imagen')) {
      return false;
    }
    return m.includes('gemini-3') || m.includes('gemini-4') || m.includes('robotics') || m.includes('thinking') || m.includes('r1');
  };

  // In-memory model cooldowns to avoid hammering quota-exhausted models
  const modelCooldowns = new Map<string, number>();

  // Dynamically populated set of Kilo free models (verified from /api/gateway/models)
  const dynamicKiloFreeModels = new Set<string>([
    'kilo-auto/free',
    'stepfun/step-3.7-flash:free',
    'poolside/laguna-m.1:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'openrouter/free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'poolside/laguna-xs-2.1:free',
    'cohere/north-mini-code:free',
    'kwaipilot/kat-coder-pro-v2.5:free',
    'tencent/hy3:free',
    'nvidia/nemotron-3.5-content-safety:free',
    'z-ai/glm-5:free',
    'z-ai/glm-4.5-air:free',
    'deepseek/deepseek-r1-0528:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen3-coder:free',
    'minimax/minimax-m2.5:free',
    'nvidia/nemotron-3.5-lightning:free',
    'nvidia/nemotron-3.5-super-vl:free',
    'baidu/ernie-5.5-flash-preview:free',
    'liquid/lfm-3-1.7b:free',
    'apodex/apodex-1.1-mini:free',
    'dots-studio/dots-3-note-preview:free',
    'stealth/glyph-cluster',
    'reflection/beam-free',
    'nvidia/nemotron-3.5-lightning-free'
  ]);

  // Pre-warm Kilo free models cache on startup (non-blocking)
  const refreshKiloFreeModelsCache = async () => {
    try {
      const response = await fetch('https://api.kilo.ai/api/gateway/models', { signal: AbortSignal.timeout(10000) });
      if (response.ok) {
        const data: any = await response.json();
        if (Array.isArray(data?.data)) {
          for (const m of data.data) {
            if (!m?.id) continue;
            const idLower = m.id.toLowerCase();
            const isZeroPrice = m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion ?? 0) === 0;
            if (m.isFree === true || isZeroPrice || idLower.endsWith(':free') || idLower.endsWith('-free') || idLower.includes('/free')) {
              dynamicKiloFreeModels.add(m.id);
            }
            if (Array.isArray(m.autoRouting?.models)) {
              for (const autoId of m.autoRouting.models) {
                if (autoId && m.id === 'kilo-auto/free') dynamicKiloFreeModels.add(autoId);
              }
            }
          }
          console.log(`[Startup] Cached ${dynamicKiloFreeModels.size} free Kilo models.`);
        }
      }
    } catch {
      // ignore startup prefetch errors
    }
  };
  void refreshKiloFreeModelsCache();

  const isModelCoolingDown = (model: string): boolean => {
    const expiresAt = modelCooldowns.get(model);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      modelCooldowns.delete(model);
      return false;
    }
    return true;
  };

  const markModelCooldown = (model: string, retryDelaySec?: number) => {
    const durationMs = (retryDelaySec && retryDelaySec > 0 ? retryDelaySec : 30) * 1000;
    modelCooldowns.set(model, Date.now() + durationMs);
    console.log(`[Cooldown] Model ${model} set on cooldown for ${Math.round(durationMs / 1000)}s`);
  };

  const getAttempts = (requestedModel: string, reqWebSearch: boolean, reqDeepThinking: boolean) => {
    const rawAttempts: Array<{ model: string; enableWebSearch: boolean; enableDeepThinking: boolean }> = [];

    const trimmedReq = (requestedModel && requestedModel.trim()) ? requestedModel.trim() : 'gemini-3.7-flash';
    const reqLower = trimmedReq.toLowerCase();
    // Normalize robotic2 / partial gemini-robotic-er2 aliases to the exact official model ID
    const safeRequested =
      reqLower === 'robotic2' ||
      reqLower.startsWith('gemini-robotic-er2') ||
      reqLower.startsWith('gemini-robotic-er-2')
        ? 'gemini-robotics-er-2-preview'
        : trimmedReq;

    const pushAttempt = (model: string, enableWebSearch: boolean, enableDeepThinking: boolean) => {
      const resolvedThinking = enableDeepThinking && supportsThinking(model);
      if (!rawAttempts.some(a => a.model === model && a.enableWebSearch === enableWebSearch && a.enableDeepThinking === resolvedThinking)) {
        rawAttempts.push({ model, enableWebSearch, enableDeepThinking: resolvedThinking });
      }
    };

    if (reqWebSearch && reqDeepThinking) {
      // Web Search + Deep Thinking: prioritize gemini-robotics-er-2-preview, then fallback chain
      pushAttempt('gemini-robotics-er-2-preview', true, true);
      pushAttempt('gemini-4-hydrogen', true, true);
      pushAttempt(safeRequested, true, true);
      for (const m of ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3-flash-preview']) {
        pushAttempt(m, true, true);
      }
    } else if (reqWebSearch) {
      // Web Search only: prioritize fast search model gemini-3.1-flash-lite, then requested & fallbacks
      pushAttempt('gemini-3.1-flash-lite', true, false);
      pushAttempt(safeRequested, true, false);
      for (const m of ['gemini-3.6-flash', 'gemini-3-flash-preview', 'gemini-3.7-flash']) {
        pushAttempt(m, true, false);
      }
    } else if (reqDeepThinking) {
      // Deep Thinking only: requested model first, then Gemini 4 & Gemini 3 chain
      pushAttempt(safeRequested, false, true);
      for (const m of ['gemini-4-hydrogen', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3-flash-preview']) {
        pushAttempt(m, false, true);
      }
    } else {
      // Standard text: requested model first
      pushAttempt(safeRequested, false, false);
    }

    // Plain (no-search, no-thinking) fallbacks when primary or Web Search fails
    const plainFallbacks = reqWebSearch
      ? [
          'gemini-3.5-flash-lite',
          'gemini-3.6-flash',
          'gemini-3-flash-preview',
          safeRequested,
          'gemini-3.1-flash-lite',
          'gemini-flash-lite-latest',
          'gemini-flash-latest',
          'gemini-3.8-flash',
          'gemini-4-hydrogen',
        ]
      : [
          safeRequested,
          'gemini-3.6-flash',
          'gemini-3-flash-preview',
          'gemini-3.5-flash-lite',
          'gemini-3.1-flash-lite',
          'gemini-flash-lite-latest',
          'gemini-flash-latest',
          'gemini-3.7-flash',
          'gemini-3.8-flash',
          'gemini-4-hydrogen',
        ];

    for (const m of plainFallbacks) {
      pushAttempt(m, false, false);
    }

    // Prioritize models that are NOT currently cooling down
    const available = rawAttempts.filter(a => !isModelCoolingDown(a.model));
    const coolingDown = rawAttempts.filter(a => isModelCoolingDown(a.model));
    return [...available, ...coolingDown].slice(0, 6);
  };

  // Gemini Endpoints
  app.post("/api/gemini/generate", async (req, res) => {
    const routeStart = Date.now();
    const OVERALL_DEADLINE_MS = 45000;
    let clientDisconnected = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        clientDisconnected = true;
      }
    });

    try {
      const { apiKey, model, messages, config } = req.body || {};
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages array is required" });
      }
      const finalKey = getFinalKey(apiKey);
      
      if (!finalKey) return res.status(401).json({ error: "Gemini API key is missing" });

      const requestedModel = model || 'gemini-3.7-flash';
      const reqWebSearch = !!config?.enableWebSearch;
      const reqDeepThinking = !!config?.enableDeepThinking;

      const attempts = getAttempts(requestedModel, reqWebSearch, reqDeepThinking);

      let lastError: any = null;
      let searchQuotaExhausted = false;

      for (const currentAttempt of attempts) {
        if (clientDisconnected) return;
        const remainingMs = OVERALL_DEADLINE_MS - (Date.now() - routeStart);
        if (remainingMs < 4000) {
          console.warn(`[Generate] Stopping fallback chain near deadline (${Date.now() - routeStart}ms elapsed).`);
          break;
        }

        // Skip attempts that require web search if we already detected that search quota is exhausted
        if (searchQuotaExhausted && currentAttempt.enableWebSearch) {
          continue;
        }

        const attemptTimeoutMs = Math.min(22000, remainingMs);

        try {
          const ai = createGeminiClient(finalKey, attemptTimeoutMs);
          const systemInstruction = messages.filter((m: any) => m.role === 'system').map((m: any) => m.content).join('\n\n') || config?.systemInstruction;
          
          const contents = messages.filter((m: any) => m.role !== 'system').map((m: any) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          }));

          const resolvedReasoningEffort = config?.reasoningEffort || (currentAttempt.enableDeepThinking ? 'high' : 'off');
          const requestedMaxTokens = config?.maxOutputTokens === 0
            ? 65536
            : (typeof config?.maxOutputTokens === 'number' && config.maxOutputTokens > 0 ? Math.min(config.maxOutputTokens, 65536) : 65536);

          const buildGeminiConfig = (maxTok: number, includeThinking: boolean, signalTimeoutMs: number) => {
            const cfg: any = {
              systemInstruction,
              responseMimeType: config?.responseMimeType,
              maxOutputTokens: maxTok,
              abortSignal: AbortSignal.timeout(signalTimeoutMs),
            };
            if (!currentAttempt.model.startsWith('gemini-4-')) {
              if (typeof config?.temperature === 'number') cfg.temperature = Math.min(Math.max(config.temperature, 0), 2);
              if (typeof config?.topP === 'number') cfg.topP = Math.min(Math.max(config.topP, 0.05), 1);
              if (typeof config?.topK === 'number') cfg.topK = Math.min(Math.max(Math.round(config.topK), 1), 100);
            }
            if (currentAttempt.enableWebSearch && !searchQuotaExhausted) {
              cfg.tools = [{ googleSearch: {} }];
            }
            if (includeThinking && resolvedReasoningEffort !== 'off' && supportsThinking(currentAttempt.model)) {
              const levelMap: Record<string, ThinkingLevel> = {
                low: ThinkingLevel.LOW,
                medium: ThinkingLevel.MEDIUM,
                high: ThinkingLevel.HIGH,
                max: ThinkingLevel.HIGH
              };
              cfg.thinkingConfig = { thinkingLevel: levelMap[resolvedReasoningEffort] || ThinkingLevel.HIGH };
            }
            return cfg;
          };

          console.log(`[Generate] Attempting with model: ${currentAttempt.model} (webSearch: ${currentAttempt.enableWebSearch && !searchQuotaExhausted}, reasoning: ${resolvedReasoningEffort}, maxTokens: ${requestedMaxTokens}, timeout: ${attemptTimeoutMs}ms)`);
          let response;
          try {
            response = await ai.models.generateContent({
              model: currentAttempt.model,
              contents,
              config: buildGeminiConfig(requestedMaxTokens, true, attemptTimeoutMs)
            });
          } catch (paramErr: any) {
            const pMsg = (paramErr?.message || '').toLowerCase();
            const remainingAfter = OVERALL_DEADLINE_MS - (Date.now() - routeStart);
            if (remainingAfter > 6000 && (pMsg.includes('maxoutputtokens') || pMsg.includes('max_output_tokens') || pMsg.includes('thinking') || pMsg.includes('400'))) {
              const fallbackTok = requestedMaxTokens > 8192 ? 8192 : requestedMaxTokens;
              response = await ai.models.generateContent({
                model: currentAttempt.model,
                contents,
                config: buildGeminiConfig(fallbackTok, false, Math.min(18000, remainingAfter))
              });
            } else {
              throw paramErr;
            }
          }

          if (!response.candidates?.[0]) throw new Error("Gemini returned no results.");
          const candidate = response.candidates[0];
          let content = response.text || "";
          
          // Handle potential issues where Gemini might return empty content for complex models
          if (!content && candidate.content?.parts) {
            content = candidate.content.parts.map((p: any) => p.text || '').join('');
          }

          const thought = candidate.content?.parts?.find((p: any) => p.thought)?.text || "";
          
          return res.json({ 
            content: content || " ", // Return a space instead of empty string to avoid empty function call errors
            model: currentAttempt.model, 
            groundingMetadata: candidate.groundingMetadata,
            thought
          });
        } catch (e: any) {
          lastError = e;
          const errMsg = e?.message || e?.toString() || "";
          if (errMsg.includes("401")) break;

          // If quota or rate limited or high demand (503), put model on cooldown
          if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("limit") || errMsg.includes("503")) {
            let delaySec = 30;
            const match = errMsg.match(/retry in ([0-9.]+)\s*s/i) || errMsg.match(/"retryDelay":\s*"(\d+)s"/i);
            if (match && match[1]) {
              delaySec = Math.ceil(parseFloat(match[1]));
            }
            markModelCooldown(currentAttempt.model, delaySec);

            if (currentAttempt.enableWebSearch) {
              console.log("Search quota reached; proceeding immediately with non-search fallbacks...");
              searchQuotaExhausted = true;
            }
            console.log(`[Generate] Model ${currentAttempt.model} reached rate/quota limit, routing to alternative model...`);
          } else {
            console.log(`[Generate] Model ${currentAttempt.model} attempt concluded (${errMsg.slice(0, 120)}), trying alternative...`);
          }
        }
      }

      const timedOut = (Date.now() - routeStart) >= OVERALL_DEADLINE_MS - 4000;
      return res.status(timedOut ? 504 : 500).json({
        error: timedOut
          ? "انتهت مهلة انتظار استجابة النموذج. يرجى المحاولة مرة أخرى أو اختيار نموذج أسرع مثل gemini-3.7-flash."
          : extractErrorMessage(lastError, "Failed to generate content"),
      });
    } catch (globalError: any) {
      console.warn("[Generate Global Error]", globalError?.message || globalError);
      return res.status(500).json({ error: globalError?.message || "Internal server error during text generation" });
    }
  });

  app.post("/api/gemini/stream", async (req, res) => {
    const routeStart = Date.now();
    const STREAM_CONNECT_DEADLINE_MS = 45000;
    let clientDisconnected = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        clientDisconnected = true;
      }
    });
    try {
      const { apiKey, model, messages, config } = req.body || {};
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages array is required" });
      }
      const finalKey = getFinalKey(apiKey);
      if (!finalKey) return res.status(401).json({ error: "Gemini API key is missing" });

      const requestedModel = model || 'gemini-3.7-flash';
      const reqWebSearch = !!config?.enableWebSearch;
      const reqDeepThinking = !!config?.enableDeepThinking;

      const attempts = getAttempts(requestedModel, reqWebSearch, reqDeepThinking);

      let lastError = null;
      let searchQuotaExhausted = false;

      for (const currentAttempt of attempts) {
        if (clientDisconnected || res.writableEnded) return;
        const remainingMs = STREAM_CONNECT_DEADLINE_MS - (Date.now() - routeStart);
        if (remainingMs < 4000) break;
        if (searchQuotaExhausted && currentAttempt.enableWebSearch) {
          continue;
        }

        const connectTimeoutMs = Math.min(22000, remainingMs);

        try {
          const ai = createGeminiClient(finalKey);
          const systemInstruction = messages.filter((m: any) => m.role === 'system').map((m: any) => m.content).join('\n\n') || config?.systemInstruction;
          const contents = messages.filter((m: any) => m.role !== 'system').map((m: any) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          }));

          const resolvedReasoningEffort = config?.reasoningEffort || (currentAttempt.enableDeepThinking ? 'high' : 'off');
          const requestedMaxTokens = config?.maxOutputTokens === 0
            ? 65536
            : (typeof config?.maxOutputTokens === 'number' && config.maxOutputTokens > 0 ? Math.min(config.maxOutputTokens, 65536) : 65536);

          const buildGeminiStreamConfig = (maxTok: number, includeThinking: boolean) => {
            const cfg: any = {
              systemInstruction,
              responseMimeType: config?.responseMimeType,
              maxOutputTokens: maxTok
            };
            if (!currentAttempt.model.startsWith('gemini-4-')) {
              if (typeof config?.temperature === 'number') cfg.temperature = Math.min(Math.max(config.temperature, 0), 2);
              if (typeof config?.topP === 'number') cfg.topP = Math.min(Math.max(config.topP, 0.05), 1);
              if (typeof config?.topK === 'number') cfg.topK = Math.min(Math.max(Math.round(config.topK), 1), 100);
            }
            if (currentAttempt.enableWebSearch && !searchQuotaExhausted) {
              cfg.tools = [{ googleSearch: {} }];
            }
            if (includeThinking && resolvedReasoningEffort !== 'off' && supportsThinking(currentAttempt.model)) {
              const levelMap: Record<string, ThinkingLevel> = {
                low: ThinkingLevel.LOW,
                medium: ThinkingLevel.MEDIUM,
                high: ThinkingLevel.HIGH,
                max: ThinkingLevel.HIGH
              };
              cfg.thinkingConfig = { thinkingLevel: levelMap[resolvedReasoningEffort] || ThinkingLevel.HIGH };
            }
            return cfg;
          };

          const raceConnectTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
            Promise.race([
              promise,
              new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Stream handshake timeout after ${ms}ms`)), ms))
            ]);

          console.log(`[Stream] Attempting with model: ${currentAttempt.model} (webSearch: ${currentAttempt.enableWebSearch && !searchQuotaExhausted}, reasoning: ${resolvedReasoningEffort}, maxTokens: ${requestedMaxTokens})`);
          let responseStream;
          try {
            responseStream = await raceConnectTimeout(
              ai.models.generateContentStream({
                model: currentAttempt.model,
                contents,
                config: buildGeminiStreamConfig(requestedMaxTokens, true)
              }),
              connectTimeoutMs
            );
          } catch (paramErr: any) {
            const pMsg = (paramErr?.message || '').toLowerCase();
            const remainingAfter = STREAM_CONNECT_DEADLINE_MS - (Date.now() - routeStart);
            if (remainingAfter > 6000 && (pMsg.includes('maxoutputtokens') || pMsg.includes('max_output_tokens') || pMsg.includes('thinking') || pMsg.includes('400'))) {
              const fallbackTok = requestedMaxTokens > 8192 ? 8192 : requestedMaxTokens;
              responseStream = await raceConnectTimeout(
                ai.models.generateContentStream({
                  model: currentAttempt.model,
                  contents,
                  config: buildGeminiStreamConfig(fallbackTok, false)
                }),
                Math.min(18000, remainingAfter)
              );
            } else {
              throw paramErr;
            }
          }

          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('X-Accel-Buffering', 'no');
          if (typeof (res as any).flushHeaders === 'function') (res as any).flushHeaders();
          for await (const chunk of responseStream) {
            if (clientDisconnected || res.writableEnded) break;
            const candidate = chunk.candidates?.[0];
            const text = chunk.text || "";
            const groundingMetadata = candidate?.groundingMetadata;
            const thought = candidate?.content?.parts?.filter((p: any) => p.thought).map((p: any) => p.text || '').join('') || "";
            
            if (text || groundingMetadata || thought) {
              res.write("data: " + JSON.stringify({ text, groundingMetadata, thought }) + "\n\n");
            }
          }
          if (!res.writableEnded) {
            res.write("data: [DONE]\n\n");
            res.end();
          }
          return;
        } catch (e: any) {
          lastError = e;
          const errMsg = e?.message || e?.toString() || "";
          if (res.headersSent) throw e;
          if (errMsg.includes("401")) break;

          if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("limit") || errMsg.includes("503")) {
            let delaySec = 30;
            const match = errMsg.match(/retry in ([0-9.]+)\s*s/i) || errMsg.match(/"retryDelay":\s*"(\d+)s"/i);
            if (match && match[1]) {
              delaySec = Math.ceil(parseFloat(match[1]));
            }
            markModelCooldown(currentAttempt.model, delaySec);

            if (currentAttempt.enableWebSearch) {
              console.log("Stream search quota reached; proceeding immediately with non-search fallbacks...");
              searchQuotaExhausted = true;
            }
            console.log(`[Stream] Model ${currentAttempt.model} reached rate/quota limit, routing to alternative model...`);
          } else {
            console.log(`[Stream] Model ${currentAttempt.model} attempt concluded, trying alternative...`);
          }
        }
      }

      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write("data: " + JSON.stringify({ error: extractErrorMessage(lastError, "Stream failed") }) + "\n\n");
        res.end();
      }
    } catch (globalError: any) {
      console.warn("[Stream Global Error]", globalError?.message || globalError);
      try {
        if (!res.writableEnded) {
          res.write("data: " + JSON.stringify({ error: globalError?.message || "Internal server error during streaming" }) + "\n\n");
          res.end();
        }
      } catch (e) {}
    }
  });

  app.post("/api/gemini/image", async (req, res) => {
    try {
      const { apiKey, model, prompt, config } = req.body || {};
      if (typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: "prompt is required" });
      }
      const finalKey = getFinalKey(apiKey);
      if (!finalKey) return res.status(401).json({ error: "Gemini API key is missing" });

      // Build the sequential fallback list of official Gemini image models
      const requestedModel = model || 'gemini-3.1-flash-lite-image';
      const modelsToTry = [requestedModel];
      const fallbackList = [
        'gemini-3.1-flash-lite-image',
        'gemini-3.1-flash-image',
        'gemini-2.5-flash-image',
        'gemini-3-pro-image'
      ];

      for (const m of fallbackList) {
        if (!modelsToTry.includes(m)) {
          modelsToTry.push(m);
        }
      }

      let lastError = null;
      const ai = createGeminiClient(finalKey);

      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      for (let i = 0; i < modelsToTry.length; i++) {
        const currentModel = modelsToTry[i];
        try {
          console.log(`[ImageGen] Attempting image generation with model: ${currentModel}`);
          
          let base64Image: string | undefined;
          
          if (currentModel.startsWith('imagen')) {
            const imageResponse = await ai.models.generateImages({
              model: currentModel,
              prompt: prompt,
              config: {
                aspectRatio: config?.aspectRatio || '1:1',
                outputMimeType: 'image/png'
              }
            });
            base64Image = imageResponse.generatedImages?.[0]?.image?.imageBytes;
          } else {
            const response = await ai.models.generateContent({
              model: currentModel,
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              config: {
                responseModalities: [Modality.IMAGE],
                imageConfig: {
                  aspectRatio: config?.aspectRatio || '1:1'
                }
              }
            });
            const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            base64Image = part?.inlineData?.data;
          }
          
          if (base64Image) {
            console.log(`[ImageGen] Success with model: ${currentModel}`);
            const buffer = Buffer.from(base64Image, 'base64');
            res.setHeader('Content-Type', 'image/png');
            return res.send(buffer);
          }
          
          throw new Error(`لم يتم استلام بيانات الصورة من ${currentModel}.`);
        } catch (e: any) {
          console.log(`[ImageGen] Model ${currentModel} unavailable, routing to next image model...`);
          lastError = e;
          if (i < modelsToTry.length - 1) {
            await sleep(500); 
          }
        }
      }

      return res.status(500).json({ error: extractErrorMessage(lastError, "فشل توليد الصورة عبر Gemini") });
    } catch (globalError: any) {
      console.warn("[ImageGen Global Error]", globalError?.message || globalError);
      return res.status(500).json({ error: globalError?.message || "Internal server error during image generation" });
    }
  });

  const ttsCooldowns = new Map<string, number>();

  app.post("/api/cache/reset", (_req, res) => {
    modelCooldowns.clear();
    ttsCooldowns.clear();
    res.json({ ok: true, cleared: true });
  });

  const VALID_PREBUILT_VOICES = new Set([
    'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede',
    'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba',
    'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar',
    'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi',
    'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'
  ]);

  app.post("/api/gemini/speech", async (req, res) => {
    const routeStart = Date.now();
    const OVERALL_DEADLINE_MS = 48000;
    const { apiKey, model, text, voiceName, voiceStyle } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: "text is required" });
    }
    const finalKey = getFinalKey(apiKey);
    if (!finalKey) return res.status(401).json({ error: "Gemini API key is missing" });

    const safeVoiceName = VALID_PREBUILT_VOICES.has(voiceName) ? voiceName : 'Charon';
    const requestedModel = model || 'gemini-3.8-flash-lite-tts';
    const candidateList = [
      'gemini-3.8-flash-lite-tts',
      'gemini-3.8-flash-tts',
      'gemini-3.1-flash-tts-preview',
      'gemini-2.5-flash-preview-tts',
      'gemini-2.5-pro-preview-tts',
    ];

    // Prioritize requested TTS model if it's a valid TTS model, otherwise start with flagship TTS models
    const isRequestedTts = requestedModel.toLowerCase().includes('tts');
    const uniqueModels = Array.from(
      new Set(isRequestedTts ? [requestedModel, ...candidateList] : candidateList)
    );

    // Sort so models not in cooldown are tried first
    const now = Date.now();
    uniqueModels.sort((a, b) => {
      const aCool = (ttsCooldowns.get(a) || 0) > now ? 1 : 0;
      const bCool = (ttsCooldowns.get(b) || 0) > now ? 1 : 0;
      return aCool - bCool;
    });

    const trimmedStyle = typeof voiceStyle === 'string' ? voiceStyle.trim() : '';

    let lastError = null;
    const ai = createGeminiClient(finalKey);
    for (const currentModel of uniqueModels) {
      const remainingMs = OVERALL_DEADLINE_MS - (Date.now() - routeStart);
      if (remainingMs < 5000) break;

      const attemptTimeoutMs = Math.min(36000, remainingMs);

      const synthesize = async (useStyleMetadata: boolean) => {
        const partPayload: any = { text };
        if (useStyleMetadata && trimmedStyle) {
          partPayload.speechMetadata = { style: trimmedStyle };
        }
        return await ai.models.generateContent({
          model: currentModel,
          contents: [{ role: 'user', parts: [partPayload] }],
          config: {
            abortSignal: AbortSignal.timeout(attemptTimeoutMs),
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: safeVoiceName as any },
              },
            },
          },
        });
      };

      try {
        console.log(`[Speech] Synthesizing speech with model: ${currentModel}, voice: ${safeVoiceName}`);
        let response;
        try {
          response = await synthesize(Boolean(trimmedStyle));
        } catch (metaErr: any) {
          const metaMsg = String(metaErr?.message || metaErr || '');
          if (trimmedStyle && metaMsg.toLowerCase().includes('speechmetadata')) {
            console.warn(`[Speech] Model ${currentModel} rejected speechMetadata, retrying without style metadata...`);
            response = await synthesize(false);
          } else {
            throw metaErr;
          }
        }

        const part = response.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
        if (part?.inlineData?.data) {
          return res.json({ audioData: part.inlineData.data, mimeType: part.inlineData.mimeType || 'audio/wav' });
        } else {
          throw new Error("No audio data received");
        }
      } catch (e: any) {
        lastError = e;
        const errMsg = e?.message || e?.toString() || "";
        if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("limit")) {
          console.log(`[Speech] Model ${currentModel} reached quota limit, routing to alternative TTS model...`);
          ttsCooldowns.set(currentModel, Date.now() + 60000);
        } else {
          console.log(`[Speech] Model ${currentModel} unavailable (${errMsg.slice(0, 120)}), routing to alternative TTS model...`);
        }
      }
    }

    res.status(500).json({ error: extractErrorMessage(lastError, "Failed to generate speech") });
  });

  app.post("/api/gemini/transcribe", async (req, res) => {
    try {
      const { apiKey, base64Audio, mimeType } = req.body || {};
      if (typeof base64Audio !== 'string' || !base64Audio.trim()) {
        return res.status(400).json({ error: "base64Audio is required" });
      }
      const finalKey = getFinalKey(apiKey);
      if (!finalKey) return res.status(401).json({ error: "Gemini API key is missing" });

      const ai = createGeminiClient(finalKey);
      
      const contents = {
        parts: [
          {
            inlineData: {
              data: base64Audio,
              mimeType: mimeType,
            },
          },
          {
            text: "قم بتفريغ هذا المقطع الصوتي إلى نص عربي بدقة. أعد النص فقط بدون أي إضافات أو تعليقات.",
          },
        ],
      };

      const modelsToTry = ['gemini-3.5-transcribe', 'gemini-3.8-flash', 'gemini-3.5-flash'];
      let lastError = null;

      for (const m of modelsToTry) {
        try {
          console.log(`[Transcribe] Attempting with model: ${m}`);
          const response = await ai.models.generateContent({
            model: m,
            contents,
          });
          return res.json({ text: response.text || '' });
        } catch (err: any) {
          console.log(`[Transcribe] Model ${m} failed:`, err?.message || err);
          lastError = err;
        }
      }

      return res.status(500).json({ error: extractErrorMessage(lastError, "Failed to transcribe audio") });
    } catch (globalError: any) {
      console.warn("[Transcribe Global Error]", globalError?.message || globalError);
      return res.status(500).json({ error: globalError?.message || "Internal server error during transcription" });
    }
  });

  // Proxy endpoint for fetching images to avoid CORS (with SSRF guard)
  app.get("/api/proxy/image", async (req, res) => {
    const imageUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!imageUrl) {
      return res.status(400).send("URL is required");
    }
    try {
      const response = await safeFetchWithRedirectGuard(imageUrl, { requireHttps: true, timeoutMs: 25000 });
      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch image: ${response.statusText}`);
      }
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.startsWith('image/')) {
        return res.status(415).send("Upstream response is not a valid image");
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch (error: any) {
      const msg = error?.message || "Failed to fetch image";
      const isValidationErr = /protocol|internal|private|reserved|allowed|url|redirect|credentials/i.test(msg);
      res.status(isValidationErr ? 403 : 500).send(msg);
    }
  });

  // Proxy endpoint for fetching Quran CDN audio to avoid CORS and network blocks (with SSRF allowlist)
  app.get("/api/proxy/audio", async (req, res) => {
    const audioUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!audioUrl) {
      return res.status(400).send("URL is required");
    }
    try {
      const response = await safeFetchWithRedirectGuard(audioUrl, {
        requireHttps: true,
        isHostAllowed: isAllowedAudioHost,
        timeoutMs: 25000,
      });
      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch audio: ${response.statusText}`);
      }
      const contentType = (response.headers.get('content-type') || 'audio/mpeg').toLowerCase();
      if (contentType.includes('text/html') || contentType.includes('application/json') || contentType.includes('xml')) {
        return res.status(415).send("Upstream response is not valid audio");
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for up to 1 year since Quran audio is static
      res.send(buffer);
    } catch (error: any) {
      const msg = error?.message || "Failed to fetch audio";
      const isValidationErr = /protocol|internal|private|reserved|allowed|url|redirect|credentials/i.test(msg);
      res.status(isValidationErr ? 403 : 500).send(msg);
    }
  });

  // Fetch Gemini Live API models dynamically (filtered by bidiGenerateContent or live capabilities + robotics streaming)
  app.post("/api/models/gemini-live", async (req, res) => {
    const { apiKey } = req.body || {};
    const serverKey = getEnvKey(process.env.API_KEY) || getEnvKey(process.env.GEMINI_API_KEY);
    const geminiKey = getFinalKey(apiKey) || getFinalKey(serverKey);

    const priorityLiveModels = [
      'gemini-2.5-flash-native-audio-latest',
      'gemini-2.5-flash-native-audio-preview-12-2025',
      'gemini-2.5-flash-native-audio-preview-09-2025',
      'gemini-robotics-er-2-streaming-preview',
      'gemini-3.8-live',
      'gemini-3.8-live-extended-thinking',
      'gemini-3.5-live-translate-preview',
      'gemini-3.5-transcribe-live',
    ];

    const discoveredLive: string[] = [];
    let fetchedFromApi = false;

    if (geminiKey) {
      try {
        let nextPageToken = '';
        let pages = 0;
        do {
          const pageQuery = nextPageToken ? `&pageToken=${encodeURIComponent(nextPageToken)}` : '';
          const url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${geminiKey}${pageQuery}`;
          const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
          if (!response.ok) break;
          const data: any = await response.json();
          if (Array.isArray(data?.models)) {
            fetchedFromApi = true;
            for (const m of data.models) {
              const id = (m.name || '').replace('models/', '').trim();
              if (!id) continue;
              const idLower = id.toLowerCase();
              const methods: string[] = Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
              const supportsBidi = methods.some((mtd) => mtd.toLowerCase().includes('bidigeneratecontent'));
              const looksLive =
                supportsBidi ||
                idLower.includes('-live') ||
                idLower.includes('native-audio') ||
                idLower.includes('robotics-er-2-streaming') ||
                idLower.includes('streaming-preview');
              if (looksLive && !idLower.includes('embedding') && !idLower.endsWith('-tts') && !idLower.includes('tts-preview')) {
                discoveredLive.push(id);
              }
            }
          }
          nextPageToken = data?.nextPageToken || '';
          pages += 1;
        } while (nextPageToken && pages < 5);
      } catch (err) {
        console.error("Gemini Live API models fetch failed:", err);
      }
    }

    const combined = Array.from(new Set([...priorityLiveModels, ...discoveredLive]));
    return res.status(200).json({
      models: combined,
      apiCount: discoveredLive.length,
      source: fetchedFromApi ? 'api' : 'registry',
    });
  });

  // Fetch models dynamically from provider source
  app.post("/api/models/:provider", async (req, res) => {
    const { provider } = req.params;
    const { apiKey } = req.body;

    const serverKey = 
      provider === 'groq' ? getEnvKey(process.env.GROQ_API_KEY) :
      provider === 'openrouter' ? getEnvKey(process.env.OPENROUTER_API_KEY) :
      provider === 'mistral' ? getEnvKey(process.env.MISTRAL_API_KEY) :
      provider === 'routeway' ? getEnvKey(process.env.ROUTEWAY_API_KEY) :
      provider === 'deepseek' ? getEnvKey(process.env.DEEPSEEK_API_KEY) : 
      provider === 'kilo' ? getEnvKey(process.env.KILO_API_KEY) :
      provider === 'huggingface' ? getEnvKey(process.env.HF_API_KEY) :
      provider === 'gemini' ? (getEnvKey(process.env.API_KEY) || getEnvKey(process.env.GEMINI_API_KEY)) : '';

    let finalKey = getEnvKey(apiKey) || serverKey;
    if (!finalKey) {
      if (['kilo', 'routeway', 'openrouter', 'huggingface', 'pollinations'].includes(provider)) {
        finalKey = `${provider}_free_gateway_key`;
      }
    }

    try {
      let models: string[] = [];
      let freeModels: string[] = [];

      if (provider === 'gemini') {
        const allGeminiModels = [
          'gemini-robotics-er-2-preview',
          'gemini-robotics-er-2-streaming-preview',
          'gemini-3.8-live',
          'gemini-3.8-live-extended-thinking',
          'gemini-3.5-live-translate-preview',
          'gemini-3.5-transcribe-live',
          'gemini-4-hydrogen',
          'gemini-3.7-flash',
          'gemini-3.6-flash',
          'gemini-3.8-flash',
          'gemini-3.8-flash:batch',
          'gemini-3.8-pro',
          'gemini-3.8-pro:batch',
          'gemini-3.8-flash-tts',
          'gemini-3.7-flash:batch',
          'gemini-3.6-flash:batch',
          'gemini-3.5-flash',
          'gemini-3.5-flash:batch',
          'gemini-3.5-flash-lite',
          'gemini-3.5-flash-lite:batch',
          'gemini-3.5-flash-tts',
          'gemini-3.5-pro',
          'gemini-3.1-flash-lite',
          'gemini-3.1-flash-lite:batch',
          'gemini-3.1-flash-lite-preview',
          'gemini-3.1-flash-lite-image',
          'gemini-3.1-flash-tts-preview',
          'gemini-3.1-pro-preview',
          'gemini-3.1-pro-preview:batch',
          'gemini-3.1-pro-preview-customtools',
          'gemini-3.1-flash-image',
          'gemini-3.1-flash-image-preview',
          'gemini-3-flash-preview',
          'gemini-3-flash-preview:batch',
          'gemini-3-pro-image',
          'gemini-3-pro-image-preview',
          'gemini-2.5-flash',
          'gemini-2.5-flash:batch',
          'gemini-2.5-flash-lite',
          'gemini-2.5-flash-lite:batch',
          'gemini-2.5-flash-tts',
          'gemini-2.5-flash-image',
          'gemini-2.5-pro',
          'gemini-2.5-pro-preview',
          'gemini-2.5-pro:batch',
          'gemini-2.0-flash',
          'gemini-2.0-flash-001',
          'gemini-2.0-flash-lite',
          'gemini-2.0-flash-lite-001',
          'gemini-2.0-flash-lite-preview-02-05',
          'gemini-2.0-flash-thinking-exp-01-21',
          'gemini-2.0-flash-tts',
          'gemini-2.0-pro-exp-02-05',
          'gemini-1.5-flash',
          'gemini-1.5-flash-latest',
          'gemini-1.5-flash-8b',
          'gemini-1.5-flash-8b-latest',
          'gemini-1.5-flash-tts',
          'gemini-1.5-pro',
          'gemini-1.5-pro-latest',
          'gemini-flash-latest',
          'gemini-flash-lite-latest',
          'gemini-pro-latest',
          'gemini-ultra-latest',
          'gemini-ultra',
          'imagen-3.0-generate-002',
          'imagen-3.0-fast-generate-001',
          'imagen-3.0-capability-001',
          'imagen-4',
          'diffusiongemma',
          'gemma-2-2b-it',
          'gemma-2-9b-it',
          'gemma-2-27b-it',
          'gemma-3-4b-it',
          'gemma-3-12b-it',
          'gemma-3-27b-it',
          'gemma-3n-e2b-it',
          'gemma-3n-e4b-it',
          'gemma-4-26b-a4b-it',
          'gemma-4-26b-a4b-it:free',
          'gemma-4-31b-it',
          'gemma-4-31b-it:free'
        ];

        const classifyGeminiFree = (list: string[]) => list.filter((id) => {
          const m = id.toLowerCase();
          if (m.endsWith(':free')) return true;
          if (m.includes('pro') || m.includes('ultra') || m.includes('imagen-4') || m.includes('imagen-3.0-capability')) return false;
          return true;
        });

        const geminiKey = getFinalKey(apiKey) || getFinalKey(serverKey);
        if (geminiKey) {
          try {
            // Standard official Google Gemini Models API
            const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`;
            const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (response.ok) {
              const data: any = await response.json();
              if (data && data.models && Array.isArray(data.models)) {
                // Stripping 'models/' prefix and returning EVERYTHING without exceptions
                const apiModels = data.models
                  .map((m: any) => (m.name || '').replace('models/', '').trim())
                  .filter(Boolean);
                const combined = Array.from(new Set([...apiModels, ...allGeminiModels])).sort();
                return res.status(200).json({ models: combined, freeModels: classifyGeminiFree(combined).sort() });
              }
            }
          } catch (err) {
            console.error("Gemini API models fetch failed:", err);
          }
        }
        const sortedGemini = Array.from(new Set(allGeminiModels)).sort();
        return res.status(200).json({ models: sortedGemini, freeModels: classifyGeminiFree(sortedGemini).sort() });
      } else if (provider === 'groq') {
        const defaultGroqModels = [
          'llama-3.3-70b-versatile',
          'llama-3.3-70b-specdec',
          'llama-3.1-8b-instant',
          'llama-3.1-70b-versatile',
          'llama-3.2-1b-preview',
          'llama-3.2-3b-preview',
          'llama-3.2-11b-vision-preview',
          'llama-3.2-90b-vision-preview',
          'meta-llama/llama-4-maverick-17b-128e-instruct',
          'meta-llama/llama-4-scout-17b-16e-instruct',
          'llama-guard-3-8b',
          'deepseek-r1-distill-llama-70b',
          'deepseek-r1-distill-qwen-32b',
          'qwen/qwen3-32b',
          'qwen-qwq-32b',
          'qwen-2.5-32b',
          'qwen-2.5-coder-32b',
          'openai/gpt-oss-120b',
          'openai/gpt-oss-20b',
          'openai/gpt-oss-safeguard-20b',
          'moonshotai/kimi-k2-instruct',
          'allam-2-7b',
          'compound-beta',
          'compound-beta-mini',
          'mixtral-8x7b-32768',
          'gemma2-9b-it',
          'whisper-large-v3',
          'whisper-large-v3-turbo',
          'distil-whisper-large-v3-en'
        ];
        try {
          if (finalKey) {
            const response = await fetch(`https://api.groq.com/openai/v1/models`, {
              headers: { 'Authorization': `Bearer ${finalKey}` },
              signal: AbortSignal.timeout(10000)
            });
            if (response.ok) {
              const data: any = await response.json();
              if (data.data) {
                const apiModels = data.data.map((m: any) => m.id).filter(Boolean);
                models = Array.from(new Set([...apiModels, ...defaultGroqModels]));
              }
            }
          }
          if (models.length === 0) models = defaultGroqModels;
        } catch {
          models = defaultGroqModels;
        }
        freeModels = [...models];
      } else if (provider === 'openrouter') {
        const defaultOpenRouterModels = [
          'openrouter/free',
          'google/gemini-2.5-flash',
          'google/gemini-2.5-pro',
          'google/gemini-2.0-flash-lite-preview-02-05:free',
          'google/gemini-2.0-flash-001',
          'google/gemini-2.0-pro-exp-02-05:free',
          'google/gemma-4-26b-a4b-it:free',
          'google/gemma-4-31b-it:free',
          'google/gemma-3-27b-it:free',
          'google/gemma-2-9b-it:free',
          'google/gemma-2-27b-it',
          'meta-llama/llama-3.3-70b-instruct:free',
          'meta-llama/llama-3.1-8b-instruct:free',
          'meta-llama/llama-3.1-70b-instruct',
          'meta-llama/llama-3.1-405b-instruct',
          'deepseek/deepseek-r1:free',
          'deepseek/deepseek-r1-0528:free',
          'deepseek/deepseek-chat:free',
          'deepseek/deepseek-chat-v3-0324:free',
          'deepseek/deepseek-v3',
          'deepseek/deepseek-v4.1-flash-1017',
          'deepseek/deepseek-r1-distill-qwen-32b',
          'deepseek/deepseek-r1-distill-llama-70b',
          'anthropic/claude-3.7-sonnet',
          'anthropic/claude-3.5-sonnet',
          'anthropic/claude-3.5-haiku',
          'openai/gpt-oss-120b:free',
          'openai/gpt-oss-20b:free',
          'openai/gpt-4o',
          'openai/gpt-4o-mini',
          'openai/o3-mini',
          'openai/o1',
          'openai/gpt-6.1-sol',
          'openai/gpt-6.1-terra',
          'qwen/qwen3-coder:free',
          'qwen/qwen3-235b-a22b:free',
          'qwen/qwen-2.5-72b-instruct:free',
          'qwen/qwen-2.5-72b-instruct',
          'qwen/qwen-2.5-coder-32b-instruct',
          'qwen/qwen-2.5-7b-instruct:free',
          'qwen/qwen3.8-max-prime',
          'mistralai/mistral-large-2407',
          'mistralai/mistral-nemo:free',
          'microsoft/phi-4',
          'microsoft/phi-3-mini-128k-instruct:free',
          'huggingfaceh4/zephyr-7b-beta:free'
        ];
        const freeSet = new Set<string>(
          defaultOpenRouterModels.filter((id) => id.includes(':free') || id.includes('-free') || id === 'openrouter/free')
        );
        try {
          const response = await fetch(`https://openrouter.ai/api/v1/models`, { signal: AbortSignal.timeout(15000) });
          if (!response.ok) throw new Error(`OpenRouter status ${response.status}`);
          const data: any = await response.json();
          if (data.data && Array.isArray(data.data)) {
            const apiModels = data.data.map((m: any) => m.id).filter(Boolean);
            for (const m of data.data) {
              if (!m?.id) continue;
              const idLower = m.id.toLowerCase();
              const isZero = m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion ?? 0) === 0;
              if (m.isFree === true || isZero || idLower.includes(':free') || idLower.includes('-free') || idLower.includes('/free')) {
                freeSet.add(m.id);
              }
            }
            models = Array.from(new Set([...apiModels, ...defaultOpenRouterModels]));
          }
          if (models.length === 0) models = defaultOpenRouterModels;
        } catch (e) {
          console.warn("OpenRouter fetch fallback");
          models = defaultOpenRouterModels;
        }
        freeModels = Array.from(freeSet);
      } else if (provider === 'mistral') {
        const defaultMistralModels = [
          'mistral-large-latest',
          'mistral-medium-latest',
          'mistral-small-latest',
          'codestral-latest',
          'codestral-2508',
          'pixtral-large-latest',
          'pixtral-12b-2409',
          'ministral-8b-latest',
          'ministral-3b-latest',
          'open-mistral-7b',
          'open-mixtral-8x7b',
          'open-mixtral-8x22b',
          'devstral-2512',
          'voxtral-small-24b-2507',
          'mistral-embed'
        ];
        try {
          if (finalKey) {
            const response = await fetch(`https://api.mistral.ai/v1/models`, {
              headers: { 'Authorization': `Bearer ${finalKey}` },
              signal: AbortSignal.timeout(10000)
            });
            if (response.ok) {
              const data: any = await response.json();
              if (data.data) {
                const apiModels = data.data.map((m: any) => m.id).filter(Boolean);
                models = Array.from(new Set([...apiModels, ...defaultMistralModels]));
              }
            }
          }
          if (models.length === 0) models = defaultMistralModels;
        } catch {
          models = defaultMistralModels;
        }
        freeModels = models.filter((id) => {
          const m = id.toLowerCase();
          return m.includes(':free') || m.startsWith('open-') || m.includes('small') || m.includes('ministral') || m.includes('embed');
        });
      } else if (provider === 'deepseek') {
        const defaultDeepSeekModels = [
          'deepseek-chat',
          'deepseek-reasoner',
          'deepseek-v3',
          'deepseek-v3.1',
          'deepseek-v3.2',
          'deepseek-r1',
          'deepseek-r1-0528',
          'deepseek-r1-distill-qwen-32b',
          'deepseek-r1-distill-llama-70b',
          'deepseek-coder'
        ];
        try {
          if (finalKey) {
            const response = await fetch(`https://api.deepseek.com/v1/models`, {
              headers: { 'Authorization': `Bearer ${finalKey}` },
              signal: AbortSignal.timeout(10000)
            });
            if (response.ok) {
              const data: any = await response.json();
              if (data.data) {
                const apiModels = data.data.map((m: any) => m.id).filter(Boolean);
                models = Array.from(new Set([...apiModels, ...defaultDeepSeekModels]));
              }
            }
          }
          if (models.length === 0) models = defaultDeepSeekModels;
        } catch {
          models = defaultDeepSeekModels;
        }
        freeModels = models.filter((id) => id.toLowerCase().includes(':free') || id.toLowerCase().includes('-free'));
      } else if (provider === 'routeway') {
        const defaultRoutewayModels = [
          'step-3.5-flash:free',
          'step-3.7-flash',
          'deepseek-v4.1-flash:free',
          'minimax-m3.1-flash:free',
          'muse-glimmer-30b:free',
          'arcee-ai/trinity-large-preview:free',
          'nvidia/nemotron-3-nano-30b-a3b:free',
          'mistral/devstral-2-2512:free',
          'minimax/minimax-m2:free',
          'nvidia/nemotron-nano-9b-v2:free',
          'deepseek/r1-distill-qwen-32b:free',
          'meta/llama-3.3-70b-instruct:free',
          'meta/llama-3.2-3b-instruct:free',
          'meta/llama-3.2-1b-instruct:free',
          'meta/llama-3.1-8b-instruct:free',
          'mistral/mistral-nemo-instruct:free',
          'moonshotai/kimi-k2-0905:free',
          'openai/gpt-oss-120b:free',
          'z-ai/glm-4.5-air:free',
          'deepseek-r1:free',
          'deepseek-v3:free',
          'qwen3.8-27b',
          'gpt-6.1-sol',
          'gpt-6-luna',
          'gemini-3.8-flash',
          'gemini-3.7-flash',
          'gemini-3.5-flash',
          'gemini-2.5-flash',
          'gemini-2.5-pro'
        ];
        const freeSet = new Set<string>(
          defaultRoutewayModels.filter((id) => id.includes(':free') || id.includes('-free'))
        );
        try {
          const response = await fetch(`https://api.routeway.ai/v1/models`, {
            headers: finalKey && !finalKey.endsWith('_free_gateway_key') ? { 'Authorization': `Bearer ${finalKey}` } : {},
            signal: AbortSignal.timeout(15000)
          });
          if (response.ok) {
            const data: any = await response.json();
            if (data.data && Array.isArray(data.data)) {
              const apiModels = data.data.map((m: any) => m.id).filter(Boolean);
              for (const m of data.data) {
                if (!m?.id) continue;
                const idLower = m.id.toLowerCase();
                if (
                  m.isFree === true ||
                  idLower.includes(':free') ||
                  idLower.includes('-free') ||
                  (m.pricing?.input && Number(m.pricing.input.usd) === 0 && Number(m.pricing.output?.usd ?? 0) === 0)
                ) {
                  freeSet.add(m.id);
                }
              }
              models = Array.from(new Set([...apiModels, ...defaultRoutewayModels]));
            }
          }
          if (models.length === 0) models = defaultRoutewayModels;
        } catch {
          models = defaultRoutewayModels;
        }
        freeModels = Array.from(freeSet);
      } else if (provider === 'pollinations') {
        const defaultPollinations = [
          'flux',
          'flux-realism',
          'flux-anime',
          'flux-3d',
          'turbo',
          'sana',
          'midjourney',
          'dall-e-3',
          'playground-v2.5',
          'sdxl',
          'openai-fast',
          'openai',
          'gpt-oss-20b'
        ];
        const fetchedIds: string[] = [];
        const results = await Promise.allSettled([
          fetch('https://text.pollinations.ai/models', { signal: AbortSignal.timeout(8000) }),
          fetch('https://image.pollinations.ai/models', { signal: AbortSignal.timeout(8000) })
        ]);
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value.ok) {
            try {
              const d: any = await r.value.json();
              if (Array.isArray(d)) {
                for (const item of d) {
                  if (typeof item === 'string') fetchedIds.push(item);
                  else if (item?.name) {
                    fetchedIds.push(item.name);
                    if (Array.isArray(item.aliases)) fetchedIds.push(...item.aliases);
                  }
                }
              }
            } catch {
              // ignore parse error
            }
          }
        }
        models = Array.from(new Set([...fetchedIds, ...defaultPollinations])).filter(Boolean);
        freeModels = [...models];
      } else if (provider === 'stability') {
        models = [
          'stable-diffusion-3.5-large',
          'stable-diffusion-3.5-large-turbo',
          'stable-diffusion-3.5-medium',
          'stable-diffusion-3-large',
          'stable-diffusion-3-medium',
          'stable-video-diffusion-xt-1-1',
          'stability-core'
        ];
      } else if (provider === 'kilo') {
        const defaultKiloModels = [
          'kilo-auto/free',
          'stepfun/step-3.7-flash:free',
          'poolside/laguna-m.1:free',
          'nvidia/nemotron-3-ultra-550b-a55b:free',
          'openrouter/free',
          'nvidia/nemotron-3-super-120b-a12b:free',
          'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
          'poolside/laguna-xs-2.1:free',
          'cohere/north-mini-code:free',
          'kwaipilot/kat-coder-pro-v2.5:free',
          'tencent/hy3:free',
          'nvidia/nemotron-3.5-content-safety:free',
          'z-ai/glm-5:free',
          'z-ai/glm-4.5-air:free',
          'deepseek/deepseek-r1-0528:free',
          'meta-llama/llama-3.3-70b-instruct:free',
          'qwen/qwen3-coder:free',
          'minimax/minimax-m2.5:free',
          'nvidia/nemotron-3.5-lightning:free',
          'nvidia/nemotron-3.5-super-vl:free',
          'baidu/ernie-5.5-flash-preview:free',
          'liquid/lfm-3-1.7b:free',
          'apodex/apodex-1.1-mini:free',
          'dots-studio/dots-3-note-preview:free',
          'kilo-auto/efficient',
          'stealth/glyph-cluster',
          'reflection/beam-free',
          'nvidia/nemotron-3.5-lightning-free'
        ];
        const kiloEndpoints = [
          'https://api.kilo.ai/api/gateway/models',
          'https://ai-gateway.kilo.ai/api/v1/models'
        ];
        const allApiIds: string[] = [];
        const freeIdSet = new Set<string>([
          'kilo-auto/free',
          'stepfun/step-3.7-flash:free',
          'poolside/laguna-m.1:free',
          'nvidia/nemotron-3-ultra-550b-a55b:free',
          'openrouter/free',
          'nvidia/nemotron-3-super-120b-a12b:free',
          'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
          'poolside/laguna-xs-2.1:free',
          'cohere/north-mini-code:free',
          'kwaipilot/kat-coder-pro-v2.5:free',
          'tencent/hy3:free',
          'nvidia/nemotron-3.5-content-safety:free',
          'z-ai/glm-5:free',
          'z-ai/glm-4.5-air:free',
          'deepseek/deepseek-r1-0528:free',
          'meta-llama/llama-3.3-70b-instruct:free',
          'qwen/qwen3-coder:free',
          'minimax/minimax-m2.5:free',
          'nvidia/nemotron-3.5-lightning:free',
          'nvidia/nemotron-3.5-super-vl:free',
          'baidu/ernie-5.5-flash-preview:free',
          'liquid/lfm-3-1.7b:free',
          'apodex/apodex-1.1-mini:free',
          'dots-studio/dots-3-note-preview:free',
          'stealth/glyph-cluster',
          'reflection/beam-free',
          'nvidia/nemotron-3.5-lightning-free'
        ]);

        // Fetch BOTH Kilo endpoints in parallel and merge 100% of models without dropping any
        const kiloResponses = await Promise.allSettled(
          kiloEndpoints.map((kiloUrl) =>
            fetch(kiloUrl, {
              headers: finalKey && !finalKey.endsWith('_free_gateway_key') ? { 'Authorization': `Bearer ${finalKey}` } : {},
              signal: AbortSignal.timeout(15000)
            })
          )
        );
        for (const resItem of kiloResponses) {
          if (resItem.status === 'fulfilled' && resItem.value.ok) {
            try {
              const data: any = await resItem.value.json();
              if (data.data && Array.isArray(data.data)) {
                for (const m of data.data) {
                  if (!m?.id) continue;
                  allApiIds.push(m.id);
                  const idLower = m.id.toLowerCase();
                  const isZeroPrice = m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion ?? 0) === 0;
                  if (
                    m.isFree === true ||
                    isZeroPrice ||
                    idLower.endsWith(':free') ||
                    idLower.endsWith('-free') ||
                    idLower.includes('/free')
                  ) {
                    freeIdSet.add(m.id);
                    dynamicKiloFreeModels.add(m.id);
                  }
                  if (Array.isArray(m.autoRouting?.models)) {
                    for (const autoId of m.autoRouting.models) {
                      if (autoId) {
                        allApiIds.push(autoId);
                        if (m.id === 'kilo-auto/free') {
                          freeIdSet.add(autoId);
                          dynamicKiloFreeModels.add(autoId);
                        }
                      }
                    }
                  }
                }
              }
            } catch (err) {
              console.warn('Kilo models parse warning:', err);
            }
          }
        }
        models = Array.from(new Set([...defaultKiloModels, ...allApiIds]));
        freeModels = Array.from(freeIdSet);
      } else if (provider === 'huggingface') {
        const defaultHfModels = [
          'deepseek-ai/DeepSeek-R1',
          'deepseek-ai/DeepSeek-V4.1-Flash',
          'deepseek-ai/DeepSeek-V3.2',
          'Qwen/Qwen3.8-27B',
          'Qwen/Qwen3-32B',
          'Qwen/Qwen3-14B',
          'Qwen/Qwen2.5-72B-Instruct',
          'Qwen/Qwen2.5-7B-Instruct',
          'openai/gpt-oss-120b',
          'openai/gpt-oss-20b',
          'meta-llama/Llama-3.3-70B-Instruct',
          'mistralai/Mistral-Small-24B-Instruct-2501',
          'google/gemma-3-27b-it',
          'microsoft/DialoGPT-medium',
          'gpt2',
          'bigscience/bloom-560m',
          'distilgpt2',
          'facebook/blenderbot-400M-distill'
        ];
        const fetchedIds: string[] = [];
        const hasRealHfKey = finalKey && !finalKey.endsWith('_free_gateway_key');
        const hfRequests: Promise<Response>[] = [
          fetch('https://router.huggingface.co/v1/models', {
            headers: hasRealHfKey ? { 'Authorization': `Bearer ${finalKey}` } : {},
            signal: AbortSignal.timeout(12000)
          }),
          fetch('https://huggingface.co/api/models?pipeline_tag=text-generation&sort=downloads&direction=-1&limit=100', {
            signal: AbortSignal.timeout(12000)
          })
        ];
        if (hasRealHfKey) {
          hfRequests.push(
            fetch('https://api-inference.huggingface.co/models', {
              headers: { 'Authorization': `Bearer ${finalKey}` },
              signal: AbortSignal.timeout(10000)
            })
          );
        }
        const hfResults = await Promise.allSettled(hfRequests);
        for (const r of hfResults) {
          if (r.status === 'fulfilled' && r.value.ok) {
            try {
              const data: any = await r.value.json();
              const arr = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
              for (const m of arr) {
                const id = m?.id || m?.modelId;
                if (id && typeof id === 'string') fetchedIds.push(id);
              }
            } catch {
              // ignore parse error
            }
          }
        }
        models = Array.from(new Set([...fetchedIds, ...defaultHfModels])).filter(Boolean);
        freeModels = [...models];
      } else {
        return res.status(400).json({ error: "المزود غير مدعوم للتحديث التلقائي" });
      }

      // Filter empty, dedup, and sort
      models = Array.from(new Set(models.filter(m => !!m))).sort();
      freeModels = Array.from(new Set(freeModels.filter(m => !!m))).sort();

      return res.status(200).json({ models, freeModels });
    } catch (error: any) {
      console.warn(`Error in /api/models/${provider}:`, error?.message || error);
      return res.status(200).json({ models: [], freeModels: [] });
    }
  });

  // Proxy endpoint for AI providers (Mistral, Groq, OpenRouter, Routeway, etc.)
  app.post("/api/proxy/:provider", async (req, res) => {
    const { provider } = req.params;
    const { baseURL, apiKey, endpoint, ...body } = req.body;

    const payloadSize = JSON.stringify(req.body).length;
    if (payloadSize > 5 * 1024 * 1024) { // Log if > 5MB
      console.log(`Large payload detected for ${provider}: ${(payloadSize / 1024 / 1024).toFixed(2)} MB`);
    }

    if (!baseURL) {
      return res.status(400).json({ error: "baseURL is required" });
    }

    const serverKey = 
      provider === 'groq' ? getEnvKey(process.env.GROQ_API_KEY) :
      provider === 'openrouter' ? getEnvKey(process.env.OPENROUTER_API_KEY) :
      provider === 'mistral' ? getEnvKey(process.env.MISTRAL_API_KEY) :
      provider === 'routeway' ? getEnvKey(process.env.ROUTEWAY_API_KEY) :
      provider === 'deepseek' ? getEnvKey(process.env.DEEPSEEK_API_KEY) : 
      provider === 'kilo' ? getEnvKey(process.env.KILO_API_KEY) :
      provider === 'huggingface' ? getEnvKey(process.env.HF_API_KEY) :
      provider === 'stability' ? getEnvKey(process.env.STABILITY_API_KEY) :
      provider === 'gemini' ? getFinalKey(process.env.GEMINI_API_KEY) : undefined;
    
    let finalKey = provider === 'gemini' ? (getFinalKey(apiKey) || serverKey) : (getEnvKey(apiKey) || serverKey);

    if (provider === 'huggingface' && !finalKey) {
      return res.status(401).json({
        error: {
          message: 'يتطلب مزود Hugging Face مفتاح API مجاني (HF Token) من إعدادات المزود لتشغيل النماذج، أو يمكنك اختيار نموذج مجاني من Gemini أو Kilo أو Routeway.'
        }
      });
    }

    if (!finalKey) {
      if (['kilo', 'routeway', 'openrouter', 'pollinations'].includes(provider)) {
        finalKey = `${provider}_free_gateway_key`;
      }
    }

    if (!finalKey && provider !== 'pollinations') {
      console.warn(`Missing API key for provider: ${provider}. apiKey from client: ${!!apiKey}, serverKey from env: ${!!serverKey}`);
      return res.status(401).json({ error: { message: `API key for ${provider} not found on server or client.` } });
    }

    try {
      if (provider === 'kilo') {
        if (body.model) {
          body.model = body.model.replace(/^kilo\//, '');
        } else {
          body.model = 'nvidia/nemotron-3.5-lightning:free';
        }
      }

      const isImageRequest = !!body.prompt && !body.messages;
      const defaultEndpoint = endpoint || (isImageRequest ? '/images/generations' : '/chat/completions');
      const fullURL = resolveSafeProviderUrl(provider, baseURL, endpoint, baseURL, defaultEndpoint);

      // Modern AI parameter preparation for text completions (never forcefully narrow user settings)
      if (!isImageRequest) {
        if (body.frequency_penalty === undefined) {
          body.frequency_penalty = 0.2;
        }
        if (body.presence_penalty === undefined) {
          body.presence_penalty = 0.15;
        }
        if (body.max_tokens === undefined || body.max_tokens === null || body.max_tokens === 0) {
          body.max_tokens = 65536;
        }
        if (typeof body.temperature === 'number') {
          body.temperature = Math.min(Math.max(body.temperature, 0), 2);
        } else {
          body.temperature = 0.65;
        }
      }

      console.log(`Proxying request to ${provider} (${fullURL}) for model ${body.model}`);

      const reqHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'HTTP-Referer': (req.headers.origin as string) || (req.headers.referer as string) || 'https://ai.studio',
        'X-Title': 'Midad Al Rahman',
        'Accept': isImageRequest ? 'image/*, application/json' : 'application/json'
      };

      if (finalKey && !finalKey.endsWith('_free_gateway_key')) {
        reqHeaders['Authorization'] = `Bearer ${finalKey}`;
      }

      const fetchAdaptiveNonStream = async (): Promise<{ response: Response; bufferedText?: string }> => {
        const workingBody = { ...body };
        let response = await fetch(fullURL, {
          method: 'POST',
          headers: reqHeaders,
          body: JSON.stringify(workingBody)
        });
        if (isImageRequest || (response.status !== 400 && response.status !== 422)) {
          return { response };
        }
        let errText = await response.text();
        for (let retryIdx = 0; retryIdx < 4; retryIdx++) {
          const lower = errText.toLowerCase();
          let changed = false;
          if (lower.includes('reasoning') && workingBody.reasoning_effort !== undefined) {
            delete workingBody.reasoning_effort;
            changed = true;
          }
          if (lower.includes('top_k') && workingBody.top_k !== undefined) {
            delete workingBody.top_k;
            changed = true;
          }
          if (lower.includes('frequency_penalty') && workingBody.frequency_penalty !== undefined) {
            delete workingBody.frequency_penalty;
            changed = true;
          }
          if (lower.includes('presence_penalty') && workingBody.presence_penalty !== undefined) {
            delete workingBody.presence_penalty;
            changed = true;
          }
          if (lower.includes('top_p') && workingBody.top_p !== undefined) {
            delete workingBody.top_p;
            changed = true;
          }
          if (lower.includes('max_tokens') || lower.includes('max_completion_tokens') || lower.includes('context') || lower.includes('too large') || lower.includes('exceeds')) {
            const ladder = [65536, 32768, 16384, 8192, 4096];
            const nextCap = ladder.find(c => c < Number(workingBody.max_tokens || 65536));
            if (nextCap) {
              workingBody.max_tokens = nextCap;
              changed = true;
            }
          }
          if (!changed) break;
          response = await fetch(fullURL, {
            method: 'POST',
            headers: reqHeaders,
            body: JSON.stringify(workingBody)
          });
          if (response.ok || (response.status !== 400 && response.status !== 422)) {
            return { response };
          }
          errText = await response.text();
        }
        return { response, bufferedText: errText };
      };

      const { response, bufferedText } = await fetchAdaptiveNonStream();

      const contentType = response.headers.get('content-type');
      if (contentType && (contentType.includes('image/') || contentType.includes('application/octet-stream'))) {
        const buffer = await response.arrayBuffer();
        res.setHeader('Content-Type', contentType);
        res.send(Buffer.from(buffer));
        return;
      }

      const responseText = bufferedText !== undefined ? bufferedText : await response.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        const isHtml = responseText.trim().startsWith('<');
        console.warn(`Non-JSON response from ${provider} (${response.status}): ${responseText.substring(0, 120)}`);
        const msg = response.status === 401
          ? `يتطلب مزود ${provider} مفتاح API صالحاً في الإعدادات.`
          : isHtml
            ? `استجابة غير متوقعة من المزود ${provider} (الحالة ${response.status}). تأكد من مفتاح API أو اختر نموذجاً آخر.`
            : `استجابة غير صالحة من المزود (الحالة: ${response.status})`;
        return res.status(response.status >= 400 ? response.status : 502).json({ 
          error: { message: msg }
        });
      }

      if (response.status === 402) {
        return res.status(402).json({
          error: {
            message: `النموذج المختار (${body.model}) يتطلب رصيداً أو مفتاح API مدفوع في ${provider}. يمكنك اختيار نموذج يحمل علامة [مجاني] أو إدخال مفتاح API من الإعدادات.`
          }
        });
      }
      
      res.status(response.status).json(data);
    } catch (error: any) {
      console.warn(`Proxy error for ${provider}:`, error?.message || error);
      const msg = error?.message || "Internal Server Error";
      const isValidationErr = /untrusted|unsupported|invalid upstream/i.test(msg);
      res.status(isValidationErr ? 400 : 500).json({ error: { message: msg } });
    }
  });

  // Streaming proxy endpoint for AI providers (OpenAI-compatible)
  app.post("/api/proxy/stream/:provider", async (req, res) => {
    const { provider } = req.params;
    const { baseURL, apiKey, endpoint, ...body } = req.body;
    
    // Ensure streaming is enabled
    body.stream = true;

    const serverKey = 
      provider === 'groq' ? getEnvKey(process.env.GROQ_API_KEY) :
      provider === 'openrouter' ? getEnvKey(process.env.OPENROUTER_API_KEY) :
      provider === 'mistral' ? getEnvKey(process.env.MISTRAL_API_KEY) :
      provider === 'routeway' ? getEnvKey(process.env.ROUTEWAY_API_KEY) :
      provider === 'deepseek' ? getEnvKey(process.env.DEEPSEEK_API_KEY) : 
      provider === 'kilo' ? getEnvKey(process.env.KILO_API_KEY) :
      provider === 'huggingface' ? getEnvKey(process.env.HF_API_KEY) : undefined;
    
    let finalKey = getEnvKey(apiKey) || serverKey;

    if (provider === 'huggingface' && !finalKey) {
      return res.status(401).json({
        error: {
          message: 'يتطلب مزود Hugging Face مفتاح API مجاني (HF Token) من إعدادات المزود لتشغيل النماذج، أو يمكنك اختيار نموذج مجاني من Gemini أو Kilo أو Routeway.'
        }
      });
    }

    if (!finalKey && ['kilo', 'routeway', 'openrouter'].includes(provider)) {
      finalKey = `${provider}_free_gateway_key`;
    }

    if (!finalKey) {
      return res.status(401).json({ error: { message: `API key for ${provider} not found.` } });
    }

    try {
      if (provider === 'kilo') {
        if (body.model) {
          body.model = body.model.replace(/^kilo\//, '');
        } else {
          body.model = 'nvidia/nemotron-3.5-lightning:free';
        }
      }

      // Modern AI parameter preparation for streaming (respect exact user choices, auto-adapt max ceiling)
      if (body.frequency_penalty === undefined) {
        body.frequency_penalty = 0.2;
      }
      if (body.presence_penalty === undefined) {
        body.presence_penalty = 0.15;
      }
      if (body.max_tokens === undefined || body.max_tokens === null || body.max_tokens === 0) {
        body.max_tokens = 65536;
      }
      if (typeof body.temperature === 'number') {
        body.temperature = Math.min(Math.max(body.temperature, 0), 2);
      } else {
        body.temperature = 0.65;
      }

      const fallbackBaseURL =
        provider === 'kilo' ? 'https://ai-gateway.kilo.ai/api/v1' :
        provider === 'openrouter' ? 'https://openrouter.ai/api/v1' :
        provider === 'groq' ? 'https://api.groq.com/openai/v1' :
        provider === 'deepseek' ? 'https://api.deepseek.com/v1' :
        provider === 'mistral' ? 'https://api.mistral.ai/v1' :
        provider === 'routeway' ? 'https://api.routeway.ai' :
        provider === 'huggingface' ? 'https://router.huggingface.co/v1' : '';
      const fullURL = resolveSafeProviderUrl(provider, baseURL, endpoint, fallbackBaseURL, '/chat/completions');

      const reqHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'HTTP-Referer': (req.headers.origin as string) || (req.headers.referer as string) || 'https://ai.studio',
        'X-Title': 'Midad Al Rahman'
      };
      if (finalKey && !finalKey.endsWith('_free_gateway_key')) {
        reqHeaders['Authorization'] = `Bearer ${finalKey}`;
      }

      let response = await fetch(fullURL, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(body)
      });
      let bufferedErrorText: string | undefined;
      if (response.status === 400 || response.status === 422) {
        bufferedErrorText = await response.text();
        const workingBody = { ...body };
        for (let retryIdx = 0; retryIdx < 4; retryIdx++) {
          const lower = bufferedErrorText.toLowerCase();
          let changed = false;
          if (lower.includes('reasoning') && workingBody.reasoning_effort !== undefined) {
            delete workingBody.reasoning_effort;
            changed = true;
          }
          if (lower.includes('top_k') && workingBody.top_k !== undefined) {
            delete workingBody.top_k;
            changed = true;
          }
          if (lower.includes('frequency_penalty') && workingBody.frequency_penalty !== undefined) {
            delete workingBody.frequency_penalty;
            changed = true;
          }
          if (lower.includes('presence_penalty') && workingBody.presence_penalty !== undefined) {
            delete workingBody.presence_penalty;
            changed = true;
          }
          if (lower.includes('top_p') && workingBody.top_p !== undefined) {
            delete workingBody.top_p;
            changed = true;
          }
          if (lower.includes('max_tokens') || lower.includes('max_completion_tokens') || lower.includes('context') || lower.includes('too large') || lower.includes('exceeds')) {
            const ladder = [65536, 32768, 16384, 8192, 4096];
            const nextCap = ladder.find(c => c < Number(workingBody.max_tokens || 65536));
            if (nextCap) {
              workingBody.max_tokens = nextCap;
              changed = true;
            }
          }
          if (!changed) break;
          response = await fetch(fullURL, {
            method: 'POST',
            headers: reqHeaders,
            body: JSON.stringify(workingBody)
          });
          if (response.ok || (response.status !== 400 && response.status !== 422)) {
            bufferedErrorText = undefined;
            break;
          }
          bufferedErrorText = await response.text();
        }
      }

      if (!response.ok) {
        const errorText = bufferedErrorText !== undefined ? bufferedErrorText : await response.text();
        console.warn(`Streaming proxy upstream non-OK from ${provider} (${response.status}): ${errorText.substring(0, 200)}`);
        let friendlyMsg = `Provider ${provider} error: ${response.statusText}`;
        try {
          const parsedErr = JSON.parse(errorText);
          const rawMsg = parsedErr?.error?.message || parsedErr?.message || (typeof parsedErr?.error === 'string' ? parsedErr.error : '');
          if (rawMsg) friendlyMsg = rawMsg;
        } catch {
          if (errorText.trim().startsWith('<')) {
            friendlyMsg = response.status === 401
              ? `يتطلب مزود ${provider} مفتاح API صالحاً في الإعدادات.`
              : `استجابة غير صالحة من ${provider} (الحالة ${response.status}).`;
          }
        }
        if (response.status === 402) {
          friendlyMsg = `النموذج (${body.model}) يتطلب رصيداً أو مفتاح API في ${provider}. اختر نموذجاً يحمل علامة [مجاني] أو أضف مفتاحك من الإعدادات.`;
        }
        return res.status(response.status).json({ error: { message: friendlyMsg } });
      }

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof (res as any).flushHeaders === 'function') (res as any).flushHeaders();

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const streamDecoder = new TextDecoder();
      let sseLineBuffer = '';
      let decodedAssistantText = '';
      let chunksReceived = 0;
      let loopDetected = false;

      const hasConsecutiveTailLoop = (txt: string): string | null => {
        if (txt.length < 160) return null;
        const tail = txt.slice(-1000);
        const maxCandLen = Math.min(220, Math.floor(tail.length / 4));
        for (let len = 28; len <= maxCandLen; len++) {
          const cand = tail.slice(-len).trim();
          if (cand.length < 28) continue;
          let count = 1;
          let endPos = tail.lastIndexOf(cand);
          if (endPos <= 0) continue;
          while (count < 4) {
            if (endPos <= 0) break;
            const prevEnd = tail.lastIndexOf(cand, endPos - 1);
            if (prevEnd === -1 || prevEnd >= endPos || prevEnd + cand.length > endPos) break;
            const gap = tail.slice(prevEnd + cand.length, endPos);
            if (gap.length > 8) break; // must be consecutive / adjacent
            count++;
            endPos = prevEnd;
          }
          if (count >= 4) return cand;
        }
        return null;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunksReceived++;

        // Extract ONLY actual decoded delta.content (never raw SSE JSON boilerplate) for loop detection
        sseLineBuffer += streamDecoder.decode(value, { stream: true });
        let nlIdx;
        while ((nlIdx = sseLineBuffer.indexOf('\n')) >= 0) {
          const line = sseLineBuffer.slice(0, nlIdx).trim();
          sseLineBuffer = sseLineBuffer.slice(nlIdx + 1);
          if (line.startsWith('data: ')) {
            const payload = line.slice(6).trim();
            if (payload && payload !== '[DONE]') {
              try {
                const parsed = JSON.parse(payload);
                const deltaText = parsed?.choices?.[0]?.delta?.content;
                if (typeof deltaText === 'string' && deltaText.length > 0) {
                  decodedAssistantText += deltaText;
                  if (decodedAssistantText.length > 3000) {
                    decodedAssistantText = decodedAssistantText.slice(-1500);
                  }
                }
              } catch {
                // ignore partial/non-JSON SSE lines
              }
            }
          }
        }

        const stuckPhrase = hasConsecutiveTailLoop(decodedAssistantText);
        if (stuckPhrase) {
          console.warn(`[ServerLoopBreaker] Consecutive 4x repetition loop detected in ${provider} stream ("${stuckPhrase.slice(0, 30)}..."), terminating stream`);
          loopDetected = true;
        }

        if (loopDetected) {
          res.write('data: [DONE]\n\n');
          break;
        }

        res.write(value);
      }
      console.log(`Streaming proxy: finished streaming ${provider}, chunks: ${chunksReceived}, loopTerminated: ${loopDetected}`);
      res.end();
    } catch (error: any) {
      console.warn(`Streaming proxy error for ${provider}:`, error?.message || error);
      const msg = error?.message || "Streaming failed";
      const isValidationErr = /untrusted|unsupported|invalid upstream/i.test(msg);
      if (!res.headersSent) {
        res.status(isValidationErr ? 400 : 500).json({ error: { message: msg } });
      } else if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
        res.end();
      }
    }
  });

  // Live API App-Control Non-Blocking Tools
  const liveAppTools: FunctionDeclaration[] = [
    {
      name: "open_surah",
      description: "فتح سورة من القرآن الكريم داخل المصحف وتوجيه القارئ إليها فوراً.",
      behavior: Behavior.NON_BLOCKING,
      parameters: {
        type: Type.OBJECT,
        properties: {
          surahQuery: {
            type: Type.STRING,
            description: "رقم السورة (1-114) أو اسم السورة بالعربية مثل البقرة أو الكهف أو يس.",
          },
        },
        required: ["surahQuery"],
      },
    },
    {
      name: "play_recitation",
      description: "تشغيل التلاوة الصوتية لسورة أو آية محددة في مشغل التطبيق.",
      behavior: Behavior.NON_BLOCKING,
      parameters: {
        type: Type.OBJECT,
        properties: {
          surahNumber: {
            type: Type.INTEGER,
            description: "رقم السورة من 1 إلى 114.",
          },
          ayahNumber: {
            type: Type.INTEGER,
            description: "رقم الآية للبدء منها (اختياري، الافتراضي 1).",
          },
        },
        required: ["surahNumber"],
      },
    },
    {
      name: "stop_recitation",
      description: "إيقاف تلاوة القرآن الحالية فوراً.",
      behavior: Behavior.NON_BLOCKING,
      parameters: {
        type: Type.OBJECT,
        properties: {},
      },
    },
    {
      name: "search_quran",
      description: "البحث الفوري في آيات القرآن الكريم عن كلمة أو موضوع أو جملة.",
      behavior: Behavior.NON_BLOCKING,
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description: "كلمات البحث القرآنية.",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "open_app_view",
      description: "الانتقال إلى قسم محدد داخل التطبيق مثل المفضلة أو القبلة أو المسبحة أو الأدعية أو التقويم أو مولد الصور أو مداد الرحمن.",
      behavior: Behavior.NON_BLOCKING,
      parameters: {
        type: Type.OBJECT,
        properties: {
          view: {
            type: Type.STRING,
            description: "القسم المطلوب: bookmarks | qibla | tasbih | calendar | duas | image_generator | midad | ai-chat | search",
          },
        },
        required: ["view"],
      },
    },
    {
      name: "generate_image",
      description: "توليد صورة فنية أو روحانية فوراً بناءً على وصف تفصيلي باللغة الإنجليزية.",
      behavior: Behavior.NON_BLOCKING,
      parameters: {
        type: Type.OBJECT,
        properties: {
          prompt: {
            type: Type.STRING,
            description: "وصف تفصيلي دقيق للصورة المطلوبة باللغة الإنجليزية.",
          },
        },
        required: ["prompt"],
      },
    },
    {
      name: "change_reader_settings",
      description: "تغيير إعدادات القراءة والتلاوة مثل القارئ أو الرواية (حفص/ورش/قالون) أو حجم الخط أو التجويد الملون.",
      behavior: Behavior.NON_BLOCKING,
      parameters: {
        type: Type.OBJECT,
        properties: {
          reciterId: { type: Type.STRING, description: "معرف القارئ مثل ar.alafasy أو ar.husary أو ar.minshawi" },
          qiraat: { type: Type.STRING, description: "الرواية: hafs أو warsh أو qaloon" },
          fontSize: { type: Type.INTEGER, description: "حجم الخط من 14 إلى 32" },
          toggleTajweed: { type: Type.BOOLEAN, description: "تبديل تلوين أحكام التجويد" },
        },
      },
    },
    {
      name: "save_user_preference",
      description: "حفظ تفضيل أو معلومة مهمة عن المستخدم في الذاكرة الدائمة لتذكرها في كل المحادثات المستقبلية.",
      behavior: Behavior.NON_BLOCKING,
      parameters: {
        type: Type.OBJECT,
        properties: {
          note: { type: Type.STRING, description: "نص التفضيل أو المعلومة المراد حفظها عن المستخدم." },
          category: { type: Type.STRING, description: "التصنيف: style | interest | quran | general" },
        },
        required: ["note"],
      },
    },
  ];

  // Shared Live API session controller used by both WebSocket (/api/live) and HTTP SSE+POST bridge
  const createLiveSessionController = (safeSend: (payload: Record<string, any>) => void) => {
    let liveSession: any = null;
    let isClosing = false;
    let activeModelName = "";
    let didRetryMinimalOnSameModel = false;
    let setupTimer: ReturnType<typeof setTimeout> | null = null;
    let isSetupConfirmed = false;

    const closeSession = () => {
      isClosing = true;
      if (setupTimer) {
        clearTimeout(setupTimer);
        setupTimer = null;
      }
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // ignore
        }
        liveSession = null;
      }
    };

    const connectLiveSession = async (cfg: any, minimalMode = false) => {
      const requestedModel = String(cfg?.model || "").trim();
      if (!requestedModel) {
        safeSend({ type: "error", error: "يرجى اختيار نموذج Live من القائمة المنسدلة أولاً." });
        return;
      }
      activeModelName = requestedModel;
      if (minimalMode) didRetryMinimalOnSameModel = true;

      const finalKey = getFinalKey(cfg?.apiKey);
      if (!finalKey) {
        safeSend({ type: "error", error: "مفتاح Gemini API غير موجود في الخادم أو الإعدادات." });
        return;
      }

      const ai = createGeminiClient(finalKey);
      const lowerModel = requestedModel.toLowerCase();
      const isTranscribeOnly = lowerModel.includes("transcribe");
      const isTranslateOnly = lowerModel.includes("translate");
      const isRoboticsStreaming = lowerModel.includes("robotics");
      const supportsLiveThinking = lowerModel.includes("extended-thinking") || isRoboticsStreaming;
      const allowedVoices = new Set(["Puck", "Charon", "Kore", "Fenrir", "Zephyr"]);
      const requestedVoice = allowedVoices.has(cfg?.voiceName) ? cfg.voiceName : "Zephyr";

      const buildLiveConfig = (minimal: boolean) => {
        const liveCfg: any = {};

        if (isTranscribeOnly) {
          liveCfg.responseModalities = [Modality.TEXT];
          liveCfg.inputAudioTranscription = { languageCodes: [] };
          return liveCfg;
        }

        if (isTranslateOnly) {
          liveCfg.responseModalities = [Modality.AUDIO];
          liveCfg.inputAudioTranscription = {};
          liveCfg.outputAudioTranscription = {};
          liveCfg.translationConfig = {
            targetLanguageCode: cfg?.targetLanguageCode || "ar",
            echoTargetLanguage: false,
          };
          return liveCfg;
        }

        // Native audio Live models (3.8-live, 2.5-flash-native-audio, 3.1-flash-live) ONLY support AUDIO output modality;
        // robotics/transcribe models support TEXT. When client mutes audio output, keep AUDIO modality + outputAudioTranscription
        // and simply withhold PCM playback frames so turning off speaker output never triggers code 1007.
        const supportsAudioModality = !isRoboticsStreaming && !isTranscribeOnly;
        liveCfg.responseModalities = supportsAudioModality ? [Modality.AUDIO] : [Modality.TEXT];

        if (supportsAudioModality) {
          liveCfg.speechConfig = {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: requestedVoice,
              },
            },
          };
          liveCfg.outputAudioTranscription = {};
        }

        liveCfg.inputAudioTranscription = {};

        if (cfg?.systemInstruction && typeof cfg.systemInstruction === "string" && cfg.systemInstruction.trim()) {
          liveCfg.systemInstruction = cfg.systemInstruction.trim();
        }

        if (!minimal) {
          liveCfg.contextWindowCompression = { slidingWindow: {} };
          if (typeof cfg?.resumptionHandle === "string" && cfg.resumptionHandle.trim()) {
            liveCfg.sessionResumption = { handle: cfg.resumptionHandle.trim() };
          } else {
            liveCfg.sessionResumption = {};
          }

          if (supportsLiveThinking && cfg?.thinkingLevel && cfg.thinkingLevel !== "off") {
            const levelMap: Record<string, ThinkingLevel> = {
              LOW: ThinkingLevel.LOW,
              MEDIUM: ThinkingLevel.MEDIUM,
              HIGH: ThinkingLevel.HIGH,
            };
            const mappedLevel = levelMap[String(cfg.thinkingLevel).toUpperCase()];
            if (mappedLevel) {
              liveCfg.thinkingConfig = { thinkingLevel: mappedLevel };
            }
          }

          const toolsList: any[] = [];
          if (cfg?.enableWebSearch !== false) {
            toolsList.push({ googleSearch: {} });
          }
          if (cfg?.enableTools !== false) {
            toolsList.push({ functionDeclarations: liveAppTools });
          }
          if (toolsList.length > 0) {
            liveCfg.tools = toolsList;
          }
        }

        return liveCfg;
      };

      isSetupConfirmed = false;
      if (setupTimer) {
        clearTimeout(setupTimer);
        setupTimer = null;
      }

      try {
        console.log(`[LiveAPI] Connecting strictly to exact model: ${requestedModel} (minimal=${minimalMode})`);
        const session = await ai.live.connect({
          model: requestedModel,
          config: buildLiveConfig(minimalMode),
          callbacks: {
            onopen: () => {
              console.log(`[LiveAPI] Socket opened for ${requestedModel}`);
            },
            onmessage: (message: LiveServerMessage) => {
              if (isClosing) return;
              const anyMsg = message as any;
              const content = message.serverContent;
              if (anyMsg?.setupComplete || content || message.toolCall) {
                isSetupConfirmed = true;
              }
              if (isSetupConfirmed && anyMsg?.sessionResumptionUpdate?.newHandle) {
                safeSend({
                  type: "resumption_update",
                  model: requestedModel,
                  handle: anyMsg.sessionResumptionUpdate.newHandle,
                });
              }

              if (content?.interrupted) {
                safeSend({ type: "interrupted" });
              }
              if ((content as any)?.interimInputTranscription?.text) {
                safeSend({
                  type: "interim_input_transcript",
                  text: (content as any).interimInputTranscription.text,
                });
              }
              if (content?.inputTranscription?.text) {
                safeSend({
                  type: "input_transcript",
                  text: content.inputTranscription.text,
                });
              }
              if (content?.outputTranscription?.text) {
                safeSend({
                  type: "output_transcript",
                  text: content.outputTranscription.text,
                });
              }
              if ((content as any)?.interactionStatus) {
                const statusVal = (content as any).interactionStatus;
                safeSend({
                  type: "interaction_status",
                  status: statusVal,
                  isIdle: statusVal === InteractionStatus.IDLE,
                });
              }

              const clientWantsAudio = cfg?.enableAudioOutput !== false;
              for (const part of content?.modelTurn?.parts ?? []) {
                if (part.inlineData?.data && clientWantsAudio) {
                  safeSend({
                    type: "audio",
                    data: part.inlineData.data,
                    mimeType: part.inlineData.mimeType || "audio/pcm;rate=24000",
                  });
                }
                if (part.text) {
                  safeSend({
                    type: "text",
                    text: part.text,
                    thought: Boolean((part as any).thought),
                  });
                }
              }

              if (content?.turnComplete) {
                safeSend({ type: "turn_complete" });
              }

              if (message.toolCall?.functionCalls && message.toolCall.functionCalls.length > 0) {
                safeSend({
                  type: "tool_call",
                  calls: message.toolCall.functionCalls.map((fc) => ({
                    id: fc.id,
                    name: fc.name,
                    args: fc.args || {},
                  })),
                });
              }
            },
            onerror: (err: any) => {
              if (isClosing) return;
              console.warn(`[LiveAPI Error] (${requestedModel}):`, err?.message || err);
              safeSend({
                type: "error",
                model: requestedModel,
                error: extractErrorMessage(err, `تعذر الاتصال بالنموذج ${requestedModel}`),
              });
            },
            onclose: (ev: any) => {
              if (isClosing) return;
              const reason = ev?.reason || "";
              console.log(`[LiveAPI Closed] (${requestedModel}) code=${ev?.code} reason=${reason}`);
              if (setupTimer) {
                clearTimeout(setupTimer);
                setupTimer = null;
              }
              const lowerReason = String(reason).toLowerCase();
              const isStaleHandleClose =
                Boolean(cfg?.resumptionHandle) &&
                !isClosing &&
                (ev?.code === 1008 ||
                  lowerReason.includes("session not found") ||
                  lowerReason.includes("expired") ||
                  lowerReason.includes("session handle"));

              if (isStaleHandleClose) {
                liveSession = null;
                safeSend({ type: "resumption_update", model: requestedModel, handle: "" });
                console.log(`[LiveAPI] Expired/invalid resumption handle on ${requestedModel}, reconnecting cleanly without handle...`);
                void connectLiveSession({ ...cfg, resumptionHandle: undefined }, minimalMode);
                return;
              }

              const isConfigRejection =
                !isSetupConfirmed &&
                !didRetryMinimalOnSameModel &&
                !isClosing &&
                (ev?.code === 1007 ||
                  lowerReason.includes("invalid") ||
                  lowerReason.includes("unsupported") ||
                  lowerReason.includes("not supported") ||
                  lowerReason.includes("argument") ||
                  lowerReason.includes("tool") ||
                  lowerReason.includes("thinking") ||
                  lowerReason.includes("compression") ||
                  lowerReason.includes("resumption"));

              if (isConfigRejection) {
                didRetryMinimalOnSameModel = true;
                liveSession = null;
                safeSend({ type: "resumption_update", model: requestedModel, handle: "" });
                console.log(`[LiveAPI] Retrying SAME model ${requestedModel} with minimal stream config (no fallback)...`);
                void connectLiveSession({ ...cfg, resumptionHandle: undefined }, true);
                return;
              }

              liveSession = null;
              if (ev?.code === 1011 && lowerReason.includes("quota")) {
                safeSend({
                  type: "error",
                  model: requestedModel,
                  error: `⚠️ النموذج ${requestedModel} تجاوز الحصة المتاحة على مفتاح API الحالي. جرّب اختيار gemini-2.5-flash-native-audio-latest أو gemini-robotics-er-2-streaming-preview من «إعدادات الصوت المباشر»، أو أدخل مفتاح API خاصاً بك.`,
                });
                return;
              }
              safeSend({
                type: "closed",
                model: requestedModel,
                code: ev?.code || 1000,
                reason,
              });
            },
          },
        });

        if (isClosing) {
          try {
            session.close();
          } catch {
            // ignore
          }
          return;
        }

        liveSession = session;

        // Seed recent history BEFORE signalling 'connected' so queued client turns never race seedTurns
        if (Array.isArray(cfg?.seedTurns) && cfg.seedTurns.length > 0 && liveSession) {
          const validTurns = cfg.seedTurns
            .filter(
              (t: any) =>
                (t?.role === "user" || t?.role === "model") &&
                Array.isArray(t?.parts) &&
                t.parts.some((p: any) => typeof p?.text === "string" && p.text.trim())
            )
            .slice(-10);
          if (validTurns.length > 0) {
            try {
              liveSession.sendClientContent({
                turns: validTurns,
                turnComplete: false,
              });
            } catch (seedErr) {
              console.warn("[LiveAPI] Seed turns error:", seedErr);
            }
          }
        }

        // Wait briefly for immediate BidiGenerateContentSetup rejection before announcing 'connected'
        setupTimer = setTimeout(() => {
          setupTimer = null;
          if (!isClosing && liveSession === session) {
            isSetupConfirmed = true;
            safeSend({
              type: "connected",
              model: requestedModel,
              minimalMode,
              textOnlyModel: isRoboticsStreaming || isTranscribeOnly,
            });
          }
        }, 180);
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (!didRetryMinimalOnSameModel && !isClosing && (msg.toLowerCase().includes("400") || msg.toLowerCase().includes("invalid"))) {
          didRetryMinimalOnSameModel = true;
          return connectLiveSession(cfg, true);
        }
        safeSend({
          type: "error",
          model: requestedModel,
          error: extractErrorMessage(err, `فشل فتح جلسة البث المباشر مع النموذج ${requestedModel}`),
        });
      }
    };

    const handleIncomingMessage = async (msg: any) => {
      if (!msg || typeof msg !== "object") return;

      if (msg.type === "start") {
        closeSession();
        isClosing = false;
        didRetryMinimalOnSameModel = false;
        await connectLiveSession(msg.config || {}, false);
        return;
      }

      if (msg.type === "stop") {
        closeSession();
        safeSend({ type: "closed", model: activeModelName, code: 1000, reason: "Stopped by user" });
        return;
      }

      if (!liveSession) return;

      try {
        if (msg.type === "audio" && msg.data) {
          liveSession.sendRealtimeInput({
            audio: { data: msg.data, mimeType: msg.mimeType || "audio/pcm;rate=16000" },
          });
        } else if (msg.type === "video" && msg.data) {
          liveSession.sendRealtimeInput({
            video: { data: msg.data, mimeType: msg.mimeType || "image/jpeg" },
          });
        } else if (msg.type === "text" && typeof msg.text === "string" && msg.text.trim()) {
          liveSession.sendClientContent({
            turns: [{ role: "user", parts: [{ text: msg.text.trim() }] }],
            turnComplete: true,
          });
        } else if (msg.type === "context_update" && typeof msg.text === "string" && msg.text.trim()) {
          liveSession.sendClientContent({
            turns: [{ role: "user", parts: [{ text: `[تحديث تلقائي لسياق التطبيق]: ${msg.text.trim()}` }] }],
            turnComplete: false,
          });
        } else if (msg.type === "tool_response" && Array.isArray(msg.responses)) {
          liveSession.sendToolResponse({
            functionResponses: msg.responses.map((r: any) => ({
              id: r.id,
              name: r.name,
              response: r.response || { ok: true },
              scheduling: FunctionResponseScheduling.WHEN_IDLE,
            })),
          });
        }
      } catch (sendErr: any) {
        console.warn("[LiveAPI Relay Send Error]:", sendErr?.message || sendErr);
      }
    };

    return { handleIncomingMessage, closeSession };
  };

  // HTTP SSE + POST Fallback Bridge for Gemini Live (used automatically if proxy blocks WebSocket upgrade)
  const httpLiveSessions = new Map<
    string,
    {
      res: express.Response;
      controller: ReturnType<typeof createLiveSessionController>;
      keepAlive: ReturnType<typeof setInterval>;
    }
  >();

  app.get("/api/live/events/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).end();

    const existing = httpLiveSessions.get(sessionId);
    if (existing) {
      clearInterval(existing.keepAlive);
      existing.controller.closeSession();
      httpLiveSessions.delete(sessionId);
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof (res as any).flushHeaders === "function") (res as any).flushHeaders();

    const safeSseSend = (payload: Record<string, any>) => {
      if (res.writableEnded) return;
      try {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch {
        // ignore write errors
      }
    };

    const controller = createLiveSessionController(safeSseSend);
    const keepAlive = setInterval(() => {
      if (!res.writableEnded) {
        try {
          res.write(": ping\n\n");
        } catch {
          // ignore
        }
      }
    }, 15000);

    httpLiveSessions.set(sessionId, { res, controller, keepAlive });
    safeSseSend({ type: "bridge_ready", sessionId });

    res.on("close", () => {
      clearInterval(keepAlive);
      controller.closeSession();
      if (httpLiveSessions.get(sessionId)?.res === res) {
        httpLiveSessions.delete(sessionId);
      }
    });
  });

  app.post("/api/live/input/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    const entry = httpLiveSessions.get(sessionId);
    if (!entry) {
      return res.status(404).json({ error: "Live SSE session not found or closed" });
    }
    try {
      await entry.controller.handleIncomingMessage(req.body);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed to forward Live input" });
    }
  });

  // Health check endpoint for Cloud Run & uptime monitors
  app.get(["/api/health", "/healthz"], (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      status: "healthy",
      env: process.env.NODE_ENV || "development",
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // Return structured 404 JSON for unmatched /api/* routes before SPA fallback
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: "API route not found" });
  });

  // Secondary alternative direct links: /MydadElRahmanApp, /mydad-live, /live
  app.use((req, res, next) => {
    const isCustomPath = /^\/(MydadElRahmanApp|mydadelrahmanapp|mydad-live|mydadlive|live)(\/?|\/index\.html)?$/i.test(req.path);

    if (isCustomPath) {
      if (process.env.NODE_ENV === "production") {
        const distPath = path.join(process.cwd(), 'dist');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.sendFile(path.join(distPath, 'index.html'));
      } else {
        req.url = '/';
      }
    }
    next();
  });

  // Vite middleware for development (registered after all /api/* routes)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: "spa",
    });
    app.get('/@vite/client', async (_req, res, next) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (result?.code) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          const safeCode = result.code
            .replaceAll('await wsTransport.connect(handlers);', 'return;')
            .replaceAll('ws.send(JSON.stringify(data));', 'ws?.send(JSON.stringify(data));');
          return res.send(safeCode);
        }
      } catch {
        // fallback to default vite middleware
      }
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use((req, res, next) => {
      if (req.path === '/manifest.webmanifest') {
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      } else if (req.path === '/sw.js' || req.path.startsWith('/workbox-') || req.path === '/' || req.path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else if (req.path.startsWith('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      }
      next();
    });
    app.use(express.static(distPath, { etag: true, lastModified: true }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);

  const liveWss = new WebSocketServer({ server, path: "/api/live" });

  liveWss.on("connection", (clientWs: WebSocket) => {
    const safeSend = (payload: Record<string, any>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        try {
          clientWs.send(JSON.stringify(payload));
        } catch {
          // ignore send errors on closing socket
        }
      }
    };

    const controller = createLiveSessionController(safeSend);

    clientWs.on("message", async (rawData) => {
      let msg: any;
      try {
        msg = JSON.parse(rawData.toString());
      } catch {
        return;
      }
      await controller.handleIncomingMessage(msg);
    });

    clientWs.on("close", () => {
      controller.closeSession();
    });

    clientWs.on("error", () => {
      controller.closeSession();
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT} (WebSocket Live endpoint: /api/live)`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});

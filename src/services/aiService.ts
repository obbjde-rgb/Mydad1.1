import { safeLocalStorageGet, safeLocalStorageSet, parseAIJson } from "../lib/utils";
import { logNetworkRequest, logNetworkResponse } from "../lib/diagnostics";

export const AI_PROVIDERS = {
  gemini: { 
    name: 'Google Gemini', 
    keyName: 'gemini_api_key', 
    baseURL: 'https://generativelanguage.googleapis.com/v1beta', 
    defaultModel: 'gemini-3.7-flash',
    isFree: true,
    models: [
      'gemini-robotics-er-2-preview',
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
    ]
  },
  groq: { 
    name: 'Groq', 
    keyName: 'groq_api_key', 
    baseURL: 'https://api.groq.com/openai/v1', 
    defaultModel: 'llama-3.3-70b-versatile',
    isFree: true,
    models: [
      'llama-3.3-70b-versatile', 'llama-3.3-70b-specdec', 'llama-3.1-8b-instant', 'llama-3.1-70b-versatile',
      'llama-3.2-1b-preview', 'llama-3.2-3b-preview', 'llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview',
      'meta-llama/llama-4-maverick-17b-128e-instruct', 'meta-llama/llama-4-scout-17b-16e-instruct',
      'llama-guard-3-8b', 'deepseek-r1-distill-llama-70b', 'deepseek-r1-distill-qwen-32b',
      'qwen/qwen3-32b', 'qwen-qwq-32b', 'qwen-2.5-32b', 'qwen-2.5-coder-32b',
      'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'openai/gpt-oss-safeguard-20b',
      'moonshotai/kimi-k2-instruct', 'allam-2-7b', 'compound-beta', 'compound-beta-mini',
      'mixtral-8x7b-32768', 'gemma2-9b-it', 'whisper-large-v3', 'whisper-large-v3-turbo'
    ]
  },
  deepseek: { 
    name: 'DeepSeek', 
    keyName: 'deepseek_api_key', 
    baseURL: 'https://api.deepseek.com/v1', 
    defaultModel: 'deepseek-chat',
    isFree: false,
    models: [
      'deepseek-chat', 'deepseek-reasoner', 'deepseek-v3', 'deepseek-v3.1', 'deepseek-v3.2',
      'deepseek-r1', 'deepseek-r1-0528', 'deepseek-r1-distill-qwen-32b', 'deepseek-r1-distill-llama-70b', 'deepseek-coder'
    ]
  },
  openrouter: { 
    name: 'OpenRouter (Free Models)', 
    keyName: 'openrouter_api_key', 
    baseURL: 'https://openrouter.ai/api/v1', 
    defaultModel: 'openrouter/free',
    isFree: true,
    models: [
      'openrouter/free', 'nvidia/nemotron-3.5-lightning:free', 'nvidia/nemotron-3-ultra-550b-a55b:free',
      'nvidia/nemotron-3.5-super-vl:free', 'google/gemma-4-26b-a4b-it:free', 'google/gemma-4-31b-it:free',
      'google/gemma-3-27b-it:free', 'google/gemma-2-9b-it:free', 'google/gemini-2.0-flash-lite-preview-02-05:free',
      'google/gemini-2.0-pro-exp-02-05:free', 'google/gemini-2.5-flash', 'google/gemini-2.5-pro',
      'meta-llama/llama-3.3-70b-instruct:free', 'meta-llama/llama-3.1-8b-instruct:free',
      'deepseek/deepseek-r1:free', 'deepseek/deepseek-r1-0528:free', 'deepseek/deepseek-chat:free',
      'deepseek/deepseek-chat-v3-0324:free', 'deepseek/deepseek-v3', 'deepseek/deepseek-v4.1-flash-1017',
      'qwen/qwen3-coder:free', 'qwen/qwen3-235b-a22b:free', 'qwen/qwen-2.5-72b-instruct:free',
      'qwen/qwen-2.5-72b-instruct', 'qwen/qwen3.8-max-prime', 'openai/gpt-oss-120b:free',
      'openai/gpt-oss-20b:free', 'openai/gpt-4o', 'openai/gpt-4o-mini', 'openai/o3-mini',
      'openai/gpt-6.1-sol', 'openai/gpt-6.1-terra', 'anthropic/claude-3.7-sonnet',
      'mistralai/mistral-nemo:free', 'microsoft/phi-4'
    ]
  },
  kilo: {
    name: 'Kilo AI Gateway (Free & Pro)',
    keyName: 'kilo_api_key',
    baseURL: 'https://ai-gateway.kilo.ai/api/v1',
    defaultModel: 'nvidia/nemotron-3.5-lightning:free',
    isFree: true,
    models: [
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
      'nvidia/nemotron-3.5-lightning-free',
      'stealth/glyph-cluster',
      'reflection/beam-free',
      'kilo-auto/efficient',
      'anthropic/claude-opus-5.5',
      'anthropic/claude-3.7-sonnet',
      'openai/gpt-6.1-sol',
      'openai/gpt-6.1-terra',
      'openai/gpt-4o',
      '~openai/gpt-astra-latest',
      '~openai/gpt-sol-latest',
      'google/gemini-3.8-flash',
      'google/gemini-2.5-pro',
      'deepseek/deepseek-v4.1-flash-1017',
      '~deepseek/deepseek-flash-latest',
      '~deepseek/deepseek-pro-latest',
      'deepseek/deepseek-r1',
      'deepseek/deepseek-v3',
      'qwen/qwen3.8-max-prime',
      'qwen/qwen3.8-omni-flash',
      'qwen/qwen-2.5-72b-instruct'
    ]
  },
  pollinations: {
    name: 'Pollinations (Free)',
    keyName: '',
    baseURL: 'https://image.pollinations.ai/prompt',
    defaultModel: 'flux',
    isFree: true,
    models: ['flux', 'flux-realism', 'flux-anime', 'flux-3d', 'turbo', 'sana', 'midjourney', 'sdxl', 'openai-fast', 'openai', 'gpt-oss-20b']
  },
  stability: {
    name: 'Stability AI',
    keyName: 'stability_api_key',
    baseURL: 'https://api.stability.ai/v2beta',
    defaultModel: 'stable-diffusion-3.5-large',
    isFree: false,
    models: [
      'stable-diffusion-3.5-large', 'stable-diffusion-3.5-large-turbo', 'stable-diffusion-3.5-medium',
      'stable-diffusion-3-large', 'stable-diffusion-3-medium', 'stable-video-diffusion-xt-1-1', 'stability-core'
    ]
  },
  mistral: { 
    name: 'Mistral', 
    keyName: 'mistral_api_key', 
    baseURL: 'https://api.mistral.ai/v1', 
    defaultModel: 'mistral-small-latest',
    isFree: false,
    models: [
      'mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest',
      'codestral-latest', 'codestral-2508', 'pixtral-large-latest', 'pixtral-12b-2409',
      'ministral-8b-latest', 'ministral-3b-latest', 'open-mistral-7b', 'open-mixtral-8x7b',
      'open-mixtral-8x22b', 'devstral-2512', 'voxtral-small-24b-2507', 'mistral-embed'
    ]
  },
  huggingface: { 
    name: 'Hugging Face', 
    keyName: 'hf_api_key', 
    baseURL: 'https://router.huggingface.co/v1', 
    defaultModel: 'deepseek-ai/DeepSeek-R1',
    isFree: true,
    models: [
      'deepseek-ai/DeepSeek-R1', 'deepseek-ai/DeepSeek-V4.1-Flash', 'deepseek-ai/DeepSeek-V3.2',
      'Qwen/Qwen3.8-27B', 'Qwen/Qwen3-32B', 'Qwen/Qwen3-14B', 'Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-7B-Instruct',
      'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'meta-llama/Llama-3.3-70B-Instruct',
      'mistralai/Mistral-Small-24B-Instruct-2501', 'google/gemma-3-27b-it', 'microsoft/DialoGPT-medium', 'gpt2'
    ]
  },
  routeway: {
    name: 'Routeway (Free)',
    keyName: 'routeway_api_key',
    baseURL: 'https://api.routeway.ai',
    defaultModel: 'step-3.5-flash:free',
    isFree: true,
    models: [
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
      'gpt-6-luna'
    ]
  },
};

export type AIProviderKey = keyof typeof AI_PROVIDERS;


export type VoiceCategory = 'fusha-tahbir' | 'fusha-tartil' | 'moroccan-tartil' | 'moroccan-darija' | 'classic';

export interface GeminiVoiceProfile {
  id: string;
  name: string;
  baseVoice: string;
  category: VoiceCategory;
  categoryLabel: string;
  dialect: 'الفصحى' | 'الدارجة المغربية' | 'المغربية والفصحى';
  desc: string;
  stylePrompt: string;
}

const ADVANCED_GEMINI_VOICES: GeminiVoiceProfile[] = [
  // --- 1. تحبير وتلاوة الفصحى الشجية (12 صوتاً متطوراً) ---
  {
    id: 'AbulHasan_Hijaz',
    name: 'أبو الحسن المكي — تحبير حجازي آسر',
    baseVoice: 'Charon',
    category: 'fusha-tahbir',
    categoryLabel: 'تحبير شجي (فصحى)',
    dialect: 'الفصحى',
    desc: 'صوت عميق مهيب بمقام الحجاز، يمتاز بالمدود الشجية والخشوع الآسر.',
    stylePrompt: 'Deep, soulful, deeply reverent Classical Arabic Quranic Tahbir recitation in warm Hijazi Maqam, slow meditative cadence with expressive elongation and clear Tajwid.'
  },
  {
    id: 'Idris_Saba',
    name: 'الشيخ إدريس — مقام الصبا الخاشع',
    baseVoice: 'Alnilam',
    category: 'fusha-tahbir',
    categoryLabel: 'تحبير شجي (فصحى)',
    dialect: 'الفصحى',
    desc: 'نبرة حزينة خاشعة بمقام الصبا تلامس شغاف القلب وتبعث الرقة والدمع.',
    stylePrompt: 'Tender, heartfelt, melancholic Classical Arabic Quranic recitation in Saba Maqam, spiritual humility, unhurried emotional pacing and soft breath pauses.'
  },
  {
    id: 'Ibrahim_Nahawand',
    name: 'إبراهيم الحرمي — مقام نهاوند العذب',
    baseVoice: 'Fenrir',
    category: 'fusha-tahbir',
    categoryLabel: 'تحبير شجي (فصحى)',
    dialect: 'الفصحى',
    desc: 'صوت جهوري فخم بنبرة نهاوندية دافئة تحاكي كبار قراء المسجد الحرام.',
    stylePrompt: 'Commanding yet tender Classical Arabic Quranic Tilawah in Nahawand Maqam, resonant warm baritone richness, majestic Haramain cadence.'
  },
  {
    id: 'AbdulMalik_Bayat',
    name: 'عبد الملك — ترتيل بياتي شجي',
    baseVoice: 'Orus',
    category: 'fusha-tahbir',
    categoryLabel: 'تحبير شجي (فصحى)',
    dialect: 'الفصحى',
    desc: 'أداء بيّاتي عذب متقن المخارج، يجمع بين طمأنينة القلب وجمال التحبير.',
    stylePrompt: 'Serene melodic Classical Arabic Quranic recitation in Bayati Maqam, warm resonant tone, crystal-clear Arabic consonants and soothing cadence.'
  },
  {
    id: 'Zakariya_Rast',
    name: 'زكريا الأندلسي — مقام الرست الوقور',
    baseVoice: 'Iapetus',
    category: 'fusha-tahbir',
    categoryLabel: 'تحبير شجي (فصحى)',
    dialect: 'الفصحى',
    desc: 'تلاوة وقورة رصينة بمقام الرست، متوازنة بين الهيبة والصفاء الروحي.',
    stylePrompt: 'Dignified, noble Classical Arabic Quranic recitation in Rast Maqam, poised rhythm, crisp pronunciation and meditative stillness.'
  },
  {
    id: 'AbdulRahim_Tahbir',
    name: 'عبد الرحيم — تحبير الفجر الممدود',
    baseVoice: 'Rasalgethi',
    category: 'fusha-tahbir',
    categoryLabel: 'تحبير شجي (فصحى)',
    dialect: 'الفصحى',
    desc: 'تحبير فجري ندي بوقفات مطمئنة وصوت عذب يملأ السمع بالسكينة.',
    stylePrompt: 'Golden dawn-like Classical Arabic Tahbir recitation, lingering graceful vowel resonance, calm devotion and soothing melody.'
  },
  {
    id: 'Safwan_Haramain',
    name: 'صفوان البليغ — تلاوة جهورية مهيبة',
    baseVoice: 'Gacrux',
    category: 'fusha-tahbir',
    categoryLabel: 'تحبير شجي (فصحى)',
    dialect: 'الفصحى',
    desc: 'صوت جهوري رفيع المستوى لآيات القصص والوعد والوعيد بفصاحة عالية.',
    stylePrompt: 'Grand, resonant Classical Arabic baritone recitation, rich dramatic reverence and clear articulation suited for solemn reflection.'
  },
  {
    id: 'Anas_Shami',
    name: 'أنس الشامي — نبرة روحانية دافئة',
    baseVoice: 'Achird',
    category: 'fusha-tahbir',
    categoryLabel: 'تحبير شجي (فصحى)',
    dialect: 'الفصحى',
    desc: 'صوت شامي رقيق دافئ النغمة قريب من القلب في الخلوات والدعاء.',
    stylePrompt: 'Gentle, intimate, warmly melodic Classical Arabic recitation and Dua voice, soft emotional resonance.'
  },
  {
    id: 'Salman_Sikah',
    name: 'سلمان السكينة — مقام سيكاه الليلي',
    baseVoice: 'Umbriel',
    category: 'fusha-tahbir',
    categoryLabel: 'تحبير شجي (فصحى)',
    dialect: 'الفصحى',
    desc: 'تلاوة هادئة عميقة لقيام الليل وتدبر الآيات في أجواء السكون.',
    stylePrompt: 'Calm nocturnal Classical Arabic Tahbir in Sikah Maqam, hushed reverence, smooth unhurried contemplation.'
  },
  {
    id: 'Muaz_Rahma',
    name: 'معاذ الهادئ — صوت الرحمة والسكينة',
    baseVoice: 'Enceladus',
    category: 'fusha-tahbir',
    categoryLabel: 'تحبير شجي (فصحى)',
    dialect: 'الفصحى',
    desc: 'صوت ناعم مطمئن يذهب القلق ويريح النفس أثناء الاستماع الطويل.',
    stylePrompt: 'Soft, breathy, deeply comforting Classical Arabic recitation, gentle warmth and complete inner peace.'
  },
  {
    id: 'Hamza_Najdi',
    name: 'حمزة النجدي — فصاحة وقورة محكمة',
    baseVoice: 'Algenib',
    category: 'fusha-tahbir',
    categoryLabel: 'تحبير شجي (فصحى)',
    dialect: 'الفصحى',
    desc: 'نبرة عربية أصيلة ثابتة ومخارج متينة واضحة في الحروف والصفات.',
    stylePrompt: 'Firm, authoritative, pure Classical Arabic recitation with strong crisp consonant articulation and composed dignity.'
  },
  {
    id: 'Badr_Bayan',
    name: 'بدر البيان — فصحى تراثية آسرة',
    baseVoice: 'Sadaltager',
    category: 'fusha-tahbir',
    categoryLabel: 'تحبير شجي (فصحى)',
    dialect: 'الفصحى',
    desc: 'أداء بياني فصيح يبرز بلاغة القرآن الكريم وجمال التفسير والخطب.',
    stylePrompt: 'Eloquent Classical Arabic narrator and reciter voice, rich timber, noble rhythm and expressive rhetorical clarity.'
  },

  // --- 2. ترتيل الفصحى الصافي والتعليم (8 أصوات متطورة) ---
  {
    id: 'Tariq_Tartil',
    name: 'طارق المقرئ — ترتيل تعليمي متقن',
    baseVoice: 'Puck',
    category: 'fusha-tartil',
    categoryLabel: 'ترتيل الفصحى',
    dialect: 'الفصحى',
    desc: 'ترتيل منضبط بمخارج واضحة وإيقاع متزن لتسهيل الحفظ والترديد.',
    stylePrompt: 'Ultra-clear, measured Classical Arabic Tartil for Quranic memorization and learning, crisp vowels and steady tempo.'
  },
  {
    id: 'Jalal_Muqri',
    name: 'جلال الجليل — ترتيل متأنٍّ مجود',
    baseVoice: 'Zubenelgenubi',
    category: 'fusha-tartil',
    categoryLabel: 'ترتيل الفصحى',
    dialect: 'الفصحى',
    desc: 'ترتيل بطيء متأنٍّ يقف عند رؤوس الآيات بوضوح وجلال.',
    stylePrompt: 'Slow, solemn, deeply contemplative Classical Arabic Tajwid reading with clear stops and poised gravity.'
  },
  {
    id: 'Yusuf_Fasih',
    name: 'يوسف الفصيح — فصحى صافية متزنة',
    baseVoice: 'Schedar',
    category: 'fusha-tartil',
    categoryLabel: 'ترتيل الفصحى',
    dialect: 'الفصحى',
    desc: 'صوت فصيح سلس يجمع بين النقاء الصوتي والأداء المتوازن في التلاوة والتفسير.',
    stylePrompt: 'Clean, poised, balanced Classical Arabic voice combining reverence and effortless intelligibility for recitation and Tafsir.'
  },
  {
    id: 'Asma_Khashia',
    name: 'أسماء الخاشعة — تلاوة رقيقة دافئة',
    baseVoice: 'Kore',
    category: 'fusha-tartil',
    categoryLabel: 'ترتيل الفصحى',
    dialect: 'الفصحى',
    desc: 'صوت نسائي هادئ دافئ ونقي جداً لترتيل الآيات والأدعية المأثورة.',
    stylePrompt: 'Warm, serene, crystal-clear female Classical Arabic voice for gentle Quranic Tartil and tranquil reflection.'
  },
  {
    id: 'Khadija_Nada',
    name: 'خديجة الندية — نبرة الفجر العذبة',
    baseVoice: 'Aoede',
    category: 'fusha-tartil',
    categoryLabel: 'ترتيل الفصحى',
    dialect: 'الفصحى',
    desc: 'عذوبة شعرية ورقة مطمئنة تلائم أذكار الصباح والمساء والتدبر.',
    stylePrompt: 'Velvety, poetic, soothing female Classical Arabic voice ideal for Dua, Azkar, and calm Quranic meditation.'
  },
  {
    id: 'Maryam_Safiya',
    name: 'مريم الصافية — نقاء الفصحى المشرق',
    baseVoice: 'Leda',
    category: 'fusha-tartil',
    categoryLabel: 'ترتيل الفصحى',
    dialect: 'الفصحى',
    desc: 'نبرة مشرقة نقية بوضوح تام في النطق العربي السليم.',
    stylePrompt: 'Bright, pure, gentle female Classical Arabic voice with crisp standard pronunciation for daily reading.'
  },
  {
    id: 'Aisha_Sakina',
    name: 'عائشة السكينة — صوت حنون للتدبر',
    baseVoice: 'Callirrhoe',
    category: 'fusha-tartil',
    categoryLabel: 'ترتيل الفصحى',
    dialect: 'الفصحى',
    desc: 'صوت لطيف مريح يشرح الصدر في قراءة التفسير والتأمل الروحي.',
    stylePrompt: 'Compassionate, gentle, peaceful female Classical Arabic voice for spiritual reflection and calm guidance.'
  },
  {
    id: 'Ruqayya_Murabbiya',
    name: 'رقية المربية — فصحى تعليمية واضحة',
    baseVoice: 'Autonoe',
    category: 'fusha-tartil',
    categoryLabel: 'ترتيل الفصحى',
    dialect: 'الفصحى',
    desc: 'أداء تعليمي صبور ومفهوم يناسب تعليم الصغار والكبار أحكام القراءة.',
    stylePrompt: 'Articulate, patient, nurturing female Classical Arabic educator voice with clear diction.'
  },

  // --- 3. التلاوة والتحبير المغربي الأندلسي الشجي (5 أصوات متطورة) ---
  {
    id: 'Mehdi_Fassi',
    name: 'المقرئ المهدي الفاسي — تحبير مغربي أصيل',
    baseVoice: 'Algieba',
    category: 'moroccan-tartil',
    categoryLabel: 'التلاوة المغربية',
    dialect: 'المغربية والفصحى',
    desc: 'أداء مغربي فاسي عريق على طبع القرويين والرواية المغربية بترتيل شجي يأسر القلوب.',
    stylePrompt: 'Authentic Moroccan Fassi Quranic recitation style (Maghrebi Warsh cadence), soulful Andalusian-Moroccan melodic warmth, dignified and deeply moving.'
  },
  {
    id: 'Abdelali_Sussi',
    name: 'عبد العالي السوسي — ترتيل مغربي عميق النبرة',
    baseVoice: 'Sulafat',
    category: 'moroccan-tartil',
    categoryLabel: 'التلاوة المغربية',
    dialect: 'المغربية والفصحى',
    desc: 'صوت مغربي دافئ عميق النبرة مميز في الترتيل الجماعي والأذكار والابتهالات.',
    stylePrompt: 'Deep, warm southern Moroccan Quranic recitation tone, steady serene Maghrebi rhythm and heartfelt spiritual sincerity.'
  },
  {
    id: 'Sharif_Tanjawi',
    name: 'الشريف الطنجاوي — تحبير أندلسي مغربي آسر',
    baseVoice: 'Vindemiatrix',
    category: 'moroccan-tartil',
    categoryLabel: 'التلاوة المغربية',
    dialect: 'المغربية والفصحى',
    desc: 'شجن مغربي شمالي يمزج عراقة الموشح الأندلسي بخشوع التلاوة القرآنية.',
    stylePrompt: 'Expressive northern Moroccan-Andalusian melodic Classical Arabic delivery, lyrical grace and reverent vocal warmth.'
  },
  {
    id: 'Salma_Andalusia',
    name: 'سلمى الأندلسية — شجن مغربي فصيح رقيق',
    baseVoice: 'Achernar',
    category: 'moroccan-tartil',
    categoryLabel: 'التلاوة المغربية',
    dialect: 'المغربية والفصحى',
    desc: 'صوت مغربي أندلسي رقيق يأخذ العقل في قراءة الأدعية المأثورة والتدبر.',
    stylePrompt: 'Delicate, soulful Maghrebi-Andalusian female Classical Arabic voice, poetic serenity and warm tranquil emotion.'
  },
  {
    id: 'Hasna_Rabat_Tartil',
    name: 'حسناء الإدريسية — ترتيل مغربي وقور',
    baseVoice: 'Pulcherrima',
    category: 'moroccan-tartil',
    categoryLabel: 'التلاوة المغربية',
    dialect: 'المغربية والفصحى',
    desc: 'نبرة مغربية راقية ومهذبة للترتيل الهادي والأوراد اليومية.',
    stylePrompt: 'Refined, dignified Moroccan Classical Arabic female voice with calm poise and clear Maghrebi warmth.'
  },

  // --- 4. أصوات الدارجة المغربية الأصيلة والمحاورة القلبية (5 أصوات متطورة) ---
  {
    id: 'Driss_Marrakchi',
    name: 'سيدي إدريس المراكشي — دارجة مغربية أصيلة',
    baseVoice: 'Sadachbia',
    category: 'moroccan-darija',
    categoryLabel: 'الدارجة المغربية',
    dialect: 'الدارجة المغربية',
    desc: 'نبرة مغربية حكيمة ودافئة بالدارجة المغربية الأصيلة للشرح والموعظة والنصيحة.',
    stylePrompt: 'Warm, wise, authentic Moroccan Darija speaker voice, natural Maghrebi accent, friendly and reassuring conversational warmth.'
  },
  {
    id: 'Yassine_Rbati',
    name: 'الأستاذ ياسين الرباطي — دارجة مغربية راقية وفصحى',
    baseVoice: 'Zephyr',
    category: 'moroccan-darija',
    categoryLabel: 'الدارجة المغربية',
    dialect: 'المغربية والفصحى',
    desc: 'أداء مغربي رباطي متزن يجمع بين سلاسة الدارجة المغربية المهذبة والفصحى الواضحة.',
    stylePrompt: 'Polished modern Rabat Moroccan Darija and Classical Arabic speaker, calm, articulate, balanced and engaging.'
  },
  {
    id: 'Lalla_Fatima_Fassia',
    name: 'لالة فاطمة الفاسية — دارجة مغربية مهذبة وهادئة',
    baseVoice: 'Despina',
    category: 'moroccan-darija',
    categoryLabel: 'الدارجة المغربية',
    dialect: 'الدارجة المغربية',
    desc: 'صوت فاسي حنون ومهذب بالدارجة المغربية يبعث السكينة والطمأنينة في البيوت.',
    stylePrompt: 'Gentle, respectful, motherly Fassi Moroccan Darija voice, serene warmth and natural Moroccan intonation.'
  },
  {
    id: 'Khadija_Casawia',
    name: 'خديجة البيضاوية — دارجة مغربية سلسة وواضحة',
    baseVoice: 'Erinome',
    category: 'moroccan-darija',
    categoryLabel: 'الدارجة المغربية',
    dialect: 'الدارجة المغربية',
    desc: 'نبرة بيضاوية طبيعية سلسة ومفهومة لشرح المعاني والأذكار بالدارجة المغربية.',
    stylePrompt: 'Natural, crisp, friendly Casablanca Moroccan Darija voice, expressive and easy to follow.'
  },
  {
    id: 'Amina_Marrakchia',
    name: 'أمينة المراكشية — دارجة مغربية شجية ودافئة',
    baseVoice: 'Laomedeia',
    category: 'moroccan-darija',
    categoryLabel: 'الدارجة المغربية',
    dialect: 'الدارجة المغربية',
    desc: 'صوت مراكشي دافئ ومشرق لقراءة قصص الأنبياء والشرح بالدارجة المغربية.',
    stylePrompt: 'Melodic, warm, expressive Marrakchi Moroccan Darija storyteller voice with gentle joy and heart.'
  }
];

export const VOICES: GeminiVoiceProfile[] = (() => {
  const FIRST_NAMES = [
    'طارق', 'ليلى', 'سليم', 'بدر', 'نور', 'فجر', 'وسيم', 'زهراء', 'جلال', 'أمل',
    'رامي', 'نورة', 'حسن', 'سلمى', 'حمزة', 'لينا', 'عمر', 'مارية', 'زيد', 'هدى',
    'يحيى', 'عائشة', 'علي', 'فاطمة', 'خالد', 'سارة', 'إبراهيم', 'ياسمين', 'يوسف', 'داليا',
    'حميد', 'رانيا', 'سامي', 'أميرة', 'فارس', 'ندى', 'كريم', 'جنى', 'ماجد', 'ليان',
    'فادي', 'أنس', 'مريم', 'بلال', 'خديجة', 'عبد الرحمن', 'رقية', 'جعفر', 'زينب', 'حذيفة',
    'سمية', 'سلمان', 'أسماء', 'سعد', 'صفية', 'مالك', 'تسنيم', 'ياسر', 'غالية', 'معاذ',
    'غيث', 'إلياس', 'أروى', 'حسام', 'ريما', 'صالح', 'منى', 'طلال', 'نادية', 'زياد'
  ];

  const STYLES = [
    'الحجازي', 'النجدي', 'الشامي', 'المصري', 'المغربي', 'العراقي', 'اليمني', 'القرطبي',
    'الأندلسي', 'الخاشع', 'الوقور', 'النديم', 'الصافي', 'الجهوري', 'الرخيم', 'العذب',
    'الوديع', 'المطمئن', 'المرشد', 'الرشيد', 'البليغ', 'التعليمي', 'الهادئ', 'السلس',
    'المرتل', 'المجود', 'السريع', 'البطيء', 'المتزن', 'المهيب', 'الرحيم', 'الودود',
    'الحكيم', 'المشرق', 'الروحي', 'الباكي', 'المنشاوي النبرة', 'الحصري الأداء', 'البنا المحاكي',
    'الندى الصافي', 'الترتيل المريح'
  ];

  const DESCRIPTIONS = [
    'نبرة هادئة تلامس القلوب، مثالية للتلاوة الطويلة وتدبر الآيات.',
    'وضوح فائق في مخارج الحروف والصفات، ممتاز لتعليم القرآن وحفظ الآيات.',
    'صوت جهوري يملأ النفس مهابة وخشوعاً عند تلاوة آيات الوعيد والوعد.',
    'ترتيل سلس ومريح للأذن، مثالي للاستماع المتواصل أثناء العمل أو الراحة.',
    'نغمة روحانية دافئة بنبرة وقورة تجمع بين السكينة والإتقان المتناهي.',
    'صوت عذب نقي كنسيم الفجر، يبعث الأمل والطمأنينة في النفس.',
    'أداء كلاسيكي فخم بنبرة مهيبة تحاكي أسلوب كبار قراء الحرمين الشريفين.',
    'صوت رقيق وهادئ جداً، ممتاز للاستماع قبل النوم أو في خلوات العبادة.',
    'قراءة حدر سريعة متزنة، ممتازة لمراجعة الحفظ اليومي وتثبيت الآيات والسور.',
    'ترتيل متقن بمخارج حروف واضحة جداً ونبرة دافئة قريبة من القلب.',
    'صوت وقور بنبرة عميقة، يجسد الخشوع والتدبر في كل كلمة وآية.',
    'صوت حيوي ممتلئ بالطاقة والنقاء، يعطي نشاطاً وحيوية أثناء الاستماع.',
    'أداء متمكن يجمع بين عذوبة الصوت وقوة النبرة، مناسب لجميع السور.',
    'نبرة مطمئنة تحمل السكينة والسلام، تريح البال وتذهب الحزن والهم.',
    'صوت خاشع يميل إلى التباكي والتدبر، يؤثر في النفوس ويزيد الخشوع.',
    'تلاوة ندية ناصعة النقاء، تبرز جمال اللحن القرآني ومخارج الحروف بدقة.',
    'أداء تقليدي عريق بروح من عبق التاريخ والقرون الأولى، يملأ الصدر إيماناً.',
    'صوت عذب انسيابي كجريان الماء، مريح للغاية ومناسب لتكرار الآيات.',
    'صوت جهوري رصين ومحكم، يبث القوة والوقار في تلاوة سور القرآن الكريم.',
    'ترتيل تعليمي متزن مع وقفات دقيقة تتيح للمستمع ترديد الآيات والتعلم.',
    'نبرة صافية ممتدة الأصوات، تناسب المقامات الروحية الهادئة والمريحة.',
    'تلاوة وقورة بنبرة متوسطة تجمع بين السرعة والتدبر، مثالية للورد اليومي.',
    'صوت عذب ذو صدى طبيعي رائع، يملأ أركان الغرفة بالبهجة والسكينة.',
    'أداء مميز بنكهة مشرقية أصيلة، يجذب الأسماع والقلوب من أول آية.',
    'نبرة دافئة ومحببة جداً للأطفال، تشجعهم على الاستماع والمحاكاة والحفظ.',
    'صوت شجي يجمع بين الرقة والقوة، يعبر عن جمال وإعجاز الكلمات القرآنية.',
    'ترتيل هادئ بمستويات صوت متزنة وبدون تذبذب، يعين على التركيز العميق.',
    'صوت وقور يناسب السور المكية وآيات القصص والتدبر العميق في الكون.',
    'تلاوة منعشة وصافية بنبرة حيوية تبث النشاط والراحة في ذات الوقت.',
    'أداء فخم ومخارج حروف ذهبية، تليق بعظمة ومكانة كلام رب العالمين.'
  ];

  const baseVoices = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede', 'Leda', 'Zephyr'];

  const previousClassicCore: Array<{ id: string; name: string; desc: string; baseVoice: string }> = [
    { id: 'Zephyr', name: 'Zephyr', desc: 'متوازن وعصري', baseVoice: 'Zephyr' },
    { id: 'Kore', name: 'Kore', desc: 'لطيف ودافئ', baseVoice: 'Kore' },
    { id: 'Puck', name: 'Puck', desc: 'احترافي وواضح', baseVoice: 'Puck' },
    { id: 'Charon', name: 'Charon', desc: 'قوي وعميق', baseVoice: 'Charon' },
    { id: 'Fenrir', name: 'Fenrir', desc: 'رنان ومؤثر', baseVoice: 'Fenrir' },
    { id: 'Aoede', name: 'Aoede', desc: 'ناعم ومتطور', baseVoice: 'Aoede' },
    { id: 'Leda', name: 'Leda', desc: 'حيوي ونقي', baseVoice: 'Leda' },
    { id: 'Tariq', name: 'Tariq', desc: 'قوي وحكيم - مستوحى من وقار التلاوات التقليدية', baseVoice: 'Charon' },
    { id: 'Layl', name: 'Layl', desc: 'هادئ ليلي - مثالي للتلاوة الخاشعة والتأمل', baseVoice: 'Aoede' },
    { id: 'Safa', name: 'Safa', desc: 'عالي ونقي - مناسب للقراءات السريعة والواضحة', baseVoice: 'Puck' },
    { id: 'Badr', name: 'Badr', desc: 'قوي ورنان - صوت جهوري يعطي هيبة للتلاوة', baseVoice: 'Fenrir' },
    { id: 'Noor', name: 'Noor', desc: 'لطيف ودافئ - نبرة مطمئنة تلامس القلوب', baseVoice: 'Kore' },
    { id: 'Fajr', name: 'Fajr', desc: 'نقي وحيوي - بداية مشرقة ومنعشة للتلاوة', baseVoice: 'Leda' },
    { id: 'Waseem', name: 'Waseem', desc: 'احترافي - أداء منضبط ومناسب للتعليم', baseVoice: 'Puck' },
    { id: 'Zahra', name: 'Zahra', desc: 'متطور - لمسة عصرية في الأداء', baseVoice: 'Aoede' },
    { id: 'Jalal', name: 'Jalal', desc: 'عميق - صوت يملأ المكان بالخشوع', baseVoice: 'Fenrir' },
    { id: 'Amal', name: 'Amal', desc: 'مليء بالأمل - صوت يبعث الراحة والسكينة', baseVoice: 'Kore' },
    { id: 'Rami', name: 'Rami', desc: 'حيوي - أداء نشط وقوي', baseVoice: 'Charon' },
    { id: 'Noura', name: 'Noura', desc: 'ناعم - رقة في الأداء', baseVoice: 'Leda' },
    { id: 'Hassan', name: 'Hassan', desc: 'ودود - صوت قريب من القلب', baseVoice: 'Puck' },
    { id: 'Salma', name: 'Salma', desc: 'رقيق - عذوبة في التلاوة', baseVoice: 'Aoede' },
    { id: 'Hamza', name: 'Hamza', desc: 'قوي - صوت جبل ثابت', baseVoice: 'Fenrir' },
    { id: 'Lina', name: 'Lina', desc: 'صافي - نقاء عالٍ في الصوت', baseVoice: 'Kore' },
    { id: 'Omar', name: 'Omar', desc: 'وقور - هيبة وخشوع', baseVoice: 'Charon' },
    { id: 'Marya', name: 'Marya', desc: 'مؤثر - عاطفة في الأداء', baseVoice: 'Aoede' },
    { id: 'Zaid', name: 'Zaid', desc: 'رصين - أداء متزن', baseVoice: 'Puck' },
    { id: 'Huda', name: 'Huda', desc: 'مرشد - توضيح مخارج الحروف', baseVoice: 'Leda' },
    { id: 'Yahya', name: 'Yahya', desc: 'حيوي - طاقة في القراءة', baseVoice: 'Fenrir' },
    { id: 'Aisha', name: 'Aisha', desc: 'لطيف - نعومة ووضوح', baseVoice: 'Kore' },
    { id: 'Ali', name: 'Ali', desc: 'واضح - دقة في الأداء', baseVoice: 'Puck' },
    { id: 'Fatima', name: 'Fatima', desc: 'خشوع - ترتيل خاشع', baseVoice: 'Aoede' },
    { id: 'Khalid', name: 'Khalid', desc: 'رخيم - صوت مريح للأذن', baseVoice: 'Charon' },
    { id: 'Sarah', name: 'Sarah', desc: 'عذب - سلاسة في التلاوة', baseVoice: 'Kore' },
    { id: 'Ibrahim', name: 'Ibrahim', desc: 'رزين - وقار وثبات', baseVoice: 'Fenrir' },
    { id: 'Mona', name: 'Mona', desc: 'مطمئن - سكينة في الصوت', baseVoice: 'Kore' },
    { id: 'Yusuf', name: 'Yusuf', desc: 'جذاب - أداء يشد الانتباه', baseVoice: 'Zephyr' },
    { id: 'Layla', name: 'Layla', desc: 'رقيق - هدوء وسلام', baseVoice: 'Aoede' },
    { id: 'Mustafa', name: 'Mustafa', desc: 'متمكن - أداء قوي', baseVoice: 'Charon' },
    { id: 'Dalia', name: 'Dalia', desc: 'صافي - وضوح تام', baseVoice: 'Leda' },
    { id: 'Hamid', name: 'Hamid', desc: 'وديع - طمأنينة', baseVoice: 'Kore' },
    { id: 'Rania', name: 'Rania', desc: 'دافئ - عاطفة نبيلة', baseVoice: 'Aoede' },
    { id: 'Sami', name: 'Sami', desc: 'سلس - أداء انسيابي', baseVoice: 'Puck' },
    { id: 'Amira', name: 'Amira', desc: 'راقي - أداء فخم', baseVoice: 'Leda' },
    { id: 'Faris', name: 'Faris', desc: 'حماسي - قوة وشجاعة', baseVoice: 'Fenrir' },
    { id: 'Nada', name: 'Nada', desc: 'لطيف - رقة وجمال', baseVoice: 'Kore' },
    { id: 'Kareem', name: 'Kareem', desc: 'كريم - صوت سخي', baseVoice: 'Charon' },
    { id: 'Jana', name: 'Jana', desc: 'براق - إشراق في الصوت', baseVoice: 'Leda' },
    { id: 'Majid', name: 'Majid', desc: 'مهيب - جلال في القراءة', baseVoice: 'Fenrir' },
    { id: 'Layan', name: 'Layan', desc: 'ناعم - انسيابية كاملة', baseVoice: 'Aoede' },
    { id: 'Fadi', name: 'Fadi', desc: 'صريح - وضوح مباشر', baseVoice: 'Puck' }
  ];

  const voicesList: GeminiVoiceProfile[] = [...ADVANCED_GEMINI_VOICES];
  const usedIds = new Set(voicesList.map(v => v.id.toLowerCase()));
  const usedNames = new Set(voicesList.map(v => v.name.toLowerCase()));

  // Preserve all 50 named voices from previous list
  for (const item of previousClassicCore) {
    if (!usedIds.has(item.id.toLowerCase())) {
      voicesList.push({
        id: item.id,
        name: item.name,
        baseVoice: item.baseVoice,
        category: 'classic',
        categoryLabel: 'القائمة الكلاسيكية',
        dialect: 'الفصحى',
        desc: item.desc,
        stylePrompt: `Clear, respectful Classical Arabic Quranic and spiritual reading: ${item.desc}`
      });
      usedIds.add(item.id.toLowerCase());
      usedNames.add(item.name.toLowerCase());
    }
  }

  // Preserve extended voices up to 1000+ classic entries with strictly unique names & IDs
  let index = 1;
  let fnIdx = 0;
  let stIdx = 0;
  while (voicesList.length < 1000 + ADVANCED_GEMINI_VOICES.length && index < 5000) {
    const firstName = FIRST_NAMES[fnIdx % FIRST_NAMES.length];
    const style = STYLES[stIdx % STYLES.length];
    const baseVoice = baseVoices[(index * 7) % baseVoices.length];
    const desc = DESCRIPTIONS[(index * 13) % DESCRIPTIONS.length];

    const voiceName = `${firstName} ${style}`;
    const id = `Voice_${index}`;

    if (!usedIds.has(id.toLowerCase()) && !usedNames.has(voiceName.toLowerCase())) {
      voicesList.push({
        id,
        name: voiceName,
        baseVoice,
        category: 'classic',
        categoryLabel: 'القائمة الكلاسيكية',
        dialect: style === 'المغربي' || style === 'الأندلسي' ? 'المغربية والفصحى' : 'الفصحى',
        desc: `${desc} (صوت أساسي: ${baseVoice})`,
        stylePrompt: `Respectful Arabic recitation in ${style} style: ${desc}`
      });
      usedIds.add(id.toLowerCase());
      usedNames.add(voiceName.toLowerCase());
    }

    index++;
    fnIdx++;
    if (fnIdx % FIRST_NAMES.length === 0) {
      stIdx++;
    } else {
      stIdx += 3;
    }
  }

  return voicesList;
})();

export const resolveGeminiVoice = (voiceIdOrName?: string | null): GeminiVoiceProfile => {
  if (!voiceIdOrName) return VOICES[0];
  const lower = voiceIdOrName.toLowerCase();
  const byId = VOICES.find(v => v.id.toLowerCase() === lower);
  if (byId) return byId;
  const byName = VOICES.find(v => v.name.toLowerCase() === lower);
  if (byName) return byName;
  const byBase = VOICES.find(v => v.baseVoice.toLowerCase() === lower);
  if (byBase) return byBase;
  return VOICES[0];
};

const dynamicModelsMemoryCache: Partial<Record<AIProviderKey, string[]>> = {};

export const getDynamicModelsList = (provider: AIProviderKey): string[] => {
  const baseModels = ((AI_PROVIDERS[provider] as any)?.models || [(AI_PROVIDERS[provider] as any)?.defaultModel]).filter(Boolean) as string[];
  const memModels = dynamicModelsMemoryCache[provider] || [];

  let lsModels: string[] = [];
  const cached = safeLocalStorageGet(`dynamic_models_${provider}`);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        lsModels = parsed;
      }
    } catch (e) {
      console.warn("Error parsing dynamic models from localStorage:", e);
    }
  }

  // Merge in-memory cache + localStorage cache + static provider models with ZERO exclusions
  const combined = Array.from(new Set([...memModels, ...lsModels, ...baseModels])).filter(Boolean) as string[];
  if (combined.length > (memModels.length || 0)) {
    dynamicModelsMemoryCache[provider] = combined;
  }
  return combined;
};

const dynamicFreeModelsCache: Partial<Record<AIProviderKey, Set<string>>> = {};

function getDynamicFreeModelsSet(provider: AIProviderKey): Set<string> | null {
  if (dynamicFreeModelsCache[provider]) return dynamicFreeModelsCache[provider]!;
  const cached = safeLocalStorageGet(`dynamic_free_models_${provider}`);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        const set = new Set<string>(parsed);
        dynamicFreeModelsCache[provider] = set;
        return set;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export function classifyModelPricing(provider: AIProviderKey, modelName: string): 'free' | 'paid' {
  const m = modelName.toLowerCase().trim();

  // First check live API-verified free models list (catches zero-cost preview models & full free sets)
  const verifiedFree = getDynamicFreeModelsSet(provider);
  if (verifiedFree && verifiedFree.has(modelName)) {
    return 'free';
  }

  if (provider === 'pollinations' || provider === 'groq' || provider === 'huggingface') {
    return 'free';
  }
  if (provider === 'stability') return m.includes('free') ? 'free' : 'paid';
  if (provider === 'deepseek') return m.includes(':free') || m.includes('-free') ? 'free' : 'paid';

  // Gateways & Routers: explicit free tag or known free identifier indicates free tier; everything else requires credits
  if (provider === 'openrouter' || provider === 'kilo' || provider === 'routeway') {
    if (
      m.endsWith(':free') ||
      m.endsWith('-free') ||
      m.includes('/free') ||
      m === 'free' ||
      (provider === 'kilo' && (m === 'stealth/glyph-cluster' || m === 'openrouter/free' || m === 'kilo-auto/free' || m === 'reflection/beam-free'))
    ) {
      return 'free';
    }
    return 'paid';
  }

  // Gemini: Free tier covers Flash, Lite, Gemma, TTS, Image-Flash/Imagen-fast; Pro & Ultra are Paid/Pro
  if (provider === 'gemini') {
    if (m.endsWith(':free')) return 'free';
    if (
      m.includes('pro') ||
      m.includes('ultra') ||
      m.includes('imagen-4') ||
      m.includes('imagen-3.0-capability')
    ) {
      return 'paid';
    }
    return 'free';
  }

  // Mistral: open-weight / small / ministral vs commercial large / medium / codestral / pixtral
  if (provider === 'mistral') {
    if (
      m.includes(':free') ||
      m.startsWith('open-') ||
      m.includes('small') ||
      m.includes('ministral') ||
      m.includes('embed')
    ) {
      return 'free';
    }
    return 'paid';
  }

  if (m.endsWith(':free') || m.includes('free')) return 'free';
  if (m.includes('pro') || m.includes('ultra') || m.includes('gpt-4') || m.includes('claude') || m.includes('large')) {
    return 'paid';
  }

  return 'free';
}

export const getDynamicImageModelsList = (provider: AIProviderKey): string[] => {
  if (provider === 'gemini') {
    const defaultModels = [
      'imagen-3.0-generate-002',
      'imagen-3.0-fast-generate-001',
      'gemini-3.1-flash-image',
      'gemini-2.5-flash-image',
      'gemini-3-pro-image'
    ];
    let models = [...defaultModels];
    const cached = safeLocalStorageGet(`dynamic_models_${provider}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          models = Array.from(new Set([...defaultModels, ...parsed.filter(m => m.includes('image') || m.includes('generate') || m.includes('imagen'))]));
        }
      } catch (e) {
        // ignore
      }
    }
    return models;
  }
  if (provider === 'pollinations') {
    return ['flux', 'flux-realism', 'flux-anime', 'flux-3d', 'turbo', 'sana'];
  }
  if (provider === 'routeway') {
    return ['step-3.5-flash:free'];
  }
  // Fallback for other providers like openrouter
  return getDynamicModelsList(provider);
};

// Helper to build absolute API URLs
const getApiUrl = (path: string) => {
  const base = window.location.origin;
  // Ensure path starts with / and remove leading / from path if present
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
};

export const fetchAndUpdateModels = async (provider: AIProviderKey, apiKey?: string): Promise<string[]> => {
  const fallbackModels = ((AI_PROVIDERS[provider] as any)?.models || [(AI_PROVIDERS[provider] as any)?.defaultModel || 'gemini-3.8-flash']).filter(Boolean) as string[];
  const url = getApiUrl(`/api/models/${provider}?t=${Date.now()}`);

  const attemptFetch = async (): Promise<string[] | null> => {
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey || "" }),
      signal: AbortSignal.timeout(25000)
    };
    logNetworkRequest(url, options, 'AIModels');
    const response = await fetch(url, options);
    logNetworkResponse(url, response, 'AIModels');

    if (response.ok) {
      const data = await response.json().catch(() => null);
      if (data && Array.isArray(data.models) && data.models.length > 0) {
        const merged = Array.from(new Set([...data.models, ...fallbackModels])).filter(Boolean) as string[];
        // Always update in-memory cache first so QuotaExceededError in localStorage never drops models
        dynamicModelsMemoryCache[provider] = merged;
        if (Array.isArray(data.freeModels)) {
          dynamicFreeModelsCache[provider] = new Set<string>(data.freeModels);
          safeLocalStorageSet(`dynamic_free_models_${provider}`, JSON.stringify(data.freeModels));
        }
        safeLocalStorageSet(`dynamic_models_${provider}`, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('models_updated', { detail: { provider, models: merged } }));
        return merged;
      }
    }
    return null;
  };

  try {
    const first = await attemptFetch();
    if (first) return first;
  } catch (error) {
    console.warn(`Attempt 1 failed to fetch dynamic models for ${provider}, retrying once:`, error);
  }

  // Retry once automatically in case of transient timeout/network hiccup
  try {
    const retry = await attemptFetch();
    if (retry) return retry;
  } catch (error) {
    console.warn(`Could not fetch dynamic models for ${provider}, using existing cache/fallbacks:`, error);
  }

  return getDynamicModelsList(provider);
};

let lastFetchTime = 0;
let cachedResults: Record<string, string[]> | null = null;
let modelUpdaterIntervalId: ReturnType<typeof setInterval> | null = null;

export const initModelUpdater = () => {
  // 1. Immediately fetch and update all models upon opening the app
  fetchAllProvidersModels(true).catch(e => console.warn("Initial models update warning:", e));

  // 2. Automatically update models every 30 minutes in background (singleton guard)
  if (!modelUpdaterIntervalId) {
    modelUpdaterIntervalId = setInterval(async () => {
      try {
        console.log("Automatically updating AI models...");
        await fetchAllProvidersModels(true);
        console.log("AI models updated successfully.");
      } catch (e) {
        console.warn("Failed to automatically update AI models:", e);
      }
    }, 30 * 60 * 1000);
  }
};

export const fetchAllProvidersModels = async (force: boolean = false): Promise<Record<string, string[]>> => {
  const now = Date.now();
  if (!force && cachedResults && (now - lastFetchTime < 3 * 60 * 1000)) {
    return cachedResults;
  }

  const providers = Object.keys(AI_PROVIDERS) as AIProviderKey[];
  const results: Record<string, string[]> = {};
  
  // Parallel fetch for instant loading upon opening the app
  await Promise.allSettled(providers.map(async (provider) => {
    try {
      const keyName = (AI_PROVIDERS[provider] as any).keyName;
      const key = keyName ? (safeLocalStorageGet(keyName) || '') : '';
      const models = await fetchAndUpdateModels(provider, key);
      results[provider] = models;
    } catch (e) {
      console.warn(`Failed to fetch models for ${provider}:`, e);
      results[provider] = getDynamicModelsList(provider);
    }
  }));

  lastFetchTime = Date.now();
  cachedResults = results;
  window.dispatchEvent(new CustomEvent('models_updated', { detail: { results } }));
  return results;
};

export interface ImageGenerationConfig {
  width?: number;
  height?: number;
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  seed?: number;
  model?: string;
}

export const generateImage = async (prompt: string, preferredProvider: AIProviderKey, config?: ImageGenerationConfig): Promise<string> => {
  // 1. Refine the prompt using Gemini
  const refinementMessages: AIMessage[] = [{
    role: 'user',
    content: `Rewrite the following user prompt for high-quality, aesthetic, and safe image generation. 
    Follow these strict constraints:
    - No humans or faces.
    - No text, signatures, or watermarks.
    - Clean composition, safe representation.
    - Add descriptive visual details to create a masterpiece.
    
    User prompt: "${prompt}"
    
    Return ONLY the final, polished image prompt. Nothing else.`
  }];

  let processedPrompt = prompt;
  try {
    const refinementResult = await callAI('gemini', refinementMessages, 'gemini-3.7-flash', {
        systemInstruction: "You are an expert prompt engineer for image generation."
    });
    processedPrompt = refinementResult.content.trim();
  } catch (e) {
    console.warn("Failed to refine prompt with Gemini, using original:", e);
    processedPrompt = prompt;
  }
  
  // Add premium quality enhancement tokens if prompt doesn't already contain them
  const qualityTokens = ", detailed masterpiece, stunning aesthetic, high resolution, 8k, photorealistic";
  if (!processedPrompt.toLowerCase().includes("masterpiece") && !processedPrompt.toLowerCase().includes("detailed")) {
    processedPrompt = `${processedPrompt}${qualityTokens}`;
  }
  
  // Automatically truncate the visual prompt to 500 characters max
  if (processedPrompt.length > 500) {
    processedPrompt = processedPrompt.substring(0, 500);
  }

  const imageCapableProviders: AIProviderKey[] = ['pollinations', 'gemini', 'routeway', 'stability'];
  
  // Default image provider is ALWAYS 'pollinations' unless user explicitly selected another capable provider
  const actualPreferred = imageCapableProviders.includes(preferredProvider) 
    ? preferredProvider 
    : 'pollinations';

  const resolveModelForProvider = (targetProvider: AIProviderKey, requested?: string) => {
    const providerModels = getDynamicImageModelsList(targetProvider);
    if (requested && providerModels.includes(requested)) {
      return requested;
    }
    return providerModels[0] || (AI_PROVIDERS[targetProvider] as any).defaultModel;
  };

  // Prioritize preferred provider first, then ALWAYS fall back to 'pollinations' first on failure, then remaining providers
  const providersToTry = Array.from(
    new Set<AIProviderKey>([actualPreferred, 'pollinations', ...imageCapableProviders])
  );
  
  let lastError = null;
  for (const provider of providersToTry) {
    const providerModel = resolveModelForProvider(
      provider,
      provider === actualPreferred ? config?.model : undefined
    );
    let attempt = 0;
    const MAX_IMAGE_RETRIES = 2;
    
    while (attempt <= MAX_IMAGE_RETRIES) {
      try {
        console.log(`Attempting image generation on ${provider} with model ${providerModel} (Attempt ${attempt + 1})`);
        return await generateImageWithProvider(processedPrompt, provider, { ...config, model: providerModel });
      } catch (error: any) {
        lastError = error;
        const errorMessage = error.message || "";
        
        // Check for rate limiting
        if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
          attempt++;
          if (attempt <= MAX_IMAGE_RETRIES) {
            const delay = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
            console.warn(`Rate limited on ${provider} for image gen. Retrying in ${delay.toFixed(0)}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        console.warn(`Image generation failed for ${provider} with model ${providerModel}:`, error);
        break; // Move to next provider
      }
    }
  }
  
  throw lastError || new Error("Image generation failed for all providers.");
};

const generateImageWithProvider = async (prompt: string, provider: AIProviderKey, config?: ImageGenerationConfig): Promise<string> => {
  console.log(`Generating image with provider: ${provider}, model: ${config?.model}`);
  const providerConfig = AI_PROVIDERS[provider] as any;
  const model = config?.model || providerConfig.defaultModel;
  
  // Get API key from local storage, or fall back to injected environment variable if available
  const getClientSideKey = () => {
    const localKey = safeLocalStorageGet(providerConfig.keyName);
    if (localKey && localKey.trim().length > 5 && !localKey.startsWith('MY_') && !localKey.startsWith('YOUR_')) {
      return localKey.trim();
    }
    return undefined;
  };

  const apiKey = getClientSideKey();

  if (provider === 'gemini') {
    console.log("Entering Gemini block, model:", model);
    const response = await fetch(getApiUrl(`/api/gemini/image?t=${Date.now()}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, model, prompt, config })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || response.statusText || "Gemini image generation failed.");
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('image/')) {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }

    const text = await response.text();
    const data = parseAIJson<any>(text, null);
    if (!data) {
      // If we got a 200 OK but invalid JSON, it's weird. If we got an error, the text IS the error.
      if (!response.ok) {
        throw new Error(`Gemini image generation failed (${response.status}): ${text.substring(0, 200)}`);
      }
      throw new Error(`Invalid JSON in Gemini image (${response.status}): ${text.substring(0, 100)}`);
    }
    
    if (data.error) {
       throw new Error(data.error.message || data.error || "Unknown Gemini image error");
    }
    
    if (data.data) {
      return data.data;
    }
    throw new Error("لم يتم استلام بيانات الصورة من Gemini.");
  }

  if (provider === 'pollinations') {
    const seed = config?.seed || Math.floor(Math.random() * 1000000);
    const width = config?.width || 1024;
    const height = config?.height || 1024;
    const encodedPrompt = encodeURIComponent(prompt);
    const cleanModel = model.split(':')[0];
    // If the prompt is already highly detailed/optimized (e.g. from smart mode or is quite long),
    // we set enhance=false to prevent pollinations from scrambling it or adding weird text.
    const shouldEnhance = prompt.length < 60;
    const url = `${providerConfig.baseURL}/${encodedPrompt}?width=${width}&height=${height}&model=${cleanModel}&seed=${seed}&nologo=true&enhance=${shouldEnhance}`;
    
    return url;
  }

  if (provider === 'routeway') {
    const response = await fetch(getApiUrl(`/api/proxy/routeway?t=${Date.now()}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseURL: 'https://api.routeway.ai',
        endpoint: '/v1/images/generations',
        apiKey: apiKey,
        model: model,
        prompt: prompt,
        size: `${config?.width || 1024}x${config?.height || 1024}`,
        n: 1,
        response_format: 'b64_json'
      })
    });

    const text = await response.text();
    const data = parseAIJson<any>(text, null);
    if (!data) {
      if (!response.ok) {
        throw new Error(`Routeway Error (${response.status}): ${text.substring(0, 200)}`);
      }
      throw new Error(`Routeway Error: Invalid JSON response (${response.status}): ${text.substring(0, 100)}`);
    }

    if (!response.ok) {
      const errorMessage = data?.error?.message || data?.message || data?.error || response.statusText || "Unknown Error";
      throw new Error(`Routeway Error: ${errorMessage}`);
    }

    if (data.data?.[0]?.b64_json) {
      return `data:image/png;base64,${data.data[0].b64_json}`;
    }
    if (data.data?.[0]?.url) {
      return data.data[0].url;
    }
    throw new Error("No image data received from Routeway.");
  }

  if (provider === 'stability') {
    const response = await fetch(getApiUrl(`/api/proxy/stability?t=${Date.now()}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseURL: providerConfig.baseURL,
        endpoint: `/v2beta/stable-image/generate/sd3`,
        apiKey: apiKey,
        model: model,
        prompt: prompt,
        aspect_ratio: config?.aspectRatio || '1:1',
        output_format: 'jpeg'
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Stability AI Error (${response.status}): ${errorText}`);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  throw new Error(`Provider ${provider} does not support image generation yet.`);
};

export const generateSmartPrompt = async (userInput: string, provider: AIProviderKey, model: string): Promise<string> => {
  const systemPrompt = `You are an expert Image Prompt Engineer for models like Midjourney, Flux, and DALL-E.
Your task is to transform a simple user description into a precise, concise, and professional English prompt.
Focus on lighting, composition, and key artistic details without hyperbole, over-exaggeration, or unnecessary complexity.
The prompt must be highly accurate, straightforward, and easy for image generation models to execute.
IMPORTANT:
- Keep the prompt concise, under 50 words to prevent errors or execution failures.
- Output ONLY the English prompt.
- DO NOT include any Arabic text.
- DO NOT include any conversational filler or introductions.
- If the input is in Arabic, translate the core concept to English precisely.
- Ensure the output is a single paragraph of descriptive, precise, and non-exaggerated English text.`;

  // We prioritize fast, high-quota models with a robust fallback chain
  const promptModels = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3-flash-preview', 'gemini-3.5-flash-lite'];
  let lastError = null;

  for (const promptModel of promptModels) {
    try {
      console.log(`[SmartPrompt] Attempting to generate visual description with model: ${promptModel}`);
      const response = await callAIWithFailover('gemini', [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput }
      ], promptModel);

      let result = response.content.trim();
      // Basic cleanup to remove common AI filler if it persists
      result = result.replace(/^(Here is your prompt:|Prompt:|الوصف:)\s*/i, '');
      return result;
    } catch (err) {
      console.log(`[SmartPrompt] Model ${promptModel} failed, trying next fallback...`, err);
      lastError = err;
    }
  }

  // Fallback to original provider & model as a last resort
  try {
    const response = await callAIWithFailover(provider, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userInput }
    ], model);
    let result = response.content.trim();
    result = result.replace(/^(Here is your prompt:|Prompt:|الوصف:)\s*/i, '');
    return result;
  } catch (err) {
    throw lastError || err;
  }
};

export const generateShortArabicSummary = async (userInput: string, provider: AIProviderKey, model: string): Promise<string> => {
  const systemPrompt = `أنت خبير في تلخيص الأوصاف البصرية.
مهمتك هي تحويل وصف المستخدم إلى جملة قصيرة ومركزة باللغة العربية الفصحى تصف الصورة.
يجب ألا تتجاوز الجملة 7 كلمات.
أعد الجملة فقط، بدون أي مقدمات أو تعليقات.`;

  const promptModels = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3-flash-preview', 'gemini-3.5-flash-lite'];
  let lastError = null;

  for (const promptModel of promptModels) {
    try {
      console.log(`[ArabicSummary] Attempting to generate with model: ${promptModel}`);
      const response = await callAIWithFailover('gemini', [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput }
      ], promptModel);
      return response.content.trim().split(/\s+/).slice(0, 7).join(' ');
    } catch (err) {
      console.log(`[ArabicSummary] Model ${promptModel} failed, trying next fallback...`, err);
      lastError = err;
    }
  }

  // Fallback to original provider & model
  try {
    const response = await callAIWithFailover(provider, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userInput }
    ], model);
    return response.content.trim().split(/\s+/).slice(0, 7).join(' ');
  } catch (err) {
    throw lastError || err;
  }
};

export const generateDua = async (provider: AIProviderKey): Promise<{ title: string; arabic: string; translation: string; source: string }> => {
  const systemPrompt = `أنت خبير في الأدعية المأثورة والشرعية.
مهمتك هي توليد دعاء يومي جديد، أصيل، يوافق القرآن والسنة، ويلتزم بالشرع.
يجب أن يكون الدعاء:
1. عنواناً معبراً (title).
2. نصاً عربياً فصيحاً (arabic).
3. ترجمة إنجليزية دقيقة (translation).
4. مصدراً شرعياً عاماً أو سياقاً (source).
يجب ألا تكرر أدعية سابقة.
أعد النتيجة بصيغة JSON فقط:
{
  "title": "...",
  "arabic": "...",
  "translation": "...",
  "source": "..."
}`;

  const response = await callAIWithFailover(provider, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: "أريد دعاء اليوم الجديد." }
  ]);

  try {
    const responseText = response.content.trim();
    return parseAIJson<{ title: string; arabic: string; translation: string; source: string }>(responseText, {
      title: "دعاء اليوم",
      arabic: "اللهم اجعل هذا اليوم يوماً مباركاً مليئاً بالخير والبركة.",
      translation: "O Allah, make this day a blessed day full of goodness and blessings.",
      source: "دعاء عام"
    });
  } catch (e) {
    console.error("Failed to parse generated dua:", e);
    return {
      title: "دعاء اليوم",
      arabic: "اللهم اجعل هذا اليوم يوماً مباركاً مليئاً بالخير والبركة.",
      translation: "O Allah, make this day a blessed day full of goodness and blessings.",
      source: "دعاء عام"
    };
  }
};

export type AIMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  imageUrl?: string;
  imageModel?: string;
  groundingMetadata?: any;
  thought?: string;
};

export interface AIResponse {
  content: string;
  model: string;
  groundingMetadata?: any;
  thought?: string;
}

export type ReasoningEffort = 'off' | 'low' | 'medium' | 'high' | 'max';
export type ResponseDepth = 'concise' | 'balanced' | 'deep' | 'encyclopedic';
export type AIPresetKey = 'precision' | 'balanced' | 'creative' | 'research' | 'custom';

export interface AIAdvancedConfig {
  preset: AIPresetKey;
  maxTokens: number; // 0 = Auto-Max (أقصى حد متاح للنموذج تلقائياً حتى 128K رمز)
  temperature: number; // 0.0 - 1.5
  topP: number; // 0.1 - 1.0
  topK: number; // 1 - 100
  frequencyPenalty: number; // 0.0 - 1.5
  presencePenalty: number; // 0.0 - 1.5
  reasoningEffort: ReasoningEffort;
  responseDepth: ResponseDepth;
  contextWindow: number; // 10, 20, 40, 80, 0 (All history)
  enableWebSearch: boolean;
  autoOpenThoughts: boolean;
  customInstructions: string;
}

export const DEFAULT_AI_ADVANCED_CONFIG: AIAdvancedConfig = {
  preset: 'research',
  maxTokens: 0, // Auto-Max (أقصى حد ممكن للنموذج تلقائياً)
  temperature: 0.65,
  topP: 0.95,
  topK: 40,
  frequencyPenalty: 0.2,
  presencePenalty: 0.15,
  reasoningEffort: 'high',
  responseDepth: 'deep',
  contextWindow: 40,
  enableWebSearch: false,
  autoOpenThoughts: false,
  customInstructions: ''
};

export const AI_PRESETS: Record<Exclude<AIPresetKey, 'custom'>, {
  label: string;
  description: string;
  values: Partial<AIAdvancedConfig>;
}> = {
  precision: {
    label: 'دقيق ومنهجي',
    description: 'دقة شرعية وعلمية عالية بأقل عشوائية',
    values: {
      temperature: 0.2,
      topP: 0.85,
      topK: 20,
      frequencyPenalty: 0.15,
      presencePenalty: 0.05,
      reasoningEffort: 'high',
      responseDepth: 'deep',
      maxTokens: 0
    }
  },
  balanced: {
    label: 'متوازن قياسي',
    description: 'توازن مثالي بين السرعة والفصاحة والعمق',
    values: {
      temperature: 0.65,
      topP: 0.95,
      topK: 40,
      frequencyPenalty: 0.2,
      presencePenalty: 0.15,
      reasoningEffort: 'medium',
      responseDepth: 'balanced',
      maxTokens: 0
    }
  },
  creative: {
    label: 'بلاغي وإبداعي',
    description: 'أسلوب أدبي وتأملي غني بالتراكيب والمعاني',
    values: {
      temperature: 0.95,
      topP: 0.98,
      topK: 60,
      frequencyPenalty: 0.3,
      presencePenalty: 0.3,
      reasoningEffort: 'medium',
      responseDepth: 'deep',
      maxTokens: 0
    }
  },
  research: {
    label: 'بحث موسوعي أقصى',
    description: 'أقصى طول استجابة وأعمق استدلال ممكن',
    values: {
      temperature: 0.5,
      topP: 0.92,
      topK: 40,
      frequencyPenalty: 0.15,
      presencePenalty: 0.2,
      reasoningEffort: 'max',
      responseDepth: 'encyclopedic',
      contextWindow: 80,
      maxTokens: 0
    }
  }
};

export function loadAIAdvancedConfig(storageKey: string, legacyPrefix?: string): AIAdvancedConfig {
  try {
    const raw = safeLocalStorageGet(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_AI_ADVANCED_CONFIG, ...parsed };
    }
    if (legacyPrefix) {
      const temp = Number(safeLocalStorageGet(`${legacyPrefix}_temperature`));
      const custom = safeLocalStorageGet(`${legacyPrefix}_custom_instructions`) || '';
      const webSearch = safeLocalStorageGet(`${legacyPrefix}_web_search`) === 'true';
      const deep = safeLocalStorageGet(`${legacyPrefix}_deep_thinking`);
      return {
        ...DEFAULT_AI_ADVANCED_CONFIG,
        temperature: !Number.isNaN(temp) && temp > 0 ? temp : DEFAULT_AI_ADVANCED_CONFIG.temperature,
        customInstructions: custom,
        enableWebSearch: webSearch,
        reasoningEffort: deep === 'false' ? 'off' : DEFAULT_AI_ADVANCED_CONFIG.reasoningEffort
      };
    }
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULT_AI_ADVANCED_CONFIG };
}

export function saveAIAdvancedConfig(storageKey: string, config: AIAdvancedConfig, legacyPrefix?: string): void {
  safeLocalStorageSet(storageKey, JSON.stringify(config));
  if (legacyPrefix) {
    safeLocalStorageSet(`${legacyPrefix}_temperature`, config.temperature.toString());
    safeLocalStorageSet(`${legacyPrefix}_max_tokens`, config.maxTokens.toString());
    safeLocalStorageSet(`${legacyPrefix}_custom_instructions`, config.customInstructions);
    safeLocalStorageSet(`${legacyPrefix}_web_search`, config.enableWebSearch ? 'true' : 'false');
    safeLocalStorageSet(`${legacyPrefix}_deep_thinking`, config.reasoningEffort !== 'off' ? 'true' : 'false');
  }
}

export function getResponseDepthDirective(depth: ResponseDepth): string {
  switch (depth) {
    case 'concise':
      return 'أسلوب الإجابة المطلوب: موجز ومركز؛ قدّم الخلاصة الدقيقة مباشرة دون إطالة زائدة.';
    case 'balanced':
      return 'أسلوب الإجابة المطلوب: متوازن ومنهجي؛ اجمع بين وضوح الفكرة وذكر الشواهد الأساسية.';
    case 'deep':
      return 'أسلوب الإجابة المطلوب: تحليل معمّق ومفصل؛ اشرح الجوانب اللغوية والعلمية والروحية بتفصيل وافٍ ولا تختصر الإجابة مبكراً.';
    case 'encyclopedic':
      return 'أسلوب الإجابة المطلوب: بحث موسوعي استقصائي شامل ومطوّل؛ استثمر كامل مساحة الاستجابة المتاحة في التفصيل والتأصيل والتحليل المتعدد المحاور حتى تستوفي الموضوع بالكامل دون بتر أو اختصار.';
  }
}

export type AIConfig = {
  responseMimeType?: string;
  systemInstruction?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxOutputTokens?: number;
  enableWebSearch?: boolean;
  enableDeepThinking?: boolean;
  reasoningEffort?: ReasoningEffort;
  responseDepth?: ResponseDepth;
  allowProviderFallback?: boolean;
  signal?: AbortSignal;
};

/**
 * Detects degenerate repetition loops in LLM generation and returns trimmed clean text.
 * Requires 4+ consecutive/adjacent repeats of a 28+ char phrase at the tail so legitimate prose is never clipped.
 */
export function detectAndCleanRepetitionLoop(text: string): { isLoop: boolean; cleanText: string } {
  if (!text || text.length < 160) return { isLoop: false, cleanText: text };

  const windowSize = Math.min(text.length, 1000);
  const tail = text.slice(-windowSize);
  const maxCandLen = Math.min(220, Math.floor(tail.length / 4));

  for (let len = 28; len <= maxCandLen; len++) {
    const candidate = tail.slice(-len).trim();
    if (candidate.length < 28) continue;

    let count = 1;
    let earliestTailPos = tail.lastIndexOf(candidate);
    if (earliestTailPos <= 0) continue;

    while (count < 8) {
      if (earliestTailPos <= 0) break;
      const prevPos = tail.lastIndexOf(candidate, earliestTailPos - 1);
      if (prevPos === -1 || prevPos >= earliestTailPos || prevPos + candidate.length > earliestTailPos) break;
      const gap = tail.slice(prevPos + candidate.length, earliestTailPos);
      if (gap.length > 8) break;
      count++;
      earliestTailPos = prevPos;
    }

    if (count >= 4) {
      const absKeepEnd = text.length - windowSize + earliestTailPos + candidate.length;
      const cleanText = text.slice(0, absKeepEnd).trim();
      return { isLoop: true, cleanText };
    }
  }

  return { isLoop: false, cleanText: text };
}

export const getSystemInstruction = (): string => {
  const now = new Date();
  let dateStr = "";
  try {
    dateStr = now.toLocaleDateString('ar-EG', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      timeZoneName: 'short'
    });
  } catch (e) {
    dateStr = now.toString();
  }

  return `
تعليمات هامة للنموذج:
1. المرجعية القرآنية والسنة: يجب أن تكون جميع إجاباتك مستندة إلى فهم صحيح للقرآن والسنة.
2. عملية التصحيح الذاتي: قبل تقديم إجابتك النهائية، تأكد أن إجابتك مطابقة للقرآن والسنة، مختصرة وبليغة وغير مكررة، وتلبي طلب المستخدم بدقة.
3. قاعدة المواصلة: إذا طلب المستخدم "المواصلة" أو "المتابعة"، استأنف الحديث من حيث انتهيت في إجابتك السابقة وانتقل لنقاط جديدة مباشرة. يُمنع صياغة نفس الأفكار السابقة بأسلوب مختلف.
4. تجنب التكرار: لا تكرر الآيات أو المعلومات التي سبق ذكرها في المحادثة أو ضمن نفس الإجابة.
5. العمق والتدبر: قدم شروحات معمقة وبليغة ومفصلة وشاملة بأسلوب عربي فصيح رصين، وتجاوز الإجابات السطحية.
6. الحفاظ على السياق: حافظ دائماً على سياق المحادثة كاملاً، وابنِ على النقاط السابقة.
7. الدقة والضبط: قدم أوصافاً ومعلومات دقيقة ومضبوطة في جميع الأوقات.
8. الأسلوب الروحاني والعلمي: حافظ على أسلوب محترم وروحاني وعلمي يليق بتطبيق قرآني.
9. الزمن الفعلي للمستخدم: التاريخ والوقت الفعلي الحالي الآن هو: ${dateStr}. استخدم هذه المعلومة الزمنية إذا سألك المستخدم عن الوقت، التاريخ، اليوم، أو أحداث مرتبطة بالزمن الحالي لتجيب بدقة زمنية تامة وبطريقة طبيعية.
10. اللغة العربية الفصحى الخالصة: اكتب باللغة العربية الفصحى السليمة حصراً. يُمنع منعاً باتاً خلط أي كلمات أجنبية (إنجليزية، صينية، أو غيرها) داخل النص العربي ما لم يُطلب ذلك صراحة.
11. منع التكرار اللانهائي والهلوسة: يُمنع منعاً باتاً تكرار نفس الآية الكريمة أو العبارة مراراً وتكراراً. اذكر الشاهد القرآني مرة واحدة فقط بدقة وإتقان، ثم أتمم فكرتك وتوقف فور اكتمال المعنى دون استرسال تكراري فارغ.
`;
};


export const enhanceMessages = (messages: AIMessage[]): AIMessage[] => {
  const instruction = getSystemInstruction().trim();
  const enhanced = messages.map(m => {
    if (m.role === 'system') {
      const contentStr = typeof m.content === 'string' ? m.content : '';
      if (contentStr.includes("تعليمات هامة للنموذج")) {
        return m;
      }
      return { ...m, content: `${instruction}\n\n${m.content}` };
    }
    return m;
  });
  if (!enhanced.some(m => m.role === 'system' && m.content.includes("تعليمات هامة للنموذج"))) {
    enhanced.unshift({ role: 'system', content: instruction });
  }
  return enhanced;
};

const getApiKey = (provider: AIProviderKey): string => {
  const providerConfig = AI_PROVIDERS[provider] as any;
  const localKey = safeLocalStorageGet(providerConfig.keyName) || "";
  
  if (localKey && !['undefined', 'null', 'MY_GEMINI_API_KEY'].includes(localKey) && !localKey.startsWith('YOUR_')) {
    return localKey.trim();
  }
  return "";
};

export const callAIWithFailover = async (preferredProvider: AIProviderKey, messages: AIMessage[], customModel?: string, config?: AIConfig): Promise<AIResponse> => {
  // Safety check for provider
  if (!preferredProvider || !AI_PROVIDERS[preferredProvider]) {
    console.warn(`Provider ${preferredProvider} not found or not specified, falling back to gemini`);
    preferredProvider = 'gemini';
  }

  const enhancedMessages = enhanceMessages(messages);

  const providers: AIProviderKey[] = [preferredProvider];
  
  // ALWAYS enable fallback to other healthy providers if preferred hits rate limit or errors
  const fallbackList: AIProviderKey[] = ['gemini', 'kilo', 'routeway', 'openrouter', 'groq', 'mistral', 'huggingface'];
  for (const p of fallbackList) {
    if (!providers.includes(p)) {
      providers.push(p);
    }
  }
  
  let lastError = null;

  for (const provider of providers) {
    const providerConfig = AI_PROVIDERS[provider];
    if (!providerConfig) continue;
    
    try {
      console.log(`Trying AI provider: ${providerConfig.name}`);
      const modelToUse = provider === preferredProvider ? customModel : undefined;
      const result = await callAI(provider, enhancedMessages, modelToUse, config);
      return result;
    } catch (error: any) {
      lastError = error;
      const errorMessage = (error?.message || error || "").toString();
      console.warn(`Provider ${providerConfig.name} failed (${errorMessage}), failover to next provider...`);
    }
  }
  
  throw lastError || new Error("جميع النماذج والمزودات المتاحة مشغولة حالياً، يرجى المحاولة بعد قليل.");
};

export const callAI = async (provider: AIProviderKey, messages: AIMessage[], customModel?: string, config?: AIConfig): Promise<AIResponse> => {
  const enhancedMessages = enhanceMessages(messages);
  const providerConfig = AI_PROVIDERS[provider] as any;
  const apiKey = getApiKey(provider);
  
  // If apiKey is empty, we proceed anyway because the server might have it in environment variables
  // The server proxy will handle the 401 if it's missing there too

  // Disable Automatic Model Rotation to strictly adhere to the requested model
  const requestedModel = customModel || providerConfig.defaultModel;
  const modelsToTry = [requestedModel]; // Only try the requested model
  let lastModelError = null;


  for (const model of modelsToTry) {
    try {
      if (provider === 'gemini') {
        const response = await fetch(getApiUrl(`/api/gemini/generate?t=${Date.now()}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, model, messages: enhancedMessages, config }),
          signal: config?.signal
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || response.statusText || "Gemini text generation failed.");
        }
        const text = await response.text();
        const data = parseAIJson<any>(text, null);
        if (!data) {
          throw new Error(`Invalid JSON in Gemini text (${response.status}): ${text.substring(0, 100)}`);
        }
        if (!data.content && data.error) {
          throw new Error(data.error);
        }
        return { content: data.content || "", model: data.model || model, groundingMetadata: data.groundingMetadata, thought: data.thought };
      }

      // For OpenAI-compatible providers, combine system messages into one
      const systemMessages = enhancedMessages.filter(m => m.role === 'system');
      const otherMessages = enhancedMessages.filter(m => m.role !== 'system');
      
      if (otherMessages.length === 0) {
        otherMessages.push({ role: 'user', content: 'مرحباً' });
      }
      
      const finalMessages = [];
      const combinedSystemContent = systemMessages.map(m => m.content).join('\n\n');

      if (provider === 'routeway') {
        // Routeway might not support system messages, prepend to first user message
        if (otherMessages.length > 0 && combinedSystemContent) {
          finalMessages.push({
            role: otherMessages[0].role,
            content: `${combinedSystemContent}\n\n${otherMessages[0].content}`
          });
          finalMessages.push(...otherMessages.slice(1).map(m => ({
            role: m.role,
            content: m.content
          })));
        } else {
          finalMessages.push(...otherMessages.map(m => ({
            role: m.role,
            content: m.content
          })));
        }
      } else {
        if (combinedSystemContent) {
          finalMessages.push({
            role: 'system',
            content: combinedSystemContent
          });
        }
        finalMessages.push(...otherMessages.map(m => ({
          role: m.role,
          content: m.content
        })));
      }

      // Use proxy for all non-Gemini providers to avoid CORS and keep keys secure
      const resolvedReasoning = config?.reasoningEffort || (config?.enableDeepThinking ? 'high' : 'off');
      const requestBody: Record<string, any> = {
        baseURL: providerConfig.baseURL,
        apiKey: apiKey, // Pass the key (from localStorage or empty if using server-side env)
        model: model,
        messages: finalMessages,
        response_format: config?.responseMimeType === 'application/json' ? { type: 'json_object' } : undefined,
        temperature: config?.temperature !== undefined ? Math.min(Math.max(config.temperature, 0), 2) : 0.65,
        top_p: config?.topP !== undefined ? Math.min(Math.max(config.topP, 0.05), 1) : 0.95,
        max_tokens: config?.maxOutputTokens !== undefined ? config.maxOutputTokens : 0,
        frequency_penalty: config?.frequencyPenalty !== undefined ? config.frequencyPenalty : 0.2,
        presence_penalty: config?.presencePenalty !== undefined ? config.presencePenalty : 0.15
      };
      if (resolvedReasoning !== 'off') {
        requestBody.reasoning_effort = resolvedReasoning === 'max' ? 'high' : resolvedReasoning;
      }

      const payloadSize = JSON.stringify(requestBody).length;
      if (payloadSize > 1 * 1024 * 1024) {
        console.log(`Sending large payload to proxy (${provider}): ${(payloadSize / 1024 / 1024).toFixed(2)} MB`);
      }

      const response = await fetch(getApiUrl(`/api/proxy/${provider}?t=${Date.now()}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: config?.signal
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        let message = errorText;
        try {
          const errorData = JSON.parse(errorText);
          message = errorData.error?.message || errorData.message || errorText;
        } catch (e) {
          // Not JSON
        }
        throw new Error(`خطأ من المزود ${providerConfig.name} (${response.status}): ${message}`);
      }

      const responseText = await response.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error(`استجابة غير صالحة من المزود ${providerConfig.name}: ${responseText.substring(0, 150)}`);
      }
      
      // Check for provider-specific error objects even on 200 OK
      if (data.error) {
        throw new Error(`خطأ من المزود ${providerConfig.name}: ${data.error.message || JSON.stringify(data.error)}`);
      }

      if (!data.choices || data.choices.length === 0) {
        console.error(`Empty choices from ${providerConfig.name}:`, data);
        throw new Error(`استجابة غير متوقعة من المزود ${providerConfig.name}: لم يتم العثور على خيارات (choices).`);
      }
      
      let content = data.choices[0].message?.content;
      if (content === undefined || content === null) {
        throw new Error(`استجابة غير متوقعة من المزود ${providerConfig.name}: محتوى الرسالة فارغ.`);
      }

      const loopCheck = detectAndCleanRepetitionLoop(content);
      if (loopCheck.isLoop) {
        content = loopCheck.cleanText;
      }
      
      return { content, model: data.model || model };
    } catch (error) {
      console.warn(`Model ${model} on ${providerConfig.name} failed:`, error);
      lastModelError = error;
      
      // If it's an authentication error (401), skip retries and move to next provider immediately
      if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string' && (error as any).message.includes('401')) {
        console.warn(`Authentication error (401) on ${providerConfig.name}, skipping provider...`);
        throw error; // This will be caught by callAIWithFailover and move to next provider
      }

      // If it's a "Provider error" from Routeway, it's likely a provider-wide issue
      // skip other models and move to the next provider
      if (provider === 'routeway' && error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string' && (error as any).message.includes('Provider error')) {
        console.warn(`Routeway provider-wide error detected, skipping to next provider...`);
        throw error;
      }

      // If we have more models to try, continue the loop
      if (modelsToTry.length > 1) {
        console.log(`Retrying with next model for ${providerConfig.name}...`);
        continue;
      }
      throw error;
    }
  }
  throw lastModelError || new Error(`فشلت جميع النماذج المتاحة لدى ${providerConfig.name}`);
};

export const callAIStream = async (provider: AIProviderKey, messages: AIMessage[], customModel?: string, config?: AIConfig, onChunk?: (chunk: string, groundingMetadata?: any, thought?: string) => void): Promise<void> => {
  const enhancedMessages = enhanceMessages(messages);
  const providerConfig = AI_PROVIDERS[provider] as any;
  const model = customModel || providerConfig.defaultModel;
  const apiKey = getApiKey(provider);

  if (provider === 'gemini') {
    const response = await fetch(getApiUrl(`/api/gemini/stream?t=${Date.now()}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, model, messages: enhancedMessages, config }),
      signal: config?.signal
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || response.statusText || "Failed to connect to stream");
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No reader available");

    const decoder = new TextDecoder();
    let buffer = '';
    let accumulated = '';

    const processGeminiSseBlock = (sseMessage: string): boolean => {
      if (!sseMessage.startsWith('data: ')) return false;
      const dataStr = sseMessage.slice(6).trim();
      if (dataStr === '[DONE]') return true;
      let data;
      try { data = JSON.parse(dataStr); } catch { return false; }
      if (data.error) throw new Error(data.error);
      if (data.text) {
        accumulated += data.text;
        const loopCheck = detectAndCleanRepetitionLoop(accumulated);
        if (loopCheck.isLoop) {
          console.warn('[GeminiStreamLoopBreaker] Repetition loop detected, stopping stream');
          return true;
        }
      }
      if (onChunk) onChunk(data.text || "", data.groundingMetadata, data.thought);
      return false;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        if (buffer.trim()) {
          if (processGeminiSseBlock(buffer.trim())) return;
        }
        break;
      }
      
      buffer += decoder.decode(value, { stream: true });
      
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n\n')) >= 0) {
        const sseMessage = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 2);
        if (processGeminiSseBlock(sseMessage)) return;
      }
    }
  } else {
    // OpenAI-compatible streaming
    const systemMessages = enhancedMessages.filter(m => m.role === 'system');
    const otherMessages = enhancedMessages.filter(m => m.role !== 'system');
    const combinedSystemContent = systemMessages.map(m => m.content).join('\n\n');
    const finalMessages = combinedSystemContent 
      ? [{ role: 'system', content: combinedSystemContent }, ...otherMessages]
      : otherMessages;

    const resolvedReasoning = config?.reasoningEffort || (config?.enableDeepThinking ? 'high' : 'off');
    const requestBody: Record<string, any> = {
      baseURL: providerConfig.baseURL,
      apiKey: apiKey,
      model: model,
      messages: finalMessages,
      temperature: config?.temperature !== undefined ? Math.min(Math.max(config.temperature, 0), 2) : 0.65,
      top_p: config?.topP !== undefined ? Math.min(Math.max(config.topP, 0.05), 1) : 0.95,
      max_tokens: config?.maxOutputTokens !== undefined ? config.maxOutputTokens : 0,
      frequency_penalty: config?.frequencyPenalty !== undefined ? config.frequencyPenalty : 0.2,
      presence_penalty: config?.presencePenalty !== undefined ? config.presencePenalty : 0.15
    };
    if (resolvedReasoning !== 'off') {
      requestBody.reasoning_effort = resolvedReasoning === 'max' ? 'high' : resolvedReasoning;
    }

    const response = await fetch(getApiUrl(`/api/proxy/stream/${provider}?t=${Date.now()}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: config?.signal
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown error");
      let message = errText;
      try {
        const parsed = JSON.parse(errText);
        message = parsed?.error?.message || parsed?.message || errText;
      } catch {
        // keep errText
      }
      throw new Error(message);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No reader available");

    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedContent = '';

    const readWithTimeout = (r: ReadableStreamDefaultReader<Uint8Array>, timeoutMs: number): Promise<ReadableStreamReadResult<Uint8Array>> => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const timeoutPromise = new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Stream read timeout")), timeoutMs);
      });
      return Promise.race([r.read(), timeoutPromise]).finally(() => {
        if (timeoutId !== null) clearTimeout(timeoutId);
      });
    };

    const processOpenAILine = (line: string): 'done' | 'loop' | 'continue' => {
      if (!line.startsWith('data: ')) return 'continue';
      const dataStr = line.slice(6).trim();
      if (dataStr === '[DONE]') return 'done';
      try {
        const data = JSON.parse(dataStr);
        if (data.error) {
          const errMsg = typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
          throw new Error(errMsg);
        }
        const delta = data.choices?.[0]?.delta;
        const content = delta?.content;
        const reasoning = delta?.reasoning || delta?.reasoning_content;

        if (content) {
          accumulatedContent += content;
          const loopCheck = detectAndCleanRepetitionLoop(accumulatedContent);
          if (loopCheck.isLoop) {
            console.warn(`[ClientStreamLoopBreaker] Repetition loop caught on ${provider}, halting stream cleanly!`);
            return 'loop';
          }
        }

        if ((content || reasoning) && onChunk) {
          onChunk(content || "", undefined, reasoning);
        }
      } catch (e: any) {
        if (e.message && !e.message.includes('JSON')) {
          throw e;
        }
      }
      return 'continue';
    };

    while (true) {
      const { done, value } = await readWithTimeout(reader, 60000);
      if (done) {
        buffer += decoder.decode();
        if (buffer.trim()) {
          for (const remLine of buffer.split('\n')) {
            const status = processOpenAILine(remLine.trim());
            if (status === 'done' || status === 'loop') return;
          }
        }
        break;
      }
      
      buffer += decoder.decode(value, { stream: true });
      
      let newlineIndex;
      let shouldStop = false;

      while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        const status = processOpenAILine(line);
        if (status === 'done') return;
        if (status === 'loop') {
          shouldStop = true;
          break;
        }
      }

      if (shouldStop) {
        break;
      }
    }
  }
};

function splitTextIntoChunks(text: string, maxLength: number = 500): string[] {
  const chunks: string[] = [];
  let currentChunk = '';

  // Clean the text from markdown formatting that might confuse TTS
  const cleanText = text.replace(/[*_~`#]/g, '');
  
  // Split by sentences or newlines
  const sentences = cleanText.split(/(?<=[.?!؟\n])\s+/);

  for (const sentence of sentences) {
    if (!sentence.trim()) continue;
    
    if ((currentChunk + ' ' + sentence).length <= maxLength) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      
      // If a single sentence is longer than maxLength, split it by words
      if (sentence.length > maxLength) {
        const words = sentence.split(' ');
        let tempChunk = '';
        for (const word of words) {
          if ((tempChunk + ' ' + word).length <= maxLength) {
            tempChunk += (tempChunk ? ' ' : '') + word;
          } else {
            if (tempChunk) chunks.push(tempChunk);
            tempChunk = word;
          }
        }
        currentChunk = tempChunk;
      } else {
        currentChunk = sentence;
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  
  return chunks;
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x2000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    let s = '';
    for (let j = 0; j < sub.length; j++) {
      s += String.fromCharCode(sub[j]);
    }
    parts.push(s);
  }
  return btoa(parts.join(''));
}

export const generateRecitationStream = async function* (text: string, voiceName: string, apiKey?: string) {
  const finalKey = apiKey || safeLocalStorageGet(AI_PROVIDERS.gemini.keyName);

  const chunks = splitTextIntoChunks(text, 750);

  const voiceProfile = resolveGeminiVoice(voiceName);
  const actualVoiceName = voiceProfile.baseVoice;

  const selectedTtsModel = safeLocalStorageGet('ai_tts_model') || 'gemini-3.8-flash-lite-tts';
  const allGeminiModels = getDynamicModelsList('gemini');
  let ttsModels = allGeminiModels.filter(m => {
    const lower = m.toLowerCase();
    return (
      lower.includes('tts') &&
      !lower.includes(':batch') &&
      !lower.includes('image') &&
      !lower.includes('embedding') &&
      !lower.includes('search') &&
      !lower.includes('experimental') &&
      !lower.startsWith('gemini-1.5') &&
      !lower.startsWith('gemini-2.0')
    );
  });
  const preferredTtsOrder = [
    'gemini-3.8-flash-lite-tts',
    'gemini-3.8-flash-tts',
    'gemini-3.1-flash-tts-preview',
    'gemini-2.5-flash-preview-tts',
    'gemini-2.5-pro-preview-tts',
  ];
  ttsModels = Array.from(new Set([
    ...(selectedTtsModel.toLowerCase().includes('tts') ? [selectedTtsModel] : []),
    ...preferredTtsOrder,
    ...ttsModels
  ]));
  let currentModelIndex = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i].trim();
    if (!chunkText) continue;
    
    let retries = 8; // Increased retries to handle rate limits
    let success = false;
    let delay = 3000;

    while (retries > 0 && !success) {
      try {
        console.log(`Generating AI recitation for chunk ${i + 1}/${chunks.length} using ${ttsModels[currentModelIndex]} (${voiceProfile.id}): "${chunkText.substring(0, 30)}..."`);
        
        const response = await fetch(`${window.location.origin}/api/gemini/speech?t=${Date.now()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            apiKey: finalKey, 
            model: ttsModels[currentModelIndex], 
            text: chunkText, 
            voiceName: actualVoiceName,
            voiceStyle: voiceProfile.stylePrompt
          })
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const httpErr: any = new Error(err.error || response.statusText || `HTTP ${response.status}`);
          httpErr.status = err.status || response.status;
          httpErr.code = err.code || response.status;
          throw httpErr;
        }
        
        const data = await response.json();
        if (!data.audioData) {
          console.warn(`No audio data received for chunk ${i + 1}`);
          retries--;
          continue;
        }
        
        const audioData = data.audioData;
        const mimeType = data.mimeType || 'audio/wav';
        
        // Decode base64 to binary
        const binaryString = atob(audioData);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let j = 0; j < len; j++) {
          bytes[j] = binaryString.charCodeAt(j);
        }

        // Check if the audio data already has a complete WAV header (44+ bytes starting with 'RIFF')
        const hasWavHeader = len >= 44 && 
                             bytes[0] === 0x52 && // R
                             bytes[1] === 0x49 && // I
                             bytes[2] === 0x46 && // F
                             bytes[3] === 0x46;   // F

        let finalBase64 = audioData;
        let finalMimeType = mimeType;
        let finalBytes: Uint8Array = bytes;

        if (!hasWavHeader) {
          // Add WAV header to each chunk so it can be played independently
          const wavHeader = new ArrayBuffer(44);
          const view = new DataView(wavHeader);
          view.setUint32(0, 0x52494646, false); // RIFF
          view.setUint32(4, 36 + len, true); // file length
          view.setUint32(8, 0x57415645, false); // WAVE
          view.setUint32(12, 0x666d7420, false); // fmt 
          view.setUint32(16, 16, true); // format chunk length
          view.setUint16(20, 1, true); // sample format (raw)
          view.setUint16(22, 1, true); // channel count
          view.setUint32(24, 24000, true); // sample rate
          view.setUint32(28, 24000 * 2, true); // byte rate
          view.setUint16(32, 2, true); // block align
          view.setUint16(34, 16, true); // bits per sample
          view.setUint32(36, 0x64617461, false); // data
          view.setUint32(40, len, true); // data chunk length
          
          const combined = new Uint8Array(44 + len);
          combined.set(new Uint8Array(wavHeader), 0);
          combined.set(bytes, 44);
          
          finalBytes = combined;
          finalBase64 = uint8ToBase64(combined);
          finalMimeType = 'audio/wav';
        }

        yield {
          data: finalBase64, // Keep for backward compatibility if needed elsewhere
          audioBytes: finalBytes, // Direct binary data is much faster
          pcmBytes: bytes, // Raw bytes from the server without added header
          pcmData: audioData,
          mimeType: finalMimeType,
          chunkIndex: i,
          totalChunks: chunks.length
        };
        
        success = true;
        
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        let errorObj = error;
        try {
          if (typeof error === 'string') {
            errorObj = JSON.parse(error);
          } else if (error instanceof Error) {
            try {
              errorObj = JSON.parse(error.message);
            } catch (e) {}
          }
        } catch (e) {}
        
        errorObj = (errorObj as any).error || errorObj;
        
        const errorMessage = (errorObj as any).message || String(error);
        const lowerErr = (errorMessage || '').toLowerCase();
        const isQuotaExceeded = 
          (errorObj as any).status === 'RESOURCE_EXHAUSTED' || 
          (errorObj as any).code == 429 || 
          (errorObj as any).status == 429 ||
          ((errorObj as any).name === 'ApiError' && (errorObj as any).status == 429) ||
          lowerErr.includes('resource_exhausted') ||
          lowerErr.includes('429');
          
        const isHardQuotaLimit = isQuotaExceeded && errorMessage && typeof errorMessage === 'string' && errorMessage.includes('check your plan and billing details');
        const isInvalidModel = (
          ((errorObj as any).status === 'INVALID_ARGUMENT' || (errorObj as any).status == 400 || lowerErr.includes('invalid json') || lowerErr.includes('unknown name')) &&
          (lowerErr.includes('supports text output') || lowerErr.includes('response modalities: audio') || lowerErr.includes('speechconfig'))
        );
        
        // Smart fallback: If quota exceeded, permission denied, not found, or invalid model, switch immediately
        const isPermissionDenied = (errorObj as any).status === 'PERMISSION_DENIED' || (errorObj as any).status == 403;
        const isNotFound = (errorObj as any).status === 'NOT_FOUND' || (errorObj as any).status == 404;
        if (isQuotaExceeded || isHardQuotaLimit || isNotFound || isInvalidModel || isPermissionDenied) {
          if (currentModelIndex < ttsModels.length - 1) {
            console.warn(`Model ${ttsModels[currentModelIndex]} failed (${(errorObj as any).status || 'ERROR'}). Switching to next model...`);
            currentModelIndex++;
            retries = 8; // Reset retries for the new model
            continue;
          }
          console.warn(`All models failed or hard quota limit reached on chunk ${i + 1}.`);
          throw new Error("HARD_QUOTA_LIMIT");
        }

        console.error(`Gemini TTS Error on chunk ${i + 1}:`, error);
        
        retries--;
        if (isQuotaExceeded && retries > 0) {
          console.warn(`Quota exceeded, retrying chunk ${i + 1} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 1.5; // Exponential backoff
        } else if (retries > 0) {
          console.log(`Retrying chunk ${i + 1} in 2s...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.warn(`Giving up on chunk ${i + 1} after retries.`);
          throw new Error("CHUNK_FAILED");
        }
      }
    }
  }
};

export const generateRecitation = async (text: string, voiceName: string, apiKey?: string) => {
  const finalKey = apiKey || safeLocalStorageGet(AI_PROVIDERS.gemini.keyName);

  const voiceProfile = resolveGeminiVoice(voiceName);
  const actualVoiceName = voiceProfile.baseVoice;

  const chunks = splitTextIntoChunks(text, 750);

  const selectedTtsModel = safeLocalStorageGet('ai_tts_model') || 'gemini-3.8-flash-lite-tts';
  const allGeminiModels = getDynamicModelsList('gemini');
  let ttsModels = allGeminiModels.filter(m => {
    const lower = m.toLowerCase();
    return (
      lower.includes('tts') &&
      !lower.includes(':batch') &&
      !lower.includes('image') &&
      !lower.includes('embedding') &&
      !lower.includes('search') &&
      !lower.includes('experimental') &&
      !lower.startsWith('gemini-1.5') &&
      !lower.startsWith('gemini-2.0')
    );
  });
  const preferredTtsOrder = [
    'gemini-3.8-flash-lite-tts',
    'gemini-3.8-flash-tts',
    'gemini-3.1-flash-tts-preview',
    'gemini-2.5-flash-preview-tts',
    'gemini-2.5-pro-preview-tts',
  ];
  ttsModels = Array.from(new Set([
    ...(selectedTtsModel.toLowerCase().includes('tts') ? [selectedTtsModel] : []),
    ...preferredTtsOrder,
    ...ttsModels
  ]));
  let currentModelIndex = 0;

  let combinedPcmBytes = new Uint8Array(0);
  let finalMimeType = 'audio/wav';

  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i].trim();
    if (!chunkText) continue;
    
    let retries = 8; // Increased retries
    let success = false;
    let delay = 3000; // Increased initial delay for quota errors

    while (retries > 0 && !success) {
      try {
        console.log(`Generating AI recitation for chunk ${i + 1}/${chunks.length} using ${ttsModels[currentModelIndex]} (${voiceProfile.id}): "${chunkText.substring(0, 30)}..."`);
        
        const response = await fetch(`${window.location.origin}/api/gemini/speech?t=${Date.now()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            apiKey: finalKey, 
            model: ttsModels[currentModelIndex], 
            text: chunkText, 
            voiceName: actualVoiceName,
            voiceStyle: voiceProfile.stylePrompt
          })
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const httpErr: any = new Error(err.error || response.statusText || `HTTP ${response.status}`);
          httpErr.status = err.status || response.status;
          httpErr.code = err.code || response.status;
          throw httpErr;
        }

        const data = await response.json();
        if (!data.audioData) {
          console.warn(`No audio data received for chunk ${i + 1}`);
          retries--;
          continue;
        }
        
        const audioData = data.audioData;
        const mimeType = data.mimeType || 'audio/wav';
        
        // Decode base64 to binary
        const binaryString = atob(audioData);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let j = 0; j < len; j++) {
          bytes[j] = binaryString.charCodeAt(j);
        }

        // If it's the first chunk, save the mimeType
        if (i === 0) finalMimeType = mimeType;

        // Check if the audio data already has a WAV header (starts with 'RIFF')
        const hasWavHeader = len >= 44 && 
                             bytes[0] === 0x52 && // R
                             bytes[1] === 0x49 && // I
                             bytes[2] === 0x46 && // F
                             bytes[3] === 0x46;   // F

        // If it has a WAV header, strip the 44-byte header to get raw PCM
        const pcmBytes = hasWavHeader ? bytes.slice(44) : bytes;

        // Append to combined bytes
        const newCombined = new Uint8Array(combinedPcmBytes.length + pcmBytes.length);
        newCombined.set(combinedPcmBytes, 0);
        newCombined.set(pcmBytes, combinedPcmBytes.length);
        combinedPcmBytes = newCombined;
        
        success = true;
        
        // Add a delay between successful chunks to avoid rate limits
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        let errorObj = error;
        try {
          if (typeof error === 'string') {
            errorObj = JSON.parse(error);
          } else if (error instanceof Error) {
            try {
              errorObj = JSON.parse(error.message);
            } catch (e) {}
          }
        } catch (e) {}
        
        errorObj = (errorObj as any).error || errorObj;
        
        const errorMessage = (errorObj as any).message || String(error);
        const lowerErr = (errorMessage || '').toLowerCase();
        const isQuotaExceeded = 
          (errorObj as any).status === 'RESOURCE_EXHAUSTED' || 
          (errorObj as any).code == 429 || 
          (errorObj as any).status == 429 ||
          ((errorObj as any).name === 'ApiError' && (errorObj as any).status == 429) ||
          lowerErr.includes('resource_exhausted') ||
          lowerErr.includes('429');
        
        const isInternalError = 
          (errorObj as any).status === 'INTERNAL' || 
          (errorObj as any).code == 500 || 
          (errorObj as any).status == 500;
          
        const isHardQuotaLimit = isQuotaExceeded && errorMessage && typeof errorMessage === 'string' && errorMessage.includes('check your plan and billing details');
        const isInvalidModel = (
          ((errorObj as any).status === 'INVALID_ARGUMENT' || (errorObj as any).status == 400 || lowerErr.includes('invalid json') || lowerErr.includes('unknown name')) &&
          (lowerErr.includes('supports text output') || lowerErr.includes('response modalities: audio') || lowerErr.includes('speechconfig'))
        );
        
        const isPermissionDenied = (errorObj as any).status === 'PERMISSION_DENIED' || (errorObj as any).status == 403;
        const isNotFound = (errorObj as any).status === 'NOT_FOUND' || (errorObj as any).status == 404;
        if (isHardQuotaLimit || isNotFound || isInvalidModel || isPermissionDenied) {
          if (currentModelIndex < ttsModels.length - 1) {
            console.warn(`Model ${ttsModels[currentModelIndex]} failed (${(errorObj as any).status || 'ERROR'}). Trying next model...`);
            currentModelIndex++;
            retries = 8; // Reset retries for the new model
            continue;
          }
          console.warn(`Hard quota limit reached on chunk ${i + 1}. Falling back immediately.`);
          if (i === 0) return null;
          break;
        }

        console.error(`Gemini TTS Error on chunk ${i + 1}:`, error);
        
        retries--;
        if ((isQuotaExceeded || isInternalError) && retries > 0) {
          console.warn(`${isQuotaExceeded ? 'Quota exceeded' : 'Internal error'}, retrying chunk ${i + 1} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 1.5; // Exponential backoff
        } else if (retries > 0) {
          console.log(`Retrying chunk ${i + 1} in 2s...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else if (isQuotaExceeded && i === 0) {
          return null; // Fail gracefully if first chunk fails due to quota
        } else if (isQuotaExceeded && i > 0) {
          console.warn(`Giving up on chunk ${i + 1} after retries. Returning partial audio.`);
          break; // Break the loop and return what we have so far
        }
      }
    }
    
    // If a chunk failed completely and we broke the loop, stop processing further chunks
    if (!success) {
      break;
    }
  }

  if (combinedPcmBytes.length === 0) {
    return null;
  }

  console.log("AI Recitation generated successfully for all chunks.");

  // Add WAV header to the combined PCM bytes
  let finalAudioData = '';
  if (finalMimeType && typeof finalMimeType === 'string' && (finalMimeType.includes('pcm') || !finalMimeType.includes('mpeg'))) {
    try {
      const len = combinedPcmBytes.length;
      const wavHeader = new ArrayBuffer(44);
      const view = new DataView(wavHeader);
      
      /* RIFF identifier */
      view.setUint32(0, 0x52494646, false);
      /* file length */
      view.setUint32(4, 36 + len, true);
      /* RIFF type */
      view.setUint32(8, 0x57415645, false);
      /* format chunk identifier */
      view.setUint32(12, 0x666d7420, false);
      /* format chunk length */
      view.setUint32(16, 16, true);
      /* sample format (raw) */
      view.setUint16(20, 1, true);
      /* channel count */
      view.setUint16(22, 1, true);
      /* sample rate */
      view.setUint32(24, 24000, true);
      /* byte rate (sample rate * block align) */
      view.setUint32(28, 24000 * 2, true);
      /* block align (channel count * bytes per sample) */
      view.setUint16(32, 2, true);
      /* bits per sample */
      view.setUint16(34, 16, true);
      /* data chunk identifier */
      view.setUint32(36, 0x64617461, false);
      /* data chunk length */
      view.setUint32(40, len, true);
      
      const combined = new Uint8Array(44 + len);
      combined.set(new Uint8Array(wavHeader), 0);
      combined.set(combinedPcmBytes, 44);
      
      // Convert back to base64 safely without call-stack overflow
      finalAudioData = uint8ToBase64(combined);
      finalMimeType = 'audio/wav';
    } catch (e) {
      console.error("Error adding WAV header:", e);
      // Fallback to raw base64 if header fails
      finalAudioData = uint8ToBase64(combinedPcmBytes);
    }
  } else {
    // If it's not PCM (e.g., mp3), we can't just concatenate bytes easily without decoding.
    // But Gemini TTS currently returns PCM. If it returns something else, this might produce invalid audio.
    finalAudioData = uint8ToBase64(combinedPcmBytes);
  }

  return {
    data: finalAudioData,
    mimeType: finalMimeType
  };
};

export const transcribeAudio = async (
  base64Audio: string,
  mimeType: string,
  apiKey?: string
): Promise<string> => {
  const finalKey = apiKey || safeLocalStorageGet(AI_PROVIDERS.gemini.keyName);

  try {
    const response = await fetch(getApiUrl(`/api/gemini/transcribe?t=${Date.now()}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        apiKey: finalKey,
        base64Audio,
        mimeType
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || response.statusText);
    }

    const data = await response.json();
    return data.text?.trim() || "";
  } catch (error) {
    console.warn('Audio transcription error:', error);
    throw error;
  }
};

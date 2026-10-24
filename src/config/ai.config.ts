import { registerAs } from '@nestjs/config';

// Model ids change often; keep them in env so a model swap is a config change.
// Defaults are stable models on the Gemini API free tier (Oct 2026).
export default registerAs('ai', () => ({
  apiKey: process.env.GEMINI_API_KEY,
  textModel: process.env.GEMINI_TEXT_MODEL ?? 'gemini-3.5-flash-lite',
  embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001',
  ttsModel: process.env.GEMINI_TTS_MODEL ?? 'gemini-3.8-flash-lite-tts',
  // Whole-app safety net per server instance, below the free tier's daily cap.
  dailyBudget: parseInt(process.env.AI_DAILY_BUDGET ?? '800', 10),
}));

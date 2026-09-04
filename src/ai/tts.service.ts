import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface NarrationResult {
  audioBuffer: Buffer;
  mimeType: string;
  estimatedDurationSeconds: number;
}

const MAX_NARRATION_CHARS = 3000; // keeps generation time reasonable on serverless
const WORDS_PER_MINUTE_SPOKEN = 130; // average calm narration pace

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private readonly genAI: GoogleGenerativeAI;

  // DEPLOYMENT NOTE: Gemini's TTS-capable model names may change as
  // Google updates their API. Check https://ai.google.dev/gemini-api/docs/models
  // for the current TTS-supporting model before deploying to production.
  private readonly ttsModelName = 'gemini-3.1-flash-tts-preview';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY is not defined');
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateNarration(text: string): Promise<NarrationResult> {
    if (text.length > MAX_NARRATION_CHARS) {
      throw new BadRequestException(
        `Text too long for narration. Maximum ${MAX_NARRATION_CHARS} characters, got ${text.length}.`,
      );
    }

    if (text.trim().length < 10) {
      throw new BadRequestException('Text too short to narrate.');
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.ttsModelName });

      // Gentle, calm delivery - fits poetry and reflective content better
      // than a brisk "news anchor" tone.
      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }, // calm, measured tone
            },
          },
        } as Record<string, unknown>, // SDK types may lag behind API - see deployment note below
      });

      const audioPart = result.response.candidates?.[0]?.content?.parts?.[0];
      const inlineData = (
        audioPart as { inlineData?: { data: string; mimeType: string } }
      )?.inlineData;

      if (!inlineData?.data) {
        throw new Error('No audio data returned from Gemini TTS');
      }

      const audioBuffer = Buffer.from(inlineData.data, 'base64');
      const wordCount = text.trim().split(/\s+/).length;
      const estimatedDurationSeconds = Math.ceil(
        (wordCount / WORDS_PER_MINUTE_SPOKEN) * 60,
      );

      return {
        audioBuffer,
        mimeType: inlineData.mimeType || 'audio/wav',
        estimatedDurationSeconds,
      };
    } catch (error) {
      this.logger.error('Gemini TTS generation failed', error);
      throw new BadRequestException(
        'Failed to generate narration. Please try again shortly.',
      );
    }
  }

  // Strips markdown/formatting artifacts that would sound awkward if read aloud
  prepareTextForNarration(title: string, body: string): string {
    const cleanBody = body
      .replace(/[#*_~`]/g, '') // strip markdown symbols
      .replace(/\n{2,}/g, '. ') // paragraph breaks become natural pauses
      .replace(/\n/g, ', ') // line breaks (common in poetry) become soft pauses
      .trim();

    return `${title}. ${cleanBody}`;
  }
}

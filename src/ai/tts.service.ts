import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';

export interface NarrationResult {
  audioBuffer: Buffer;
  mimeType: string;
  estimatedDurationSeconds: number;
}

const MAX_NARRATION_CHARS = 3000; // keeps generation time inside serverless limits
const WORDS_PER_MINUTE_SPOKEN = 130; // calm narration pace

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private readonly model: string;

  constructor(
    private readonly aiService: AiService,
    config: ConfigService,
  ) {
    this.model = config.get<string>('ai.ttsModel')!;
  }

  async generateNarration(text: string): Promise<NarrationResult> {
    if (text.length > MAX_NARRATION_CHARS) {
      throw new BadRequestException(
        `Text too long for narration. Maximum ${MAX_NARRATION_CHARS} characters, got ${text.length}.`,
      );
    }
    if (text.trim().length < 10)
      throw new BadRequestException('Text too short to narrate.');
    if (!this.aiService.spend()) {
      throw new ServiceUnavailableException(
        'Narration is resting for today. Try again tomorrow.',
      );
    }

    try {
      const res = await this.aiService.client.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [{ text: `Read this slowly and gently:\n\n${text}` }],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });

      const data = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!data) throw new Error('No audio data returned');
      const audio = Buffer.from(data, 'base64');
      const isWav = audio.toString('ascii', 0, 4) === 'RIFF';

      const words = text.trim().split(/\s+/).length;
      return {
        // Some models return raw PCM samples; browsers need a WAV container.
        audioBuffer: isWav ? audio : pcmToWav(audio),
        mimeType: 'audio/wav',
        estimatedDurationSeconds: Math.ceil(
          (words / WORDS_PER_MINUTE_SPOKEN) * 60,
        ),
      };
    } catch (error) {
      this.logger.error('Gemini TTS generation failed', error);
      throw new BadRequestException(
        'Failed to generate narration. Please try again shortly.',
      );
    }
  }

  // Strips formatting that sounds awkward when read aloud
  prepareTextForNarration(title: string, body: string): string {
    const cleanBody = body
      .replace(/[#*_~`]/g, '')
      .replace(/\n{2,}/g, '. ') // stanza/paragraph breaks become pauses
      .replace(/\n/g, ', ') // line breaks become soft pauses
      .trim();
    return `${title}. ${cleanBody}`;
  }
}

// A WAV file is a 44-byte RIFF header followed by the raw samples.
// Gemini TTS: 24 kHz, 16-bit, mono, little-endian PCM.
export function pcmToWav(
  pcm: Buffer,
  sampleRate = 24000,
  channels = 1,
  bitsPerSample = 16,
): Buffer {
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28); // byte rate
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

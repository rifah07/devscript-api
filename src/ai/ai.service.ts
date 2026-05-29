import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly modelName = 'gemini-3.1-flash-lite';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) throw new Error('GEMINI_API_KEY is not defined');

    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateSummary(title: string, body: string): Promise<string> {
    return this.callGemini(
      `Summarize this blog post in 2-3 sentences. Be concise and focus on the key takeaways.

Title: ${title}

Content: ${body.slice(0, 3000)}`, // limit body to avoid token overflow
    );
  }

  async suggestTags(title: string, body: string): Promise<string[]> {
    const response = await this.callGemini(
      `Suggest 3-5 relevant tags for this developer blog post.
Return ONLY a JSON array of lowercase strings. No explanation. Example: ["nestjs","typescript","backend"]

Title: ${title}
Content: ${body.slice(0, 2000)}`,
    );

    try {
      // Strip markdown code fences if Gemini adds them
      const clean = response.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean) as unknown;
      if (Array.isArray(parsed)) {
        return (parsed as unknown[])
          .filter((t): t is string => typeof t === 'string')
          .slice(0, 5);
      }
      return [];
    } catch {
      this.logger.warn('Failed to parse tags from Gemini response');
      return [];
    }
  }

  async suggestTitles(draft: string): Promise<string[]> {
    const response = await this.callGemini(
      `Suggest 3 engaging blog post titles for this developer content.
Return ONLY a JSON array of strings. No explanation.

Draft: ${draft.slice(0, 1000)}`,
    );

    try {
      const clean = response.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean) as unknown;
      if (Array.isArray(parsed)) {
        return (parsed as unknown[])
          .filter((t): t is string => typeof t === 'string')
          .slice(0, 3);
      }
      return [];
    } catch {
      this.logger.warn('Failed to parse titles from Gemini response');
      return [];
    }
  }

  // ─── Private helper ───────────────────────────────────────────────────────

  private async callGemini(prompt: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      this.logger.error('Gemini API call failed', error);
      // Return empty string instead of crashing - AI is a nice-to-have
      return '';
    }
  }
}

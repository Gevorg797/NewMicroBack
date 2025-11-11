import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class GptService {
  private readonly logger = new Logger(GptService.name);
  private readonly historyLimit = 16;
  private readonly conversations = new Map<string, ChatMessage[]>();
  private readonly apiKey = process.env.PAYMENT_BOT_OPENAI_KEY;
  private readonly apiUrl =
    process.env.PAYMENT_BOT_OPENAI_URL ??
    'https://api.openai.com/v1/chat/completions';
  private readonly model =
    process.env.PAYMENT_BOT_OPENAI_MODEL ?? 'gpt-4o-mini';
  private readonly systemPrompt =
    process.env.PAYMENT_BOT_OPENAI_SYSTEM_PROMPT ??
    'Ты дружелюбный ассистент платежного бота. Отвечай кратко, но информативно, помогай пользователю решить задачу.';

  constructor(private readonly httpService: HttpService) {}

  resetConversation(userId: string): void {
    this.conversations.delete(userId);
  }

  async generateChatResponse(userId: string, message: string): Promise<string> {
    if (!this.apiKey) {
      this.logger.error('PAYMENT_BOT_OPENAI_KEY is not configured');
      throw new Error('GPT_API_KEY_MISSING');
    }

    const history: ChatMessage[] = this.conversations.get(userId) ?? [];
    history.push({ role: 'user', content: message } as ChatMessage);

    const trimmedHistory: ChatMessage[] = history.slice(-this.historyLimit);

    const payload = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: this.systemPrompt,
        },
        ...trimmedHistory,
      ],
      temperature: 0.7,
    };

    try {
      const { data } = await this.httpService.axiosRef.post(
        this.apiUrl,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const reply: string | undefined =
        data?.choices?.[0]?.message?.content?.trim();

      if (!reply) {
        throw new Error('Empty response from OpenAI');
      }

      const updatedHistory: ChatMessage[] = [
        ...trimmedHistory,
        { role: 'assistant', content: reply } as ChatMessage,
      ];
      this.conversations.set(userId, updatedHistory.slice(-this.historyLimit));

      return reply;
    } catch (error) {
      this.logger.error(
        `Failed to fetch completion: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new Error('GPT_REQUEST_FAILED');
    }
  }
}

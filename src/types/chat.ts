import { VercelAIMessage } from '@vercel/ai';

export interface ChatMessage extends VercelAIMessage {
  conversationId?: string;
  createdAt?: string;
}

export interface ChatMessageWithId extends ChatMessage {
  id: string;
}

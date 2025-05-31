import { Message as VercelAIMessage } from 'ai';

export interface ChatMessage extends Omit<VercelAIMessage, 'createdAt'> {
  conversationId?: string;
  createdAt?: Date;
}

export interface ChatMessageWithId extends ChatMessage {
  id: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessageWithId[];
  createdAt: string;
  updatedAt: string;
}

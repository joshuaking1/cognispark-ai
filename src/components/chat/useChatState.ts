import { useState, Dispatch, SetStateAction } from 'react';
import { Conversation } from '@/types/chat';
import { Message as VercelAIMessage } from 'ai';

interface ChatState {
  isSidebarLoading: boolean;
  isHistoryLoading: boolean;
  isListening: boolean;
  isVoiceInputEnabled: boolean;
  conversations: Conversation[];
  currentConversationId: string | null;
  displayMessages: VercelAIMessage[];
  isTTSEnabled: boolean;
  isSpeaking: boolean;
}

interface ChatStateActions {
  setIsSidebarLoading: Dispatch<SetStateAction<boolean>>;
  setIsHistoryLoading: Dispatch<SetStateAction<boolean>>;
  setIsListening: Dispatch<SetStateAction<boolean>>;
  setIsVoiceInputEnabled: Dispatch<SetStateAction<boolean>>;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  setCurrentConversationId: Dispatch<SetStateAction<string | null>>;
  setDisplayMessages: Dispatch<SetStateAction<VercelAIMessage[]>>;
  setIsTTSEnabled: Dispatch<SetStateAction<boolean>>;
  setIsSpeaking: Dispatch<SetStateAction<boolean>>;
}

export function useChatState(): ChatState & ChatStateActions {
  const [isSidebarLoading, setIsSidebarLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceInputEnabled, setIsVoiceInputEnabled] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [displayMessages, setDisplayMessages] = useState<VercelAIMessage[]>([]);
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  return {
    isSidebarLoading,
    isHistoryLoading,
    isListening,
    isVoiceInputEnabled,
    conversations,
    currentConversationId,
    displayMessages,
    isTTSEnabled,
    isSpeaking,
    setIsSidebarLoading,
    setIsHistoryLoading,
    setIsListening,
    setIsVoiceInputEnabled,
    setConversations,
    setCurrentConversationId,
    setDisplayMessages,
    setIsTTSEnabled,
    setIsSpeaking
  };
}

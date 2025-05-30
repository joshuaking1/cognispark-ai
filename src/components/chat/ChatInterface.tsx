// src/components/chat/ChatInterface.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Send as PaperPlaneIcon,
  Plus as PlusIcon,
  RefreshCw as UpdateIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Volume2 as Volume2Icon,
  VolumeX as VolumeXIcon,
  MessageSquare,
  Sparkles,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { useChat } from "ai/react";
import type { Message as VercelAIMessage } from "ai";
import { format, isToday, isYesterday } from "date-fns";
import { useSearchParams, useRouter, usePathname } from 'next/navigation';


// Removed helper function as it causes issues with React hooks

import { getMessagesForConversation, getConversationsListAction } from "@/app/actions/chatActions";
import { generateConversationTitle } from "@/app/actions/generateConversationTitleAction";
import ChatMessageContentRenderer from "./ChatMessageContentRenderer";

// Define DisplayMessage structure for UI rendering
interface DisplayMessage extends VercelAIMessage {
  createdAt: Date;
}

interface Conversation {
  id: string;
  title: string;
}

// Add type definition for SpeechRecognition
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// Web Speech API instances
let recognition: SpeechRecognition | null = null;
let speechSynthesisUtterance: SpeechSynthesisUtterance | null = null;

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

// Convert ChatMessage to VercelAIMessage
const convertToVercelMessage = (msg: ChatMessage): VercelAIMessage => ({
  id: msg.id,
  role: msg.role,
  content: msg.content,
});

export default function ChatInterface() {
  const [isVoiceInputActive, setIsVoiceInputActive] = useState(false);
  const [isTTSActive, setIsTTSActive] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // UI specific states
  const [isSidebarLoading, setIsSidebarLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const scrollArea = scrollAreaRef.current;
  const [vercelMessages, setVercelMessages] = useState<VercelAIMessage[]>([]);
  // Input is now managed by useChat hook instead of local state

  // Vercel AI SDK's useChat hook
  const {
    messages: aiMessages,
    input: aiInput,
    handleInputChange,
    handleSubmit,
    isLoading: chatIsLoading,
    error,
    setMessages
  } = useChat({
    api: '/api/chat',
    initialMessages: vercelMessages,
    id: currentConversationId || undefined,
    body: {
      conversationId: currentConversationId || undefined
    },
    onFinish: async (message) => {
      if (isTTSEnabled && message.role === 'assistant') {
        speakText(message.content);
      }
      // Update the messages state after completion
      setVercelMessages(prev => [...prev]);
    }
  });

  // Mapped messages for display with guaranteed Date objects
  const displayMessages = vercelMessages.map((message) => ({
    ...message,
    createdAt: new Date(),
  }));

  // Handle URL search parameters and conversation selection
  useEffect(() => {
    const urlSearchParams = new URLSearchParams(window.location.search);
    const prefillMessage = urlSearchParams.get('prefill');
    const requestedConversationId = urlSearchParams.get('conversationId');
    let hasProcessedQuery = false;

    if (requestedConversationId) {
      if (requestedConversationId !== currentConversationId) { // Only load if it's a different convo
        selectConversation(requestedConversationId);
      }
      hasProcessedQuery = true;
    } else if (prefillMessage) {
      if (currentConversationId) { // If on an existing convo and prefill comes, assume new chat with prefill
        handleNewConversation();
      }
      handleInputChange({ target: { value: decodeURIComponent(prefillMessage) } } as React.ChangeEvent<HTMLTextAreaElement>);
      hasProcessedQuery = true;
    } else if (!currentConversationId && conversations.length > 0) {
      // Optionally auto-select most recent from sidebar
      // selectConversation(conversations[0].id);
    }

    if (hasProcessedQuery) {
      const currentPath = window.location.pathname;
      router.replace(currentPath, { scroll: false }); // Clean URL
    }
  }, [searchParams, conversations, router, handleInputChange, currentConversationId, handleNewConversation, selectConversation]); // Added proper dependencies

  // Function to select a conversation
  const selectConversation = useCallback(async (conversationId: string) => {
    setIsHistoryLoading(true);
    try {
      const messages = await getMessagesForConversation(conversationId);
      setVercelMessages(messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content
      })));
      setCurrentConversationId(conversationId);
      handleInputChange({ target: { value: '' } } as React.ChangeEvent<HTMLTextAreaElement>); // Clear input when switching conversations
    } catch (err: unknown) {
      console.error('Error loading conversation:', err);
      toast.error('Failed to load conversation');
    } finally {
      setIsHistoryLoading(false);
    }
  }, [setVercelMessages, handleInputChange]);

  const scrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'auto') => {
    const scrollArea = scrollAreaRef.current;
    if (scrollArea) {
      const viewport = scrollArea.querySelector('div[style*="overflow: scroll;"]') as HTMLElement;
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: behavior });
      }
    }
  }, []);

  const loadConversationsList = useCallback(async () => {
    setIsSidebarLoading(true);
    try {
      const convos = await getConversationsListAction();
      setConversations(convos);
    } catch (e: unknown) {
      console.error("Failed to load conversations list:", e);
      toast.error("Could not load your past conversations.");
    } finally {
      setIsSidebarLoading(false);
    }
  }, []);

  const loadMessagesForSelectedConvo = useCallback(async (convoId: string | null) => {
    if (!convoId) {
      setVercelMessages([]);
      setCurrentConversationId(null);
      handleInputChange({ target: { value: '' } } as React.ChangeEvent<HTMLTextAreaElement>);
      return;
    }

    setIsHistoryLoading(true);
    try {
      const messages = await getMessagesForConversation(convoId);
      // Convert ChatMessage[] to VercelAIMessage[]
      const convertedMessages = messages.map((msg) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));
      setVercelMessages(convertedMessages);
      setCurrentConversationId(convoId);
      handleInputChange({ target: { value: '' } } as React.ChangeEvent<HTMLTextAreaElement>); // Clear input when switching conversations
    } catch (err: unknown) {
      console.error("Error loading messages:", err);
      toast.error("Error", {
        description: err instanceof Error ? err.message : "Failed to load messages",
      });
    } finally {
      setIsHistoryLoading(false);
    }
  }, [setVercelMessages, handleInputChange, setCurrentConversationId]);

  // Initial load of conversations
  useEffect(() => {
    loadConversationsList();
  }, [loadConversationsList]);

  // Handle conversationId and prefill from URL
  useEffect(() => {
    const prefillMessage = searchParams.get('prefill');
    const requestedConversationId = searchParams.get('conversationId');

    let hasProcessedQuery = false;

    if (requestedConversationId) {
      if (requestedConversationId !== currentConversationId) {
        loadMessagesForSelectedConvo(requestedConversationId);
      }
      hasProcessedQuery = true;
    } else if (prefillMessage) {
      setVercelMessages([]);
      setCurrentConversationId(null);
      handleInputChange({ target: { value: decodeURIComponent(prefillMessage) } } as React.ChangeEvent<HTMLTextAreaElement>);
      hasProcessedQuery = true;
    } else {
      loadConversationsList();
    }

    if (hasProcessedQuery && pathname) {
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, router, pathname, currentConversationId, loadMessagesForSelectedConvo, setVercelMessages, loadConversationsList, handleInputChange]);

  // Scroll to bottom when new messages arrive or loading state changes
  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (scrollArea && (displayMessages.length > 0 || chatIsLoading)) {
      const viewport = scrollArea.querySelector('div[style*="overflow: scroll;"]') as HTMLElement;
      if (viewport) {
        viewport.scrollTo({ 
          top: viewport.scrollHeight, 
          behavior: chatIsLoading ? 'auto' : 'smooth' 
        });
      }
    }
  }, [displayMessages, chatIsLoading]);

  // Speech Recognition and Synthesis Effect
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        recognition = new SpeechRecognitionAPI();
        if (recognition) {
          recognition.continuous = false;
          recognition.interimResults = false;
          recognition.lang = 'en-US';

          recognition.onresult = (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript.trim();
            handleInputChange({ target: { value: aiInput ? `${aiInput} ${transcript}` : transcript } } as React.ChangeEvent<HTMLTextAreaElement>);
            setIsListening(false);
          };
          recognition.onerror = (event) => {
            toast.error("Voice Error", { description: `Could not recognize speech: ${event.error}` });
            setIsListening(false);
          };
          recognition.onend = () => setIsListening(false);
        }
      } else {
        console.warn('Speech Recognition API not supported.');
      }
    }
    return () => {
      if (recognition && isListening) recognition.stop();
      if (speechSynthesis?.speaking) speechSynthesis.cancel();
    };
  }, [setInput, isListening]);

  const toggleVoiceInput = () => {
    if (!recognition) {
      toast.error("Voice input is not supported by your browser.");
      return;
    }
    if (isListening) {
      recognition.stop();
    } else {
      try {
        setIsListening(true);
        recognition.start();
        toast.info("Listening...", { duration: 2500 });
      } catch (e) {
        toast.error("Voice Error", { description: "Could not start voice input." });
        setIsListening(false);
      }
    }
  };

  const speakText = (textToSpeak: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      if (speechSynthesis.speaking) speechSynthesis.cancel();
      speechSynthesisUtterance = new SpeechSynthesisUtterance(textToSpeak);
      speechSynthesisUtterance.onstart = () => setIsSpeaking(true);
      speechSynthesisUtterance.onend = () => setIsSpeaking(false);
      speechSynthesisUtterance.onerror = () => {
        toast.error("TTS Error", { description: "Could not play audio." });
        setIsSpeaking(false);
      };
      speechSynthesis.speak(speechSynthesisUtterance);
    } else {
      toast.error("Text-to-speech is not supported.");
    }
  };

  const toggleTTS = () => {
    setIsTTSEnabled(prev => {
      const newState = !prev;
      if (!newState && speechSynthesis?.speaking) {
        speechSynthesis.cancel();
        setIsSpeaking(false);
      }
      toast.info(newState ? "Nova's voice enabled" : "Nova's voice disabled");
      return newState;
    });
  };

  const handleNewConversation = () => {
    loadMessagesForSelectedConvo(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!chatIsLoading && aiInput.trim()) {
        handleSubmit(event);
      }
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900">
      {/* Sidebar - Hidden on mobile */}
      <div className="hidden md:flex w-80 sticky top-0 h-screen bg-slate-50/30 dark:bg-slate-900/30 backdrop-blur-sm border-r border-slate-200/20 dark:border-slate-700/20 flex-col">
        {/* Sidebar Header */}
        <div className="p-6 border-b border-slate-200/20 dark:border-slate-700/20 bg-gradient-to-r from-blue-600/90 to-purple-600/90 backdrop-blur-sm">
          <Button 
            onClick={handleNewConversation} 
            className="w-full h-12 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm font-medium transition-all duration-200"
            variant="outline"
          >
            <PlusIcon className="mr-2 h-5 w-5" />
            Start New Chat
          </Button>
        </div>

        {/* Conversations Header */}
        <div className="px-6 py-4 border-b border-slate-200/20 dark:border-slate-700/20 bg-slate-50/30 dark:bg-slate-800/30 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Recent Chats</h3>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={loadConversationsList} 
              disabled={isSidebarLoading} 
              className="h-8 w-8 p-0 hover:bg-slate-200/30 dark:hover:bg-slate-700/30"
            >
              <UpdateIcon className={`h-4 w-4 ${isSidebarLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 space-y-2">
            {isSidebarLoading && conversations.length === 0 && 
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl bg-slate-200/20 dark:bg-slate-700/20" />
              ))
            }
            
            {!isSidebarLoading && conversations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100/50 to-purple-100/50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">No conversations yet</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Start chatting with Nova to see your history here</p>
              </div>
            )}
            
            {conversations.map((convo) => (
              <div
                key={convo.id}
                onClick={() => loadMessagesForSelectedConvo(convo.id)}
                className={`group relative p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                  currentConversationId === convo.id 
                    ? "bg-gradient-to-r from-blue-500/90 to-purple-500/90 text-white backdrop-blur-sm" 
                    : "hover:bg-slate-100/30 dark:hover:bg-slate-800/30 hover:scale-[1.01]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    currentConversationId === convo.id ? "bg-white" : "bg-slate-300/50 dark:bg-slate-600/50"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium line-clamp-2 ${
                      currentConversationId === convo.id 
                        ? "text-white" 
                        : "text-slate-900 dark:text-slate-100"
                    }`}>
                      {convo.title}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area - Adjusted to take remaining space */}
      <div className="flex flex-col flex-1 min-w-0 h-screen">
        {/* Chat Header - Improved for mobile */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 px-4 md:px-8 py-4 md:py-6 shadow-sm">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                  {currentConversationId && displayMessages.length > 0 
                    ? conversations.find((c) => c.id === currentConversationId)?.title || "Chat with Nova"
                    : "Chat with Nova"
                  }
                </h1>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">AI Teaching Assistant</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 md:gap-3">
              <Button 
                onClick={toggleTTS} 
                variant="outline" 
                size="icon" 
                className="h-9 w-9 md:h-11 md:w-11 rounded-xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:bg-white/80 dark:hover:bg-slate-800/80"
              >
                {isTTSEnabled ? (
                  isSpeaking ? 
                    <Volume2Icon className="h-4 w-4 md:h-5 md:w-5 text-blue-600 animate-pulse" /> : 
                    <Volume2Icon className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                ) : (
                  <VolumeXIcon className="h-4 w-4 md:h-5 md:w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Messages Area - Improved for mobile */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-8">
              {isHistoryLoading && (
                <div className="space-y-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={`skel-${i}`} className={`flex gap-4 ${i % 2 !== 0 ? 'justify-end' : ''}`}>
                      {i % 2 === 0 && <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />}
                      <div className={`space-y-2 max-w-md ${i % 2 !== 0 ? 'order-first' : ''}`}>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                      {i % 2 !== 0 && <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />}
                    </div>
                  ))}
                </div>
              )}

              {!isHistoryLoading && displayMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] md:min-h-[400px] text-center px-4">
                  <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center mb-4 md:mb-6">
                    <MessageSquare className="w-10 h-10 md:w-12 md:h-12 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2 md:mb-3">
                    {currentConversationId ? "This conversation is empty" : "Welcome to Nova AI!"}
                  </h2>
                  <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-md leading-relaxed">
                    {currentConversationId 
                      ? "Send a message to continue this conversation."
                      : "Your AI teaching assistant is ready to help. Ask questions, get explanations, or start learning something new!"
                    }
                  </p>
                </div>
              )}

              {!isHistoryLoading && displayMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 md:gap-4 mb-6 md:mb-8 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role !== "user" && (
                    <Avatar className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0 shadow-lg ring-2 ring-white dark:ring-slate-800">
                      <AvatarImage src="/nova-avatar.png" alt="Nova" />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white font-semibold">
                        N
                      </AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div className={`space-y-2 max-w-md ${msg.role === "user" ? "order-first" : ""}`}>
                    <p className={`text-sm font-medium line-clamp-2 ${
                      msg.role === "user" ? "text-blue-600 dark:text-blue-400" : "text-slate-900 dark:text-slate-100"
                    }`}>
                      {msg.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Input Area */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700/50 p-4 md:p-8">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2">
              <Textarea
                value={aiInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="flex-1"
              />
              <Button type="submit" disabled={chatIsLoading}>
                <PaperPlaneIcon className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
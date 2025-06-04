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
import { useChat, type Message as VercelAIMessage } from "ai/react";
import { format, isToday, isYesterday } from "date-fns";
import Joyride from "react-joyride";
import { useFeatureTour } from "@/hooks/useFeatureTour";
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

// Add Web Speech API type declarations
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionError {
  error: string;
  message: string;
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

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: Event) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// Helper function to get search params
const getSearchParams = () => {
  const [params] = useSearchParams();
  return params;
};

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

// Define tour steps for the chat interface
const chatTourSteps = [
  {
    target: '.chat-input-textarea',
    content: 'Type your questions or messages to Nova here!',
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '.voice-input-button',
    content: 'Click here to use your voice to talk to Nova.',
    placement: 'top',
  },
  {
    target: '.tts-toggle-button',
    content: "Enable this to hear Nova's responses spoken aloud.",
    placement: 'bottom',
  },
  {
    target: '.chat-sidebar-toggle',
    content: 'Open this to see your conversation history.',
    placement: 'right',
  },
  {
    target: '.send-message-button',
    content: 'Click this button to send your message to Nova.',
    placement: 'left',
  }
];

// Web Speech API instances
let recognition: SpeechRecognition | null = null;
// let speechSynthesisUtterance: SpeechSynthesisUtterance | null = null; // Removed

export default function ChatInterface() {
  const [isVoiceInputActive, setIsVoiceInputActive] = useState(false);
  const [isTTSActive, setIsTTSActive] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // UI specific states
  const [isSidebarLoading, setIsSidebarLoading] = useState(false);
  
  // Initialize the feature tour
  // TODO: Replace true with a check from user profile in production
  const { runTour, tourSteps, handleJoyrideCallback, startTour } = useFeatureTour({
    tourKey: "chat",
    steps: chatTourSteps,
    isTourEnabledInitially: true, // For testing, set to true. In production, this should be based on user profile
  });
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioQueue, setAudioQueue] = useState<string[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const scrollArea = scrollAreaRef.current;
  const audioRef = useRef<HTMLAudioElement | null>(null); // For playing audio stream

  // Vercel AI SDK's useChat hook
  const {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading: chatIsLoading,
    error,
    setMessages: setVercelMessages,
    reload,
  } = useChat({
    api: "/api/chat/stream",
    body: {
      conversationId: currentConversationId,
    },
    onResponse: (response) => {
      const newConversationId = response.headers.get('X-Conversation-Id');
      if (newConversationId && currentConversationId !== newConversationId) {
        setCurrentConversationId(newConversationId);
      }
    },
    onFinish: async (message) => {
      if (isTTSEnabled && message.role === 'assistant' && message.content) {
        await playNovaResponse(message.content);
      }
      
      const activeConversationId = currentConversationId || messages.find(m=>m.role==='assistant')?.id;

      if (activeConversationId) {
          loadConversationsList();
          const MIN_MESSAGES_FOR_TITLE_GEN = 2;
          const currentConvoMessages = messages.filter(m => !activeConversationId || m.id.startsWith(activeConversationId.substring(0,5)));
          const convoDetails = conversations.find(c => c.id === activeConversationId);
          const firstUserMessageContent = currentConvoMessages.find(m => m.role === 'user')?.content || "";

          if (currentConvoMessages.length >= MIN_MESSAGES_FOR_TITLE_GEN &&
              (!convoDetails || (firstUserMessageContent && convoDetails.title.startsWith(firstUserMessageContent.substring(0,10))) || !convoDetails.title)
          ) {
            generateConversationTitle(activeConversationId)
              .then(result => { if (result.success) loadConversationsList(); })
              .catch(err => console.error("Title gen call error:", err));
          }
      }
    },
    onError: (err) => {
      toast.error("Chat Error", { description: err.message });
    }
  });

  // Mapped messages for display with guaranteed Date objects
  const displayMessages: DisplayMessage[] = messages.map((message) => ({
    ...message,
    createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
  }));

  // Handle URL search parameters and conversation selection
  useEffect(() => {
    if (typeof window === 'undefined') return; // Skip during SSR

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
      setInput(decodeURIComponent(prefillMessage));
      hasProcessedQuery = true;
    } else if (!currentConversationId && conversations.length > 0) {
      // Optionally auto-select most recent from sidebar
      // selectConversation(conversations[0].id);
    }

    if (hasProcessedQuery) {
      const currentPath = window.location.pathname;
      router.replace(currentPath, { scroll: false }); // Clean URL
    }
  }, [searchParams, conversations, router, setInput]); // Removed window.location.search from deps

  // Function to select a conversation
  const selectConversation = useCallback(async (conversationId: string) => {
    setIsHistoryLoading(true);
    try {
      const messages = await getMessagesForConversation(conversationId);
      const formattedMessages = messages.map(msg => ({
        id: msg.id!,
        role: msg.sender as "user" | "assistant",
        content: msg.content,
        createdAt: new Date(msg.created_at!)
      }));
      setVercelMessages(formattedMessages);
      setCurrentConversationId(conversationId);
      setInput(''); // Clear input when switching conversations
    } catch (err) {
      console.error('Error loading conversation:', err);
      toast.error('Failed to load conversation');
    } finally {
      setIsHistoryLoading(false);
    }
  }, [setVercelMessages, setInput]);

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
    } catch (e) {
      console.error("Failed to load conversations list:", e);
      toast.error("Could not load your past conversations.");
    } finally {
      setIsSidebarLoading(false);
    }
  }, []);

  const loadMessagesForSelectedConvo = useCallback(async (convoId: string | null) => {
    if (convoId === null) {
      setVercelMessages([]);
      setCurrentConversationId(null);
      setInput('');
      return;
    }
    if (convoId === currentConversationId && messages.length > 0) return;

    setIsHistoryLoading(true);
    try {
      const dbMessages = await getMessagesForConversation(convoId);
      const formattedVercelMessages: VercelAIMessage[] = dbMessages.map(msg => ({
        id: msg.id!,
        role: msg.sender as "user" | "assistant",
        content: msg.content,
        createdAt: new Date(msg.created_at!)
      }));
      setVercelMessages(formattedVercelMessages);
      setCurrentConversationId(convoId);
      setInput('');
      loadConversationsList();
    } catch (e) {
      console.error("Failed to load messages:", e);
      toast.error("Could not load chat history for this conversation.");
      setCurrentConversationId(null);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [setVercelMessages, setInput, currentConversationId, loadConversationsList]);

  // Initial load of conversations
  useEffect(() => {
    loadConversationsList();
  }, [loadConversationsList]);

  // Handle conversationId and prefill from URL
  useEffect(() => {
    const urlSearchParams = new URLSearchParams(window.location.search);
    const prefillMessage = urlSearchParams.get('prefill');
    const requestedConversationId = urlSearchParams.get('conversationId');

    let hasProcessedQuery = false;

    if (requestedConversationId) {
      if (requestedConversationId !== currentConversationId) {
        loadMessagesForSelectedConvo(requestedConversationId);
      }
      hasProcessedQuery = true;
    } else if (prefillMessage) {
      setVercelMessages([]);
      setCurrentConversationId(null);
      setInput(decodeURIComponent(prefillMessage));
      hasProcessedQuery = true;
    } else {
      loadConversationsList();
    }

    if (hasProcessedQuery && pathname) {
      router.replace(pathname, { scroll: false });
    }
  }, [window.location.search, setInput, router, pathname, currentConversationId, loadMessagesForSelectedConvo, setVercelMessages]);

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

          recognition.onresult = (event: SpeechRecognitionEvent) => {
            const transcript = event.results[event.results.length - 1][0].transcript.trim();
            setInput(prevInput => prevInput ? `${prevInput} ${transcript}` : transcript);
            setIsListening(false);
          };
          recognition.onerror = (event: Event) => {
            const errorEvent = event as unknown as SpeechRecognitionError;
            toast.error("Voice Error", { description: `Could not recognize speech: ${errorEvent.error}` });
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
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
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

  const playNovaResponse = async (textToSpeak: string) => {
    if (isSpeaking) { // If already speaking, stop previous
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = ""; // Detach source
      }
      setIsSpeaking(false);
    }

    setIsSpeaking(true);
    try {
      const response = await fetch('/api/tts/nova-speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak }),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || `TTS service failed with status ${response.status}`);
        } else {
          throw new Error(`TTS service failed with status ${response.status}`);
        }
      }

      if (!response.body) {
        throw new Error('No audio data received from TTS service');
      }

      // Create an Audio element to play the stream
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      const audio = audioRef.current;
      
      // Get a reader from the response body stream
      const reader = response.body.getReader();
      // Create a new ReadableStream from the reader to build up the blob URL
      const stream = new ReadableStream({
        start(controller) {
          function push() {
            reader.read().then(({ done, value }) => {
              if (done) {
                controller.close();
                return;
              }
              controller.enqueue(value);
              push();
            }).catch(error => {
              console.error("Error reading TTS stream:", error);
              controller.error(error);
            });
          }
          push();
        }
      });

      // Create a new response from the stream to get a Blob
      const blobResponse = new Response(stream);
      const blob = await blobResponse.blob(); // Get the entire audio as a blob
      const audioUrl = URL.createObjectURL(blob); // Create a URL for the blob

      audio.src = audioUrl;
      audio.play()
        .catch(e => {
            console.error("Audio play error:", e);
            toast.error("Playback Error", { 
              description: "Could not play Nova's voice. Please check your browser's audio settings."
            });
            setIsSpeaking(false);
        });

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl); // Clean up blob URL
      };
      audio.onerror = (e) => {
        console.error("Audio element error:", e);
        toast.error("Audio Error", { 
          description: "An error occurred with Nova's voice playback. Please try again."
        });
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl); // Clean up
      };

    } catch (error: any) {
      console.error("playNovaResponse error:", error);
      toast.error("TTS Failed", { 
        description: error.message || "Could not generate Nova's voice. Please try again."
      });
      setIsSpeaking(false);
    }
  };

  const toggleTTS = () => {
    setIsTTSEnabled(prev => {
      const newState = !prev;
      if (!newState && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.src = ""; // Detach source
        setIsSpeaking(false);
      }
      toast.info(newState ? "Nova's premium voice enabled" : "Nova's voice disabled");
      return newState;
    });
  };

  // Cleanup audio element on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const handleNewConversation = () => {
    loadMessagesForSelectedConvo(null);
  };

  const customSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmit(e, {
      body: {
        conversationId: currentConversationId
      }
    });
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
              size="icon"
              onClick={toggleSidebar}
              className="md:hidden h-9 w-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 chat-sidebar-toggle"
            >
              <UpdateIcon className={`h-4 w-4 ${isSidebarLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>
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
                  
                  <div className={`group relative max-w-[85%] md:max-w-[70%] ${msg.role === "user" ? "order-first" : ""}`}>
                    <div className={`px-4 md:px-6 py-3 md:py-4 rounded-2xl shadow-lg transition-all duration-200 ${
                      msg.role === "user" 
                        ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-br-md" 
                        : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/50 dark:border-slate-700/50 rounded-bl-md"
                    }`}>
                      {msg.role === "assistant" && messages[messages.length - 1]?.id === msg.id && !chatIsLoading && reload && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="absolute -top-2 -right-2 h-7 w-7 md:h-8 md:w-8 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 border shadow-lg rounded-full" 
                          onClick={() => reload()}
                        >
                          <UpdateIcon className="h-3 w-3 md:h-4 md:w-4" />
                        </Button>
                      )}
                      
                      <ChatMessageContentRenderer content={msg.content} />
                      
                      {msg.createdAt && (
                        <p className={`text-[10px] md:text-xs mt-2 md:mt-3 ${
                          msg.role === "user" 
                            ? "text-white/70 text-right" 
                            : "text-slate-500 dark:text-slate-400"
                        }`}>
                          {isToday(msg.createdAt) 
                            ? format(msg.createdAt, "p") 
                            : isYesterday(msg.createdAt) 
                              ? `Yesterday ${format(msg.createdAt, "p")}` 
                              : format(msg.createdAt, "MMM d, p")
                          }
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {msg.role === "user" && (
                    <Avatar className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0 shadow-lg ring-2 ring-white dark:ring-slate-800">
                      <AvatarFallback className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                        U
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}

              {chatIsLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-3 md:gap-4 mb-6 md:mb-8">
                  <Avatar className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0 shadow-lg ring-2 ring-white dark:ring-slate-800">
                    <AvatarImage src="/nova-avatar.png" alt="Nova" />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white font-semibold">
                      N
                    </AvatarFallback>
                  </Avatar>
                  <div className="max-w-[85%] md:max-w-[70%] px-4 md:px-6 py-3 md:py-4 rounded-2xl rounded-bl-md bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-500 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                      </div>
                      <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">Nova is thinking...</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Input Area - Improved for mobile */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700/50 p-4 md:p-8">
          <form onSubmit={customSubmit} className="max-w-4xl mx-auto">
            {error && (
              <div className="mb-4 p-3 md:p-4 text-xs md:text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl">
                <p>Error: {error.message}</p>
              </div>
            )}
            
            <div className="flex items-end gap-2 md:gap-4">
              <div className="flex-1 relative">
                <Textarea
                  value={input}
                  onChange={handleInputChange}
                  placeholder={isListening ? "Listening..." : "Ask Nova anything..."}
                  className="min-h-[50px] md:min-h-[60px] max-h-32 resize-none rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 focus:border-blue-500/50 dark:focus:border-blue-400/50 px-4 md:px-6 py-3 md:py-4 pr-12 md:pr-16 text-sm md:text-base shadow-lg transition-all duration-200 chat-input-textarea"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!chatIsLoading && input.trim()) {
                        const form = e.currentTarget.form;
                        if (form) {
                          const formEvent = new Event('submit') as unknown as React.FormEvent<HTMLFormElement>;
                          formEvent.preventDefault = () => {};
                          customSubmit(formEvent);
                        }
                      }
                    }
                  }}
                  disabled={chatIsLoading || isHistoryLoading || isListening}
                />
                {input.length > 0 && (
                  type="submit"
                  size="lg"
                  disabled={chatIsLoading || isHistoryLoading || !input.trim() || isListening}
                  className="h-[50px] w-[50px] md:h-[60px] md:w-[60px] rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg transition-all duration-200 send-message-button"
                >
                  <PaperPlaneIcon className="h-5 w-5 md:h-6 md:w-6" />
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-3 md:mt-4 text-[10px] md:text-xs text-slate-500 dark:text-slate-400 px-2">
              <span className="hidden sm:inline">Press Enter to send • Shift + Enter for new line</span>
              <span className="sm:hidden">Enter to send</span>
              <span>LearnBridgEdu AI</span>
            </div>
          </form>
        </div>
      </div>
    </div>
    </>
  );
}
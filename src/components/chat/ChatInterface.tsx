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
  Menu as MenuIcon,
  Clock,
  Settings2 // Example for a potential settings icon
} from "lucide-react";
import { toast } from "sonner";
import { useChat, type Message as VercelAIMessage } from "ai/react";
import { format, isToday, isYesterday } from "date-fns";
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

import { getMessagesForConversation, getConversationsListAction } from "@/app/actions/chatActions";
import { generateConversationTitle } from "@/app/actions/generateConversationTitleAction";
import ChatMessageContentRenderer from "./ChatMessageContentRenderer";

interface DisplayMessage extends VercelAIMessage {
  createdAt: Date;
}

interface Conversation {
  id: string;
  title: string;
}

let recognition: SpeechRecognition | null = null;

const BRAND_ORANGE = "#fd6a3e";
const BRAND_BLUE = "#022e7d";

export default function ChatInterface() {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null); // Ref for textarea focus
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [isSidebarLoading, setIsSidebarLoading] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  const toggleSidebar = () => {
    setIsMobileSidebarOpen(prev => !prev);
  };

  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null); 

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
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set('conversationId', newConversationId);
        router.push(`${pathname}?${newParams.toString()}`, { scroll: false });
      }
    },
    onFinish: async (message) => {
      if (isTTSEnabled && message.role === 'assistant' && message.content) {
        await playNovaResponse(message.content);
      }
      const activeConversationId = currentConversationId || messages.find(m=>m.role==='assistant')?.id?.split('_')[0];
      if (activeConversationId) {
          loadConversationsList();
          const MIN_MESSAGES_FOR_TITLE_GEN = 2;
          const currentConvoMessages = messages.filter(m => m.id && (!activeConversationId || true)); 
          const convoDetails = conversations.find(c => c.id === activeConversationId);
          const firstUserMessageContent = currentConvoMessages.find(m => m.role === 'user')?.content || "";
          if (currentConvoMessages.length >= MIN_MESSAGES_FOR_TITLE_GEN &&
              (!convoDetails || !convoDetails.title || (convoDetails.title === "New Chat" || convoDetails.title.startsWith("Untitled") || (firstUserMessageContent && convoDetails.title.startsWith(firstUserMessageContent.substring(0,20)))))
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

  const displayMessages: DisplayMessage[] = messages.map((message) => ({
    ...message,
    createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
  }));
  
  const loadConversationsList = useCallback(async () => {
    setIsSidebarLoading(true);
    try {
      const convos = await getConversationsListAction();
      setConversations(convos);
    } catch (e) {
      console.error("Failed to load conversations list:", e);
      // toast.error("Could not load your past conversations."); // Potentially too noisy
    } finally {
      setIsSidebarLoading(false);
    }
  }, []);

  const loadMessagesForSelectedConvo = useCallback(async (convoId: string | null) => {
    if (convoId === null) { 
      setVercelMessages([]);
      setCurrentConversationId(null);
      setInput('');
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('conversationId');
      newParams.delete('prefill'); 
      router.push(`${pathname}${newParams.toString() ? '?' + newParams.toString() : ''}`, { scroll: false });
      inputRef.current?.focus();
      return;
    }
    if (convoId === currentConversationId && messages.length > 0 && !searchParams.get('prefill')) {
      if (isMobileSidebarOpen) setIsMobileSidebarOpen(false);
      inputRef.current?.focus();
      return;
    }
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
      if (isMobileSidebarOpen) setIsMobileSidebarOpen(false); 
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set('conversationId', convoId);
      newParams.delete('prefill'); 
      router.push(`${pathname}?${newParams.toString()}`, { scroll: false });
      inputRef.current?.focus();
    } catch (e) {
      console.error("Failed to load messages for convo " + convoId + ":", e);
      toast.error("Could not load chat history.");
    } finally {
      setIsHistoryLoading(false);
    }
  }, [setVercelMessages, setInput, currentConversationId, messages.length, router, pathname, searchParams, isMobileSidebarOpen]);

  useEffect(() => {
    const convoIdFromUrl = searchParams.get('conversationId');
    const prefillMessageFromUrl = searchParams.get('prefill');
    if (convoIdFromUrl) {
      if (convoIdFromUrl !== currentConversationId) {
        loadMessagesForSelectedConvo(convoIdFromUrl);
      }
      if (prefillMessageFromUrl) {
        const newSp = new URLSearchParams(searchParams.toString());
        newSp.delete('prefill');
        router.replace(`${pathname}?${newSp.toString()}`, { scroll: false });
      }
    } else if (prefillMessageFromUrl) {
      setVercelMessages([]);
      setCurrentConversationId(null); 
      setInput(decodeURIComponent(prefillMessageFromUrl));
      const newSp = new URLSearchParams(searchParams.toString());
      newSp.delete('prefill');
      router.replace(`${pathname}?${newSp.toString()}`, { scroll: false });
      inputRef.current?.focus();
    }
  }, [searchParams]); // Simplified deps, let internal calls manage their own reactive updates.

  useEffect(() => {
    loadConversationsList();
  }, [loadConversationsList]);

  useEffect(() => { // Auto-scroll logic
    const scrollViewport = scrollAreaRef.current?.querySelector('div[style*="overflow: scroll;"]') as HTMLElement;
    if (scrollViewport) {
      const isUserTyping = document.activeElement === inputRef.current && input.length > 0;
      if (isUserTyping && chatIsLoading) { // If user submitted and AI is responding, scroll smoothly
          setTimeout(() => scrollViewport.scrollTo({ top: scrollViewport.scrollHeight, behavior: 'smooth' }), 100);
      } else if (!isUserTyping) { // General scroll for new messages if not actively typing in a way that suggests user wants control
          const lastMessage = displayMessages[displayMessages.length - 1];
          // Scroll if AI just responded or if close to bottom
          const isScrolledToBottom = scrollViewport.scrollHeight - scrollViewport.clientHeight <= scrollViewport.scrollTop + 150;
          if ( (lastMessage?.role === 'assistant' && messages[messages.length -1]?.id === lastMessage.id) || isScrolledToBottom ) {
              scrollViewport.scrollTo({ top: scrollViewport.scrollHeight, behavior: 'smooth' });
          }
      }
    }
  }, [displayMessages, chatIsLoading, input]); // Added input to deps for typing check consideration

  useEffect(() => { // Speech Recognition Effect
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        recognition = new SpeechRecognitionAPI();
        recognition.continuous = false;recognition.interimResults = false; recognition.lang = 'en-US';
        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[event.results.length - 1][0].transcript.trim();
          setInput(prevInput => prevInput ? `${prevInput} ${transcript}` : transcript); setIsListening(false);
        };
        recognition.onerror = (event: Event) => {
          const errorEvent = event as unknown as SpeechRecognitionError;
          toast.error("Voice Error", { description: `Could not recognize speech: ${errorEvent.error}` }); setIsListening(false);
        };
        recognition.onend = () => setIsListening(false);
      } else { console.warn('Speech Recognition API not supported.');}
    }
    return () => {
      if (recognition && isListening) { recognition.stop(); }
      if (audioRef.current) {
        audioRef.current.pause();
        if(audioRef.current.src.startsWith('blob:')) URL.revokeObjectURL(audioRef.current.src);
        audioRef.current.src = '';
      }
    };
  }, [setInput, isListening]);

  const toggleVoiceInput = () => {
    if (!recognition) { toast.error("Voice input is not supported by your browser."); return; }
    if (isListening) { recognition.stop(); } else {
      try { setIsListening(true); setInput(''); recognition.start(); toast.info("Listening...", { duration: 3500 });
      } catch (e) { toast.error("Voice Error", { description: "Could not start voice input." }); setIsListening(false); }
    }
  };
  const playNovaResponse = async (textToSpeak: string) => { 
    if (isSpeaking && audioRef.current) { 
        audioRef.current.pause();
        if(audioRef.current.src.startsWith('blob:')) URL.revokeObjectURL(audioRef.current.src);
        audioRef.current.src = ""; setIsSpeaking(false);
    }
    setIsSpeaking(true);
    try {
        const response = await fetch('/api/tts/nova-speak', {method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: textToSpeak })});
        if (!response.ok || !response.body) {
            const errorData = response.headers.get('content-type')?.includes('application/json') ? await response.json() : { error: `TTS service failed: ${response.statusText || response.status}` };
            throw new Error(errorData.error || `TTS service failed`);
        }
        const audioBlob = await response.blob(); const audioUrl = URL.createObjectURL(audioBlob);
        if (!audioRef.current) { audioRef.current = new Audio(); }
        const audio = audioRef.current; audio.src = audioUrl;
        audio.play().catch(e => { console.error("Audio play error:", e); toast.error("Playback Error", { description: "Could not play Nova's voice. Check audio settings."}); setIsSpeaking(false); URL.revokeObjectURL(audioUrl); });
        audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(audioUrl); };
        audio.onerror = (e) => { console.error("Audio element error:", e); toast.error("Audio Error", { description: "Error with Nova's voice playback."}); setIsSpeaking(false); URL.revokeObjectURL(audioUrl); };
    } catch (error: any) { console.error("playNovaResponse error:", error); toast.error("TTS Failed", { description: error.message || "Could not generate Nova's voice."}); setIsSpeaking(false); }
  };
  const toggleTTS = () => { 
    setIsTTSEnabled(prev => {
      const newState = !prev;
      if (!newState && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause(); if(audioRef.current.src.startsWith('blob:')) URL.revokeObjectURL(audioRef.current.src);
        audioRef.current.src = ""; setIsSpeaking(false);
      }
      toast.info(newState ? "Nova's voice enabled" : "Nova's voice disabled"); return newState;
    });
  };
  useEffect(() => { 
    return () => {
      if (audioRef.current) {
        audioRef.current.pause(); if(audioRef.current.src.startsWith('blob:')) URL.revokeObjectURL(audioRef.current.src);
        audioRef.current.src = '';
      }
    };
  }, []);

  const handleNewConversation = () => { loadMessagesForSelectedConvo(null); };
  const customSubmit = (e: React.FormEvent<HTMLFormElement>) => { 
    e.preventDefault(); if (!input.trim()) return; 
    handleSubmit(e, { body: { conversationId: currentConversationId }});
  };

  return (
    <div className="flex h-screen antialiased text-slate-800 dark:text-slate-100 bg-white dark:bg-neutral-900">
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={toggleSidebar} 
        />
      )}
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-72 bg-neutral-50 dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700/60 flex flex-col transition-transform duration-300 ease-in-out md:sticky md:translate-x-0 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 flex-shrink-0 border-b border-neutral-200 dark:border-neutral-700/60">
          <Button 
            onClick={handleNewConversation} 
            className={`w-full h-10 bg-[${BRAND_ORANGE}] hover:bg-orange-500 text-white font-medium transition-all duration-200 rounded-md shadow-sm hover:shadow focus-visible:ring-2 focus-visible:ring-[${BRAND_ORANGE}] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800`}
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        </div>

        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700/60 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Recent</h3>
             <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar} 
              className="md:hidden h-8 w-8 rounded-md text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
              aria-label="Close sidebar"
            >
              <MenuIcon className="h-5 w-5" /> 
            </Button>
          </div>
        </div>
        
        <ScrollArea className="flex-1 min-h-0">
            <div className="p-2 space-y-1">
                {(isSidebarLoading && conversations.length === 0) && (
                    Array.from({ length: 7 }).map((_, i) => (
                        <Skeleton key={i} className="h-9 w-full rounded bg-neutral-200 dark:bg-neutral-700" />
                    ))
                )}
                {(!isSidebarLoading && conversations.length === 0) && (
                    <div className="text-center py-8 px-4">
                        <MessageSquare className="mx-auto h-8 w-8 text-neutral-400 dark:text-neutral-500" />
                        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">No chats yet.</p>
                    </div>
                )}
                {conversations.map((convo) => (
                    <Button
                        key={convo.id}
                        variant="ghost"
                        className={`w-full justify-start items-center h-auto py-2 px-3 text-sm truncate rounded-md transition-colors duration-150 text-left focus-visible:ring-1 focus-visible:ring-[${BRAND_ORANGE}]
                            ${currentConversationId === convo.id 
                            ? `bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 font-medium`
                            : `text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/70`
                        }`}
                        onClick={() => loadMessagesForSelectedConvo(convo.id)}
                    >
                       <MessageSquare className="h-4 w-4 mr-2.5 text-neutral-500 dark:text-neutral-400 flex-shrink-0" />
                       <span className="truncate block flex-1">{convo.title || "Untitled Chat"}</span>
                    </Button>
                ))}
            </div>
        </ScrollArea>
        {/* Sidebar Footer - Optional, e.g. for settings or user profile */}
        <div className="p-3 border-t border-neutral-200 dark:border-neutral-700/60 mt-auto flex-shrink-0">
            <Button variant="ghost" className="w-full justify-start text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/70 rounded-md">
                <Settings2 className="h-4 w-4 mr-2.5 text-neutral-500 dark:text-neutral-400"/> Settings
            </Button>
        </div>
      </div> {/* End Sidebar */}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col max-h-screen overflow-hidden"> {/* Ensure main area also controls its overflow */}
        {/* Chat Header - Minimal */}
        <div className="h-16 flex-shrink-0 border-b border-neutral-200 dark:border-neutral-700/60 flex items-center px-6">
          <div className="flex items-center gap-3 w-full">
              <Button variant="ghost" size="icon" onClick={toggleSidebar} className="md:hidden h-9 w-9 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md" aria-label="Open sidebar">
                  <MenuIcon className="h-5 w-5" />
              </Button>
              <h2 className="text-base font-semibold text-neutral-700 dark:text-neutral-200 truncate flex-1">
                  {currentConversationId 
                      ? conversations.find(c => c.id === currentConversationId)?.title || "Chat"
                      : "AI Assistant"
                  }
              </h2>
              <div className="flex items-center gap-2">
                  <Button 
                      variant={isTTSEnabled ? "subtle" : "outline"}
                      style={isTTSEnabled ? { backgroundColor: `rgba(2, 46, 125, 0.1)`, color: BRAND_BLUE, borderColor: `rgba(2, 46, 125, 0.2)` } : {borderColor: "hsl(var(--border))"}}
                      size="icon" 
                      onClick={toggleTTS}
                      className={`h-9 w-9 rounded-md tts-toggle-button transition-all text-neutral-500 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200`}
                      aria-label={isTTSEnabled ? "Disable Voice" : "Enable Voice"}
                  >
                      {isSpeaking ? <Volume2Icon className="h-4 w-4 animate-pulse" /> : (isTTSEnabled ? <Volume2Icon className="h-4 w-4" /> : <VolumeXIcon className="h-4 w-4" />)}
                  </Button>
              </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          <ScrollArea className="h-full" viewportRef={scrollAreaRef}>
            <div className="max-w-3xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
              {isHistoryLoading && (
                <div className="space-y-5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className={`flex items-start gap-3 ${i % 2 !== 0 ? 'justify-end' : ''}`}>
                      {i % 2 === 0 && <Skeleton className="h-9 w-9 rounded-full bg-neutral-200 dark:bg-neutral-700" />}
                      <div className={`flex flex-col gap-1.5 items-start ${i % 2 !== 0 ? 'order-first items-end' : ''}`}>
                        <Skeleton className="h-5 w-32 rounded bg-neutral-200 dark:bg-neutral-700" />
                        <Skeleton className="h-5 w-48 rounded bg-neutral-200 dark:bg-neutral-700" />
                      </div>
                      {i % 2 !== 0 && <Skeleton className="h-9 w-9 rounded-full bg-neutral-200 dark:bg-neutral-700" />}
                    </div>
                  ))}
                </div>
              )}

              {!isHistoryLoading && displayMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-300px)] text-center px-4 pt-10">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 bg-[${BRAND_ORANGE}]/10`}>
                    <MessageSquare className={`w-8 h-8 text-[${BRAND_ORANGE}]`} />
                  </div>
                  <h2 className="text-xl font-semibold text-neutral-700 dark:text-neutral-200 mb-2">
                    {currentConversationId ? "Empty Conversation" : "How can I help you today?"}
                  </h2>
                  {/* Suggestion chips - example */}
                  {!currentConversationId && (
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                        {["Explain quantum computing", "Recipe for banana bread", "Debug my Python code"].map(prompt => (
                            <Button key={prompt} variant="outline" size="sm" className="bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700" onClick={() => setInput(prompt)}>
                                {prompt}
                            </Button>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {!isHistoryLoading && displayMessages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 mb-5 ${msg.role === "user" ? "justify-end" : "items-start"}`}>
                  {msg.role !== "user" && (
                    <Avatar className="h-8 w-8 md:h-9 md:w-9 flex-shrink-0 shadow-sm">
                      <AvatarImage src="/nova-avatar.png" alt="Nova" />
                      <AvatarFallback className={`bg-[${BRAND_ORANGE}] text-white font-medium text-sm`}>N</AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`group relative max-w-[85%] md:max-w-[75%] ${msg.role === "user" ? "order-first" : ""}`}>
                    <div className={`px-3.5 py-2.5 rounded-lg shadow-sm 
                      ${ msg.role === "user" 
                          ? `bg-[${BRAND_BLUE}] text-white rounded-br-sm` 
                          : "bg-white dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-600/50 rounded-bl-sm"
                      }`}>
                      {msg.role === "assistant" && messages[messages.length - 1]?.id === msg.id && !chatIsLoading && reload && (
                        <Button 
                          variant="ghost" size="icon" 
                          className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-100/70 dark:bg-neutral-600/70 backdrop-blur-sm border border-neutral-300 dark:border-neutral-500 shadow-md rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-500" 
                          onClick={() => reload()} aria-label="Reload response">
                          <UpdateIcon className="h-3 w-3 text-neutral-500 dark:text-neutral-300" />
                        </Button>
                      )}
                      <ChatMessageContentRenderer content={msg.content} />
                      {msg.createdAt && (
                        <p className={`text-xs mt-2 opacity-60 ${msg.role === "user" ? "text-neutral-300 text-right" : "text-neutral-500 dark:text-neutral-400"}`}>
                          {format(msg.createdAt, "p")}
                        </p>
                      )}
                    </div>
                  </div>
                  {msg.role === "user" && (
                    <Avatar className="h-8 w-8 md:h-9 md:w-9 flex-shrink-0 shadow-sm">
                      <AvatarFallback className="bg-neutral-200 dark:bg-neutral-600 text-neutral-600 dark:text-neutral-300 font-medium text-sm">U</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}

              {chatIsLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex items-start gap-3 mb-5">
                  <Avatar className="h-8 w-8 md:h-9 md:w-9 flex-shrink-0 shadow-sm">
                    <AvatarImage src="/nova-avatar.png" alt="Nova" />
                    <AvatarFallback className={`bg-[${BRAND_ORANGE}] text-white font-medium text-sm`}>N</AvatarFallback>
                  </Avatar>
                  <div className="max-w-[85%] md:max-w-[75%] px-3.5 py-2.5 rounded-lg bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600/50 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className={`w-1.5 h-1.5 bg-[${BRAND_ORANGE}]/50 rounded-full animate-bounce`} style={{ animationDelay: "0s" }} />
                        <div className={`w-1.5 h-1.5 bg-[${BRAND_ORANGE}]/70 rounded-full animate-bounce`} style={{ animationDelay: "0.1s" }} />
                        <div className={`w-1.5 h-1.5 bg-[${BRAND_ORANGE}] rounded-full animate-bounce`} style={{ animationDelay: "0.2s" }} />
                      </div>
                      <p className="text-sm text-neutral-600 dark:text-neutral-300">Thinking...</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Input Area - Styled like ChatGPT/Gemini */}
        <div className="flex-shrink-0 border-t border-neutral-200 dark:border-neutral-700/60 bg-white dark:bg-neutral-800/50 pt-3 pb-4 sm:pt-4 sm:pb-5 px-4">
          <form onSubmit={customSubmit} className="max-w-3xl mx-auto">
            {error && (
              <div className="mb-2 p-2.5 text-sm text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400 border border-red-300 dark:border-red-600 rounded-md">
                <p>{error.message}</p>
              </div>
            )}
            <div className="relative flex items-end p-0.5 border border-neutral-300 dark:border-neutral-600 rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-[${BRAND_ORANGE}] focus-within:border-[${BRAND_ORANGE}] bg-white dark:bg-neutral-700">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                placeholder={isListening ? "Listening..." : "Message AI Assistant..."}
                className="flex-1 min-h-[44px] max-h-48 resize-none border-none focus:ring-0 shadow-none bg-transparent p-3 text-base placeholder:text-neutral-500 dark:placeholder:text-neutral-400 chat-input-textarea"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!chatIsLoading && input.trim()) {
                      const form = e.currentTarget.form;
                      if (form) {
                         const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                         form.dispatchEvent(submitEvent);
                      }
                    }
                  }
                }}
                disabled={chatIsLoading || isHistoryLoading || isListening}
              />
              <div className="flex items-center p-1.5">
                <Button 
                    variant="ghost" size="icon" onClick={toggleVoiceInput}
                    className={`h-9 w-9 rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-600 voice-input-button
                               ${isListening ? `text-[${BRAND_ORANGE}] dark:text-[${BRAND_ORANGE}] bg-neutral-100 dark:bg-neutral-600` : ''}`}
                    type="button" aria-label={isListening ? "Stop Listening" : "Start Voice Input"}
                    disabled={chatIsLoading || isHistoryLoading}>
                    {isListening ? <MicOffIcon className="h-5 w-5" /> : <MicIcon className="h-5 w-5" />}
                </Button>
                <Button
                  type="submit"
                  disabled={chatIsLoading || isHistoryLoading || !input.trim() || isListening}
                  className={`ml-1.5 h-9 w-9 rounded-lg bg-[${BRAND_ORANGE}] hover:bg-orange-500 text-white send-message-button
                              disabled:bg-neutral-200 dark:disabled:bg-neutral-600 disabled:text-neutral-400 dark:disabled:text-neutral-500 disabled:cursor-not-allowed`}
                  aria-label="Send Message" size="icon">
                  <PaperPlaneIcon className="h-4.5 w-4.5" />
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-center text-neutral-500 dark:text-neutral-400">
              AI can make mistakes. Consider checking important information.
            </p>
          </form>
        </div> {/* End Input Area */}
      </div> {/* End Main Chat Area Flex Container */}
    </div> // End Root Div
  );
}
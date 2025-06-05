"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import Vapi from "@vapi-ai/web";
import { startVoiceChatSession, endVoiceChatSession } from "@/app/actions/voiceChatActions";
import {
  ArrowLeft,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Loader2,
  Phone,
  PhoneOff,
  Headphones,
  MessageSquare,
  Clock,
  Signal,
  AlertTriangle,
  Sparkles,
  Zap,
  Activity
} from "lucide-react";

type ConnectionStatus = "idle" | "connecting" | "connected" | "error" | "disconnecting";
type SpeechStatus = "listening" | "speaking" | "processing" | "idle";

interface VoiceChatStats {
  duration: number;
  messagesExchanged: number;
  connectionQuality: "excellent" | "good" | "fair" | "poor";
}

export default function VoiceChatPage() {
  const router = useRouter();
  const [vapiInstance, setVapiInstance] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("Ready to connect with Learnbridge AI");
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<VoiceChatStats>({
    duration: 0,
    messagesExchanged: 0,
    connectionQuality: "excellent"
  });

  // Timer for session duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (connectionStatus === "connected") {
      interval = setInterval(() => {
        setStats(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [connectionStatus]);

  // Cleanup function
  useEffect(() => {
    return () => {
      if (vapiInstance) {
        vapiInstance.stop();
      }
    };
  }, [vapiInstance]);

  const formatDuration = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const getConnectionQualityColor = (quality: string) => {
    switch (quality) {
      case "excellent": return "text-emerald-500";
      case "good": return "text-blue-500";
      case "fair": return "text-amber-500";
      case "poor": return "text-red-500";
      default: return "text-slate-500";
    }
  };

  const startVoiceChat = async () => {
    try {
      setConnectionStatus("connecting");
      setStatusMessage("Initializing voice connection...");
      setError(null);

      // Start a new voice chat session in the database
      const { sessionId: newSessionId, error: sessionError } = await startVoiceChatSession();
      
      if (sessionError) {
        throw new Error(sessionError);
      }
      
      setSessionId(newSessionId);
      setStatusMessage("Connecting to Learnbridge AI's voice system...");

      // Create a new VAPI instance
      const vapi = new Vapi(process.env.NEXT_PUBLIC_VAPI_API_KEY || "");
      
      // Set up event listeners
      vapi.on("call-start", () => {
        setConnectionStatus("connected");
        setSpeechStatus("listening");
        setStatusMessage("Connected! Learnbridge AI is ready to chat");
        setStats(prev => ({ ...prev, duration: 0, messagesExchanged: 0 }));
        toast.success("Connected!", { description: "Voice chat with Learnbridge AI has started" });
      });
      
      vapi.on("call-end", async () => {
        setConnectionStatus("idle");
        setSpeechStatus("idle");
        setStatusMessage("Voice chat ended");
        
        if (newSessionId) {
          await endVoiceChatSession(newSessionId, "completed");
        }
        
        toast.info("Call ended", { description: "Voice chat session has ended" });
      });
      
      vapi.on("error", async (error: any) => {
        console.error("VAPI error:", error);
        const errorMessage = error.message || "Connection failed";
        setError(errorMessage);
        setConnectionStatus("error");
        setSpeechStatus("idle");
        setStatusMessage(`Error: ${errorMessage}`);
        
        if (newSessionId) {
          await endVoiceChatSession(newSessionId, "error", errorMessage);
        }
        
        toast.error("Connection Error", { description: errorMessage });
      });
      
      vapi.on("speech-start", () => {
        setSpeechStatus("speaking");
        setStatusMessage("Learnbridge AI is speaking...");
      });
      
      vapi.on("speech-end", () => {
        setSpeechStatus("listening");
        setStatusMessage("Learnbridge AI is listening...");
      });

      vapi.on("message", (message: any) => {
        if (message.type === 'transcript') {
          setStats(prev => ({ ...prev, messagesExchanged: prev.messagesExchanged + 1 }));
        }
      });

      // Save the instance
      setVapiInstance(vapi);

      // Start the conversation
      await vapi.start(process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || "", {
        variableValues: {
          userName: "User"
        }
      });

    } catch (error) {
      console.error("Failed to start voice chat:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setError(errorMessage);
      setConnectionStatus("error");
      setStatusMessage(`Failed to start: ${errorMessage}`);
      
      if (sessionId) {
        await endVoiceChatSession(sessionId, "error", errorMessage);
      }
      
      toast.error("Connection Failed", { description: errorMessage });
    }
  };

  const endVoiceChat = async () => {
    if (vapiInstance) {
      setConnectionStatus("disconnecting");
      setStatusMessage("Ending voice chat...");
      
      vapiInstance.stop();
      setVapiInstance(null);
      setSpeechStatus("idle");
      
      if (sessionId) {
        await endVoiceChatSession(sessionId, "completed");
        setSessionId(null);
      }
    }
  };

  const toggleMute = () => {
    if (vapiInstance && connectionStatus === "connected") {
      const newMutedState = !isMuted;
      vapiInstance.setMuted(newMutedState);
      setIsMuted(newMutedState);
      setStatusMessage(newMutedState ? "Microphone muted" : "Microphone active");
      toast.info(newMutedState ? "Microphone muted" : "Microphone unmuted");
    }
  };

  const toggleAudio = () => {
    setIsAudioEnabled(!isAudioEnabled);
    const newStatus = !isAudioEnabled ? "Learnbridge AI's voice enabled" : "Learnbridge AI's voice disabled";
    setStatusMessage(newStatus);
    toast.info(newStatus);
    
    if (vapiInstance) {
      vapiInstance.send({
        type: "add-message",
        message: {
          role: "system",
          content: isAudioEnabled ? 
            "Please stop speaking and respond with text only." : 
            "Please resume normal voice responses."
        }
      });
    }
  };

  const getStatusBadgeVariant = () => {
    switch (connectionStatus) {
      case "connected": return "default";
      case "connecting": case "disconnecting": return "secondary";
      case "error": return "destructive";
      default: return "outline";
    }
  };

  const getSpeechIndicator = () => {
    switch (speechStatus) {
      case "speaking": return { 
        color: "bg-gradient-to-r from-blue-400 to-purple-500", 
        animation: "animate-pulse",
        glow: "shadow-lg shadow-blue-500/50"
      };
      case "listening": return { 
        color: "bg-gradient-to-r from-emerald-400 to-teal-500", 
        animation: "animate-pulse",
        glow: "shadow-lg shadow-emerald-500/50"
      };
      case "processing": return { 
        color: "bg-gradient-to-r from-amber-400 to-orange-500", 
        animation: "animate-spin",
        glow: "shadow-lg shadow-amber-500/50"
      };
      default: return { 
        color: "bg-slate-400", 
        animation: "",
        glow: ""
      };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-emerald-400/20 to-blue-600/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-purple-400/10 to-pink-600/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border-b border-slate-200/30 dark:border-slate-700/30 shadow-lg shadow-slate-900/5">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 hover:bg-white/90 hover:scale-105 transition-all duration-200 shadow-lg"
                onClick={() => router.push("/chat")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                  Learnbridge AI Voice Chat
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Real-time AI conversation
                </p>
              </div>
            </div>
            
            {connectionStatus === "connected" && (
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="gap-2 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-slate-200/50 px-3 py-1">
                  <Clock className="h-3 w-3 text-blue-500" />
                  <span className="font-mono">{formatDuration(stats.duration)}</span>
                </Badge>
                <Badge variant="outline" className="gap-2 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-slate-200/50 px-3 py-1">
                  <MessageSquare className="h-3 w-3 text-purple-500" />
                  {stats.messagesExchanged}
                </Badge>
                <Badge variant="outline" className={`gap-2 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-slate-200/50 px-3 py-1 ${getConnectionQualityColor(stats.connectionQuality)}`}>
                  <Signal className="h-3 w-3" />
                  {stats.connectionQuality}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-8 relative">
        {/* Main Voice Interface */}
        <Card className="shadow-2xl border-slate-200/30 dark:border-slate-700/30 bg-white/40 dark:bg-slate-800/40 backdrop-blur-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-white/20 dark:from-slate-800/50 dark:to-slate-800/20 pointer-events-none"></div>
          <CardHeader className="text-center pb-8 relative">
            <div className="flex flex-col items-center gap-6">
              {/* Avatar with enhanced visuals */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full blur-2xl opacity-30 group-hover:opacity-50 transition-opacity duration-500 animate-pulse"></div>
                <Avatar className="w-40 h-40 border-4 border-white/80 dark:border-slate-700/80 shadow-2xl relative z-10 ring-4 ring-white/50 dark:ring-slate-700/50">
                  <AvatarFallback className="text-5xl font-bold bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 text-white">
                    N
                  </AvatarFallback>
                </Avatar>
                
                {/* Enhanced connection indicator */}
                <div className={`absolute bottom-3 right-3 w-8 h-8 rounded-full border-4 border-white dark:border-slate-800 ${getSpeechIndicator().color} ${getSpeechIndicator().animation} ${getSpeechIndicator().glow} z-20`}>
                  {speechStatus === "speaking" && <Volume2 className="h-4 w-4 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />}
                  {speechStatus === "listening" && <Mic className="h-4 w-4 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />}
                  {speechStatus === "processing" && <Activity className="h-4 w-4 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />}
                </div>
                
                {/* Multiple pulse rings for active states */}
                {(speechStatus === "speaking" || speechStatus === "listening") && (
                  <>
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 animate-ping"></div>
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 animate-ping delay-75"></div>
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 animate-ping delay-150"></div>
                  </>
                )}
              </div>

              <div className="space-y-3">
                <Badge 
                  variant={getStatusBadgeVariant()} 
                  className="text-sm px-4 py-2 rounded-full font-medium bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-slate-200/50"
                >
                  {connectionStatus === "connected" && <Zap className="w-3 h-3 mr-1" />}
                  {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
                </Badge>
                <p className="text-base text-slate-700 dark:text-slate-300 max-w-md font-medium">
                  {statusMessage}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-8 relative">
            {/* Error Display */}
            {error && (
              <Alert variant="destructive" className="bg-red-50/80 dark:bg-red-950/30 backdrop-blur-sm border-red-200/50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="font-medium">{error}</AlertDescription>
              </Alert>
            )}

            {/* Enhanced Control Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              {connectionStatus !== "connected" ? (
                <Button
                  onClick={startVoiceChat}
                  disabled={connectionStatus === "connecting" || connectionStatus === "disconnecting"}
                  size="lg"
                  className="h-16 px-10 rounded-2xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 text-white shadow-2xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 transition-all duration-300 font-semibold text-lg border-0"
                >
                  {connectionStatus === "connecting" ? (
                    <>
                      <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Phone className="mr-3 h-6 w-6" />
                      Start Voice Chat
                    </>
                  )}
                </Button>
              ) : (
                <div className="flex items-center gap-4">
                  <Button
                    onClick={toggleMute}
                    variant={isMuted ? "destructive" : "outline"}
                    size="lg"
                    className={`h-16 w-16 rounded-2xl transition-all duration-300 hover:scale-105 ${
                      isMuted 
                        ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30" 
                        : "bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-slate-200/50 hover:bg-white/90 shadow-lg"
                    }`}
                  >
                    {isMuted ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
                  </Button>
                  
                  <Button
                    onClick={toggleAudio}
                    variant={!isAudioEnabled ? "destructive" : "outline"}
                    size="lg"
                    className={`h-16 w-16 rounded-2xl transition-all duration-300 hover:scale-105 ${
                      !isAudioEnabled 
                        ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30" 
                        : "bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-slate-200/50 hover:bg-white/90 shadow-lg"
                    }`}
                  >
                    {isAudioEnabled ? <Volume2 className="h-7 w-7" /> : <VolumeX className="h-7 w-7" />}
                  </Button>
                  
                  <Button
                    onClick={endVoiceChat}
                    variant="destructive"
                    size="lg"
                    className="h-16 px-8 rounded-2xl bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 shadow-lg shadow-red-500/30 hover:shadow-red-500/40 hover:scale-105 transition-all duration-300 font-semibold"
                  >
                    <PhoneOff className="mr-3 h-6 w-6" />
                    End Chat
                  </Button>
                </div>
              )}
            </div>

            {/* Enhanced Session Stats */}
            {connectionStatus === "connected" && (
              <Card className="bg-gradient-to-br from-slate-50/80 to-white/80 dark:from-slate-900/80 dark:to-slate-800/80 backdrop-blur-sm border-slate-200/30 dark:border-slate-700/30 shadow-xl">
                <CardContent className="p-6">
                  <div className="grid grid-cols-3 gap-6 text-center">
                    <div className="space-y-2">
                      <div className="p-3 bg-blue-500/10 rounded-2xl inline-block">
                        <Clock className="h-6 w-6 text-blue-500" />
                      </div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {formatDuration(stats.duration)}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Duration</p>
                    </div>
                    <div className="space-y-2">
                      <div className="p-3 bg-purple-500/10 rounded-2xl inline-block">
                        <MessageSquare className="h-6 w-6 text-purple-500" />
                      </div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {stats.messagesExchanged}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Messages</p>
                    </div>
                    <div className="space-y-2">
                      <div className="p-3 bg-emerald-500/10 rounded-2xl inline-block">
                        <Signal className="h-6 w-6 text-emerald-500" />
                      </div>
                      <p className={`text-2xl font-bold capitalize ${getConnectionQualityColor(stats.connectionQuality)}`}>
                        {stats.connectionQuality}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Quality</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {/* Enhanced Tips Section */}
        <Card className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-2xl border-slate-200/30 dark:border-slate-700/30 shadow-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent dark:from-slate-800/30 pointer-events-none"></div>
          <CardHeader className="relative">
            <CardTitle className="text-xl flex items-center gap-3 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl">
                <Headphones className="h-5 w-5 text-white" />
              </div>
              Tips for the Best Experience
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                {[
                  "Speak naturally and clearly as if talking to a friend",
                  "Use headphones to prevent echo and improve audio quality",
                  "Find a quiet environment for clearer conversation"
                ].map((tip, index) => (
                  <div key={index} className="flex items-start gap-4 p-3 rounded-xl bg-gradient-to-r from-blue-50/80 to-purple-50/80 dark:from-blue-950/30 dark:to-purple-950/30 border border-blue-200/30 dark:border-blue-800/30">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                      {tip}
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                {[
                  "Use the mute button when you need a moment to think",
                  "Toggle audio if you prefer text-only responses",
                  "Learnbridge AI can help with learning, questions, and conversations"
                ].map((tip, index) => (
                  <div key={index} className="flex items-start gap-4 p-3 rounded-xl bg-gradient-to-r from-purple-50/80 to-pink-50/80 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-200/30 dark:border-purple-800/30">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                      {tip}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
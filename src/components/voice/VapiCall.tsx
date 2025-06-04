// src/components/voice/VapiCall.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Vapi from "@vapi-ai/web"; // Vapi Web SDK
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { 
  Phone, 
  Mic, 
  MicOff, 
  PhoneOff, 
  AlertTriangle, 
  Loader2, 
  UserCircle,
  MessageSquare,
  Clock,
  Sparkles,
  Volume2,
  Zap,
  VideoOff,
  MoreHorizontal,
  Speaker
} from "lucide-react";

const vapiPublicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
let vapiInstance: Vapi | null = null; // Keep instance outside component to persist

if (typeof window !== "undefined" && vapiPublicKey && !vapiInstance) {
  try {
    vapiInstance = new Vapi(vapiPublicKey);
  } catch (e) {
    console.error("Failed to initialize Vapi SDK:", e);
  }
}

interface VapiCallProps {
  assistantId: string;
  cogniSparkUserId?: string;
  userName?: string;
  userGrade?: string;
  userSubjects?: string[];
}

type CallStatus = "idle" | "connecting" | "connected" | "error" | "ended";

interface Transcript {
  speaker: string;
  text: string;
  timestamp: Date;
}

export default function VapiCall({ 
  assistantId, 
  cogniSparkUserId,
  userName = "Student", 
  userGrade, 
  userSubjects 
}: VapiCallProps) {
  const [isCalling, setIsCalling] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const callDurationInterval = useRef<NodeJS.Timeout | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  useEffect(() => {
    if (!vapiInstance) {
      console.error("VapiCall: Vapi SDK not initialized.");
      setCallError("Voice service not available. Public key might be missing.");
      return;
    }

    const onCallStart = () => {
      console.log("VapiCall Component: Call Started");
      setCallStatus("connected");
      setIsCalling(true);
      setIsLoading(false);
      setCallError(null);
      setTranscripts([]);
      setCallDuration(0);
      
      callDurationInterval.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      
      toast.success("Call started", { description: "Connected to Nova successfully!" });
    };

    const onCallEnd = () => {
      console.log("VapiCall Component: Call Ended");
      setCallStatus("ended");
      setIsCalling(false);
      setIsLoading(false);
      setIsMuted(false);
      
      if (callDurationInterval.current) {
        clearInterval(callDurationInterval.current);
      }
      
      toast.info("Call ended", { description: "Voice conversation has ended." });
      
      // Reset to idle after a brief delay
      setTimeout(() => setCallStatus("idle"), 2000);
    };

    const onError = (e: any) => {
      const errorMessage = e?.message || e?.toString() || "Unknown Vapi error";
      console.error("VapiCall Component: Error", errorMessage, e);
      setCallStatus("error");
      setCallError(errorMessage);
      setIsCalling(false);
      setIsLoading(false);
      
      if (callDurationInterval.current) {
        clearInterval(callDurationInterval.current);
      }
      
      toast.error("Voice Call Error", { description: errorMessage });
    };
    
    const onMessage = (message: any) => {
      if (message.type === 'transcript' && message.transcriptType === 'final') {
        const speaker = message.role === 'user' ? userName : 'Nova';
        const newTranscript: Transcript = {
          speaker,
          text: message.transcript,
          timestamp: new Date()
        };
        setTranscripts(prev => [...prev, newTranscript]);
      }
    };

    vapiInstance.on("call-start", onCallStart);
    vapiInstance.on("call-end", onCallEnd);
    vapiInstance.on("error", onError);
    vapiInstance.on("message", onMessage);

    return () => {
      vapiInstance?.removeListener("call-start", onCallStart);
      vapiInstance?.removeListener("call-end", onCallEnd);
      vapiInstance?.removeListener("error", onError);
      vapiInstance?.removeListener("message", onMessage);
      
      if (callDurationInterval.current) {
        clearInterval(callDurationInterval.current);
      }
      
      if (isCalling && vapiInstance) {
        console.log("VapiCall Component: Unmounting, stopping active call if any.");
        vapiInstance.stop();
      }
    };
  }, [isCalling, userName]);

  const startCall = async () => {
    if (!vapiInstance) {
      setCallError("Vapi service not properly initialized.");
      toast.error("Voice Service Error", { 
        description: "Could not initialize voice service." 
      });
      return;
    }
    
    if (isCalling || isLoading) return;

    setCallStatus("connecting");
    setIsLoading(true);
    setCallError(null);

    try {
      const assistantOverrides = {
        variableValues: {
          cogniSparkUserId: cogniSparkUserId || null,
          userName: userName || "Student",
          userGrade: userGrade || "Not Specified",
          userSubjects: userSubjects?.join(", ") || "General learning"
        }
      };

      await vapiInstance.start(assistantId, assistantOverrides);
    } catch (error) {
      console.error("Failed to start call:", error);
      setCallStatus("error");
      setIsLoading(false);
      setCallError("Failed to start voice call");
      toast.error("Connection Failed", { 
        description: "Could not start voice conversation." 
      });
    }
  };

  const stopCall = () => {
    if (!vapiInstance || !isCalling) return;
    vapiInstance.stop();
  };

  const toggleMute = () => {
    if (!vapiInstance || !isCalling) return;
    const newMutedState = !isMuted;
    vapiInstance.setMuted(newMutedState);
    setIsMuted(newMutedState);
    
    toast.info(newMutedState ? "Microphone muted" : "Microphone unmuted");
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!vapiPublicKey) {
    return (
      <div className="max-w-md mx-auto">
        <Card className="border-red-200 bg-red-50/80 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg text-gray-900">Voice Service Unavailable</h3>
                <p className="text-sm text-gray-600">
                  Please check the Vapi Public Key in your environment variables to enable voice conversations.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // WhatsApp-like Call Interface
  if (isCalling) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-[#022e7d] via-blue-700 to-gray-900">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 2px, transparent 2px)',
            backgroundSize: '60px 60px'
          }} />
        </div>

        {/* Header */}
        <div className="relative flex items-center justify-between p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm font-medium opacity-90">Voice Call Active</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>

        {/* Main Call Area */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center relative">
          {/* Nova Avatar */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-[#fd6a3e] to-orange-400 rounded-full blur-3xl opacity-30 animate-pulse" />
            <div className="relative w-40 h-40 bg-gradient-to-br from-[#fd6a3e] to-orange-500 rounded-full shadow-2xl flex items-center justify-center">
              <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <UserCircle className="h-20 w-20 text-white" />
              </div>
            </div>
            {/* Audio visualization rings */}
            <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping" />
            <div className="absolute inset-4 rounded-full border-2 border-white/20 animate-ping animation-delay-75" />
          </div>

          {/* Call Info */}
          <div className="text-white space-y-2 mb-8">
            <h2 className="text-3xl font-bold">Nova AI</h2>
            <p className="text-lg opacity-80">Your Learning Assistant</p>
            <div className="flex items-center justify-center gap-2 text-sm opacity-70">
              <Clock className="h-4 w-4" />
              <span>{formatDuration(callDuration)}</span>
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2 text-white/80 mb-12">
            <Volume2 className="h-5 w-5 animate-bounce" />
            <span className="text-sm font-medium">Speaking...</span>
          </div>
        </div>

        {/* Call Controls */}
        <div className="relative p-8">
          <div className="flex items-center justify-center gap-8">
            {/* Mute Button */}
            <Button
              onClick={toggleMute}
              size="lg"
              className={`w-16 h-16 rounded-full shadow-2xl transition-all duration-300 ${
                isMuted 
                  ? 'bg-gray-600 hover:bg-gray-700 text-white' 
                  : 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm'
              }`}
            >
              {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </Button>

            {/* End Call Button */}
            <Button
              onClick={stopCall}
              size="lg"
              className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95"
            >
              <PhoneOff className="h-8 w-8" />
            </Button>

            {/* Speaker Button */}
            <Button
              size="lg"
              className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm shadow-2xl transition-all duration-300"
            >
              <Speaker className="h-6 w-6" />
            </Button>
          </div>

          {/* Control Labels */}
          <div className="flex items-center justify-center gap-8 mt-4 text-xs text-white/60">
            <span className="w-16 text-center">{isMuted ? 'Unmute' : 'Mute'}</span>
            <span className="w-20 text-center">End Call</span>
            <span className="w-16 text-center">Speaker</span>
          </div>
        </div>

        {/* Error Display */}
        {callError && (
          <div className="absolute bottom-32 left-4 right-4">
            <Alert className="bg-red-500/20 border-red-400 text-white backdrop-blur-sm">
              <AlertTriangle className="h-5 w-5" />
              <AlertDescription>{callError}</AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    );
  }

  // Pre-call Interface
  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Main Call Setup Card */}
      <Card className="relative overflow-hidden shadow-2xl border-0 bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-900 dark:to-slate-800/80 backdrop-blur-xl">
        {/* Brand Color Accent */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#fd6a3e] to-[#022e7d]" />
        
        <CardHeader className="text-center pb-6 pt-8">
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#fd6a3e]/20 to-[#022e7d]/20 blur-xl animate-pulse" />
            <div className="relative bg-gradient-to-br from-[#fd6a3e] to-[#022e7d] p-6 rounded-full shadow-lg text-white">
              <UserCircle className="h-12 w-12" />
            </div>
          </div>
          
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
            Voice Call with Nova
          </CardTitle>
          
          <CardDescription className="text-base mt-2 text-gray-600 dark:text-gray-300">
            Your AI Learning Assistant
          </CardDescription>

          {userName && userGrade && (
            <div className="mt-4 p-3 bg-gradient-to-r from-[#fd6a3e]/10 to-[#022e7d]/10 rounded-lg">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Ready for <span className="text-[#fd6a3e] font-semibold">{userName}</span> • Grade {userGrade}
              </p>
            </div>
          )}
        </CardHeader>

        <CardContent className="px-8 pb-8">
          <div className="space-y-6">
            {/* Connection Status */}
            <div className="flex items-center justify-center">
              <Badge 
                variant="secondary"
                className="px-4 py-2 bg-gradient-to-r from-emerald-100 to-blue-100 text-emerald-700 border-0"
              >
                <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse" />
                Ready to Connect
              </Badge>
            </div>

            {/* Start Call Button */}
            <Button 
              onClick={startCall} 
              className="w-full h-16 text-lg font-semibold bg-gradient-to-r from-[#fd6a3e] to-[#022e7d] hover:from-[#fd6a3e]/90 hover:to-[#022e7d]/90 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] text-white"
              disabled={isLoading || callStatus === "connecting"}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                  <span>Connecting to Nova...</span>
                </>
              ) : (
                <>
                  <Phone className="mr-3 h-6 w-6" />
                  Start Voice Call
                  <Sparkles className="ml-3 h-5 w-5" />
                </>
              )}
            </Button>

            {/* Features */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="text-center p-3 rounded-lg bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800">
                <Volume2 className="h-6 w-6 mx-auto mb-2 text-[#fd6a3e]" />
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Real-time Voice</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800">
                <MessageSquare className="h-6 w-6 mx-auto mb-2 text-[#022e7d]" />
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Live Transcript</p>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {callError && (
            <Alert className="mt-6 border-red-200 bg-red-50/80">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <AlertDescription className="text-red-700">{callError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Live Transcript Card */}
      {transcripts.length > 0 && (
        <Card className="shadow-xl border-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-[#fd6a3e] to-[#022e7d] rounded-lg text-white">
                <MessageSquare className="h-4 w-4" />
              </div>
              Previous Conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48 w-full rounded-lg border bg-slate-50/50 dark:bg-slate-800/50 p-4">
              <div className="space-y-4">
                {transcripts.map((transcript, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={transcript.speaker === 'Nova' ? 'default' : 'secondary'}
                        className={transcript.speaker === 'Nova' 
                          ? 'bg-gradient-to-r from-[#fd6a3e] to-[#022e7d] text-white' 
                          : 'bg-gray-200 text-gray-700'
                        }
                      >
                        {transcript.speaker}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {transcript.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                      {transcript.text}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
// src/app/chat/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { User } from "@supabase/supabase-js";
import Joyride, { Step } from "react-joyride";

import ChatInterface from "@/components/chat/ChatInterface";
import { useFeatureTour } from "@/hooks/useFeatureTour";

// Define steps for this page's tour
const chatPageTourSteps: Step[] = [
  {
    target: ".chat-input-textarea",
    content: "Type your questions or messages to Nova here. Try asking about any subject!",
    placement: "top",
    disableBeacon: true,
  },
  {
    target: ".voice-input-button",
    content: "Click the microphone to talk to Nova directly using your voice.",
    placement: "left",
  },
  {
    target: ".tts-toggle-button",
    content: "Toggle this to hear Nova's responses spoken aloud with a high-quality voice.",
    placement: "bottom",
  },
  {
    target: ".chat-sidebar-toggle",
    content: "Your past conversations with Nova are saved here. Click to revisit them.",
    placement: "right",
  },
  {
    target: ".send-message-button",
    content: "Click this button to send your message to Nova.",
    placement: "left",
  }
];

export default function ChatPage() {
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [runInitialTour, setRunInitialTour] = useState(false);
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  // Joyride hook
  const { runTour, tourSteps, handleJoyrideCallback } = useFeatureTour({
    tourKey: "chat", // Matches the key in TourCompletionPayload and DB column suffix
    steps: chatPageTourSteps,
    isTourEnabledInitially: runInitialTour // Control when the tour starts
  });

  useEffect(() => {
    const checkUserAndTourStatus = async () => {
      setIsLoadingProfile(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        router.push("/login?message=Please login to chat with Nova.");
        setIsLoadingProfile(false);
        return;
      }
      
      setUser(session.user);

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("tour_completed_chat")
        .eq("id", session.user.id)
        .single();

      if (error && error.code !== "PGRST116") { // PGRST116: row not found
        console.error("Error fetching tour status for chat:", error);
      } else if (profileData && profileData.tour_completed_chat === false) {
        setRunInitialTour(true); // Enable the tour to run via useFeatureTour's useEffect
      } else if (!profileData) { // Profile might not exist yet for a brand new user
        setRunInitialTour(true); // Run tour for brand new users too
      }
      
      setIsLoadingProfile(false);
    };
    
    checkUserAndTourStatus();
  }, [supabase, router]);

  if (isLoadingProfile) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-white via-[#fd6a3e]/5 to-[#022e7d]/5 dark:from-slate-950 dark:via-[#fd6a3e]/10 dark:to-[#022e7d]/10">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#fd6a3e]/20 to-[#022e7d]/20 dark:from-[#fd6a3e]/30 dark:to-[#022e7d]/30 rounded-full mb-4 shadow-md"></div>
          <div className="h-4 w-32 bg-gradient-to-r from-[#fd6a3e]/20 to-[#022e7d]/20 dark:from-[#fd6a3e]/30 dark:to-[#022e7d]/30 rounded mb-2"></div>
          <div className="h-3 w-24 bg-gradient-to-r from-[#fd6a3e]/10 to-[#022e7d]/10 dark:from-[#fd6a3e]/20 dark:to-[#022e7d]/20 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Joyride
        steps={tourSteps}
        run={runTour}
        callback={handleJoyrideCallback}
        continuous={true}
        showProgress={true}
        showSkipButton={true}
        styles={{
          options: {
            zIndex: 10000,
            primaryColor: "#fd6a3e", // Brand orange-red
            secondaryColor: "#022e7d", // Brand navy blue
            backgroundColor: "#ffffff",
            textColor: "#022e7d", // Brand navy blue for text
            arrowColor: "#ffffff",
            overlayColor: "rgba(2, 46, 125, 0.3)", // Semi-transparent navy blue
            spotlightShadow: "0 0 15px rgba(253, 106, 62, 0.5)", // Orange-red shadow around the spotlight
          },
          buttonNext: {
            backgroundColor: "#fd6a3e",
            color: "#ffffff",
            borderRadius: "4px",
            padding: "8px 16px",
            fontWeight: "bold",
          },
          buttonBack: {
            color: "#022e7d",
            marginRight: 10,
          },
          buttonSkip: {
            color: "#022e7d",
          },
        }}
      />
      <div className="flex-grow flex flex-col">
        <ChatInterface />
      </div>
    </>
  );
}

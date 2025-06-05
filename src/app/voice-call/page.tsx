// src/app/voice-call/page.tsx
"use client"; // Because we might fetch profile client-side to pass to VapiCall

import VapiCall from "@/components/voice/VapiCall";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";

interface UserProfileForVapi {
    fullName?: string | null;
    gradeLevel?: string | null;
    subjectsOfInterest?: string[] | null;
}

export default function VoiceCallPage() {
  // Replace with your actual Vapi Assistant ID for Learnbridge AI
  const NOVA_VAPI_ASSISTANT_ID = process.env.NEXT_PUBLIC_NOVA_VAPI_ASSISTANT_ID || "YOUR_ASSISTANT_ID_FALLBACK";
  // ^^^ Consider putting this in .env.local as NEXT_PUBLIC_NOVA_VAPI_ASSISTANT_ID

  const [userProfile, setUserProfile] = useState<UserProfileForVapi | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const supabase = createPagesBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // State to store the Supabase user object
  const [cogniSparkUser, setCogniSparkUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchUserForVapi = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCogniSparkUser(session.user);
        
        // Fetch profile data
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, grade_level, subjects_of_interest')
          .eq('id', session.user.id)
          .single();
        
        setUserProfile({
            fullName: profileData?.full_name,
            gradeLevel: profileData?.grade_level,
            subjectsOfInterest: profileData?.subjects_of_interest as string[] || []
        });
      }
      setIsLoadingProfile(false);
    };
    fetchUserForVapi();
  }, [supabase]);

  if (isLoadingProfile) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin"/></div>;
  }
  
  if (!NOVA_VAPI_ASSISTANT_ID || NOVA_VAPI_ASSISTANT_ID === "YOUR_ASSISTANT_ID_FALLBACK") {
    return (
        <div className="container mx-auto py-10 text-center">
            <h1 className="text-2xl font-bold text-destructive">Voice Call Configuration Error</h1>
            <p className="mt-4 text-muted-foreground">The Vapi Assistant ID for Learnbridge AI is not set up correctly.</p>
            <p className="text-xs mt-2">Please set NEXT_PUBLIC_NOVA_VAPI_ASSISTANT_ID in your environment variables.</p>
            <Button asChild className="mt-6"><Link href="/dashboard">Back to Dashboard</Link></Button>
        </div>
    );
  }


  return (
    <div className="container mx-auto py-10 flex flex-col items-center gap-8">
      <div>
        <h1 className="text-3xl font-bold text-center">Real-Time Voice Call with Learnbridge AI</h1>
        <p className="mt-2 text-muted-foreground text-center max-w-md">
          Experience a natural, interruptible conversation with your AI tutor. Just click start and begin talking!
        </p>
      </div>
      <VapiCall
        assistantId={NOVA_VAPI_ASSISTANT_ID}
        cogniSparkUserId={cogniSparkUser?.id} // Pass the ID
        userName={userProfile?.fullName}
        userGrade={userProfile?.gradeLevel}
        userSubjects={userProfile?.subjectsOfInterest}
      />
    </div>
  );
}
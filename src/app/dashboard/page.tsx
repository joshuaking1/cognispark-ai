"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, 
  Lightbulb, 
  MessageSquare, 
  BookOpen, 
  FileText, 
  Brain, 
  LogOut,
  Clock
} from "lucide-react";
import LearningPlanGenerator, { LearningPlan } from "@/components/dashboard/LearningPlanGenerator";
import ChatMessageContentRenderer from "@/components/chat/ChatMessageContentRenderer";
import { updateUserProfile } from "@/app/actions/userSettingsActions";
import OnboardingDialog from "@/components/onboarding/OnboardingDialog";

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
  grade_level: string | null;
  subjects_of_interest: string[] | null;
  has_completed_onboarding: boolean | null;
}

interface User {
  id: string;
  email?: string;
}

interface RecentActivity {
  id: string;
  type: 'chat' | 'flashcard' | 'note';
  title: string;
  created_at: string;
  preview?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [learningPlan, setLearningPlan] = useState<LearningPlan | null>(null);
  const [learningPlanError, setLearningPlanError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push("/login");
          return;
        }
        setUser(session.user as User);

        // Fetch profile
        const { data: profileData } = await supabase
    .from('profiles')
          .select('full_name, avatar_url, grade_level, subjects_of_interest, has_completed_onboarding')
          .eq('id', session.user.id)
    .single();
        setProfile(profileData);

        // Fetch recent activity
        const [chatResult, flashcardResult, noteResult] = await Promise.all([
          supabase
            .from('conversations')
            .select('id, title, created_at, last_message')
            .eq('user_id', session.user.id)
            .order('updated_at', { ascending: false })
            .limit(3),
          supabase
            .from('flashcard_sets')
            .select('id, title, created_at')
            .eq('user_id', session.user.id)
            .order('updated_at', { ascending: false })
            .limit(3),
          supabase
            .from('smart_notes')
            .select('id, title, created_at, content')
            .eq('user_id', session.user.id)
            .order('updated_at', { ascending: false })
            .limit(3)
        ]);

        const activities: RecentActivity[] = [
          ...(chatResult.data?.map(chat => ({
            id: chat.id,
            type: 'chat' as const,
            title: chat.title,
            created_at: chat.created_at,
            preview: chat.last_message
          })) || []),
          ...(flashcardResult.data?.map(set => ({
            id: set.id,
            type: 'flashcard' as const,
            title: set.title,
            created_at: set.created_at
          })) || []),
          ...(noteResult.data?.map(note => ({
            id: note.id,
            type: 'note' as const,
            title: note.title,
            created_at: note.created_at,
            preview: note.content?.substring(0, 100)
          })) || [])
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
         .slice(0, 5);

        setRecentActivity(activities);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
    
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') router.push('/login');
      else if (session?.user) setUser(session.user as User);
      else setUser(null);
    });

    return () => authListener?.subscription.unsubscribe();
  }, [supabase, router]);

  useEffect(() => {
    if (profile && profile.has_completed_onboarding === false && !isLoading) {
      setShowOnboarding(true);
    }
  }, [profile, isLoading]);

  const handlePlanGenerated = (plan: LearningPlan | null, error?: string) => {
    setLearningPlan(plan);
    setLearningPlanError(error || null);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    if (user) {
      try {
        await updateUserProfile({ has_completed_onboarding: true });
      } catch (e) {
        console.error("Failed to update onboarding status:", e);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <div className="p-8 text-center">Redirecting to login...</div>;
  }

  const features = [
    {
      title: "Chat with Nova",
      description: "Ask questions and get instant help",
      icon: <MessageSquare className="h-6 w-6" />,
      href: "/chat"
    },
    {
      title: "Smart Notes",
      description: "Create and organize your study notes",
      icon: <FileText className="h-6 w-6" />,
      href: "/notes"
    },
    {
      title: "Flashcards",
      description: "Create and review flashcards",
      icon: <Brain className="h-6 w-6" />,
      href: "/flashcards"
    },
    {
      title: "Study Resources",
      description: "Access learning materials",
      icon: <BookOpen className="h-6 w-6" />,
      href: "/resources"
    }
  ];

  return (
    <div className="flex flex-col gap-10 p-4 md:p-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback>{profile?.full_name?.[0] || user.email?.[0] || '?'}</AvatarFallback>
            </Avatar>
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {profile?.full_name || 'Student'}!</h1>
            <p className="text-muted-foreground">
              {profile?.grade_level || 'Grade not set'} • {profile?.subjects_of_interest?.join(', ') || 'No subjects selected'}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
      </div>

      {/* Learning Plan Section */}
      <section>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl flex items-center">
              <Lightbulb className="mr-3 h-6 w-6 text-yellow-500" /> Your Personalized Learning Plan
            </CardTitle>
            <CardDescription>
              Tell Nova your current learning goal, or let it suggest a plan based on your profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LearningPlanGenerator onPlanGenerated={handlePlanGenerated} />
            {learningPlanError && (
              <p className="mt-4 text-sm text-destructive">{learningPlanError}</p>
            )}
            {learningPlan && (
              <div className="mt-6 pt-6 border-t">
                {learningPlan.introduction && (
                  <p className="mb-4 text-muted-foreground italic">{learningPlan.introduction}</p>
                )}
                <h3 className="text-lg font-semibold mb-3">Here&apos;s your suggested plan:</h3>
                <ul className="space-y-3">
                  {learningPlan.steps.map((step) => (
                    <li key={step.id} className="p-3 border rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                      <strong className="font-medium text-primary">{step.title}</strong>
                      {step.description && (
                        <ChatMessageContentRenderer content={step.description} />
                      )}
                      {step.action_link && (
                        <Button asChild variant="link" size="sm" className="px-0 h-auto mt-1">
                          <Link href={step.action_link} target={step.action_link.startsWith('http') ? '_blank' : '_self'}>
                            {step.action_link.startsWith('http') 
                              ? `Go to ${step.resource_type || 'Resource'}`
                              : "Let&apos;s do this!"}
          </Link>
            </Button>
                      )}
                    </li>
                  ))}
                </ul>
                {learningPlan.conclusion && (
                  <p className="mt-4 text-muted-foreground italic">{learningPlan.conclusion}</p>
                )}
        </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Quick Access Features */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Quick Access</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature) => (
            <Link key={feature.title} href={feature.href}>
              <Card className="h-full hover:bg-muted/50 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="font-medium">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Activity */}
        <section>
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px]">
              {recentActivity.length > 0 ? (
                <div className="divide-y">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {activity.type === 'chat' && <MessageSquare className="h-5 w-5 text-blue-500" />}
                          {activity.type === 'flashcard' && <Brain className="h-5 w-5 text-green-500" />}
                          {activity.type === 'note' && <FileText className="h-5 w-5 text-purple-500" />}
                      <div>
                            <h3 className="font-medium">{activity.title}</h3>
                            {activity.preview && (
                              <p className="text-sm text-muted-foreground line-clamp-2">{activity.preview}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {new Date(activity.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
            ))}
          </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  No recent activity to show.
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
        </section>

      {/* Replace Welcome Modal with Onboarding Dialog */}
      <OnboardingDialog 
        isOpen={showOnboarding} 
        onClose={handleOnboardingComplete} 
      />
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Loader2, 
  Lightbulb, 
  MessageSquare, 
  BookOpen, 
  FileText, 
  Brain, 
  LogOut,
  ArrowRight,
  Calendar,
  Clock,
  Sparkles,
  Settings,
  Camera,
  HelpCircle
} from "lucide-react";
import LearningPlanGenerator, { LearningPlan } from "@/components/dashboard/LearningPlanGenerator";
import ChatMessageContentRenderer from "@/components/chat/ChatMessageContentRenderer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { updateUserProfile } from "@/app/actions/userSettingsActions";
import { saveActiveLearningPlanAction, markLearningPlanStepAction, clearActiveLearningPlanAction } from "@/app/actions/learningPlanActions";
import { motion, AnimatePresence } from "framer-motion";
import OnboardingDialog from "@/components/onboarding/OnboardingDialog";

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
  grade_level: string | null;
  subjects_of_interest: string[] | null;
  has_completed_onboarding: boolean | null;
  active_learning_plan: LearningPlan | null;
  active_plan_completed_steps: string[] | null;
}

interface User {
  id: string;
  email?: string;
}

interface RecentActivity {
  id: string;
  type: 'flashcard' | 'chat' | 'quiz';
  title: string;
  timestamp: string;
  details?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [learningPlan, setLearningPlan] = useState<LearningPlan | null>(null);
  const [activePlan, setActivePlan] = useState<LearningPlan | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
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

        // Fetch profile with active plan
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, grade_level, subjects_of_interest, has_completed_onboarding, active_learning_plan, active_plan_completed_steps')
          .eq('id', session.user.id)
          .single();
        
        setProfile(profileData);
        if (profileData?.active_learning_plan) {
          setActivePlan(profileData.active_learning_plan as LearningPlan);
          setCompletedSteps(profileData.active_plan_completed_steps || []);
        } else {
          setActivePlan(null);
          setCompletedSteps([]);
        }

        // Fetch recent activity
        const { data: activityData } = await supabase
          .from('recent_activity')
          .select('*')
          .eq('user_id', session.user.id)
          .order('timestamp', { ascending: false })
          .limit(5);

        setRecentActivity(activityData || []);

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
    if (profile && !profile.has_completed_onboarding) {
      setShowOnboarding(true);
    }
  }, [profile]);

  const handlePlanGenerated = async (plan: LearningPlan | null, error?: string) => {
    if (error) { 
      toast.error("Plan Error", { description: error }); 
      return; 
    }
    if (plan) {
      setLearningPlan(plan); // Show the newly generated plan
    }
  };

  const handleActivatePlan = async () => {
    if (!learningPlan) return;
    const result = await saveActiveLearningPlanAction(learningPlan);
    if (result.success) {
      toast.success("Learning plan activated!");
      setActivePlan(learningPlan);
      setCompletedSteps([]);
      setLearningPlan(null);
    } else {
      toast.error("Failed to activate plan", { description: result.error });
    }
  };

  const handleClearActivePlan = async () => {
    const result = await clearActiveLearningPlanAction();
    if (result.success) {
      setActivePlan(null);
      setCompletedSteps([]);
      toast.info("Active learning plan cleared.");
    } else {
      toast.error("Failed to clear plan", { description: result.error });
    }
  };

  const toggleStepCompletion = async (stepId: string) => {
    const isCurrentlyCompleted = completedSteps.includes(stepId);
    const newCompletedStatus = !isCurrentlyCompleted;

    // Optimistic UI update
    const newCompletedSteps = newCompletedStatus
      ? [...completedSteps, stepId]
      : completedSteps.filter(id => id !== stepId);
    setCompletedSteps(newCompletedSteps);

    const result = await markLearningPlanStepAction(stepId, newCompletedStatus);
    if (!result.success) {
      toast.error("Failed to update step", { description: result.error });
      // Revert optimistic update
      setCompletedSteps(completedSteps);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Determine which plan to display
  const displayPlan = activePlan || learningPlan;
  const isGeneratedPlanPendingActivation = learningPlan && !activePlan;

  return (
    <div className="flex flex-col gap-10 p-4 md:p-8">
      {/* Header Section */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback>
              {profile?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">
              Welcome back, {profile?.full_name || user.email?.split('@')[0] || 'User'}!
            </h1>
            <p className="text-muted-foreground">
              {profile?.grade_level ? `Grade ${profile.grade_level}` : 'No grade level set'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
          <Button variant="outline" onClick={() => supabase.auth.signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </section>

      {/* Learning Plan Section */}
      <section>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl flex items-center">
              <Lightbulb className="mr-3 h-6 w-6 text-yellow-500" />
              {activePlan ? "Your Active Learning Plan" : "Generate a Learning Plan"}
            </CardTitle>
            {!activePlan && <CardDescription>Tell Nova your goal or let it suggest a plan.</CardDescription>}
          </CardHeader>
          <CardContent>
            {!activePlan && !learningPlan && (
              <LearningPlanGenerator onPlanGenerated={handlePlanGenerated} />
            )}

            {displayPlan && (
              <div className="mt-4 pt-4 border-t">
                {displayPlan.introduction && (
                  <p className="mb-4 text-muted-foreground italic">{displayPlan.introduction}</p>
                )}
                <h3 className="text-lg font-semibold mb-3">
                  {isGeneratedPlanPendingActivation ? "Suggested Plan (Not Active Yet):" : "Current Steps:"}
                </h3>
                <ul className="space-y-3">
                  {displayPlan.steps.map((step) => {
                    const isCompleted = completedSteps.includes(step.id);
                    return (
                      <li 
                        key={step.id} 
                        className={`p-3 border rounded-md transition-colors ${
                          isCompleted 
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' 
                            : 'bg-muted/30 hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {activePlan === displayPlan && (
                            <Checkbox
                              id={`step-${step.id}`}
                              checked={isCompleted}
                              onCheckedChange={() => toggleStepCompletion(step.id)}
                              className="mt-1"
                            />
                          )}
                          <div className="flex-grow">
                            <Label 
                              htmlFor={`step-${step.id}`} 
                              className={`font-medium text-primary cursor-pointer ${
                                isCompleted ? 'line-through text-muted-foreground' : ''
                              }`}
                            >
                              {step.title}
                            </Label>
                            {step.description && (
                              <div className={`text-sm mt-1 ${
                                isCompleted ? 'text-muted-foreground' : 'text-foreground/80'
                              }`}>
                                <ChatMessageContentRenderer content={step.description} />
                              </div>
                            )}
                            {step.action_link && (
                              <Button 
                                asChild 
                                variant="link" 
                                size="sm" 
                                className="px-0 h-auto mt-1 text-xs"
                              >
                                <Link 
                                  href={step.action_link} 
                                  target={step.action_link.startsWith('http') ? '_blank' : '_self'}
                                >
                                  {step.action_link.startsWith('http') 
                                    ? `Go to ${step.resource_type || 'Resource'}` 
                                    : "Let's do this!"}
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {displayPlan.conclusion && (
                  <p className="mt-4 text-muted-foreground italic">{displayPlan.conclusion}</p>
                )}

                {isGeneratedPlanPendingActivation && learningPlan && (
                  <div className="mt-6 flex gap-2">
                    <Button onClick={handleActivatePlan}>
                      <Sparkles className="mr-2 h-4"/>Activate This Plan
                    </Button>
                    <Button variant="outline" onClick={() => setLearningPlan(null)}>
                      Dismiss Suggestion
                    </Button>
                  </div>
                )}
                {activePlan && !learningPlan && (
                  <Button 
                    variant="outline" 
                    onClick={handleClearActivePlan} 
                    className="mt-6"
                  >
                    Clear Active Plan & Generate New
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Quick Access Features */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <Link href="/flashcards" className="block p-6">
            <CardHeader className="p-0">
              <CardTitle className="text-lg flex items-center">
                <BookOpen className="mr-2 h-5 w-5 text-blue-500" />
                Flashcards
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 mt-2">
              <p className="text-sm text-muted-foreground">
                Review and create flashcards
              </p>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <Link href="/chat" className="block p-6">
            <CardHeader className="p-0">
              <CardTitle className="text-lg flex items-center">
                <MessageSquare className="mr-2 h-5 w-5 text-green-500" />
                Chat with Nova
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 mt-2">
              <p className="text-sm text-muted-foreground">
                Ask questions and get help
              </p>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <Link href="/quiz" className="block p-6">
            <CardHeader className="p-0">
              <CardTitle className="text-lg flex items-center">
                <FileText className="mr-2 h-5 w-5 text-purple-500" />
                Take a Quiz
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 mt-2">
              <p className="text-sm text-muted-foreground">
                Test your knowledge
              </p>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <Link href="/settings" className="block p-6">
            <CardHeader className="p-0">
              <CardTitle className="text-lg flex items-center">
                <Settings className="mr-2 h-5 w-5 text-gray-500" />
                Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 mt-2">
              <p className="text-sm text-muted-foreground">
                Manage your preferences
              </p>
            </CardContent>
          </Link>
        </Card>
      </section>

      {/* Recent Activity */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              {recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-4 p-3 rounded-lg bg-muted/30">
                      <div className="mt-1">
                        {activity.type === 'flashcard' && <BookOpen className="h-5 w-5 text-blue-500" />}
                        {activity.type === 'chat' && <MessageSquare className="h-5 w-5 text-green-500" />}
                        {activity.type === 'quiz' && <FileText className="h-5 w-5 text-purple-500" />}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{activity.title}</h4>
                        {activity.details && (
                          <p className="text-sm text-muted-foreground mt-1">{activity.details}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(activity.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No recent activity
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </section>

      {/* Onboarding Dialog */}
      <OnboardingDialog
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
        onComplete={async (data) => {
          const result = await updateUserProfile({
            fullName: data.full_name,
            date_of_birth: data.date_of_birth,
            grade_level: data.grade_level,
            subjects_of_interest: data.subjects_of_interest,
            has_completed_onboarding: true
          });
          
          if (result.success) {
            setProfile(prev => prev ? { ...prev, ...data, has_completed_onboarding: true } : null);
            toast.success("Profile updated successfully!");
          } else {
            toast.error("Failed to update profile", { description: result.error });
          }
        }}
      />
    </div>
  );
}
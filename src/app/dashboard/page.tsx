"use client";

import React from "react";
import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  HelpCircle,
  TrendingUp,
  Target,
  Award,
  Users,
  ChevronRight,
  PlayCircle,
  CheckCircle2,
  Star,
  Zap
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
  const [stats, setStats] = useState({
    totalFlashcards: 0,
    totalChats: 0,
    totalQuizzes: 0,
    masteryLevel: 0
  });

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
          .from('activity_log')
          .select('*')
          .eq('user_id', session.user.id)
          .order('timestamp', { ascending: false })
          .limit(5);

        setRecentActivity(activityData || []);

        // Fetch stats
        const { count: flashcardCount } = await supabase
          .from('flashcards')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', session.user.id);

        const { count: chatCount } = await supabase
          .from('chat_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', session.user.id);

        const { count: quizCount } = await supabase
          .from('quiz_attempts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', session.user.id);

        setStats({
          totalFlashcards: flashcardCount || 0,
          totalChats: chatCount || 0,
          totalQuizzes: quizCount || 0,
          masteryLevel: 75 // This would be calculated based on actual performance
        });

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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const calculatePlanProgress = () => {
    if (!activePlan || activePlan.steps.length === 0) return 0;
    return Math.round((completedSteps.length / activePlan.steps.length) * 100);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 space-y-8">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        
        {/* Stats Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <div>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Determine which plan to display
  const displayPlan = activePlan || learningPlan;
  const isGeneratedPlanPendingActivation = learningPlan && !activePlan;
  const planProgress = calculatePlanProgress();

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {getGreeting()}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}!
          </h1>
          <p className="text-muted-foreground">
            Ready to continue your learning journey?
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push('/chat')} size="lg">
            <MessageSquare className="mr-2 h-4 w-4" />
            Start Learning
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Flashcards</p>
                <h3 className="text-2xl font-bold">{stats.totalFlashcards}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  <TrendingUp className="h-3 w-3 inline mr-1" />
                  +12% this week
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Chat Sessions</p>
                <h3 className="text-2xl font-bold">{stats.totalChats}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  <TrendingUp className="h-3 w-3 inline mr-1" />
                  +5% this week
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Quizzes</p>
                <h3 className="text-2xl font-bold">{stats.totalQuizzes}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  <TrendingUp className="h-3 w-3 inline mr-1" />
                  +8% this week
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Mastery Level</p>
                <h3 className="text-2xl font-bold">{stats.masteryLevel}%</h3>
                <Progress value={stats.masteryLevel} className="mt-2 h-2" />
              </div>
              <div className="h-12 w-12 bg-gradient-to-br from-orange-400 to-pink-500 rounded-lg flex items-center justify-center">
                <Award className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Learning Plan Section */}
        <div className="lg:col-span-2">
          <Card className="h-fit">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
                    <Lightbulb className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">
                      {activePlan ? "Your Learning Plan" : "Generate Learning Plan"}
                    </CardTitle>
                    <CardDescription>
                      {activePlan 
                        ? `${planProgress}% complete • ${completedSteps.length}/${activePlan.steps.length} steps done`
                        : "Let Nova create a personalized learning plan for you"
                      }
                    </CardDescription>
                  </div>
                </div>
                {activePlan && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                )}
              </div>
              {activePlan && (
                <Progress value={planProgress} className="h-2" />
              )}
            </CardHeader>
            <CardContent>
              {!activePlan && !learningPlan && (
                <LearningPlanGenerator onPlanGenerated={handlePlanGenerated} />
              )}

              {displayPlan && (
                <div className="space-y-4">
                  {displayPlan.introduction && (
                    <Alert>
                      <Sparkles className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        {displayPlan.introduction}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-3">
                    {displayPlan.steps.map((step, index) => {
                      const isCompleted = completedSteps.includes(step.id);
                      return (
                        <Card 
                          key={step.id} 
                          className={`transition-all duration-200 ${
                            isCompleted 
                              ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' 
                              : 'hover:shadow-md'
                          }`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              {activePlan === displayPlan ? (
                                <Checkbox
                                  id={`step-${step.id}`}
                                  checked={isCompleted}
                                  onCheckedChange={() => toggleStepCompletion(step.id)}
                                  className="mt-1"
                                />
                              ) : (
                                <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center mt-1 text-xs font-medium">
                                  {index + 1}
                                </div>
                              )}
                              <div className="flex-grow space-y-2">
                                <Label 
                                  htmlFor={`step-${step.id}`} 
                                  className={`font-medium cursor-pointer ${
                                    isCompleted ? 'line-through text-muted-foreground' : ''
                                  }`}
                                >
                                  {step.title}
                                </Label>
                                {step.description && (
                                  <div className={`text-sm ${
                                    isCompleted ? 'text-muted-foreground' : 'text-muted-foreground'
                                  }`}>
                                    <ChatMessageContentRenderer content={step.description} />
                                  </div>
                                )}
                                {step.action_link && (
                                  <Button 
                                    asChild 
                                    variant="link" 
                                    size="sm" 
                                    className="h-auto p-0 text-xs"
                                  >
                                    <Link 
                                      href={step.action_link} 
                                      target={step.action_link.startsWith('http') ? '_blank' : '_self'}
                                      className="flex items-center gap-1"
                                    >
                                      <PlayCircle className="h-3 w-3" />
                                      {step.action_link.startsWith('http') 
                                        ? `Go to ${step.resource_type || 'Resource'}` 
                                        : "Let's do this!"}
                                    </Link>
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {displayPlan.conclusion && (
                    <Alert>
                      <Target className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        {displayPlan.conclusion}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Separator />

                  <div className="flex gap-3">
                    {isGeneratedPlanPendingActivation && learningPlan && (
                      <>
                        <Button onClick={handleActivatePlan} className="flex-1">
                          <Zap className="mr-2 h-4 w-4" />
                          Activate This Plan
                        </Button>
                        <Button variant="outline" onClick={() => setLearningPlan(null)}>
                          Dismiss
                        </Button>
                      </>
                    )}
                    {activePlan && !learningPlan && (
                      <Button 
                        variant="outline" 
                        onClick={handleClearActivePlan}
                      >
                        Generate New Plan
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>Jump into your favorite activities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild variant="ghost" className="w-full justify-start h-12">
                <Link href="/flashcards">
                  <BookOpen className="mr-3 h-5 w-5 text-blue-500" />
                  <div className="text-left">
                    <div className="font-medium">Study Flashcards</div>
                    <div className="text-xs text-muted-foreground">Review your cards</div>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4" />
                </Link>
              </Button>
              
              <Button asChild variant="ghost" className="w-full justify-start h-12">
                <Link href="/chat">
                  <MessageSquare className="mr-3 h-5 w-5 text-green-500" />
                  <div className="text-left">
                    <div className="font-medium">Chat with Nova</div>
                    <div className="text-xs text-muted-foreground">Ask questions</div>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4" />
                </Link>
              </Button>
              
              <Button asChild variant="ghost" className="w-full justify-start h-12">
                <Link href="/quiz">
                  <FileText className="mr-3 h-5 w-5 text-purple-500" />
                  <div className="text-left">
                    <div className="font-medium">Take Quiz</div>
                    <div className="text-xs text-muted-foreground">Test knowledge</div>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4" />
                </Link>
              </Button>
              
              <Button asChild variant="ghost" className="w-full justify-start h-12">
                <Link href="/settings">
                  <Settings className="mr-3 h-5 w-5 text-gray-500" />
                  <div className="text-left">
                    <div className="font-medium">Settings</div>
                    <div className="text-xs text-muted-foreground">Preferences</div>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <CardDescription>Your latest learning sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] pr-4">
                {recentActivity.length > 0 ? (
                  <div className="space-y-4">
                    {recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center">
                          {activity.type === 'flashcard' && <BookOpen className="h-4 w-4 text-blue-500" />}
                          {activity.type === 'chat' && <MessageSquare className="h-4 w-4 text-green-500" />}
                          {activity.type === 'quiz' && <FileText className="h-4 w-4 text-purple-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{activity.title}</p>
                          {activity.details && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{activity.details}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(activity.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">No recent activity</p>
                    <p className="text-xs mt-1">Start learning to see your progress here</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

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
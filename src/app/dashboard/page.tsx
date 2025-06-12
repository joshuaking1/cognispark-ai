"use client";

import React from "react";
import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check } from "lucide-react";

import OnboardingDialog from "@/components/onboarding/OnboardingDialog";
import LearningPlanGenerator, {
  LearningPlan,
  LearningPlanItem,
} from "@/components/dashboard/LearningPlanGenerator";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
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
  Zap,
} from "lucide-react";
import { getActiveTipOfTheDayAction } from "@/app/actions/adminActions"; // Action to fetch tip
import ChatMessageContentRenderer from "@/components/chat/ChatMessageContentRenderer";

interface AppSnippet {
  // Type for the tip
  title?: string | null;
  content: string;
  link_url?: string | null;
  snippet_type: string;
}
import { updateUserProfile } from "@/app/actions/userSettingsActions";
import {
  saveActiveLearningPlanAction,
  markLearningPlanStepAction,
  clearActiveLearningPlanAction,
} from "@/app/actions/learningPlanActions";
import { motion, AnimatePresence } from "framer-motion";

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
  grade_level: string | null;
  subjects_of_interest: string[] | null;
  has_completed_onboarding: boolean | null;
  active_learning_plan: LearningPlan | null;
  active_plan_completed_steps: string[] | null;
  role?: "student" | "teacher" | "admin" | null;
}

interface User {
  id: string;
  email?: string;
}

interface RecentActivity {
  id: string;
  type: "flashcard" | "chat" | "quiz";
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
  const [activeTip, setActiveTip] = useState<AppSnippet | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showLearningPlanGenerator, setShowLearningPlanGenerator] =
    useState(false);
  const [stats, setStats] = useState({
    totalFlashcards: 0,
    totalChats: 0,
    totalQuizzes: 0,
    masteryLevel: 0,
  });

  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push("/login");
          return;
        }
        setUser(session.user as User);

        // Fetch profile with active plan
        const { data: profileData } = await supabase
          .from("profiles")
          .select(
            "full_name, avatar_url, grade_level, subjects_of_interest, has_completed_onboarding, active_learning_plan, active_plan_completed_steps"
          )
          .eq("id", session.user.id)
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
          .from("activity_log")
          .select("*")
          .eq("user_id", session.user.id)
          .order("timestamp", { ascending: false })
          .limit(5);

        setRecentActivity(activityData || []);

        // Fetch active tip
        getActiveTipOfTheDayAction().then((result) => {
          if (result.tip) {
            setActiveTip(result.tip as AppSnippet); // Cast to AppSnippet
          }
        });

        // Fetch stats
        const { count: flashcardCount } = await supabase
          .from("flashcards")
          .select("*", { count: "exact", head: true })
          .eq("user_id", session.user.id);

        const { count: chatCount } = await supabase
          .from("chat_sessions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", session.user.id);

        const { count: quizCount } = await supabase
          .from("quiz_attempts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", session.user.id);

        setStats({
          totalFlashcards: flashcardCount || 0,
          totalChats: chatCount || 0,
          totalQuizzes: quizCount || 0,
          masteryLevel: 75, // This would be calculated based on actual performance
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") router.push("/login");
        else if (session?.user) setUser(session.user as User);
        else setUser(null);
      }
    );

    return () => authListener?.subscription.unsubscribe();
  }, [supabase, router]);

  useEffect(() => {
    if (profile && !profile.has_completed_onboarding) {
      setShowOnboarding(true);
    }
  }, [profile]);

  const handlePlanGenerated = async (
    plan: LearningPlan | null,
    error?: string
  ) => {
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
      : completedSteps.filter((id) => id !== stepId);
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
      <div className="flex flex-col gap-10 p-4 md:p-8">
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
          {/* Quick Actions */}
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-[#022e7d]/5 via-white to-[#fd6a3e]/5 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800">
              <CardTitle className="text-lg font-bold bg-gradient-to-r from-[#022e7d] to-[#fd6a3e] bg-clip-text text-transparent">
                Quick Actions
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Get started with these activities
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="justify-start p-4 h-auto border border-slate-200 dark:border-slate-700 hover:border-[#fd6a3e]/30 dark:hover:border-[#fd6a3e]/30 hover:bg-gradient-to-r hover:from-[#fd6a3e]/5 hover:to-transparent shadow-sm hover:shadow-md transition-all duration-300"
                  asChild
                >
                  <Link href="/chat">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#fd6a3e] to-[#ff8c69] flex items-center justify-center shadow-sm mr-3">
                      <MessageSquare className="h-4 w-4 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-[#022e7d] dark:text-[#fd6a3e]">
                        Chat with Learnbridge AI
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        Ask questions or brainstorm ideas
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  className="justify-start p-4 h-auto border border-slate-200 dark:border-slate-700 hover:border-[#022e7d]/30 dark:hover:border-[#022e7d]/30 hover:bg-gradient-to-r hover:from-[#022e7d]/5 hover:to-transparent shadow-sm hover:shadow-md transition-all duration-300"
                  asChild
                >
                  <Link href="/flashcards">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#022e7d] to-[#1e3a8a] flex items-center justify-center shadow-sm mr-3">
                      <BookOpen className="h-4 w-4 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-[#022e7d] dark:text-[#fd6a3e]">
                        Study Flashcards
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        Review your learning material
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  className="justify-start p-4 h-auto border border-slate-200 dark:border-slate-700 hover:border-[#fd6a3e]/30 dark:hover:border-[#fd6a3e]/30 hover:bg-gradient-to-r hover:from-[#fd6a3e]/5 hover:to-transparent shadow-sm hover:shadow-md transition-all duration-300"
                  asChild
                >
                  <Link href="/quiz">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#fd6a3e] to-[#ff8c69] flex items-center justify-center shadow-sm mr-3">
                      <FileText className="h-4 w-4 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-[#022e7d] dark:text-[#fd6a3e]">
                        Take a Quiz
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        Test your knowledge
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  className="justify-start p-4 h-auto border border-slate-200 dark:border-slate-700 hover:border-[#022e7d]/30 dark:hover:border-[#022e7d]/30 hover:bg-gradient-to-r hover:from-[#022e7d]/5 hover:to-transparent shadow-sm hover:shadow-md transition-all duration-300"
                  asChild
                >
                  <Link href="/settings">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#022e7d] to-[#1e3a8a] flex items-center justify-center shadow-sm mr-3">
                      <Settings className="h-4 w-4 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-[#022e7d] dark:text-[#fd6a3e]">
                        Settings
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        Customize your experience
                      </div>
                    </div>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          {[1, 2, 3].map((i) => (
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
      {/* === Active Tip of the Day Section === */}
      {activeTip && (
        <section className="mb-6">
          <Card className="bg-gradient-to-br from-[#fd6a3e]/10 via-white to-[#022e7d]/10 dark:from-[#fd6a3e]/20 dark:via-slate-800 dark:to-[#022e7d]/20 border-[#fd6a3e]/20 shadow-lg rounded-xl overflow-hidden">
            <CardHeader className="pb-3 pt-4 px-5 relative">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#fd6a3e]/10 to-[#022e7d]/10 rounded-full -translate-y-20 translate-x-20 z-0" />
              <CardTitle className="text-lg font-semibold text-[#022e7d] dark:text-[#fd6a3e] flex items-center relative z-10">
                <div className="mr-3 h-8 w-8 rounded-full bg-gradient-to-br from-[#fd6a3e] to-[#ff8c69] flex items-center justify-center shadow-md">
                  <Lightbulb className="h-4 w-4 text-white animate-pulse" />
                </div>
                {activeTip.title || "Nova's Tip of the Day!"}
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none px-5 pb-4 text-slate-700 dark:text-slate-300 relative z-10">
              <ChatMessageContentRenderer content={activeTip.content} />
              {activeTip.link_url && (
                <a
                  href={activeTip.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#fd6a3e] hover:text-[#e55a2e] hover:underline text-xs block mt-2 font-medium flex items-center group transition-colors"
                >
                  Learn More{" "}
                  <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
                </a>
              )}
            </CardContent>
          </Card>
        </section>
      )}
      {/* === END Tip of the Day Section === */}

      {/* Welcome Header */}
      <div className="relative rounded-xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#022e7d]/5 via-white to-[#fd6a3e]/5 dark:from-slate-800/50 dark:via-slate-900 dark:to-slate-800/50 z-0"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#fd6a3e]/10 via-transparent to-transparent z-0"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 relative z-10">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-[#022e7d] to-[#fd6a3e] bg-clip-text text-transparent">
              {getGreeting()}
              {profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
              !
            </h1>
            <p className="text-slate-600 dark:text-slate-300">
              Ready to continue your learning journey?
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => router.push("/chat")}
              size="lg"
              className="bg-gradient-to-r from-[#fd6a3e] to-[#ff8c69] hover:from-[#e55a2e] hover:to-[#fd6a3e] text-white shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Start Learning
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
          <div className="absolute inset-0 bg-gradient-to-br from-[#022e7d]/5 via-white to-white dark:from-[#022e7d]/20 dark:via-slate-800 dark:to-slate-800 opacity-80 group-hover:opacity-100 transition-opacity"></div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-[radial-gradient(circle_at_center,rgba(2,46,125,0.1),transparent_70%)] rounded-full -translate-y-12 translate-x-12"></div>
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#022e7d] dark:text-blue-300">
                  Flashcards
                </p>
                <h3 className="text-2xl font-bold">{stats.totalFlashcards}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <TrendingUp className="h-3 w-3 inline mr-1 text-[#fd6a3e]" />
                  +12% this week
                </p>
              </div>
              <div className="h-12 w-12 bg-gradient-to-br from-[#022e7d] to-[#1e3a8a] rounded-lg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
          <div className="absolute inset-0 bg-gradient-to-br from-[#fd6a3e]/5 via-white to-white dark:from-[#fd6a3e]/20 dark:via-slate-800 dark:to-slate-800 opacity-80 group-hover:opacity-100 transition-opacity"></div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-[radial-gradient(circle_at_center,rgba(253,106,62,0.1),transparent_70%)] rounded-full -translate-y-12 translate-x-12"></div>
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#fd6a3e] dark:text-orange-300">
                  Chat Sessions
                </p>
                <h3 className="text-2xl font-bold">{stats.totalChats}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <TrendingUp className="h-3 w-3 inline mr-1 text-[#022e7d]" />
                  +5% this week
                </p>
              </div>
              <div className="h-12 w-12 bg-gradient-to-br from-[#fd6a3e] to-[#ff8c69] rounded-lg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
          <div className="absolute inset-0 bg-gradient-to-br from-[#022e7d]/5 via-white to-white dark:from-[#022e7d]/20 dark:via-slate-800 dark:to-slate-800 opacity-80 group-hover:opacity-100 transition-opacity"></div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-[radial-gradient(circle_at_center,rgba(2,46,125,0.1),transparent_70%)] rounded-full -translate-y-12 translate-x-12"></div>
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#022e7d] dark:text-blue-300">
                  Quizzes
                </p>
                <h3 className="text-2xl font-bold">{stats.totalQuizzes}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <TrendingUp className="h-3 w-3 inline mr-1 text-[#fd6a3e]" />
                  +8% this week
                </p>
              </div>
              <div className="h-12 w-12 bg-gradient-to-br from-[#022e7d] to-[#1e3a8a] rounded-lg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <FileText className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
          <div className="absolute inset-0 bg-gradient-to-br from-[#fd6a3e]/5 via-white to-white dark:from-[#fd6a3e]/20 dark:via-slate-800 dark:to-slate-800 opacity-80 group-hover:opacity-100 transition-opacity"></div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-[radial-gradient(circle_at_center,rgba(253,106,62,0.1),transparent_70%)] rounded-full -translate-y-12 translate-x-12"></div>
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#fd6a3e] dark:text-orange-300">
                  Mastery Level
                </p>
                <h3 className="text-2xl font-bold">{stats.masteryLevel}%</h3>
                <Progress
                  value={stats.masteryLevel}
                  className="mt-2 h-2 bg-slate-200 dark:bg-slate-700"
                >
                  <div
                    className="h-full bg-gradient-to-r from-[#fd6a3e] to-[#022e7d] rounded-full"
                    style={{ width: `${stats.masteryLevel}%` }}
                  />
                </Progress>
              </div>
              <div className="h-12 w-12 bg-gradient-to-br from-[#fd6a3e] to-[#ff8c69] rounded-lg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
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
          <Card className="h-fit border-0 shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-[#022e7d]/5 via-white to-[#fd6a3e]/5 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#022e7d] to-[#1e3a8a] flex items-center justify-center shadow-md">
                    <Lightbulb className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold bg-gradient-to-r from-[#022e7d] to-[#fd6a3e] bg-clip-text text-transparent">
                      {activePlan
                        ? "Your Learning Plan"
                        : "Generate Learning Plan"}
                    </CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-400">
                      {activePlan
                        ? `${planProgress}% complete • ${completedSteps.length}/${activePlan.steps.length} steps done`
                        : "Let Nova create a personalized learning plan for you"}
                    </CardDescription>
                  </div>
                </div>
                {activePlan && (
                  <Badge
                    variant="secondary"
                    className="bg-gradient-to-r from-[#fd6a3e]/10 to-[#022e7d]/10 text-[#022e7d] dark:text-[#fd6a3e] border border-[#fd6a3e]/20 shadow-sm"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1 text-[#fd6a3e]" />
                    Active
                  </Badge>
                )}
              </div>
              {activePlan && (
                <div className="mt-4 h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#fd6a3e] to-[#022e7d] rounded-full transition-all duration-500"
                    style={{ width: `${planProgress}%` }}
                  />
                </div>
              )}
            </CardHeader>
            <CardContent>
              {!activePlan && !learningPlan && (
                <div className="space-y-6 py-4 relative">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#fd6a3e]/5 to-[#022e7d]/5 rounded-full -translate-y-20 translate-x-20 z-0" />
                  <div className="text-center space-y-4 relative z-10">
                    <div className="h-16 w-16 mx-auto rounded-full bg-gradient-to-br from-[#022e7d]/10 to-[#fd6a3e]/10 dark:from-[#022e7d]/20 dark:to-[#fd6a3e]/20 flex items-center justify-center shadow-md">
                      <Sparkles className="h-8 w-8 text-[#fd6a3e] dark:text-[#fd6a3e]" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium">
                        Ready to start learning?
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                        Get a personalized learning plan based on your interests
                        and goals
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowLearningPlanGenerator(true)}
                    className="w-full bg-gradient-to-r from-[#fd6a3e] to-[#ff8c69] hover:from-[#e55a2e] hover:to-[#fd6a3e] text-white shadow-md hover:shadow-lg transition-all duration-300"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate My Learning Plan
                  </Button>
                </div>
              )}

              {displayPlan && (
                <div className="space-y-4">
                  {displayPlan.introduction && (
                    <Alert className="bg-gradient-to-r from-[#022e7d]/5 to-[#fd6a3e]/5 dark:from-[#022e7d]/10 dark:to-[#fd6a3e]/10 border-[#022e7d]/20 dark:border-[#022e7d]/30 shadow-sm">
                      <Sparkles className="h-4 w-4 text-[#fd6a3e]" />
                      <AlertDescription className="text-sm text-slate-700 dark:text-slate-300">
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
                          className={`transition-all duration-200 border shadow-sm ${
                            isCompleted
                              ? "bg-gradient-to-r from-[#fd6a3e]/5 to-transparent dark:from-[#fd6a3e]/10 dark:to-transparent border-[#fd6a3e]/30 dark:border-[#fd6a3e]/30"
                              : "hover:shadow-md hover:border-[#022e7d]/30 dark:hover:border-[#022e7d]/30"
                          }`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              {activePlan === displayPlan ? (
                                <div className="mt-1">
                                  <div
                                    className={`w-5 h-5 rounded-full flex items-center justify-center shadow-sm ${
                                      isCompleted
                                        ? "bg-gradient-to-r from-[#fd6a3e] to-[#ff8c69] text-white"
                                        : "border border-[#022e7d]/30 dark:border-[#022e7d]/50"
                                    }`}
                                  >
                                    {isCompleted ? (
                                      <Check
                                        className="h-3 w-3"
                                        onClick={() =>
                                          toggleStepCompletion(step.id)
                                        }
                                        style={{ cursor: "pointer" }}
                                      />
                                    ) : (
                                      <div
                                        className="h-3 w-3 rounded-full"
                                        onClick={() =>
                                          toggleStepCompletion(step.id)
                                        }
                                        style={{ cursor: "pointer" }}
                                      />
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="h-5 w-5 rounded-full bg-gradient-to-r from-[#022e7d]/10 to-[#022e7d]/20 dark:from-[#022e7d]/20 dark:to-[#022e7d]/30 flex items-center justify-center mt-1 text-xs font-medium text-[#022e7d] dark:text-blue-300">
                                  {index + 1}
                                </div>
                              )}
                              <div className="flex-grow space-y-2">
                                <Label
                                  htmlFor={`step-${step.id}`}
                                  className={`font-medium cursor-pointer ${
                                    isCompleted
                                      ? "line-through text-slate-500 dark:text-slate-400"
                                      : "text-[#022e7d] dark:text-[#fd6a3e]"
                                  }`}
                                >
                                  {step.title}
                                </Label>
                                {step.description && (
                                  <div
                                    className={`text-sm ${
                                      isCompleted
                                        ? "text-slate-500 dark:text-slate-500"
                                        : "text-slate-600 dark:text-slate-400"
                                    }`}
                                  >
                                    <ChatMessageContentRenderer
                                      content={step.description}
                                    />
                                  </div>
                                )}
                                {step.action_link && (
                                  <Button
                                    asChild
                                    variant="link"
                                    size="sm"
                                    className="h-auto p-0 text-xs text-[#fd6a3e] hover:text-[#e55a2e]"
                                  >
                                    <Link
                                      href={step.action_link}
                                      target={
                                        step.action_link.startsWith("http")
                                          ? "_blank"
                                          : "_self"
                                      }
                                      className="flex items-center gap-1"
                                    >
                                      <PlayCircle className="h-3 w-3" />
                                      {step.action_link.startsWith("http")
                                        ? `Go to ${
                                            step.resource_type || "Resource"
                                          }`
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
                    <Alert className="bg-gradient-to-r from-[#fd6a3e]/5 to-[#022e7d]/5 dark:from-[#fd6a3e]/10 dark:to-[#022e7d]/10 border-[#fd6a3e]/20 dark:border-[#fd6a3e]/30 shadow-sm">
                      <Target className="h-4 w-4 text-[#022e7d]" />
                      <AlertDescription className="text-sm text-slate-700 dark:text-slate-300">
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
                        <Button
                          variant="outline"
                          onClick={() => setLearningPlan(null)}
                        >
                          Dismiss
                        </Button>
                      </>
                    )}
                    {activePlan && !learningPlan && (
                      <Button variant="outline" onClick={handleClearActivePlan}>
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
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-[#022e7d]/5 via-white to-[#fd6a3e]/5 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800">
              <CardTitle className="text-lg font-bold bg-gradient-to-r from-[#022e7d] to-[#fd6a3e] bg-clip-text text-transparent">
                Quick Actions
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Jump into your favorite activities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              <Button
                asChild
                variant="ghost"
                className="w-full justify-start h-14 hover:bg-[#022e7d]/5 dark:hover:bg-[#022e7d]/10 transition-all duration-200 rounded-lg group"
              >
                <Link href="/flashcards">
                  <div className="mr-3 h-10 w-10 rounded-full bg-gradient-to-br from-[#022e7d] to-[#1e3a8a] flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                    <BookOpen className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-[#022e7d] dark:text-[#fd6a3e]">
                      Study Flashcards
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Review your cards
                    </div>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 text-slate-400 group-hover:text-[#fd6a3e] group-hover:translate-x-1 transition-all" />
                </Link>
              </Button>

              <Button
                asChild
                variant="ghost"
                className="w-full justify-start h-14 hover:bg-[#fd6a3e]/5 dark:hover:bg-[#fd6a3e]/10 transition-all duration-200 rounded-lg group"
              >
                <Link href="/chat">
                  <div className="mr-3 h-10 w-10 rounded-full bg-gradient-to-br from-[#fd6a3e] to-[#ff8c69] flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                    <MessageSquare className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-[#fd6a3e] dark:text-[#fd6a3e]">
                      Chat with Learnbridge AI
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Ask questions
                    </div>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 text-slate-400 group-hover:text-[#022e7d] group-hover:translate-x-1 transition-all" />
                </Link>
              </Button>

              <Button
                asChild
                variant="ghost"
                className="w-full justify-start h-14 hover:bg-[#022e7d]/5 dark:hover:bg-[#022e7d]/10 transition-all duration-200 rounded-lg group"
              >
                <Link href="/quiz">
                  <div className="mr-3 h-10 w-10 rounded-full bg-gradient-to-br from-[#022e7d] to-[#1e3a8a] flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-[#022e7d] dark:text-[#fd6a3e]">
                      Take Quiz
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Test knowledge
                    </div>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 text-slate-400 group-hover:text-[#fd6a3e] group-hover:translate-x-1 transition-all" />
                </Link>
              </Button>

              <Button
                asChild
                variant="ghost"
                className="w-full justify-start h-14 hover:bg-[#fd6a3e]/5 dark:hover:bg-[#fd6a3e]/10 transition-all duration-200 rounded-lg group"
              >
                <Link href="/settings">
                  <div className="mr-3 h-10 w-10 rounded-full bg-gradient-to-br from-[#fd6a3e] to-[#ff8c69] flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                    <Settings className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-[#fd6a3e] dark:text-[#fd6a3e]">
                      Settings
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Preferences
                    </div>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 text-slate-400 group-hover:text-[#022e7d] group-hover:translate-x-1 transition-all" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-[#fd6a3e]/5 via-white to-[#022e7d]/5 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800">
              <CardTitle className="text-lg font-bold bg-gradient-to-r from-[#fd6a3e] to-[#022e7d] bg-clip-text text-transparent">
                Recent Activity
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Your latest learning sessions
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <ScrollArea className="h-[300px] pr-4">
                {recentActivity.length > 0 ? (
                  <div className="space-y-4">
                    {recentActivity.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-r from-white to-white/80 dark:from-slate-800/60 dark:to-slate-800/40 hover:shadow-md transition-all duration-300 border border-slate-200 dark:border-slate-700/50 hover:border-[#fd6a3e]/30 dark:hover:border-[#022e7d]/30 group"
                      >
                        <div className="h-10 w-10 rounded-full shadow-md flex items-center justify-center group-hover:scale-110 transition-transform">
                          {activity.type === "flashcard" && (
                            <div className="h-full w-full rounded-full bg-gradient-to-br from-[#022e7d] to-[#1e3a8a] flex items-center justify-center">
                              <BookOpen className="h-5 w-5 text-white" />
                            </div>
                          )}
                          {activity.type === "chat" && (
                            <div className="h-full w-full rounded-full bg-gradient-to-br from-[#fd6a3e] to-[#ff8c69] flex items-center justify-center">
                              <MessageSquare className="h-5 w-5 text-white" />
                            </div>
                          )}
                          {activity.type === "quiz" && (
                            <div className="h-full w-full rounded-full bg-gradient-to-br from-[#022e7d] to-[#1e3a8a] flex items-center justify-center">
                              <FileText className="h-5 w-5 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate group-hover:text-[#022e7d] dark:group-hover:text-[#fd6a3e] transition-colors">
                            {activity.title}
                          </p>
                          {activity.details && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                              {activity.details}
                            </p>
                          )}
                          <p className="text-xs text-slate-500 dark:text-slate-500 mt-2 flex items-center gap-1">
                            <Clock className="h-3 w-3 text-[#fd6a3e]" />
                            {new Date(activity.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 px-4 bg-gradient-to-br from-[#022e7d]/5 to-[#fd6a3e]/5 dark:from-[#022e7d]/10 dark:to-[#fd6a3e]/10 rounded-lg">
                    <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#022e7d]/20 to-[#fd6a3e]/20 dark:from-[#022e7d]/30 dark:to-[#fd6a3e]/30 flex items-center justify-center shadow-md">
                      <Brain className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                    </div>
                    <p className="text-sm font-medium text-[#022e7d] dark:text-[#fd6a3e]">
                      No recent activity
                    </p>
                    <p className="text-xs mt-1 text-slate-600 dark:text-slate-400">
                      Start learning to see your progress here
                    </p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Onboarding Dialog with brand styling */}
      <OnboardingDialog
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
        onComplete={async (data) => {
          const result = await updateUserProfile({
            fullName: data.full_name,
            date_of_birth: data.date_of_birth,
            grade_level: data.grade_level,
            subjects_of_interest: data.subjects_of_interest,
            has_completed_onboarding: true,
          });

          if (result.success) {
            setProfile((prev) =>
              prev ? { ...prev, ...data, has_completed_onboarding: true } : null
            );
            toast.success("Profile updated successfully!");
          } else {
            toast.error("Failed to update profile", {
              description: result.error,
            });
          }
        }}
      />

      {/* Learning Plan Generator with brand styling */}
      {showLearningPlanGenerator && (
        <Dialog
          open={showLearningPlanGenerator}
          onOpenChange={setShowLearningPlanGenerator}
        >
          <DialogContent className="bg-gradient-to-br from-white to-white/95 dark:from-slate-900 dark:to-slate-900/95 max-w-2xl">
            <DialogHeader className="bg-gradient-to-r from-[#fd6a3e]/5 via-white to-[#022e7d]/5 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 p-4 -m-4 mb-4 rounded-t-lg">
              <DialogTitle className="text-xl font-bold bg-gradient-to-r from-[#022e7d] to-[#fd6a3e] bg-clip-text text-transparent">
                Generate Your Learning Plan
              </DialogTitle>
              <DialogDescription className="text-slate-600 dark:text-slate-400">
                Nova will create a personalized learning plan based on your
                interests and goals
              </DialogDescription>
            </DialogHeader>
            <LearningPlanGenerator
              onPlanGenerated={(plan) => {
                if (plan) {
                  setLearningPlan(plan);
                  saveActiveLearningPlanAction(plan).then((result) => {
                    if (result.success) {
                      setActivePlan(plan);
                      setCompletedSteps([]);
                      toast.success("Learning plan created!");
                      setShowLearningPlanGenerator(false);
                    } else {
                      toast.error("Failed to save learning plan", {
                        description: result.error,
                      });
                    }
                  });
                }
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

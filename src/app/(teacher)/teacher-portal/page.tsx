// src/app/(teacher)/teacher-portal/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CalendarDays,
  Edit3,
  BarChart2,
  Users,
  Settings,
  BookOpenCheck,
  ListChecks,
  FileSignature,
  MessageCircleQuestion,
} from "lucide-react";
import { toast } from "sonner";
import { updateUserProfile } from "@/app/actions/userSettingsActions";

interface Profile {
  full_name: string | null;
  has_completed_onboarding: boolean | null;
  role?: "student" | "teacher" | "admin" | null;
}

interface User {
  id: string;
  email?: string;
}

export default function TeacherDashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchData = async () => {
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

        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, has_completed_onboarding, role")
          .eq("id", session.user.id)
          .single();

        setProfile(profileData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [supabase, router]);

  useEffect(() => {
    // Show welcome modal for teachers/admins who haven't completed onboarding
    if (profile && profile.has_completed_onboarding === false && !isLoading) {
      if (profile.role === "teacher" || profile.role === "admin") {
        setShowWelcomeModal(true);
      }
    }
  }, [profile, isLoading]);

  const handleOnboardingComplete = async () => {
    setShowWelcomeModal(false);
    if (user) {
      try {
        await updateUserProfile({ has_completed_onboarding: true });
        setProfile((prev) =>
          prev ? { ...prev, has_completed_onboarding: true } : null
        );
        toast.success("Welcome to the Teacher Portal!");
      } catch (e) {
        console.error("Error updating onboarding status:", e);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const teacherTools = [
    {
      title: "AI Lesson Planner",
      description:
        "Craft dynamic and effective lesson plans with AI assistance, including activity suggestions and differentiation notes.",
      href: "/teacher-portal/lesson-planner",
      icon: CalendarDays,
      cta: "Plan a Lesson",
    },
    {
      title: "Smart Rubric Generator",
      description:
        "Create clear, consistent, and fair rubrics for any assignment, with AI-generated criteria and descriptors.",
      href: "/teacher-portal/rubric-generator", // Future page
      icon: Edit3,
      cta: "Build a Rubric (Soon)",
    },
    {
      title: "Intelligent Assessment Builder",
      description:
        "Quickly create diverse, high-quality assessments with AI-generated questions and answer keys.",
      href: "/teacher-portal/assessment-builder", // Future page
      icon: ListChecks,
      cta: "Create Assessment (Soon)",
    },
    {
      title: "Dynamic TOS Builder",
      description:
        "Automate balanced Table of Specifications creation, aligned with Bloom's Taxonomy and curriculum.",
      href: "/teacher-portal/tos-builder", // Future page
      icon: FileSignature,
      cta: "Build TOS (Soon)",
    },
    // Add more tools as they are built
  ];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          Teacher Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Welcome, {profile?.full_name || "Teacher"}! Access your AI-powered
          productivity tools below.
        </p>
      </section>

      {/* Quick Access Tools Section */}
      <section>
        <h2 className="text-2xl font-semibold mb-6 text-gray-700 dark:text-gray-300">
          Your Teaching Toolkit
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teacherTools.map((tool) => (
            <Card
              key={tool.href}
              className="hover:shadow-lg transition-shadow duration-200 flex flex-col"
            >
              <CardHeader className="flex flex-row items-start gap-4 pb-3">
                {" "}
                {/* items-start for icon alignment */}
                <tool.icon className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
                <div>
                  <CardTitle className="text-xl mb-1">{tool.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {tool.description}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                {/* Additional content or stats for the card can go here */}
              </CardContent>
              <CardFooter>
                <Link href={tool.href} className="w-full">
                  <Button
                    variant="default"
                    className="w-full"
                    disabled={tool.cta.includes("(Soon)")}
                  >
                    {tool.cta}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      {/* Placeholder for other sections like "Recent Activity", "Student Insights (Anonymized)" */}
      {/* <section>
        <h2 className="text-2xl font-semibold mb-4">Recent Activity</h2>
        <p className="text-muted-foreground">Your recently created lesson plans and assessments will appear here.</p>
      </section> */}

      {/* Teacher Welcome Modal */}
      <Dialog
        open={showWelcomeModal}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleOnboardingComplete();
          else setShowWelcomeModal(true);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Welcome to CogniSpark AI Teacher Portal,{" "}
              {profile?.full_name?.split(" ")[0] || "Educator"}!
            </DialogTitle>
          </DialogHeader>
          <DialogDescription className="mt-2">
            Empower your teaching with AI! Here's how to get started:
          </DialogDescription>
          <div className="py-4 space-y-3 text-sm">
            <p>
              🛠️ <strong className="text-primary">AI Teaching Tools:</strong>{" "}
              Access powerful tools like the AI Lesson Planner, Rubric
              Generator, and Assessment Builder right here in the Teacher
              Portal.
            </p>
            <p>
              📚 <strong className="text-primary">Knowledge Base:</strong>{" "}
              {profile?.role === "admin"
                ? "(Admins) Upload curriculum PDFs in the "
                : "Work with your admin to upload curriculum content in the "}
              <Link
                href="/admin/manage-knowledge"
                className="font-medium underline hover:text-primary"
                onClick={handleOnboardingComplete}
              >
                Admin Panel
              </Link>{" "}
              to make Nova even smarter for your context.
            </p>
            <p>
              💡{" "}
              <strong className="text-primary">Student Tools Overview:</strong>{" "}
              Familiarize yourself with student features like AI Chat, Smart
              Notes, and Flashcards to better guide your students.
            </p>
            <p>
              ⚙️ <strong className="text-primary">Set Your Profile:</strong>{" "}
              Don't forget to visit{" "}
              <Link
                href="/settings"
                className="font-medium underline hover:text-primary"
                onClick={handleOnboardingComplete}
              >
                Account Settings
              </Link>{" "}
              to complete your profile.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={handleOnboardingComplete}
              className="w-full sm:w-auto"
            >
              Let's Get Started!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

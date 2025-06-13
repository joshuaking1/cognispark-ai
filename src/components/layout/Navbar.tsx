"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  UserCircle2,
  MessageSquare,
  Menu,
  X,
  LogOut,
  Sparkles,
  ChevronDown,
  Loader2,
  Settings,
  BookOpenCheck,
  GraduationCap, // Using GraduationCap instead of ChalkboardTeacher
  Settings2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Define ProfileData interface
interface ProfileData {
  full_name: string | null;
  avatar_url: string | null;
  role?: "student" | "teacher" | "admin" | null;
}

// Base navigation items for all authenticated users (students)
const baseNavItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/chat", label: "Chat with Nova" },
  { href: "/smart-notes", label: "Smart Notes" },
  { href: "/essay-helper", label: "Essay Helper" },
  { href: "/photo-solver", label: "Photo Solver" },
  { href: "/flashcards", label: "Flashcards" },
  { href: "/quizzes", label: "Quizzes" },
];

// Additional items for teachers
const teacherNavItems = [
  { href: "/teacher-portal", label: "Teacher Portal", icon: GraduationCap },
];

// Additional items for admins
const adminNavItems = [
  { href: "/admin", label: "Admin Panel", icon: Settings2 },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Client-side Supabase instance for checking auth state
  const supabase = createPagesBrowserClient();

  const FEEDBACK_FORM_URL = "https://forms.gle/orhAkMqh49x3XHGU9";

  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const { data: profileDataFromDB, error: profileFetchError } =
          await supabase
            .from("profiles")
            .select("full_name, avatar_url, role")
            .eq("id", currentUser.id)
            .single();

        if (profileFetchError && profileFetchError.code !== "PGRST116") {
          console.error("Navbar: Error fetching profile", profileFetchError);
          setUserProfile(null);
        } else {
          setUserProfile(profileDataFromDB as ProfileData);
        }
      } else {
        setUserProfile(null);
      }
      setIsLoading(false);
    };
    fetchUserData();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        fetchUserData();
        if (event === "SIGNED_OUT") {
          setUserProfile(null);
          router.push("/login");
        }
      }
    );

    const handleProfileUpdate = () => fetchUserData();
    window.addEventListener("profileUpdated", handleProfileUpdate);

    return () => {
      authListener?.subscription.unsubscribe();
      window.removeEventListener("profileUpdated", handleProfileUpdate);
    };
  }, [supabase, router]);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);

      // First check if we have a session
      const { data: sessionData } = await supabase.auth.getSession();

      // If we have a session, try to sign out
      if (sessionData.session) {
        const { error } = await supabase.auth.signOut();
        if (error && error.message !== "Auth session missing!") {
          console.error("Error signing out:", error.message);
        }
      }

      // Clear user state locally regardless of server response
      setUser(null);
      setUserProfile(null);

      // Clear any browser storage
      try {
        localStorage.removeItem("supabase.auth.token");
        // Clear any other auth-related items
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes("supabase") || key.includes("sb-"))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      } catch (e) {
        console.log("LocalStorage clearing error (non-critical):", e);
      }

      // Always redirect to login page
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Error during sign out:", error);
    } finally {
      setIsSigningOut(false);
    }
  };

  // Determine which nav items to display based on user role
  let currentNavItems = user ? baseNavItems : [];
  if (userProfile?.role === "teacher") {
    currentNavItems = [...currentNavItems, ...teacherNavItems];
  }
  if (userProfile?.role === "admin") {
    currentNavItems = [
      ...currentNavItems,
      ...teacherNavItems,
      ...adminNavItems,
    ];
  }

  // Deduplicate and maintain order
  const finalNavLinks = Array.from(
    new Map(currentNavItems.map((item) => [item.href, item])).values()
  );

  // Don't render navbar on login/signup pages if user is not logged in yet
  if (
    (pathname === "/login" || pathname === "/signup") &&
    !user &&
    !isLoading
  ) {
    return null;
  }

  if (isLoading && (pathname === "/login" || pathname === "/signup")) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/30 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/90 dark:border-slate-700/40 dark:bg-slate-900/90 shadow-sm">
        <div className="container flex h-16 items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <img
              src="/LearnBridge logo inverted2.png"
              alt="CogniSpark AI Logo"
              className="h-12"
            />
            <span className="font-bold text-lg bg-gradient-to-r from-[#022e7d] to-[#fd6a3e] bg-clip-text text-transparent">
              CogniSpark AI
            </span>
          </Link>
        </div>
      </header>
    );
  }

  const NavLinks = () => (
    <>
      {finalNavLinks.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`relative px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 hover:scale-105 group flex items-center gap-2 ${
            pathname === item.href
              ? "text-white bg-gradient-to-r from-[#022e7d] to-[#2563eb] shadow-lg shadow-[#022e7d]/25 border border-white/20"
              : "text-slate-700 dark:text-slate-300 hover:text-[#022e7d] dark:hover:text-white hover:bg-gradient-to-r hover:from-slate-50 hover:to-orange-50 dark:hover:from-slate-800 dark:hover:to-slate-700 border border-transparent hover:border-[#fd6a3e]/20"
          }`}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          {item.icon && <item.icon className="h-4 w-4" />}
          <span className="relative z-10">{item.label}</span>
          {pathname !== item.href && (
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#fd6a3e]/0 to-[#022e7d]/0 group-hover:from-[#fd6a3e]/5 group-hover:to-[#022e7d]/5 transition-all duration-300" />
          )}
        </Link>
      ))}
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/30 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/90 dark:border-slate-700/40 dark:bg-slate-900/90 shadow-sm">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link
            href={
              user
                ? userProfile?.role === "teacher" ||
                  userProfile?.role === "admin"
                  ? "/teacher-portal"
                  : "/dashboard"
                : "/"
            }
            className="flex items-center space-x-3 group"
          >
            <img
              src="/LearnBridge logo inverted2.png"
              alt="CogniSpark AI Logo"
              className="h-12"
            />
            <span className="font-bold text-lg bg-gradient-to-r from-[#022e7d] to-[#fd6a3e] bg-clip-text text-transparent">
              CogniSpark AI
            </span>
          </Link>

          {/* Desktop Navigation */}
          {user && (
            <nav className="hidden lg:flex items-center gap-2">
              <NavLinks />
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Feedback Link - Desktop */}
          {user && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden md:flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-[#022e7d] dark:hover:text-white hover:bg-gradient-to-r hover:from-orange-50 hover:to-blue-50 dark:hover:from-slate-800 dark:hover:to-slate-700 transition-all duration-300 rounded-xl border border-transparent hover:border-[#fd6a3e]/20"
            >
              <a
                href={FEEDBACK_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageSquare className="h-4 w-4" />
                Feedback
              </a>
            </Button>
          )}

          {isLoading ? (
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full bg-gradient-to-r from-[#fd6a3e]/20 to-[#022e7d]/20" />
              <Skeleton className="h-8 w-20 rounded-md bg-gradient-to-r from-[#fd6a3e]/20 to-[#022e7d]/20" />
            </div>
          ) : user ? (
            <>
              {/* Mobile Menu */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="lg:hidden p-2 hover:bg-gradient-to-r hover:from-orange-50 hover:to-blue-50 dark:hover:from-slate-800 dark:hover:to-slate-700 transition-all duration-300 rounded-xl border border-transparent hover:border-[#fd6a3e]/20"
                  >
                    <Menu className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-[300px] sm:w-[400px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-[#fd6a3e]/20 dark:border-slate-700/40 shadow-2xl"
                >
                  <SheetHeader className="pb-6">
                    <SheetTitle className="text-left bg-gradient-to-r from-[#022e7d] to-[#fd6a3e] bg-clip-text text-transparent font-bold">
                      Navigation
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-6">
                    <nav className="flex flex-col gap-2">
                      <NavLinks />
                    </nav>
                    <div className="border-t border-gradient-to-r from-[#fd6a3e]/20 to-[#022e7d]/20 pt-6">
                      <Button
                        asChild
                        variant="ghost"
                        className="w-full justify-start gap-2 hover:bg-gradient-to-r hover:from-orange-50 hover:to-blue-50 dark:hover:from-slate-800 dark:hover:to-slate-700 rounded-xl border border-transparent hover:border-[#fd6a3e]/20"
                      >
                        <a
                          href={FEEDBACK_FORM_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <MessageSquare className="h-4 w-4" />
                          Feedback
                        </a>
                      </Button>
                    </div>
                    <div className="border-t border-gradient-to-r from-red-200/40 to-red-300/40 pt-6">
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 dark:text-red-400 dark:hover:text-red-300 dark:hover:from-red-950/30 dark:hover:to-red-900/30 rounded-xl"
                        onClick={() => {
                          handleSignOut();
                          setIsMobileMenuOpen(false);
                        }}
                        disabled={isSigningOut}
                      >
                        {isSigningOut ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Signing Out...
                          </>
                        ) : (
                          <>
                            <LogOut className="h-4 w-4" />
                            Sign Out
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              {/* User Menu - Desktop */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2 hover:bg-gradient-to-r hover:from-orange-50 hover:to-blue-50 dark:hover:from-slate-800 dark:hover:to-slate-700 transition-all duration-300 rounded-xl border border-transparent hover:border-[#fd6a3e]/20"
                  >
                    <Avatar className="h-8 w-8 border-2 border-white/20 shadow-md">
                      {userProfile?.avatar_url ? (
                        <AvatarImage
                          src={userProfile.avatar_url}
                          alt={userProfile.full_name || "User"}
                        />
                      ) : (
                        <AvatarFallback className="bg-gradient-to-br from-[#022e7d] to-[#fd6a3e] text-white">
                          {userProfile?.full_name
                            ? userProfile.full_name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .substring(0, 2)
                            : "U"}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden md:inline-block">
                      {userProfile?.full_name || "User"}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-[#fd6a3e]/20 dark:border-slate-700/40 shadow-xl"
                >
                  <DropdownMenuLabel className="bg-gradient-to-r from-[#022e7d] to-[#fd6a3e] bg-clip-text text-transparent font-medium">
                    My Account
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gradient-to-r from-[#fd6a3e]/20 to-[#022e7d]/20" />
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-gradient-to-r hover:from-slate-50 hover:to-orange-50 dark:hover:from-slate-800 dark:hover:to-slate-700 transition-all duration-300"
                    onClick={() => router.push("/profile")}
                  >
                    <UserCircle2 className="h-4 w-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-gradient-to-r hover:from-slate-50 hover:to-orange-50 dark:hover:from-slate-800 dark:hover:to-slate-700 transition-all duration-300"
                    onClick={() => router.push("/settings")}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gradient-to-r from-red-200/40 to-red-300/40" />
                  <DropdownMenuItem
                    className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 dark:text-red-400 dark:hover:text-red-300 dark:hover:from-red-950/30 dark:hover:to-red-900/30 transition-all duration-300"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                  >
                    {isSigningOut ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Signing Out...
                      </>
                    ) : (
                      <>
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                      </>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-700 dark:text-slate-300 hover:text-[#022e7d] dark:hover:text-white hover:bg-gradient-to-r hover:from-slate-50 hover:to-orange-50 dark:hover:from-slate-800 dark:hover:to-slate-700 transition-all duration-300 rounded-xl border border-transparent hover:border-[#fd6a3e]/20"
                onClick={() => router.push("/login")}
              >
                Log In
              </Button>
              <Button
                size="sm"
                className="bg-gradient-to-r from-[#022e7d] to-[#fd6a3e] text-white hover:from-[#022e7d] hover:to-[#fd6a3e] hover:shadow-lg hover:shadow-[#022e7d]/25 transition-all duration-300 rounded-xl"
                onClick={() => router.push("/signup")}
              >
                Sign Up
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

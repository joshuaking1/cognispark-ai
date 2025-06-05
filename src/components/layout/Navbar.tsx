"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  UserCircle2, 
  MessageSquare, 
  Menu, 
  X,
  LogOut,
  Sparkles,
  ChevronDown
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

// Define navigation items
const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/chat", label: "Chat with Learnbridge AI" },
  { href: "/smart-notes", label: "Smart Notes" },
  { href: "/essay-helper", label: "Essay Helper" },
  { href: "/photo-solver", label: "Photo Solver" },
  { href: "/flashcards", label: "Flashcards" },
  { href: "/quizzes", label: "Quizzes" },
  { href: "/voice-call", label: "Voice Call Learnbridge AI" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<{ avatar_url: string | null; full_name: string | null } | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Client-side Supabase instance for checking auth state
  const supabase = createPagesBrowserClient();

  const FEEDBACK_FORM_URL = "https://forms.gle/orhAkMqh49x3XHGU9";

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('avatar_url, full_name')
          .eq('id', currentUser.id)
          .single();
        setProfile(profileData);
      }
      setIsLoading(false);
    };
    fetchUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (_event === "SIGNED_OUT") {
          setProfile(null);
          router.push("/login");
        }
      }
    );

    const handleProfileUpdate = () => {
      fetchUser();
    };
    window.addEventListener('profileUpdated', handleProfileUpdate);

    return () => {
      authListener?.subscription.unsubscribe();
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [supabase, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

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
            <img src="/LearnBridge logo inverted2.png" alt="LearnBrigeEdu Logo" className="h-10" />
          </Link>
        </div>
      </header>
    );
  }

  const NavLinks = () => (
    <>
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`relative px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 hover:scale-105 group ${
            pathname === item.href
              ? "text-white bg-gradient-to-r from-[#fd6a3e] to-[#022e7d] shadow-lg shadow-[#fd6a3e]/25 border border-white/20"
              : "text-slate-700 dark:text-slate-300 hover:text-[#022e7d] dark:hover:text-white hover:bg-gradient-to-r hover:from-slate-50 hover:to-orange-50 dark:hover:from-slate-800 dark:hover:to-slate-700 border border-transparent hover:border-[#fd6a3e]/20"
          }`}
          onClick={() => setIsMobileMenuOpen(false)}
        >
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
            href={user ? "/dashboard" : "/"}
            className="flex items-center space-x-3 group"
          >
            <img src="/LearnBridge logo inverted2.png" alt="LearnBrigeEdu Logo" className="h-10" />
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
                <SheetContent side="right" className="w-[300px] sm:w-[400px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-[#fd6a3e]/20 dark:border-slate-700/40 shadow-2xl">
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
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              {/* Desktop User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="hidden lg:flex items-center gap-2 h-10 px-3 hover:bg-gradient-to-r hover:from-orange-50 hover:to-blue-50 dark:hover:from-slate-800 dark:hover:to-slate-700 transition-all duration-300 rounded-xl border border-transparent hover:border-[#fd6a3e]/20"
                  >
                    {profile?.avatar_url || user.user_metadata?.avatar_url ? (
                      <Avatar className="h-7 w-7 ring-2 ring-gradient-to-r ring-[#fd6a3e]/30">
                        <AvatarImage 
                          src={profile?.avatar_url || user.user_metadata?.avatar_url} 
                          alt={profile?.full_name || user.email || "User"} 
                        />
                        <AvatarFallback className="bg-gradient-to-br from-[#fd6a3e] to-[#022e7d] text-white text-xs font-semibold">
                          {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="p-1.5 rounded-full bg-gradient-to-br from-[#fd6a3e] to-[#022e7d]">
                        <UserCircle2 className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 max-w-[100px] truncate">
                      {profile?.full_name || user.email?.split('@')[0] || "User"}
                    </span>
                    <ChevronDown className="h-3 w-3 text-slate-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="w-56 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-[#fd6a3e]/20 dark:border-slate-700/40 shadow-xl rounded-xl"
                >
                  <DropdownMenuLabel className="text-slate-900 dark:text-slate-100 font-semibold">
                    My Account
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gradient-to-r from-[#fd6a3e]/20 to-[#022e7d]/20" />
                  <DropdownMenuItem 
                    onClick={handleSignOut}
                    className="text-red-600 dark:text-red-400 hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 dark:hover:from-red-950/30 dark:hover:to-red-900/30 cursor-pointer gap-2 rounded-lg"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            pathname !== "/login" &&
            pathname !== "/signup" && (
              <div className="flex items-center gap-3">
                <Button 
                  asChild 
                  variant="ghost" 
                  size="sm"
                  className="text-slate-600 dark:text-slate-300 hover:text-[#022e7d] dark:hover:text-white hover:bg-gradient-to-r hover:from-orange-50 hover:to-blue-50 dark:hover:from-slate-800 dark:hover:to-slate-700 transition-all duration-300 rounded-xl border border-transparent hover:border-[#fd6a3e]/20"
                >
                  <Link href="/login">Login</Link>
                </Button>
                <Button 
                  asChild 
                  size="sm"
                  className="bg-gradient-to-r from-[#fd6a3e] to-[#022e7d] hover:from-[#ff7a52] hover:to-[#1a4ba6] text-white border-0 shadow-lg hover:shadow-xl hover:shadow-[#fd6a3e]/30 transition-all duration-300 transform hover:scale-105 rounded-xl font-semibold"
                >
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </div>
            )
          )}
        </div>
      </div>
    </header>
  );
}
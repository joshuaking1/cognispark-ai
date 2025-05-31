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
  { href: "/chat", label: "Chat with Nova" },
  { href: "/smart-notes", label: "Smart Notes" },
  { href: "/essay-helper", label: "Essay Helper" },
  { href: "/photo-solver", label: "Photo Solver" },
  { href: "/flashcards", label: "Flashcards" },
  { href: "/quizzes", label: "Quizzes" },
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
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/50 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/80 dark:border-slate-800/50 dark:bg-slate-900/80">
        <div className="container flex h-16 items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
              CogniSpark AI
            </span>
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
          className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 ${
            pathname === item.href
              ? "text-white bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          {item.label}
        </Link>
      ))}
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/50 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/80 dark:border-slate-800/50 dark:bg-slate-900/80">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link
            href={user ? "/dashboard" : "/"}
            className="flex items-center space-x-3 group"
          >
            <div className="p-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 group-hover:shadow-lg group-hover:shadow-blue-500/25 transition-all duration-200">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent hidden sm:inline-block">
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
              className="hidden md:flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
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
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          ) : user ? (
            <>
              {/* Mobile Menu */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50">
                  <SheetHeader className="pb-6">
                    <SheetTitle className="text-left bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                      Navigation
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-6">
                    <nav className="flex flex-col gap-2">
                      <NavLinks />
                    </nav>
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                      <Button
                        asChild
                        variant="ghost"
                        className="w-full justify-start gap-2 hover:bg-slate-100 dark:hover:bg-slate-800"
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
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/50"
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
                    className="hidden lg:flex items-center gap-2 h-10 px-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 rounded-lg"
                  >
                    {profile?.avatar_url || user.user_metadata?.avatar_url ? (
                      <Avatar className="h-7 w-7 ring-2 ring-slate-200 dark:ring-slate-700">
                        <AvatarImage 
                          src={profile?.avatar_url || user.user_metadata?.avatar_url} 
                          alt={profile?.full_name || user.email || "User"} 
                        />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-semibold">
                          {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="p-1.5 rounded-full bg-gradient-to-br from-slate-400 to-slate-600">
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
                  className="w-56 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50 shadow-xl"
                >
                  <DropdownMenuLabel className="text-slate-900 dark:text-slate-100">
                    My Account
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-800" />
                  <DropdownMenuItem 
                    onClick={handleSignOut}
                    className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer gap-2"
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
                  className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
                >
                  <Link href="/login">Login</Link>
                </Button>
                <Button 
                  asChild 
                  size="sm"
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
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
// src/components/layout/Navbar.tsx
"use client"; // If using client-side hooks like usePathname or for auth state

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs"; // For client-side auth state if needed
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation"; // For redirecting on logout
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  UserCircle2, 
  MessageSquare, 
  Menu, 
  X,
  LogOut
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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
          router.push("/login"); // Redirect to login on sign out
        }
      }
    );

    // Listen for profile updates
    const handleProfileUpdate = () => {
      fetchUser(); // Re-fetch user and their profile
    };
    window.addEventListener('profileUpdated', handleProfileUpdate);

    return () => {
      authListener?.subscription.unsubscribe();
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [supabase, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // The auth listener will handle the redirect.
  };

  // Don't render navbar on login/signup pages if user is not logged in yet
  if (
    (pathname === "/login" || pathname === "/signup") &&
    !user &&
    !isLoading
  ) {
    return null;
  }
  // Or if still loading and on auth pages, don't show links that require auth
  if (isLoading && (pathname === "/login" || pathname === "/signup")) {
    return (
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold sm:inline-block">CogniSpark AI</span>
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
          className={`transition-colors hover:text-foreground/80 ${
            pathname === item.href
              ? "text-foreground font-semibold border-b-2 border-primary pb-px"
              : "text-foreground/60"
          }`}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          {item.label}
        </Link>
      ))}
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={user ? "/dashboard" : "/"}
            className="flex items-center space-x-2"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src="/nova-avatar.png" alt="Nova" />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white font-semibold">
                N
              </AvatarFallback>
            </Avatar>
            <span className="font-bold hidden sm:inline-block">CogniSpark AI</span>
          </Link>

          {/* Desktop Navigation */}
          {user && (
            <nav className="hidden md:flex items-center gap-4 text-sm lg:gap-6">
              <NavLinks />
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {/* Feedback Link - Desktop */}
          {user && (
            <a
              href={FEEDBACK_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
            >
              <MessageSquare className="h-4 w-4" />
              Feedback
            </a>
          )}

          {isLoading ? (
            <Skeleton className="h-8 w-24 rounded-md" />
          ) : user ? (
            <>
              {/* Mobile Menu */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                  <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-4 mt-4">
                    <nav className="flex flex-col gap-2">
                      <NavLinks />
                    </nav>
                    <div className="border-t pt-4">
                      <a
                        href={FEEDBACK_FORM_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <MessageSquare className="h-4 w-4" />
                        Feedback
                      </a>
                    </div>
                    <div className="border-t pt-4">
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-2"
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

              {/* Desktop Avatar and Sign Out */}
              <div className="hidden md:flex items-center gap-2">
                {profile?.avatar_url || user.user_metadata?.avatar_url ? (
                  <Avatar className="h-8 w-8 cursor-pointer" title={profile?.full_name || user.email}>
                    <AvatarImage src={profile?.avatar_url || user.user_metadata?.avatar_url} alt={profile?.full_name || user.email} />
                    <AvatarFallback>
                      {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <UserCircle2 className="h-7 w-7 text-muted-foreground" />
                )}
                <Button onClick={handleSignOut} variant="ghost" size="sm" className="text-sm">
                  Sign Out
                </Button>
              </div>
            </>
          ) : (
            pathname !== "/login" &&
            pathname !== "/signup" && ( // Show login/signup only if not on those pages
              <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">Login</Link>
                </Button>
                <Button asChild size="sm">
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

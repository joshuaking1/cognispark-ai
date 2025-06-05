"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, UserPlus, Sparkles, Brain, Zap } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      setError(error.message);
      toast.error("Sign Up Failed", {
        description: error.message,
      });
    } else if (
      data.user &&
      data.user.identities &&
      data.user.identities.length === 0
    ) {
      toast.info("User already exists", {
        description: "Please check your email to confirm your account or try logging in.",
      });
    } else if (data.session) {
      toast.success("Sign Up Successful!", {
        description: "Redirecting to dashboard...",
      });
      router.push("/dashboard");
      router.refresh();
    } else {
      toast.info("Sign Up Successful!", {
        description: "Please check your email to confirm your account.",
      });
      router.push("/login?message=Check email to confirm account");
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2">
      {/* Left Side - Brand Showcase */}
      <div className="relative hidden h-full flex-col p-10 text-white lg:flex dark:border-r overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#022e7d] via-[#1e40af] to-[#fd6a3e]" />
        
        {/* Decorative Elements */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-40 left-10 w-24 h-24 bg-[#fd6a3e]/30 rounded-full blur-lg"></div>
        <div className="absolute top-1/2 right-10 w-16 h-16 bg-white/20 rounded-full blur-md"></div>
        
        {/* Logo and Brand */}
        <div className="relative z-20 flex items-center text-xl font-bold">
          <div className="mr-3 p-2 bg-white rounded-xl shadow-lg">
            <img src="/LearnBridge logo inverted2.png" alt="LearnBrigeEdu Logo" className="h-8 w-auto" />
          </div>
        </div>
        
        {/* Features */}
        <div className="relative z-20 mt-16 space-y-8">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold leading-tight">
              Transform Your Learning with AI-Powered Flashcards
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-[#fd6a3e]/20 rounded-lg">
                  <Sparkles className="h-8 w-8 mr-2 text-[#fd6a3e]" />
                </div>
                <span className="text-lg">AI-Generated Content</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-2 bg-[#fd6a3e]/20 rounded-lg">
                  <Brain className="h-5 w-5 text-[#fd6a3e]" />
                </div>
                <span className="text-lg">Smart Learning Algorithms</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-2 bg-[#fd6a3e]/20 rounded-lg">
                  <Zap className="h-5 w-5 text-[#fd6a3e]" />
                </div>
                <span className="text-base">Instant Knowledge Retention</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Testimonial */}
        <div className="relative z-20 mt-auto">
          <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
            <blockquote className="space-y-4">
              <p className="text-base leading-relaxed">
                &ldquo;LearnBrigeEdu revolutionized my study routine. The AI-powered flashcards adapt to my learning pace, making complex topics easier to master. I've improved my retention by 300%!&rdquo;
              </p>
              <footer className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#fd6a3e] to-[#f97316] rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-white">PA</span>
                </div>
                <div>
                  <div className="font-semibold">Princess Abbey</div>
                  <div className="text-sm text-blue-200">Student, Ghana</div>
                </div>
              </footer>
            </blockquote>
          </div>
        </div>
      </div>
      
      {/* Right Side - Signup Form */}
      <div className="relative lg:p-8 flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-orange-50">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-20 left-20 w-72 h-72 bg-[#fd6a3e]/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#022e7d]/10 rounded-full blur-3xl"></div>
        </div>
        
        <Card className="relative w-full max-w-md mx-4 shadow-2xl border-0 bg-white/95 backdrop-blur-sm overflow-hidden">
          {/* Card Glow Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#fd6a3e]/5 to-[#022e7d]/5 rounded-2xl" />
          
          <CardHeader className="relative space-y-6 pb-8">
            {/* Icon */}
            <div className="flex justify-center mb-2">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#fd6a3e] to-[#f97316] shadow-lg">
                <UserPlus className="h-8 w-8 text-white" />
              </div>
            </div>
            
            {/* Title */}
            <div className="text-center space-y-3">
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-[#022e7d] to-[#1e40af] bg-clip-text text-transparent">
                Join LearnBrigeEdu
              </CardTitle>
              <CardDescription className="text-gray-600 text-base leading-relaxed">
                Create your account and unlock the power of AI-driven learning
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="relative space-y-6">
            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50/80 backdrop-blur-sm">
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleSignUp} className="space-y-6">
              <div className="space-y-5">
                {/* Full Name Field */}
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-semibold text-[#022e7d]">
                    Full Name
                  </Label>
                  <div className="relative group">
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Enter your full name"
                      autoComplete="name"
                      disabled={loading}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="h-12 pl-4 text-base bg-white/80 border-2 border-gray-200 focus:bg-white focus:border-[#fd6a3e] focus:ring-4 focus:ring-[#fd6a3e]/20 transition-all duration-300 rounded-xl group-hover:border-[#fd6a3e]/50"
                    />
                  </div>
                </div>
                
                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-[#022e7d]">
                    Email Address
                  </Label>
                  <div className="relative group">
                    <Input
                      id="email"
                      placeholder="name@example.com"
                      type="email"
                      autoCapitalize="none"
                      autoComplete="email"
                      autoCorrect="off"
                      disabled={loading}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-12 pl-4 text-base bg-white/80 border-2 border-gray-200 focus:bg-white focus:border-[#fd6a3e] focus:ring-4 focus:ring-[#fd6a3e]/20 transition-all duration-300 rounded-xl group-hover:border-[#fd6a3e]/50"
                    />
                  </div>
                </div>
                
                {/* Password Field */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-[#022e7d]">
                    Password
                  </Label>
                  <div className="relative group">
                    <Input
                      id="password"
                      type="password"
                      placeholder="Create a strong password"
                      autoComplete="new-password"
                      disabled={loading}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="h-12 pl-4 text-base bg-white/80 border-2 border-gray-200 focus:bg-white focus:border-[#fd6a3e] focus:ring-4 focus:ring-[#fd6a3e]/20 transition-all duration-300 rounded-xl group-hover:border-[#fd6a3e]/50"
                    />
                  </div>
                  <p className="text-xs text-gray-500 pl-1">
                    Password must be at least 6 characters long
                  </p>
                </div>
              </div>
              
              {/* Submit Button */}
              <Button 
                disabled={loading} 
                type="submit" 
                className="w-full h-12 text-base font-bold bg-gradient-to-r from-[#fd6a3e] to-[#f97316] hover:from-[#f97316] hover:to-[#fd6a3e] border-0 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] rounded-xl"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating Your Account...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Create Your Account
                  </>
                )}
              </Button>
            </form>
          </CardContent>
          
          <CardFooter className="relative pt-6 pb-8">
            <div className="w-full text-center">
              <p className="text-gray-600">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-bold text-[#fd6a3e] hover:text-[#f97316] transition-colors duration-200 hover:underline"
                >
                  Sign in here
                </Link>
              </p>
            </div>
          </CardFooter>
        </Card>
        
        {/* Mobile Brand Info */}
        <div className="lg:hidden absolute bottom-8 left-4 right-4">
          <div className="text-center p-4 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/30">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="p-1 bg-gradient-to-br from-[#fd6a3e] to-[#f97316] rounded-lg">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-[#022e7d]">LearnBrigeEdu</span>
            </div>
            <p className="text-xs text-gray-600">Transform your learning with AI-powered flashcards</p>
          </div>
        </div>
      </div>
    </div>
  );
}
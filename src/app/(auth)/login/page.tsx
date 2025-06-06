"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      toast.error("Login Failed", {
        description: error.message,
      });
    } else {
      toast.success("Login Successful", {
        description: "Redirecting to dashboard...",
      });
      router.push("/dashboard");
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="container relative h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="relative hidden h-full flex-col p-10 text-white lg:flex dark:border-r">
        {/* Background Image Layer (Bottom) */}
        <div className="absolute inset-0" style={{
            backgroundImage: `url(/PIC.jpg)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            zIndex: 0 
        }} />

        {/* Semi-transparent Blue Gradient Layer (Middle) */}
        <div className="absolute inset-0" style={{
            background: `linear-gradient(135deg, rgba(2, 46, 125, 0.9) 0%, rgba(30, 64, 175, 0.85) 70%, rgba(37, 99, 235, 0.8) 100%)`,
            zIndex: 1 
        }} />
        
        <div className="relative z-20 flex items-center text-lg font-medium">
          <div className="mr-3 p-2 rounded-lg">
            <img src="/LearnBridge logo inverted croped.png" alt="LearnBridge Logo" className="h-14 w-auto" />
          </div>
        </div>
        
        <div className="relative z-20 mt-auto">
          <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
            <blockquote className="space-y-4">
              <p className="text-base leading-relaxed">
                &ldquo;For the first time in history, an AI specifically trained on the Standards-Based Curriculum (SBC) is available to us. This novel tool is a timely, vital intervention that redefines lesson planning and execution, setting a new standard for academic excellence.​&rdquo;
              </p>
              <footer className="text-xs opacity-90 font-medium">
              Diana Akosua Mintah - Head Mistress<br />
                Ghana Senior High School
              </footer>
            </blockquote>
          </div>
        </div>
      </div>

      <div className="relative lg:p-8 flex items-center justify-center min-h-screen" style={{
        background: `linear-gradient(135deg, #fef7f0 0%, #f0f4ff 50%, #fef7f0 100%)`
      }}>
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, rgba(253, 106, 62, 0.1) 0%, transparent 50%), 
                           radial-gradient(circle at 80% 20%, rgba(2, 46, 125, 0.1) 0%, transparent 50%),
                           radial-gradient(circle at 40% 80%, rgba(253, 106, 62, 0.05) 0%, transparent 50%)`
        }} />
        
        <Card className="relative w-full max-w-md mx-4 shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <div className="absolute inset-0 rounded-lg" style={{
            background: `linear-gradient(135deg, rgba(2, 46, 125, 0.05) 0%, rgba(253, 106, 62, 0.05) 100%)`
          }} />
          
          <CardHeader className="relative space-y-4 pb-8">
            <div className="flex justify-center mb-2">
              <div className="p-4 rounded-full shadow-lg bg-white">
                <img src="/LearnBridge icon white.png" alt="LearnBridge Logo" className="h-12 w-auto" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-center" style={{ color: '#fd6a3e' }}>
              Welcome back
            </CardTitle>
            <CardDescription className="text-center text-slate-600 text-base">
              Sign in to your LearnBrigeEdu account
            </CardDescription>
          </CardHeader>
          
          <CardContent className="relative space-y-6">
            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                    Email Address
                  </Label>
                  <div className="relative">
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
                      className="h-12 pl-4 text-base bg-slate-50 border-slate-200 focus:bg-white transition-all duration-200"
                      style={{
                        borderColor: '#e2e8f0',
                        '&:focus': {
                          borderColor: '#fd6a3e',
                          boxShadow: `0 0 0 3px rgba(253, 106, 62, 0.1)`
                        }
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#fd6a3e';
                        e.target.style.boxShadow = '0 0 0 3px rgba(253, 106, 62, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e2e8f0';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      disabled={loading}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-12 pl-4 text-base bg-slate-50 border-slate-200 focus:bg-white transition-all duration-200"
                      onFocus={(e) => {
                        e.target.style.borderColor = '#fd6a3e';
                        e.target.style.boxShadow = '0 0 0 3px rgba(253, 106, 62, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e2e8f0';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>
              </div>
              
              <Button 
                disabled={loading} 
                type="submit" 
                className="w-full h-12 text-base font-semibold text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-2xl bg-[#022e7d] hover:bg-[#011f5a]"
                style={{ boxShadow: `0 10px 25px rgba(2, 46, 125, 0.3)` }}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In to Your Account"
                )}
              </Button>
            </form>
          </CardContent>
          
          <CardFooter className="relative pt-6">
            <div className="w-full text-center">
              <p className="text-slate-600">
                Don&apos;t have an account?{" "}
                <Link
                  href="/signup"
                  className="font-semibold transition-colors duration-200 hover:underline"
                  style={{
                    color: '#fd6a3e'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#022e7d';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#fd6a3e';
                  }}
                >
                  Create one here
                </Link>
              </p>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
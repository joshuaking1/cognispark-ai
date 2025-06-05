// src/app/page.tsx
"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Brain, 
  MessageSquare, 
  BookOpen, 
  Camera, 
  Sparkles, 
  ArrowRight,
  Lightbulb,
  Zap,
  Shield,
  Users
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-blue-50 dark:from-slate-900 dark:via-blue-950 dark:to-slate-800 -z-10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(253,106,62,0.1),transparent_50%)] -z-10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(2,46,125,0.1),transparent_50%)] -z-10" />
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto text-center"
          >
            <div className="inline-block mb-4">
              <span className="px-3 py-1 text-sm font-medium bg-gradient-to-r from-[#fd6a3e] to-[#ff8c69] text-white rounded-full shadow-lg">
                Beta Release
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-[#022e7d] via-[#fd6a3e] to-[#022e7d] bg-clip-text text-transparent">
              Welcome to LearnBridgEdu AI
            </h1>
            <p className="text-xl md:text-2xl text-slate-700 dark:text-slate-200 mb-8 max-w-3xl mx-auto">
              The next generation of personalized learning powered by advanced AI technology
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto bg-gradient-to-r from-[#fd6a3e] to-[#ff8c69] hover:from-[#e55a2e] hover:to-[#fd6a3e] text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Get Started <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="w-full sm:w-auto border-2 border-[#022e7d] text-[#022e7d] hover:bg-[#022e7d] hover:text-white transition-all duration-300"
                >
                  Sign In
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gradient-to-b from-white to-gray-50 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-[#022e7d] via-[#fd6a3e] to-[#022e7d] bg-clip-text text-transparent">
              Powered by Advanced AI Technology
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Experience the future of learning with our cutting-edge AI features
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <MessageSquare className="h-8 w-8 text-[#fd6a3e]" />,
                title: "AI Chat Assistant",
                description: "Get instant help and explanations from LearnBridge, your personal AI tutor",
                gradient: "from-[#fd6a3e]/10 to-[#ff8c69]/5"
              },
              {
                icon: <Brain className="h-8 w-8 text-[#022e7d]" />,
                title: "Smart Flashcards",
                description: "Create and study AI-generated flashcards for better retention",
                gradient: "from-[#022e7d]/10 to-[#4169e1]/5"
              },
              {
                icon: <Camera className="h-8 w-8 text-[#fd6a3e]" />,
                title: "Photo Problem Solver",
                description: "Snap a picture of any problem and get step-by-step solutions",
                gradient: "from-[#fd6a3e]/10 to-[#ff8c69]/5"
              },
              {
                icon: <BookOpen className="h-8 w-8 text-[#022e7d]" />,
                title: "Smart Notes",
                description: "Create, organize, and summarize your study materials with AI",
                gradient: "from-[#022e7d]/10 to-[#4169e1]/5"
              },
              {
                icon: <Lightbulb className="h-8 w-8 text-[#fd6a3e]" />,
                title: "Essay Helper",
                description: "Get AI assistance with brainstorming, outlining, and feedback",
                gradient: "from-[#fd6a3e]/10 to-[#ff8c69]/5"
              },
              {
                icon: <Zap className="h-8 w-8 text-[#022e7d]" />,
                title: "Quiz Generator",
                description: "Create personalized quizzes to test your knowledge",
                gradient: "from-[#022e7d]/10 to-[#4169e1]/5"
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="h-full hover:shadow-xl transition-all duration-300 border-0 shadow-lg">
                  <CardContent className={`p-6 bg-gradient-to-br ${feature.gradient} relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/20 to-transparent rounded-full -translate-y-10 translate-x-10" />
                    <div className="mb-4 relative z-10">{feature.icon}</div>
                    <h3 className="text-xl font-semibold mb-2 text-slate-800 dark:text-slate-100">{feature.title}</h3>
                    <p className="text-slate-600 dark:text-slate-300">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Beta Info Section */}
      <section className="py-20 bg-gradient-to-r from-[#022e7d]/5 via-white to-[#fd6a3e]/5 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <Card className="border-0 shadow-2xl bg-gradient-to-br from-white via-white to-orange-50/30 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800">
              <CardContent className="p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#fd6a3e]/10 to-[#022e7d]/10 rounded-full -translate-y-20 translate-x-20" />
                <div className="flex items-center gap-4 mb-6 relative z-10">
                  <div className="p-2 bg-blue-200 rounded-lg">
                    <img src="/LearnBridge logo inverted2.png" alt="LearnBrigeEdu Logo" className="h-10 w-auto" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#022e7d] to-[#fd6a3e] bg-clip-text text-transparent">
                    Currently in Beta
                  </h2>
                </div>
                <p className="text-lg text-slate-600 dark:text-slate-300 mb-6 relative z-10">
                  LearnBridgeEdu AI is currently in beta testing, offering early access to our revolutionary learning platform. 
                  As a beta user, you'll have the opportunity to shape the future of AI-powered education while enjoying 
                  exclusive features and benefits.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                  <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-[#022e7d]/5 to-transparent rounded-lg">
                    <div className="p-2 bg-[#022e7d] rounded-lg">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1 text-[#022e7d] dark:text-blue-400">Early Access</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        Be among the first to experience our cutting-edge AI learning features
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-[#fd6a3e]/5 to-transparent rounded-lg">
                    <div className="p-2 bg-[#fd6a3e] rounded-lg">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1 text-[#fd6a3e] dark:text-orange-400">Shape the Future</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        Provide feedback and help us improve the platform
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Parent Company Section */}
      <section className="py-20 bg-gradient-to-br from-[#022e7d] via-[#022e7d] to-[#1e40af] dark:from-slate-900 dark:to-slate-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(253,106,62,0.3),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto text-center"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6 bg-gradient-to-r from-white via-orange-200 to-white bg-clip-text text-transparent">
              Powered by LearnBridgeEdu
            </h2>
            <p className="text-lg text-blue-100 mb-8 max-w-3xl mx-auto">
              LearnBridge AI is the latest innovation from LearnBridgeEdu, a pioneer in educational technology in Ghana. 
              We've created a next-generation platform that leverages cutting-edge AI to deliver personalized learning experiences.
            </p>
            <Link href="/signup">
              <Button 
                size="lg"
                className="bg-gradient-to-r from-[#fd6a3e] to-[#ff8c69] hover:from-[#e55a2e] hover:to-[#fd6a3e] text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                Join the Beta <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
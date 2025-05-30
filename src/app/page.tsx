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
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-900 dark:to-slate-800 -z-10" />
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto text-center"
          >
            <div className="inline-block mb-4">
              <span className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                Beta Release
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Welcome to LearnBridgEdu CogniSpark AI
            </h1>
            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 mb-8">
              The next generation of personalized learning powered by advanced AI technology
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]">
                  Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                  Sign In
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Powered by Advanced AI Technology
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Experience the future of learning with our cutting-edge AI features
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <MessageSquare className="h-8 w-8 text-blue-600 dark:text-blue-400" />,
                title: "AI Chat Assistant",
                description: "Get instant help and explanations from Nova, your personal AI tutor"
              },
              {
                icon: <Brain className="h-8 w-8 text-purple-600 dark:text-purple-400" />,
                title: "Smart Flashcards",
                description: "Create and study AI-generated flashcards for better retention"
              },
              {
                icon: <Camera className="h-8 w-8 text-blue-600 dark:text-blue-400" />,
                title: "Photo Problem Solver",
                description: "Snap a picture of any problem and get step-by-step solutions"
              },
              {
                icon: <BookOpen className="h-8 w-8 text-purple-600 dark:text-purple-400" />,
                title: "Smart Notes",
                description: "Create, organize, and summarize your study materials with AI"
              },
              {
                icon: <Lightbulb className="h-8 w-8 text-blue-600 dark:text-blue-400" />,
                title: "Essay Helper",
                description: "Get AI assistance with brainstorming, outlining, and feedback"
              },
              {
                icon: <Zap className="h-8 w-8 text-purple-600 dark:text-purple-400" />,
                title: "Quiz Generator",
                description: "Create personalized quizzes to test your knowledge"
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="h-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-lg transition-all duration-200">
                  <CardContent className="p-6">
                    <div className="mb-4">{feature.icon}</div>
                    <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-slate-600 dark:text-slate-300">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Beta Info Section */}
      <section className="py-20 bg-slate-50 dark:bg-slate-800">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <Sparkles className="h-8 w-8 text-yellow-500" />
                  <h2 className="text-2xl md:text-3xl font-bold">Currently in Beta</h2>
                </div>
                <p className="text-lg text-slate-600 dark:text-slate-300 mb-6">
                  CogniSpark AI is currently in beta testing, offering early access to our revolutionary learning platform. 
                  As a beta user, you'll have the opportunity to shape the future of AI-powered education while enjoying 
                  exclusive features and benefits.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-start gap-3">
                    <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400 mt-1" />
                    <div>
                      <h3 className="font-semibold mb-1">Early Access</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        Be among the first to experience our cutting-edge AI learning features
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="h-6 w-6 text-purple-600 dark:text-purple-400 mt-1" />
                    <div>
                      <h3 className="font-semibold mb-1">Shape the Future</h3>
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
      <section className="py-20 bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto text-center"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Powered by LearnBridgeEdu
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 mb-8">
              CogniSpark AI is the latest innovation from LearnBridgeEdu, a pioneer in educational technology in Ghana. 
               we've created a next-generation 
              platform that leverages cutting-edge AI to deliver personalized learning experiences.
            </p>
            <Link href="/signup">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]">
                Join the Beta <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

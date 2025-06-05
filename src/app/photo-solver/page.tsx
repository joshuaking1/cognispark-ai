"use client";

import { useState, useRef, ChangeEvent, DragEvent, useEffect } from "react";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";
import Joyride, { Step } from "react-joyride";
import { useFeatureTour } from "@/hooks/useFeatureTour";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, UploadCloud, Image as ImageIcon, Wand2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

import { processImageWithOCRAction } from "@/app/actions/ocrActions";

export default function PhotoSolverPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState<'uploading' | 'processing' | null>(null);
  const [result, setResult] = useState<{ success: boolean; text?: string; error?: string } | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  
  const supabase = createPagesBrowserClient();
  
  // Define tour steps
  const tourSteps: Step[] = [
    {
      target: ".photo-solver-page",
      content: "Welcome to Learnbridge AI's Photo Solver! This tool helps you solve math problems, science questions, and more from images.",
      disableBeacon: true,
      placement: "center"
    },
    {
      target: ".upload-area",
      content: "Upload or drag & drop a photo of your homework, math problem, or any question you need help with.",
      placement: "bottom"
    },
    {
      target: ".file-input-button",
      content: "Click here to select an image from your device.",
      placement: "bottom"
    },
    {
      target: ".process-button",
      content: "After uploading your image, click here to have Nova analyze it and provide a solution.",
      placement: "bottom"
    },
    {
      target: ".solution-area",
      content: "Your solution will appear here. Nova will explain the steps and provide a detailed answer.",
      placement: "top"
    }
  ];
  
  // Use our custom feature tour hook
  const { runTour, handleJoyrideCallback, startTour } = useFeatureTour({
    tourKey: "photo_solver",
    steps: tourSteps,
    isTourEnabledInitially: false // Will be set based on user profile
  });
  
  // Fetch user profile to check if tour has been completed
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('completed_tours')
            .eq('id', session.user.id)
            .single();
            
          if (!error && profile) {
            setUserProfile(profile);
            
            // Check if user has completed this tour
            const completedTours = profile.completed_tours || [];
            if (!completedTours.includes('photo_solver')) {
              // If not completed, run the tour
              startTour();
            }
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        setIsLoadingProfile(false);
      }
    };
    
    fetchUserProfile();
  }, [supabase, startTour]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    handleFile(file);
  };

  const handleFile = (file: File | undefined) => {
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File too large", {
          description: "Please upload an image smaller than 5MB.",
        });
        return;
      }
      if (
        !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
          file.type
        )
      ) {
        toast.error("Invalid file type", {
          description: "Please upload a JPG, PNG, WEBP, or GIF image.",
        });
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleProcessImage = async () => {
    if (!selectedFile) {
      toast.error("No image selected.");
      return;
    }
    setIsLoading(true);
    setProgress(0);
    setLoadingStage('uploading');

    const formData = new FormData();
    formData.append("image", selectedFile);

    try {
      // Simulate upload progress
      const uploadInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(uploadInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const processResult = await processImageWithOCRAction(formData);
      clearInterval(uploadInterval);
      setProgress(100);
      setLoadingStage('processing');
      setResult(processResult);

      if (processResult.success && processResult.text) {
        toast.success("Text extracted! Asking Nova for help...");

        const problemTextFromOCR = processResult.text;
        const instructionForNova = `The following text was extracted from an image of a student's homework problem. Please analyze it carefully.
If it appears to be a question or problem requiring a solution (e.g., math, science, logic puzzle, concept explanation):
1.  Restate the core problem or question clearly.
2.  Provide a detailed, step-by-step explanation of how to arrive at the solution.
3.  If it's a math problem, show your work and use LaTeX for all mathematical expressions (inline with $...$ and block with $$...$$).
4.  If it's a conceptual question, break down the explanation into logical parts.
5.  If the problem is ambiguous, seems to be missing critical information from the image, or is unclear, ask clarifying questions *before* attempting a full solution.
6.  Maintain a helpful, encouraging, and student-focused tone.

If the text does not seem to be a solvable problem or academic question (e.g., just random text, a picture of a cat), politely state that you can only help with academic problems and ask if there's a specific question they have about the text.

Problem text from image:
---
${problemTextFromOCR}
---
Your step-by-step explanation or clarifying questions:`;

        const encodedInstruction = encodeURIComponent(instructionForNova);
        router.push(`/chat?prefill=${encodedInstruction}`);

      } else {
        toast.error("OCR Failed", { description: processResult.error || "Could not extract text from the image." });
      }
    } catch (error: any) {
      toast.error("Upload Error", { description: error.message || "An unexpected error occurred." });
    } finally {
      setIsLoading(false);
      setProgress(0);
      setLoadingStage(null);
    }
  };

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4 sm:px-6 photo-solver-page min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Joyride Tour */}
      <Joyride
        steps={tourSteps}
        run={runTour}
        continuous
        showSkipButton
        showProgress
        callback={handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: '#fd6a3e',
            zIndex: 1000,
          },
        }}
      />
      
      {/* Header Section */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#fd6a3e] to-[#ff8c69] shadow-lg mb-6">
          <ImageIcon className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
          <span className="bg-gradient-to-r from-[#022e7d] via-[#fd6a3e] to-[#022e7d] bg-clip-text text-transparent">
            Learnbridge AI's Photo Problem Solver
          </span>
        </h1>
        <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Transform your homework photos into step-by-step solutions with AI-powered analysis
        </p>
      </div>

      <Card className="max-w-3xl mx-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-0 shadow-2xl shadow-[#fd6a3e]/10 dark:shadow-[#fd6a3e]/5">
        <CardHeader className="space-y-2 bg-gradient-to-r from-[#022e7d]/5 to-[#fd6a3e]/5 rounded-t-lg border-b border-slate-200/50 dark:border-slate-700/50">
          <CardTitle className="text-xl md:text-2xl font-bold text-[#022e7d] dark:text-slate-100">
            Upload Your Problem
          </CardTitle>
          <CardDescription className="text-base text-slate-600 dark:text-slate-400">
            Upload an image of a math problem, science question, or any text you need help with.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6 p-6 md:p-8">
          <div className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "flex flex-col items-center gap-6 p-8 rounded-2xl border-2 border-dashed transition-all duration-300 upload-area",
                isDragging
                  ? "border-[#fd6a3e] bg-gradient-to-br from-[#fd6a3e]/10 via-orange-50/50 to-[#fd6a3e]/5 scale-[1.02] shadow-lg shadow-[#fd6a3e]/20"
                  : "border-slate-300/60 dark:border-slate-600/60 hover:border-[#fd6a3e]/60 bg-gradient-to-br from-slate-50/50 to-white/80 dark:from-slate-800/50 dark:to-slate-700/30 hover:shadow-lg hover:shadow-[#fd6a3e]/10"
              )}
            >
              <div className="text-center space-y-4">
                <div className={cn(
                  "mx-auto w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300",
                  isDragging 
                    ? "bg-gradient-to-br from-[#fd6a3e] to-[#ff8c69] scale-110 shadow-lg shadow-[#fd6a3e]/30" 
                    : "bg-gradient-to-br from-[#fd6a3e]/20 to-[#ff8c69]/20 hover:from-[#fd6a3e]/30 hover:to-[#ff8c69]/30"
                )}>
                  <UploadCloud className={cn(
                    "h-8 w-8 transition-all duration-300",
                    isDragging ? "text-white" : "text-[#fd6a3e]"
                  )} />
                </div>
                
                <div>
                  <Label
                    htmlFor="imageUpload"
                    className="text-lg font-semibold text-[#022e7d] dark:text-slate-200 cursor-pointer hover:text-[#fd6a3e] transition-colors duration-200"
                  >
                    Drop your image here or click to browse
                  </Label>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Max file size: 5MB • Supported: JPG, PNG, WEBP, GIF
                  </p>
                </div>
              </div>
              
              <Input
                id="imageUpload"
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png, image/jpeg, image/webp, image/gif"
                className="hidden file-input-button"
                disabled={isLoading}
              />
              
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="px-8 py-3 rounded-full border-2 border-[#fd6a3e]/30 text-[#fd6a3e] hover:bg-[#fd6a3e] hover:text-white hover:border-[#fd6a3e] transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#fd6a3e]/25"
                disabled={isLoading}
              >
                <UploadCloud className="mr-2 h-5 w-5" />
                Choose File
              </Button>
            </div>

            {previewUrl && (
              <div className="space-y-4 p-6 rounded-2xl bg-gradient-to-br from-slate-50/80 to-white/60 dark:from-slate-800/50 dark:to-slate-700/30 border border-slate-200/50 dark:border-slate-600/50 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-lg">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[#022e7d] dark:text-slate-200 flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-[#fd6a3e]" />
                    Image Preview
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveImage}
                    disabled={isLoading}
                    className="h-9 px-4 rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all duration-200 hover:scale-105"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
                <AspectRatio
                  ratio={16 / 9}
                  className="bg-white/80 dark:bg-slate-800/50 rounded-xl overflow-hidden border border-slate-200/50 dark:border-slate-600/50 shadow-md hover:shadow-lg transition-all duration-300"
                >
                  <img
                    src={previewUrl}
                    alt="Selected problem"
                    className="object-contain w-full h-full transition-transform duration-300 hover:scale-[1.02]"
                  />
                </AspectRatio>
              </div>
            )}

            {selectedFile && (
              <div className="space-y-4">
                {isLoading && (
                  <div className="space-y-3 p-4 rounded-xl bg-gradient-to-r from-[#fd6a3e]/5 to-[#022e7d]/5 border border-[#fd6a3e]/20">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium text-[#022e7d] dark:text-slate-200">
                        <Loader2 className="h-4 w-4 animate-spin text-[#fd6a3e]" />
                        {loadingStage === 'uploading' ? 'Uploading image...' : 'Processing image...'}
                      </span>
                      <span className="font-semibold text-[#fd6a3e]">{progress}%</span>
                    </div>
                    <Progress 
                      value={progress} 
                      className="h-3 bg-slate-200/50 dark:bg-slate-700/50"
                      style={{
                        background: 'linear-gradient(to right, #fd6a3e, #022e7d)'
                      }}
                    />
                  </div>
                )}
                <Button
                  onClick={handleProcessImage}
                  disabled={isLoading || !selectedFile}
                  className="w-full h-14 text-base font-semibold rounded-2xl bg-gradient-to-r from-[#fd6a3e] to-[#ff8c69] hover:from-[#e55a35] hover:to-[#fd6a3e] text-white shadow-xl hover:shadow-2xl hover:shadow-[#fd6a3e]/30 transition-all duration-300 hover:scale-[1.02] disabled:scale-100 disabled:opacity-50 disabled:hover:shadow-xl process-button border-0"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                      <span className="animate-pulse">
                        {loadingStage === 'uploading' ? 'Uploading...' : 'Processing...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-3 h-6 w-6" />
                      Extract Text & Ask Nova
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
        
        <CardFooter className="text-center bg-gradient-to-r from-slate-50/50 to-orange-50/30 dark:from-slate-800/30 dark:to-slate-700/30 border-t border-slate-200/50 dark:border-slate-600/50 rounded-b-lg">
          <p className="text-sm text-slate-600 dark:text-slate-400 mx-auto">
            📸 Upload a clear image of your problem for the best results
          </p>
        </CardFooter>
      </Card>
    
      {/* Results Card - Only show if we have results */}
      {result && (
        <Card className="mt-8 max-w-3xl mx-auto shadow-2xl shadow-[#022e7d]/10 border-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm solution-area">
          <CardHeader className="bg-gradient-to-r from-[#022e7d]/5 to-[#fd6a3e]/5 rounded-t-lg border-b border-slate-200/50 dark:border-slate-700/50">
            <CardTitle className="text-2xl font-bold text-[#022e7d] dark:text-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#fd6a3e] to-[#ff8c69] flex items-center justify-center">
                <span className="text-white font-bold text-sm">✓</span>
              </div>
              Extracted Text
            </CardTitle>
            <CardDescription className="text-base text-slate-600 dark:text-slate-400">
              Here's what Nova found in your image
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-700 p-6 rounded-xl border border-slate-200/50 dark:border-slate-600/50 shadow-inner">
              <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {result.text}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
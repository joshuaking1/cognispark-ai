"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
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

  const handleSubmitImage = async () => {
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

      const result = await processImageWithOCRAction(formData);
      clearInterval(uploadInterval);
      setProgress(100);
      setLoadingStage('processing');

      if (result.success && result.text) {
        toast.success("Text extracted! Asking Nova for help...");

        const problemTextFromOCR = result.text;
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
        toast.error("OCR Failed", { description: result.error || "Could not extract text from the image." });
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
    <div className="container mx-auto py-4 md:py-8 px-4">
      <Card className="max-w-2xl mx-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl md:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Nova's Photo Problem Solver
          </CardTitle>
          <CardDescription className="text-sm md:text-base text-slate-600 dark:text-slate-400">
            Upload an image of a math problem, science question, or any text you need help with.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 border-2 border-dashed transition-all duration-200",
                isDragging
                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20"
                  : "border-slate-200/50 dark:border-slate-700/50 hover:border-blue-400/50 dark:hover:border-blue-400/50"
              )}
            >
              <div className="flex-1 w-full">
                <Label
                  htmlFor="imageUpload"
                  className="text-sm md:text-base font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer group"
                >
                  <UploadCloud className="h-5 w-5 text-blue-600 dark:text-blue-400 transition-transform duration-200 group-hover:scale-110" />
                  <span>Upload Image or Drag & Drop</span>
                </Label>
                <Input
                  id="imageUpload"
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/webp, image/gif"
                  className="mt-2 block w-full text-sm text-slate-500 dark:text-slate-400
                           file:mr-4 file:py-2 file:px-4
                           file:rounded-full file:border-0
                           file:text-sm file:font-semibold
                           file:bg-blue-50 dark:file:bg-blue-900/20
                           file:text-blue-600 dark:file:text-blue-400
                           hover:file:bg-blue-100 dark:hover:file:bg-blue-900/30
                           disabled:opacity-50 disabled:cursor-not-allowed
                           bg-white/50 dark:bg-slate-800/50
                           border-slate-200/50 dark:border-slate-700/50
                           transition-all duration-200"
                  disabled={isLoading}
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Max file size: 5MB. Supported types: JPG, PNG, WEBP, GIF.
                </p>
              </div>
            </div>

            {previewUrl && (
              <div className="space-y-4 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm md:text-base font-medium text-slate-700 dark:text-slate-300">Image Preview</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveImage}
                    disabled={isLoading}
                    className="h-8 text-xs sm:text-sm bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border-slate-200/50 dark:border-slate-700/50 transition-all duration-200 hover:scale-105"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
                <AspectRatio
                  ratio={16 / 9}
                  className="bg-white/50 dark:bg-slate-800/50 rounded-lg overflow-hidden border border-slate-200/50 dark:border-slate-700/50 transition-all duration-200 hover:shadow-lg"
                >
                  <img
                    src={previewUrl}
                    alt="Selected problem"
                    className="object-contain w-full h-full transition-transform duration-200 hover:scale-[1.02]"
                  />
                </AspectRatio>
              </div>
            )}

            {selectedFile && (
              <div className="space-y-4">
                {isLoading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {loadingStage === 'uploading' ? 'Uploading image...' : 'Processing image...'}
                      </span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}
                <Button
                  onClick={handleSubmitImage}
                  disabled={isLoading || !selectedFile}
                  className="w-full h-11 text-sm md:text-base bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] disabled:scale-100 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" />
                      <span className="animate-pulse">
                        {loadingStage === 'uploading' ? 'Uploading...' : 'Processing...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                      Extract Text & Ask Nova
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="text-xs text-slate-500 dark:text-slate-400 text-center border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/30 dark:bg-slate-800/30">
          <p>Upload a clear image of your problem for the best results.</p>
        </CardFooter>
      </Card>
    </div>
  );
}

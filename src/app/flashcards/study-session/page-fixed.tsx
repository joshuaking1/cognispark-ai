"use client";

import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import StudySessionContent from "./StudySessionContent";

// Main page component with Suspense boundary
export default function StudySessionPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-8 px-4 md:px-0">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="min-h-[300px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    }>
      <StudySessionContent />
    </Suspense>
  );
}

// src/hooks/useFeatureTour.ts
import { useState, useEffect } from 'react';
import { CallBackProps, STATUS } from 'react-joyride';
import { markTourAsCompletedAction } from '@/app/actions/userSettingsActions'; // Adjust path if needed

export type TourKey = // Exporting for use in pages
    | "chat"
    | "flashcards"
    | "essay_helper"
    | "photo_solver"
    | "smart_notes"
    | "quiz_generator"
    | "learning_plan";

interface UseFeatureTourProps {
  tourKey: TourKey;
  steps: any[]; // Define your react-joyride steps array structure
  isTourEnabledInitially: boolean; // Passed from page, based on profile.tour_completed_...
}

export const useFeatureTour = ({ tourKey, steps, isTourEnabledInitially }: UseFeatureTourProps) => {
  const [runTour, setRunTour] = useState(false);
  const [tourSteps, setTourSteps] = useState(steps);

  useEffect(() => {
    // Only run the tour if it's enabled initially (i.e., not completed before)
    // and if there are steps defined.
    if (isTourEnabledInitially && steps.length > 0) {
      // Slight delay to ensure target elements are rendered
      const timer = setTimeout(() => {
        setRunTour(true);
      }, 500); // Adjust delay as needed
      return () => clearTimeout(timer);
    }
  }, [isTourEnabledInitially, steps]);

  const handleJoyrideCallback = async (data: CallBackProps) => {
    const { status, type, action } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    // console.log("Joyride callback data:", data);

    if (finishedStatuses.includes(status) || action === 'close') {
      setRunTour(false); // Stop the tour
      // Mark tour as completed in the database so it doesn't run again
      if (isTourEnabledInitially) { // Only mark if it was actually run because it was due
        try {
          await markTourAsCompletedAction({ tourKey });
          // console.log(`Tour ${tourKey} marked as completed.`);
          // Optionally, update a local state/context if the page needs to know immediately
          // without waiting for a profile re-fetch.
        } catch (error) {
          console.error(`Failed to mark tour ${tourKey} as completed:`, error);
          // Handle error (e.g., toast notification), though it's not critical for UX if this fails silently once.
        }
      }
    }
  };

  const startTour = () => {
    if (steps.length > 0) {
        setTourSteps(steps); // Ensure steps are current if they can change
        setRunTour(true);
    }
  };

  return { runTour, tourSteps, handleJoyrideCallback, startTour, setRunTour };
};

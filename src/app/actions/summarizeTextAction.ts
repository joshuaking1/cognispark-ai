// src/app/actions/summarizeTextAction.ts
"use server";

import Groq from "groq-sdk";
import { createSupabaseServerActionClient } from "@/lib/supabase/server"; // For auth, not strictly needed here but good practice

type SummaryLengthOption = "short" | "medium" | "long";

const groqApiKey = process.env.GROQ_API_KEY;

if (!groqApiKey) {
    console.error("CRITICAL: GROQ_API_KEY for summarization is not set.");
}
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

// Helper to determine target length based on option
function getTargetLengthPrompt(lengthOption: SummaryLengthOption): string {
    switch (lengthOption) {
        case "short":
            return "Provide a concise summary, roughly 20% of the original length, focusing on the absolute main points.";
        case "medium":
            return "Provide a balanced summary, roughly 40% of the original length, covering key arguments and supporting details.";
        case "long":
            return "Provide a more comprehensive summary, roughly 60% of the original length, including more nuances and examples if present in the original text.";
        default:
            return "Provide a medium-length summary.";
    }
}

export async function summarizeTextAction(
  textToSummarize: string,
  lengthOption: SummaryLengthOption
): Promise<{ success: boolean; summary?: string; error?: string }> {
  if (!groq) {
    return { success: false, error: "AI Service (Groq) for summarization is not configured." };
  }
  if (!textToSummarize.trim()) {
    return { success: false, error: "No text provided to summarize." };
  }

  // Personalization: Fetch user profile
  let personalizationInstruction = "";
  try {
    const supabase = createSupabaseServerActionClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!authError && user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('grade_level, subjects_of_interest, date_of_birth, full_name')
        .eq('id', user.id)
        .single();
      if (profileData) {
        if (profileData.full_name) {
          personalizationInstruction += ` The student's name is ${profileData.full_name}.`;
        }
        if (profileData.grade_level && profileData.grade_level !== "Not Specified") {
          personalizationInstruction += ` The summary should be tailored for a ${profileData.grade_level} student.`;
        }
        if (profileData.date_of_birth) {
          personalizationInstruction += ` The student was born on ${profileData.date_of_birth}. Use this to further tailor the summary if relevant.`;
        }
        if (profileData.subjects_of_interest && (profileData.subjects_of_interest as string[]).length > 0) {
          personalizationInstruction += ` If possible, subtly relate the summary to topics like ${(profileData.subjects_of_interest as string[]).join(", ")}.`;
        }
      }
    }
  } catch (e) { /* Ignore personalization errors */ }
  // Add current time and timezone
  const now = new Date();
  const timeString = now.toLocaleString();
  personalizationInstruction += ` Current time: ${timeString}.`;

  const maxLengthForGroq = 15000; // Groq context window is large, but let's cap input for sanity
  const truncatedText = textToSummarize.length > maxLengthForGroq
    ? textToSummarize.substring(0, maxLengthForGroq) + "..."
    : textToSummarize;

  if (textToSummarize.length > maxLengthForGroq) {
    console.warn(`Input text truncated from ${textToSummarize.length} to ${maxLengthForGroq} characters for summarization.`);
  }

  const targetLengthInstruction = getTargetLengthPrompt(lengthOption);

  const prompt = `Please summarize the following text. ${targetLengthInstruction} ${personalizationInstruction} Focus on clarity and accuracy. The original text is provided below:\n\n---BEGIN TEXT---\n${truncatedText}\n---END TEXT---\n\nSummary:`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-8b-8192", // Or consider mixtral for potentially better summarization
      temperature: 0.5,      // Temperature can be slightly higher for summarization than pure Q&A
      max_tokens: 2048,      // Allow ample space for summary based on length option
      stream: false,
    });

    const summary = completion.choices[0]?.message?.content?.trim();

    if (!summary) {
      return { success: false, error: "AI could not generate a summary." };
    }

    return { success: true, summary: summary };

  } catch (error: any) {
    console.error("Error summarizing text with Groq:", error);
    if (error instanceof Groq.APIError) {
        return { success: false, error: `AI summarization failed: ${error.status} ${error.message}` };
    }
    return { success: false, error: "AI summarization encountered an unexpected issue." };
  }
}
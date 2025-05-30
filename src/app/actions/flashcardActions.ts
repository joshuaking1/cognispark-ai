// src/app/actions/flashcardActions.ts
"use server";

import Groq from "groq-sdk";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache"; // If you have a page listing flashcard sets
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";

const groqApiKey = process.env.GROQ_API_KEY;
if (!groqApiKey) console.error("CRITICAL: GROQ_API_KEY for flashcard actions is not set.");
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

interface FlashcardPayload {
  title: string;
  description?: string;
  sourceText: string;
}

interface FlashcardQAPair {
  question: string;
  answer: string;
}

interface ActionResult<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
  setId?: string;
  cardsGeneratedCount?: number;
}

interface FlashcardForClient { // For sending to client
  id: string;
  question: string;
  answer: string;
  due_date: string | null;
  interval: number | null;
  ease_factor: number | null;
  repetitions: number | null;
  last_reviewed_at: string | null;
}

interface FlashcardSetWithCards { // For sending to client
  id: string;
  title: string;
  description: string | null;
  flashcards: FlashcardForClient[];
  user_id: string; // Good to have for ownership checks or other client logic
  created_at: string;
  updated_at: string;
  masteryPercentage: number; // Add mastery percentage
  masteredCount: number; // Add count of mastered cards
  totalCards: number; // Add total card count
}

interface GetSetResult {
  success: boolean;
  set?: FlashcardSetWithCards;
  error?: string;
}

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  set_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface FlashcardSet {
  id: string;
  title: string;
  description?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  flashcards: Flashcard[];
}

export interface UpdateSRSDataPayload {
  flashcardId: string;
  qualityOfResponse: 0 | 1 | 2 | 3; // 0: Again, 1: Hard, 2: Good, 3: Easy
}

export interface SRSUpdateResult {
  success: boolean;
  error?: string;
  nextDueDate?: string;
  newInterval?: number;
  newEaseFactor?: number;
  newRepetitions?: number;
}

const MIN_EASE_FACTOR = 1.3;

export interface DueCardsResult {
  success: boolean;
  dueCards?: FlashcardForClient[];
  error?: string;
  setTitles?: Record<string, string>;
}

interface StudyPerformanceData {
  cardId: string;
  question: string;
  quality: 0 | 1 | 2 | 3; // 0: Again, 1: Hard, 2: Good, 3: Easy
}

interface StudyReportResult {
  success: boolean;
  report?: string; // The AI-generated report as a Markdown string
  error?: string;
}

interface LogStudySessionPayload {
  setId: string;
  cardsReviewedCount: number;
  performanceCounts: { again: number; hard: number; good: number; easy: number };
  setMasteryPercentageAtEnd: number;
}

interface SessionHistoryData {
  session_completed_at: string;
  performance_snapshot: { again: number; hard: number; good: number; easy: number };
  mastery_at_session_end: number | null;
  cards_reviewed: number;
}

interface SessionHistoryResult {
  success: boolean;
  history?: SessionHistoryData[];
  error?: string;
}

// --- New Action to Fetch a Flashcard Set and its Cards ---
export async function getFlashcardSetDetailsAction(setId: string): Promise<ActionResult<FlashcardSetWithCards>> {
  try {
    const supabase = createSupabaseServerComponentClient();

    // First verify the set exists and user has access
    const { data: set, error: setError } = await supabase
      .from('flashcard_sets')
      .select('*')
      .eq('id', setId)
      .single();

    if (setError) {
      console.error("Error fetching flashcard set:", setError);
      if (setError.code === 'PGRST116') {
        return { 
          success: false, 
          error: "Flashcard set not found. It may have been deleted or you don't have access to it." 
        };
      }
      return { success: false, error: "Failed to fetch flashcard set" };
    }

    if (!set) {
      return { 
        success: false, 
        error: "Flashcard set not found. It may have been deleted or you don't have access to it." 
      };
    }

    const { data: flashcards, error: cardsError } = await supabase
      .from('flashcards')
      .select('*')
      .eq('set_id', setId)
      .order('created_at', { ascending: true });

    if (cardsError) {
      console.error("Error fetching flashcards:", cardsError);
      return { success: false, error: "Failed to fetch flashcards" };
    }

    // Calculate mastery metrics
    let masteredCount = 0;
    const totalCards = flashcards?.length || 0;

    flashcards?.forEach(card => {
      // Define "mastered": interval > 21 days, or at least 3 good reps and interval >= 7 days
      if (card.interval && card.interval >= 21) {
        masteredCount++;
      } else if (card.repetitions && card.repetitions >= 3 && card.interval && card.interval >= 7) {
        masteredCount++;
      }
    });

    const masteryPercentage = totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0;

    return {
      success: true,
      data: {
        ...set,
        flashcards: flashcards || [],
        masteryPercentage,
        masteredCount,
        totalCards
      }
    };
  } catch (error: any) {
    console.error("Error in getFlashcardSetDetailsAction:", error);
    return { success: false, error: error.message || "An unexpected error occurred" };
  }
}

// --- Action to Generate Flashcards from Text ---
export async function generateFlashcardsFromTextAction(
  payload: FlashcardPayload
): Promise<ActionResult> {
  if (!groq) {
    return { success: false, error: "AI Service (Groq) for flashcard generation is not configured." };
  }

  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "User not authenticated." };
  }

  const { title, description, sourceText } = payload;
  if (!title.trim() || !sourceText.trim()) {
    return { success: false, error: "Set title and source text are required." };
  }

  // 1. Create the Flashcard Set entry in the database
  let setId: string;
  try {
    const { data: setInsertData, error: setInsertError } = await supabase
      .from("flashcard_sets")
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
      })
      .select("id") // Select the ID of the newly created set
      .single(); // Expect a single row back

    if (setInsertError) throw setInsertError;
    if (!setInsertData || !setInsertData.id) throw new Error("Failed to create flashcard set record or retrieve its ID.");
    setId = setInsertData.id;
  } catch (error: any) {
    console.error("Error creating flashcard set in DB:", error);
    return { success: false, error: `Could not create flashcard set: ${error.message}` };
  }

  // 2. Prompt Groq to generate Q&A pairs from the source text
  const maxLengthForGroq = 10000; // Adjust based on typical source text length and model context
  const truncatedSourceText = sourceText.length > maxLengthForGroq
    ? sourceText.substring(0, maxLengthForGroq) + "..."
    : sourceText;

  if (sourceText.length > maxLengthForGroq) {
    console.warn(`Flashcard source text truncated from ${sourceText.length} to ${maxLengthForGroq} characters.`);
  }

  // Personalization: Fetch user profile
  let personalizationInstruction = "";
  try {
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
          personalizationInstruction += ` The flashcards should be tailored for a ${profileData.grade_level} student.`;
        }
        if (profileData.date_of_birth) {
          personalizationInstruction += ` The student was born on ${profileData.date_of_birth}. Use this to further tailor the flashcards if relevant.`;
        }
        if (profileData.subjects_of_interest && (profileData.subjects_of_interest as string[]).length > 0) {
          personalizationInstruction += ` If possible, relate the flashcards to topics like ${(profileData.subjects_of_interest as string[]).join(", ")}.`;
        }
      }
    }
  } catch (e) { /* Ignore personalization errors */ }
  // Add current time and timezone
  const now = new Date();
  const timeString = now.toLocaleString();
  personalizationInstruction += ` Current time: ${timeString}.`;

  const prompt = `From the following text, extract key concepts, terms, facts, or definitions and transform them into clear question and answer pairs suitable for flashcards. Aim for 5 to 15 flashcards. ${personalizationInstruction}

  Your entire response should be ONLY a JSON array with no additional text. The array should contain objects with exactly two keys:
  1. "question": A string for the question side of the flashcard.
  2. "answer": A string for the answer side of the flashcard.

  Your response should start with '[' and end with ']'. Do not include any introductory phrases, explanations, or markdown formatting.

  Example of desired output:
  [
    {
      "question": "What is the powerhouse of the cell?",
      "answer": "The mitochondrion."
    },
    {
      "question": "What year did World War II end?",
      "answer": "1945."
    }
  ]

  Source Text:
  ---BEGIN TEXT---
  ${truncatedSourceText}
  ---END TEXT---

  Generate the JSON array of flashcards now:`;

  let generatedQAPairs: FlashcardQAPair[] = [];
  let jsonStringToParse = ""; // Initialize to avoid linter error
  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-70b-8192", // Larger model often better for structured JSON and nuanced extraction
      temperature: 0.4,       // Focused extraction
      max_tokens: 2000,       // Allow ample space for several Q&A pairs
      // response_format: { type: "json_object" }, // IDEAL if Groq/model supports this for array output
    });

    const rawResponse = completion.choices[0]?.message?.content?.trim();
    if (!rawResponse) {
      throw new Error("AI did not return any content for flashcards.");
    }

    // Attempt to parse the JSON array with enhanced error handling
    try {
      // First try to find JSON within markdown code block
      const markdownJsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/);
      
      if (markdownJsonMatch) {
        jsonStringToParse = markdownJsonMatch[1].trim();
      } else {
        // If no markdown block found, try to find JSON array or object
        const arrayMatch = rawResponse.match(/\[([\s\S]*)\]/);
        const objectMatch = rawResponse.match(/\{([\s\S]*)\}/);
        
        if (arrayMatch) {
          jsonStringToParse = `[${arrayMatch[1]}]`;
        } else if (objectMatch) {
          jsonStringToParse = `[${objectMatch[0]}]`;
        } else {
          throw new Error("Could not find valid JSON structure in AI response");
        }
      }

      // Attempt to parse the JSON
      const parsedData = JSON.parse(jsonStringToParse);

      // Validate the parsed data
      if (!Array.isArray(parsedData)) {
        throw new Error("Parsed data is not a JSON array as expected");
      }

      // Validate each Q&A pair structure
      generatedQAPairs = parsedData.filter((item: any) => {
        if (typeof item !== 'object' || item === null) return false;
        if (!('question' in item) || typeof item.question !== 'string' || item.question.trim() === '') return false;
        if (!('answer' in item) || typeof item.answer !== 'string' || item.answer.trim() === '') return false;
        return true;
      }).map((item: any) => ({
        question: item.question.trim(),
        answer: item.answer.trim()
      })) as FlashcardQAPair[];

      if (generatedQAPairs.length === 0 && parsedData.length > 0) {
        console.warn("Parsed flashcard data but items did not meet structure requirements:", parsedData);
        throw new Error("Generated flashcards do not meet the required structure");
      }

    } catch (parseError: any) {
      console.error("Failed to parse JSON flashcards from AI:", parseError.message);
      console.error("JSON String that failed parsing:", jsonStringToParse);
      console.error("Original Raw AI response:", rawResponse);
      
      // Provide more specific error messages based on the parsing failure
      if (parseError.message.includes("Unexpected token")) {
        throw new Error("AI response contains invalid JSON syntax. Please check the format.");
      } else if (parseError.message.includes("not a JSON array")) {
        throw new Error("AI response is not in the expected array format. Expected an array of Q&A pairs.");
      } else if (parseError.message.includes("do not meet structure requirements")) {
        throw new Error("Generated flashcards have invalid structure. Each card must have a valid question and answer.");
      } else {
        throw new Error("Failed to parse flashcard data. Please check the format and try again.");
      }
    }

    if (generatedQAPairs.length === 0) {
      // This could be because the AI genuinely couldn't find Q&A or parsing failed to validate any
      return { 
        success: true, 
        setId, 
        cardsGeneratedCount: 0, 
        error: "No valid flashcards could be generated. The text might not contain suitable Q&A pairs or the format was incorrect." 
      };
    }

  } catch (error: any) {
    console.error("Error generating flashcards with Groq:", error);
    // If AI generation fails, we've already created the set.
    // We could delete the empty set, or leave it and let the user know.
    // For now, return error but the set exists.
    return { success: false, error: `AI flashcard generation failed: ${error.message}`, setId };
  }

  // 3. Insert generated flashcards into the database
  try {
    const flashcardsToInsert = generatedQAPairs.map(pair => ({
      set_id: setId,
      user_id: user.id, // Ensure user_id is set on individual cards for RLS
      question: pair.question,
      answer: pair.answer,
    }));

    if (flashcardsToInsert.length > 0) {
      const { error: cardsInsertError } = await supabase
        .from("flashcards")
        .insert(flashcardsToInsert);

      if (cardsInsertError) {
        // Critical: Cards failed to insert. The set exists but is empty.
        // Consider how to handle this: delete the set? Notify user more strongly?
        console.error("Error inserting flashcards into DB:", cardsInsertError);
        throw new Error(`Failed to save generated flashcards: ${cardsInsertError.message}`);
      }
    }
    
    // Revalidate path if you have a page listing all flashcard sets
    revalidatePath("/flashcards"); // Example path
    revalidatePath(`/flashcards/set/${setId}`); // Revalidate the specific set page

    return { success: true, setId, cardsGeneratedCount: generatedQAPairs.length };

  } catch (error: any) {
    console.error("Error processing flashcard saving:", error);
    // Set exists, but cards might not have been saved.
    return { success: false, error: `Could not save flashcards: ${error.message}`, setId };
  }
}

export async function updateFlashcardAction(
  flashcardId: string,
  newQuestion: string,
  newAnswer: string
): Promise<ActionResult<FlashcardForClient>> {
  if (!flashcardId || !newQuestion.trim() || !newAnswer.trim()) {
    return { success: false, error: "Flashcard ID, question, and answer are required." };
  }

  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "User not authenticated." };
  }

  try {
    const { data: updatedCard, error: updateError } = await supabase
      .from("flashcards")
      .update({
        question: newQuestion.trim(),
        answer: newAnswer.trim(),
      })
      .eq("id", flashcardId)
      .eq("user_id", user.id)
      .select("id, question, answer, due_date, interval, ease_factor, repetitions, last_reviewed_at")
      .single();

    if (updateError) throw updateError;
    if (!updatedCard) throw new Error("Failed to update flashcard or retrieve updated data.");

    // Get the set_id for revalidation
    const { data: card } = await supabase
      .from('flashcards')
      .select('set_id')
      .eq('id', flashcardId)
      .single();

    if (card?.set_id) {
      revalidatePath(`/flashcards/set/${card.set_id}`);
    }
    revalidatePath("/flashcards"); // For any card count updates

    return { success: true, data: updatedCard };

  } catch (error: any) {
    console.error(`Error updating flashcard ${flashcardId}:`, error);
    return { success: false, error: `Could not update flashcard: ${error.message}` };
  }
}

export async function deleteFlashcardAction(flashcardId: string): Promise<ActionResult<FlashcardForClient>> {
  if (!flashcardId) {
    return { success: false, error: "Flashcard ID is required." };
  }

  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "User not authenticated." };
  }

  try {
    // First get the card to return it and verify ownership
    const { data: card, error: fetchError } = await supabase
      .from("flashcards")
      .select("id, question, answer, set_id, due_date, interval, ease_factor, repetitions, last_reviewed_at")
      .eq("id", flashcardId)
      .eq("user_id", user.id)
      .single();

    if (fetchError) throw fetchError;
    if (!card) throw new Error("Flashcard not found or access denied.");

    // Delete the card
    const { error: deleteError } = await supabase
      .from("flashcards")
      .delete()
      .eq("id", flashcardId)
      .eq("user_id", user.id);

    if (deleteError) throw deleteError;

    // Revalidate paths
      revalidatePath(`/flashcards/set/${card.set_id}`);
    revalidatePath("/flashcards"); // For any card count updates

    return { success: true, data: card };

  } catch (error: any) {
    console.error(`Error deleting flashcard ${flashcardId}:`, error);
    return { success: false, error: `Could not delete flashcard: ${error.message}` };
  }
}

interface AddManualCardPayload {
  setId: string;
  question: string;
  answer: string;
}

export async function addManualFlashcardAction(
  payload: AddManualCardPayload
): Promise<ActionResult<FlashcardForClient>> {
  const { setId, question, answer } = payload;
  if (!setId || !question.trim() || !answer.trim()) {
    return { success: false, error: "Set ID, question, and answer are required." };
  }

  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: "User not authenticated." };

  try {
    // Verify user owns the set they are adding to
    const { count, error: setCountError } = await supabase
      .from("flashcard_sets")
      .select("id", { count: 'exact', head: true })
      .eq("id", setId)
      .eq("user_id", user.id);

    if (setCountError || count === 0) {
      return { success: false, error: "Target flashcard set not found or access denied." };
    }

    const { data: newCard, error: insertError } = await supabase
      .from("flashcards")
      .insert({
        set_id: setId,
        user_id: user.id,
        question: question.trim(),
        answer: answer.trim(),
        due_date: null,
        interval: null,
        ease_factor: null,
        repetitions: null,
        last_reviewed_at: null
      })
      .select("id, question, answer, due_date, interval, ease_factor, repetitions, last_reviewed_at")
      .single();

    if (insertError) throw insertError;
    if (!newCard) throw new Error("Failed to create manual flashcard or retrieve it.");

    revalidatePath(`/flashcards/set/${setId}`);
    revalidatePath("/flashcards"); // For card count update

    return { success: true, data: newCard };

  } catch (error: any) {
    console.error("Error adding manual flashcard:", error);
    return { success: false, error: `Could not add card: ${error.message}` };
  }
}

export async function updateFlashcardSRSDataAction(
  flashcardId: string,
  quality: number
): Promise<SRSUpdateResult> {
  if (!flashcardId || quality < 0 || quality > 5) {
    return { success: false, error: "Invalid flashcard ID or quality rating." };
  }

  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "User not authenticated." };
  }

  try {
    // Get current card data
    const { data: currentCard, error: fetchError } = await supabase
      .from("flashcards")
      .select("id, set_id, due_date, interval, ease_factor, repetitions, last_reviewed_at")
      .eq("id", flashcardId)
      .eq("user_id", user.id)
      .single();

    if (fetchError) throw fetchError;
    if (!currentCard) throw new Error("Flashcard not found or access denied.");

    // Calculate new SRS data
    const now = new Date();
    const nextDueDate = new Date(now);
    let newInterval = 1;
    let newEaseFactor = currentCard.ease_factor || 2.5;
    let newRepetitions = (currentCard.repetitions || 0) + 1;

    if (quality >= 3) { // Successful recall
      if (currentCard.repetitions === 0) {
        newInterval = 1;
      } else if (currentCard.repetitions === 1) {
        newInterval = 6;
      } else {
        newInterval = Math.round(currentCard.interval * newEaseFactor);
      }
      newEaseFactor = Math.max(1.3, newEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    } else { // Failed recall
      newRepetitions = 0;
      newInterval = 1;
    }

    nextDueDate.setDate(nextDueDate.getDate() + newInterval);

    // Update card with new SRS data
    const { error: updateError } = await supabase
      .from("flashcards")
      .update({
        due_date: nextDueDate.toISOString(),
        interval: newInterval,
        ease_factor: newEaseFactor,
        repetitions: newRepetitions,
        last_reviewed_at: now.toISOString()
      })
      .eq("id", flashcardId)
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    // Revalidate paths
    revalidatePath(`/flashcards/set/${currentCard.set_id}`);
    revalidatePath("/flashcards"); // For any card count updates

    return { 
      success: true, 
      nextDueDate: nextDueDate.toISOString(),
      newInterval,
      newEaseFactor,
      newRepetitions
    };

  } catch (error: any) {
    console.error(`Error updating SRS data for card ${flashcardId}:`, error);
    return { success: false, error: `Could not update SRS data: ${error.message}` };
  }
}

// --- New Action to Fetch Due Flashcards for a Set ---
export async function getDueFlashcardsForSetAction(setId: string): Promise<DueCardsResult> {
  if (!setId) {
    return { success: false, error: "Set ID is required to fetch due cards." };
  }

  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "User not authenticated." };
  }

  try {
    const now = new Date().toISOString();
    const { data: dueCards, error } = await supabase
      .from("flashcards")
      .select("id, question, answer, due_date, interval, ease_factor, repetitions, last_reviewed_at")
      .eq("set_id", setId)
      .eq("user_id", user.id)
      .lte("due_date", now)
      .order("due_date", { ascending: true });

    if (error) {
      console.error(`Error fetching due flashcards for set ${setId}:`, error);
      throw error;
    }

    return { success: true, dueCards: dueCards || [] };

  } catch (error: any) {
    console.error("Error in getDueFlashcardsForSetAction:", error);
    return { success: false, error: `Could not load due flashcards: ${error.message}` };
  }
}

export async function generateStudyReportAction(
  setTitle: string,
  performanceData: StudyPerformanceData[],
  userGradeLevel?: string | null // For personalization
): Promise<StudyReportResult> {
  if (!groq) return { success: false, error: "AI Service not configured." };
  if (performanceData.length === 0) return { success: false, error: "No study data to generate a report." };

  // Construct a summary of performance for the prompt
  let performanceSummary = `The student just finished a study session for the flashcard set titled "${setTitle}".\n`;
  if (userGradeLevel) {
    performanceSummary += `The student is in ${userGradeLevel}.\n`;
  }
  performanceSummary += "Here's a summary of their performance on some cards:\n";

  const difficultCards = performanceData.filter(p => p.quality < 2); // Again or Hard
  const wellKnownCards = performanceData.filter(p => p.quality >= 2); // Good or Easy

  if (difficultCards.length > 0) {
    performanceSummary += "\nCards they found challenging (marked 'Again' or 'Hard'):\n";
    difficultCards.slice(0, 5).forEach(card => { // Limit for prompt length
      performanceSummary += `- Question: "${card.question}" (Rated: ${card.quality === 0 ? 'Again' : 'Hard'})\n`;
    });
  }
  if (wellKnownCards.length > 0 && difficultCards.length < 5) { // Add some well-known if few difficult ones shown
    performanceSummary += "\nCards they recalled well (marked 'Good' or 'Easy'):\n";
    wellKnownCards.slice(0, (5 - difficultCards.length)).forEach(card => {
      performanceSummary += `- Question: "${card.question}" (Rated: ${card.quality === 2 ? 'Good' : 'Easy'})\n`;
    });
  }
  if (difficultCards.length === 0 && wellKnownCards.length > 0) {
    performanceSummary += "\nGreat job! The student recalled all reviewed cards well or easily.\n"
  } else if (difficultCards.length === 0 && wellKnownCards.length === 0) {
    // This case shouldn't happen if performanceData is not empty, but as a fallback:
    performanceSummary += "\nNo specific card performance details available for this summary, but the session was completed.\n"
  }

  const prompt = `${performanceSummary}

Please generate a concise study session report that includes:
1.  A brief overall encouragement or summary statement.
2.  Specific areas or topics (based on the challenging card questions) the student should focus on more.
3.  Positive reinforcement for topics they seem to understand well (if any were reviewed positively).
4.  One or two practical study tips relevant to flashcard learning or the topics covered.
5.  Keep the tone supportive and constructive.
Output the report as a well-formatted Markdown string.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-70b-8192", // Good for analysis and report generation
      temperature: 0.6,
      max_tokens: 500,
    });

    const report = completion.choices[0]?.message?.content?.trim();
    if (!report) return { success: false, error: "AI could not generate a study report." };

    return { success: true, report };

  } catch (error: any) {
    console.error("Groq Study Report Error:", error);
    return { success: false, error: `AI report generation failed: ${error.message}` };
  }
}

export async function getDueFlashcardsForMultipleSetsAction(setIds: string[]): Promise<DueCardsResult> {
  if (!setIds || setIds.length === 0) {
    return { success: false, error: "No set IDs provided." };
  }

  const supabase = createSupabaseServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated." };
  }

  const now = new Date().toISOString();
  const { data: dueCards, error } = await supabase
    .from("flashcards")
    .select(`
      id,
      question,
      answer,
      due_date,
      interval,
      ease_factor,
      repetitions,
      last_reviewed_at,
      set_id,
      flashcard_sets!inner (
        title
      )
    `)
    .in("set_id", setIds)
    .eq("user_id", user.id)
    .lte("due_date", now)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("Error fetching due cards:", error);
    return { success: false, error: "Failed to fetch due cards." };
  }

  return { 
    success: true, 
    dueCards: dueCards || [],
    setTitles: dueCards?.reduce((acc, card: any) => {
      if (card.flashcard_sets && !acc[card.set_id]) {
        acc[card.set_id] = card.flashcard_sets.title;
      }
      return acc;
    }, {} as Record<string, string>) || {}
  };
}

export async function logStudySessionAction(payload: LogStudySessionPayload): Promise<{success: boolean, error?: string}> {
  const supabase = createSupabaseServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "User not authenticated." };

  const { setId, cardsReviewedCount, performanceCounts, setMasteryPercentageAtEnd } = payload;
  const { error } = await supabase.from("study_sessions").insert({
    user_id: user.id,
    set_id: setId,
    cards_reviewed: cardsReviewedCount,
    performance_snapshot: performanceCounts,
    mastery_at_session_end: setMasteryPercentageAtEnd,
  });
  
  if (error) { 
    console.error("Error logging study session:", error); 
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function getStudySessionHistoryAction(setId: string): Promise<SessionHistoryResult> {
  const supabase = createSupabaseServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "User not authenticated." };

  const { data, error } = await supabase
    .from("study_sessions")
    .select("session_completed_at, performance_snapshot, mastery_at_session_end, cards_reviewed")
    .eq("set_id", setId)
    .eq("user_id", user.id)
    .order("session_completed_at", { ascending: true })
    .limit(15);

  if (error) { 
    console.error("Error fetching session history:", error); 
    return { success: false, error: error.message }; 
  }
  return { success: true, history: data || [] };
}
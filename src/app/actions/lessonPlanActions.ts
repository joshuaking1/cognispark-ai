// src/app/actions/lessonPlanActions.ts
"use server";

import Groq from "groq-sdk";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getEmbeddingForText, EMBEDDING_DIMENSION } from "@/lib/aiUtils";

// Define types (should match client-side for consistency)
interface LessonPlanActivity {
  activity: string;
  time_minutes?: number;
  description?: string;
}
interface GeneratedLessonPlanForDB {
  // For DB saving
  id?: string;
  teacher_id: string;
  title: string;
  subject: string;
  week?: string;
  duration_minutes: number;
  form_grade_level: string;
  strand?: string | null;
  sub_strand?: string | null;
  content_standard?: string | null;
  learning_outcomes?: string[] | null; // Store as jsonb
  learning_indicators?: string[] | null;
  essential_questions?: string[] | null;
  pedagogical_strategies?: string[] | null;
  teaching_learning_resources?: string[] | null;
  differentiation_notes?: string | null;
  keywords?: string[] | null;
  starter_activity?: string | null;
  main_activities?: LessonPlanActivity[] | null; // Store as jsonb
  plenary_ending_activity?: string | null;
  assessment_methods?: string | null;
  homework_follow_up?: string | null;
}

interface GeneratePlanPayload {
  subject: string;
  week?: string;
  duration_minutes: number;
  form_grade_level: string;
  strand?: string;
  sub_strand?: string;
}
interface GeneratePlanResult {
  success: boolean;
  plan?: Partial<GeneratedLessonPlanForDB>; // AI might not generate all fields perfectly
  error?: string;
}

const groqApiKey = process.env.GROQ_API_KEY;
if (!groqApiKey)
  console.error("CRITICAL: GROQ_API_KEY for Lesson Plan actions is not set.");
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

// Helper function to verify user is authenticated
async function verifyUser() {
  try {
    const supabase = createSupabaseServerActionClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) return { user: null, error: "Authentication failed" };
    return { user, error: null };
  } catch (e) {
    return { user: null, error: "Authentication check failed" };
  }
}

// Helper function to verify teacher role
async function verifyTeacher() {
  try {
    const { user, error } = await verifyUser();
    if (error || !user) return { user: null, error: "Authentication failed" };

    const supabase = createSupabaseServerActionClient();
    const { data, error: roleError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (roleError) return { user: null, error: "Role verification failed" };
    if (data?.role !== "teacher")
      return { user: null, error: "Teacher role required" };

    return { user, error: null };
  } catch (e) {
    return { user: null, error: "Teacher verification failed" };
  }
}

export async function generateLessonPlanAction(
  payload: GeneratePlanPayload
): Promise<GeneratePlanResult> {
  if (!groq) return { success: false, error: "AI Service not configured." };

  const supabase = createSupabaseServerActionClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return { success: false, error: "User not authenticated." };
  // Further check if user is teacher via profiles.role if needed

  const {
    subject,
    week,
    duration_minutes,
    form_grade_level,
    strand,
    sub_strand,
  } = payload;

  // === RAG INTEGRATION START ===
  let retrievedContext = "";
  // Construct a query string from relevant inputs for embedding
  const queryTextForRAG = `${subject} ${
    sub_strand || strand || ""
  } ${form_grade_level} lesson plan`.trim();
  if (queryTextForRAG) {
    console.log(
      `RAG (LessonPlan ${subject}): Generating embedding for "${queryTextForRAG}"`
    );
    const queryEmbedding = await getEmbeddingForText(queryTextForRAG);
    if (queryEmbedding && queryEmbedding.length === EMBEDDING_DIMENSION) {
      const { data: matchedChunks, error: matchError } = await supabase.rpc(
        "match_document_chunks", // Your pgvector search function
        {
          query_embedding: queryEmbedding,
          match_threshold: 0.7, // Start with a slightly lower threshold for broader context
          match_count: 5, // Get more chunks for lesson planning
          user_id: user.id, // For personalized knowledge retrieval
        }
      );
      if (matchError) {
        console.error(`RAG Error (LessonPlan ${subject}):`, matchError.message);
      } else if (matchedChunks && matchedChunks.length > 0) {
        retrievedContext =
          "Refer to the following relevant information from the provided curriculum/textbooks when drafting the lesson plan:\n\n<CURRICULUM_CONTEXT>\n";
        matchedChunks.forEach((chunk: any) => {
          retrievedContext += `Chunk (Source: ${
            chunk.metadata?.source_document_name || "Uploaded Document"
          }, Page: ${chunk.metadata?.page_number || "N/A"}):\n${
            chunk.chunk_text
          }\n---\n`;
        });
        retrievedContext += "</CURRICULUM_CONTEXT>\n\n";
        console.log(
          `RAG (LessonPlan ${subject}): Retrieved ${matchedChunks.length} chunks.`
        );
      } else {
        console.log(
          `RAG (LessonPlan ${subject}): No relevant curriculum chunks found for "${queryTextForRAG}".`
        );
      }
    } else {
      console.warn(
        `RAG (LessonPlan ${subject}): Could not generate embedding for query "${queryTextForRAG}".`
      );
    }
  }
  // === RAG INTEGRATION END ===

  // Construct detailed prompt for Groq
  const prompt = `
    You are Learnbridge AI, an expert AI assistant for teachers. Generate a comprehensive draft lesson plan.
    
    ${retrievedContext}
    
    Based on the teacher's request AND THE PROVIDED CURRICULUM CONTEXT (if any), please generate a comprehensive lesson plan.
    If curriculum context is provided, heavily favor information, terminology, and standards from it. 
    If the context seems insufficient for a specific part, you may use your general knowledge but indicate where the curriculum context was lacking with a brief note: "[Note: Limited curriculum context for this section]".
    
    The teacher has provided the following core details:
    - Subject: ${subject}
    - Week/Unit: ${week || "Not specified"}
    - Lesson Duration: ${duration_minutes} minutes
    - Form/Grade Level: ${form_grade_level}
    - Strand: ${strand || "Not specified"}
    - Sub-Strand/Topic: ${sub_strand || "General topic within subject"}

    Based on these, generate content for the following lesson plan sections:
    1.  Suggested Lesson Title (concise and descriptive)
    2.  Content Standard(s) (relevant curriculum standard for the topic and grade)
    3.  Learning Outcome(s) (What students will know or be able to do. Start with action verbs. Min 2-3)
    4.  Learning Indicator(s) (How students will demonstrate achievement of outcomes. Min 2-3)
    5.  Essential Question(s) (Thought-provoking questions guiding the lesson. Min 3)
    6.  Pedagogical Strategies (List 2-3 varied teaching methods appropriate for this lesson, e.g., Direct Instruction, Inquiry-Based Learning, Collaborative Group Work, Think-Pair-Share, Jigsaw)
    7.  Teaching & Learning Resources (List specific materials needed, e.g., Whiteboard, Markers, Projector, Handout X, Textbook Chapter Y, specific online simulation URL, YouTube video link if highly relevant and educational)
    8.  Key Notes on Differentiation (Suggest 1-2 brief strategies for supporting diverse learners: e.g., scaffolding for struggling learners, extension activities for advanced learners)
    9.  Keywords (List 5-7 key vocabulary terms or concepts for this lesson)
    10. Starter Activity (A string describing a brief engaging activity, ~5-10% of lesson time. For example: "Quick quiz on previous topic.")
    11. Main Lesson Activities (A sequence of 2-4 activities. For each, provide a description and an estimated time in minutes. Total time for main activities should be ~70-80% of lesson duration)
    12. Plenary/Ending Activity (A string describing how to summarize learning, check understanding, and wrap up. ~5-10% of lesson time. For example: "Students share one key takeaway from the lesson.")
    13. Assessment Methods (Briefly state how student learning will be assessed, formative and/or summative, e.g., Q&A, Exit Ticket, Short Quiz, Observation)
    14. Homework/Follow-up (Optional: Suggest a brief assignment or reading)

    Output the entire lesson plan as a single, valid JSON object.
    The root object should have keys corresponding to the user inputs (subject, week, duration_minutes, form_grade_level, strand, sub_strand) AND the AI-generated sections listed above (e.g., "lesson_title", "content_standard", "learning_outcomes" (as array of strings), "main_activities" (as array of objects with "activity" and "time_minutes" keys), etc.).
    Use snake_case for all keys in the JSON.
    For fields that are lists (like learning_outcomes, keywords, pedagogical_strategies, main_activities), use JSON arrays. For example, an array of strings should look like: ["item 1", "item 2 with more words", "item 3"].
    Ensure time allocations for starter, main activities, and plenary roughly fit the total lesson_duration.

    Pay CRITICAL attention to JSON syntax: 
    1. ALL string values MUST be enclosed in double quotes (e.g., "This is a string"). This includes the very last string value in the entire JSON object.
    2. Strings within an array must EACH be enclosed in their own double quotes (e.g., ["string one", "string two"]). Do NOT do ["string one" "string two"].
    3. Any special characters within strings (like newlines or quotes themselves) MUST be correctly escaped (e.g., \\n for newline, \\\" for a double quote character within the string).
    4. Ensure there are no trailing commas after the last item in an object or array.
    The generated JSON MUST be parseable by a standard JSON parser. Double-check your output for completeness and validity before finishing.

    Example for a main_activity item: {"activity": "Teacher explains Newton's First Law with examples.", "time_minutes": 15}

    Generate the JSON object now.
  `;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-70b-8192", // Powerful model for structured, detailed generation
      temperature: 0.5,
      max_tokens: 4096, // Increased token limit for potentially long lesson plans
    });

    const rawResponse = completion.choices[0]?.message?.content?.trim();
    if (!rawResponse) {
      console.error("AI_RESPONSE_ERROR: AI did not return any content.");
      return { success: false, error: "AI did not return a lesson plan." };
    }

    let jsonStringToParse = "";
    const markdownJsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/);

    if (markdownJsonMatch && markdownJsonMatch[1]) {
      jsonStringToParse = markdownJsonMatch[1].trim();
    } else {
      // If not in a markdown block, try to find the main JSON object
      // by looking for the first '{' and the last '}'
      const firstBrace = rawResponse.indexOf("{");
      const lastBrace = rawResponse.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        jsonStringToParse = rawResponse.substring(firstBrace, lastBrace + 1);
      } else {
        console.error(
          "AI_RESPONSE_ERROR: AI response does not appear to contain a JSON structure. Raw response:",
          rawResponse
        );
        return {
          success: false,
          error:
            "AI response does not appear to contain a valid JSON structure. Please try again.",
        };
      }
    }

    let parsedPlan;
    try {
      parsedPlan = JSON.parse(jsonStringToParse);
    } catch (parseError: any) {
      console.error("LESSON PLAN JSON PARSE ERROR:", parseError.message);
      console.error("--- RAW AI RESPONSE (jsonStringToParse) ---");
      console.error(jsonStringToParse);
      console.error("--- END RAW AI RESPONSE ---");

      // Attempt to repair common JSON errors before failing
      let repairedJson = jsonStringToParse;
      let repairAttempted = false;

      // Common error pattern 1: Missing closing bracket for arrays
      // Look for patterns like: "array": ["item1", "item2", "next_key": "value"
      const missingArrayClosingBracketRegex =
        /"(\w+)":\s*\[\s*(?:"[^"]*"(?:,\s*)?)+\s*"(\w+)":/g;
      if (missingArrayClosingBracketRegex.test(repairedJson)) {
        repairAttempted = true;
        repairedJson = repairedJson.replace(
          missingArrayClosingBracketRegex,
          '"$1": [$&],\n"$2":'
        );
        repairedJson = repairedJson.replace(/\[\s*"(\w+)":/g, '],\n"$1":'); // Fix the replacement
      }

      // Common error pattern 2: Unclosed arrays at end of objects
      const unclosedArraysRegex =
        /"(\w+)":\s*\[\s*(?:"[^"]*"(?:,\s*)?)+\s*(?![\],])/g;
      if (unclosedArraysRegex.test(repairedJson)) {
        repairAttempted = true;
        repairedJson = repairedJson.replace(unclosedArraysRegex, '"$1": [$&]');
      }

      // Try parsing the repaired JSON
      if (repairAttempted) {
        try {
          console.log("Attempting to parse repaired JSON:", repairedJson);
          parsedPlan = JSON.parse(repairedJson);
          console.log("Successfully repaired and parsed JSON!");
        } catch (repairError: any) {
          console.error("JSON repair attempt failed:", repairError.message);
          // Fall back to original error
          let detailedError = `AI lesson plan generation failed due to invalid JSON format: ${parseError.message}. Please try again.`;
          if (jsonStringToParse.length < 2000) {
            // Only include snippet if not excessively long
            detailedError += ` Problem near: "...${jsonStringToParse.substring(
              Math.max(0, parseError.index - 30),
              Math.min(jsonStringToParse.length, parseError.index + 30)
            )}..."`;
          }
          return { success: false, error: detailedError };
        }
      } else {
        // If no repair was attempted, return the original error
        let detailedError = `AI lesson plan generation failed due to invalid JSON format: ${parseError.message}. Please try again.`;
        if (jsonStringToParse.length < 2000) {
          // Only include snippet if not excessively long
          detailedError += ` Problem near: "...${jsonStringToParse.substring(
            Math.max(0, parseError.index - 30),
            Math.min(jsonStringToParse.length, parseError.index + 30)
          )}..."`;
        }
        return { success: false, error: detailedError };
      }
    }

    // Normalize potential camelCase sub_strand from AI to snake_case
    if (parsedPlan.subStrand !== undefined) {
      parsedPlan.sub_strand = parsedPlan.subStrand;
      delete parsedPlan.subStrand; // Remove the camelCase version
    }

    // Normalize lesson_title to title if AI used that
    if (parsedPlan.lesson_title && !parsedPlan.title) {
      parsedPlan.title = parsedPlan.lesson_title;
      delete parsedPlan.lesson_title;
    }

    // Construct the final plan by explicitly picking known properties
    // This ensures no unexpected properties from AI response are included.
    const finalPlan: Partial<GeneratedLessonPlanForDB> = {
      // User inputs (already snake_case)
      subject: payload.subject,
      week: payload.week,
      duration_minutes: payload.duration_minutes,
      form_grade_level: payload.form_grade_level,
      strand: payload.strand,
      sub_strand: payload.sub_strand, // This comes from payload, AI's sub_strand will be merged below

      // AI generated parts (ensure they are part of GeneratedLessonPlanForDB)
      title:
        parsedPlan.title || `${payload.subject} - ${payload.form_grade_level}`,
      content_standard: parsedPlan.content_standard || "",
      learning_outcomes: parsedPlan.learning_outcomes || [],
      learning_indicators: parsedPlan.learning_indicators || [],
      essential_questions: parsedPlan.essential_questions || [],
      pedagogical_strategies: parsedPlan.pedagogical_strategies || [],
      teaching_learning_resources: parsedPlan.teaching_learning_resources || [],
      differentiation_notes: parsedPlan.differentiation_notes || "",
      keywords: parsedPlan.keywords || [],
      starter_activity:
        (typeof parsedPlan.starter_activity === "object" &&
        parsedPlan.starter_activity?.activity
          ? parsedPlan.starter_activity.activity
          : parsedPlan.starter_activity) || "",
      main_activities: parsedPlan.main_activities || [],
      plenary_ending_activity:
        (typeof parsedPlan.plenary_ending_activity === "object" &&
        parsedPlan.plenary_ending_activity?.activity
          ? parsedPlan.plenary_ending_activity.activity
          : parsedPlan.plenary_ending_activity) || "",
      assessment_methods: parsedPlan.assessment_methods || "",
      homework_follow_up: parsedPlan.homework_follow_up || "",
    };

    // Handle sub_strand: use AI's if available, else payload's, else default to empty string
    if (parsedPlan.sub_strand !== undefined) {
      finalPlan.sub_strand = parsedPlan.sub_strand;
    } else if (payload.sub_strand !== undefined) {
      finalPlan.sub_strand = payload.sub_strand;
    } else {
      finalPlan.sub_strand = "";
    }

    // Handle strand: use AI's if available, else payload's, else default to empty string
    // (Assuming AI might also return 'strand', though not explicitly in current parsedPlan usage for it)
    if (parsedPlan.strand !== undefined) {
      finalPlan.strand = parsedPlan.strand;
    } else if (payload.strand !== undefined) {
      finalPlan.strand = payload.strand;
    } else {
      finalPlan.strand = "";
    }

    // The explicit mapping above with || null or || [] handles undefined cases,
    // so the loop to delete undefined properties is no longer strictly necessary
    // for these fields as they will have default values.
    // However, it can remain as a general cleanup for any other unexpected undefined properties if the type were broader.
    // For GeneratedLessonPlanForDB, all properties are now explicitly handled.
    // Object.keys(finalPlan).forEach(key => {
    //     if ((finalPlan as any)[key] === undefined) {
    //         delete (finalPlan as any)[key];
    //     }
    // });

    return { success: true, plan: finalPlan };
  } catch (error: any) {
    console.error("Groq Lesson Plan Error:", error);
    return {
      success: false,
      error: `AI lesson plan generation failed: ${error.message}`,
    };
  }
}

export async function saveLessonPlanAction(
  planData: GeneratedLessonPlanForDB // This is the full plan object from client
): Promise<{ success: boolean; lessonPlanId?: string; error?: string }> {
  const supabase = createSupabaseServerActionClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user)
    return { success: false, error: "User not authenticated." };
  // Add admin/teacher role check if necessary from profiles table for extra security

  const dataToSave: Omit<GeneratedLessonPlanForDB, "id" | "teacher_id"> & {
    teacher_id: string;
  } = {
    teacher_id: user.id,
    title: planData.title || "",
    subject: planData.subject || "",
    week: planData.week, // Reverted: week is a number and should not default to ""
    duration_minutes: planData.duration_minutes,
    form_grade_level: planData.form_grade_level || "",
    strand: planData.strand || "",
    sub_strand: planData.sub_strand || "",
    content_standard: planData.content_standard || "",
    learning_outcomes: planData.learning_outcomes || [],
    learning_indicators: planData.learning_indicators || [],
    essential_questions: planData.essential_questions || [],
    pedagogical_strategies: planData.pedagogical_strategies || [],
    teaching_learning_resources: planData.teaching_learning_resources || [],
    differentiation_notes: planData.differentiation_notes || "",
    keywords: planData.keywords || [],
    starter_activity: planData.starter_activity || "",
    main_activities: planData.main_activities || [],
    plenary_ending_activity: planData.plenary_ending_activity || "",
    assessment_methods: planData.assessment_methods || "",
    homework_follow_up: planData.homework_follow_up || "",
  };

  try {
    let resultData;
    if (planData.id) {
      // Update existing plan
      const { data, error } = await supabase
        .from("lesson_plans")
        .update({ ...dataToSave, updated_at: new Date().toISOString() })
        .eq("id", planData.id)
        .eq("teacher_id", user.id) // Ensure teacher owns it
        .select("id")
        .single();
      if (error) throw error;
      resultData = data;
    } else {
      // Insert new plan
      const { data, error } = await supabase
        .from("lesson_plans")
        .insert(dataToSave)
        .select("id")
        .single();
      if (error) throw error;
      resultData = data;
    }

    if (!resultData || !resultData.id)
      throw new Error("Failed to save lesson plan or retrieve ID.");

    revalidatePath("/teacher-portal/lesson-planner"); // Or a page that lists lesson plans
    // revalidatePath(`/teacher-portal/lesson-plans/${resultData.id}`);

    return { success: true, lessonPlanId: resultData.id };
  } catch (error: any) {
    console.error("Error saving lesson plan:", error);
    return {
      success: false,
      error: `Could not save lesson plan: ${error.message}`,
    };
  }
}

interface SavedLessonPlanMetaForClient {
  id: string;
  title: string;
  subject: string;
  form_grade_level: string;
  updated_at: string;
}

// --- Get Saved Lesson Plans for Teacher ---
export async function getSavedLessonPlansAction(): Promise<{
  success: boolean;
  plans?: SavedLessonPlanMetaForClient[];
  error?: string;
}> {
  const authCheck = await verifyTeacher();
  if (authCheck.error || !authCheck.user)
    return { success: false, error: authCheck.error };

  const supabase = createSupabaseServerActionClient();
  try {
    const { data, error } = await supabase
      .from("lesson_plans")
      .select("id, title, subject, form_grade_level, updated_at")
      .eq("teacher_id", authCheck.user.id)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return { success: true, plans: data || [] };
  } catch (e: any) {
    console.error("Error fetching saved lesson plans:", e);
    return { success: false, error: e.message };
  }
}

// --- Get Full Lesson Plan by ID ---
export async function getLessonPlanByIdAction(planId: string): Promise<{
  success: boolean;
  plan?: GeneratedLessonPlanForDB; // Returns the full plan structure
  error?: string;
}> {
  const authCheck = await verifyTeacher();
  if (authCheck.error || !authCheck.user)
    return { success: false, error: authCheck.error };
  if (!planId) return { success: false, error: "Plan ID is required." };

  const supabase = createSupabaseServerActionClient();
  try {
    const { data, error } = await supabase
      .from("lesson_plans")
      .select("*") // Select all fields for editing
      .eq("id", planId)
      .eq("teacher_id", authCheck.user.id) // Ensure teacher owns it
      .single();

    if (error) throw error;
    if (!data)
      return {
        success: false,
        error: "Lesson plan not found or access denied.",
      };
    return { success: true, plan: data as GeneratedLessonPlanForDB };
  } catch (e: any) {
    console.error(`Error fetching lesson plan ${planId}:`, e);
    return { success: false, error: e.message };
  }
}

// --- Get Learning Objectives for a Lesson Plan ---
export async function getLearningObjectivesForPlanAction(
  planId: string
): Promise<{
  success: boolean;
  objectives?: string[];
  error?: string;
}> {
  const authCheck = await verifyTeacher();
  if (authCheck.error || !authCheck.user)
    return { success: false, error: authCheck.error };
  if (!planId) return { success: false, error: "Plan ID is required." };

  const supabase = createSupabaseServerActionClient();
  try {
    const { data, error } = await supabase
      .from("lesson_plans")
      .select("learning_outcomes") // Only select the learning_outcomes field
      .eq("id", planId)
      .eq("teacher_id", authCheck.user.id) // Ensure teacher owns it
      .single();

    if (error) throw error;
    if (!data)
      return {
        success: false,
        error: "Lesson plan not found or no objectives.",
      };

    // learning_outcomes is stored as jsonb array of strings
    const objectives = (data.learning_outcomes as string[]) || [];
    return { success: true, objectives };
  } catch (e: any) {
    console.error(`Error fetching objectives for lesson plan ${planId}:`, e);
    return { success: false, error: e.message };
  }
}

// --- Delete Lesson Plan ---
export async function deleteLessonPlanAction(planId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const authCheck = await verifyTeacher();
  if (authCheck.error || !authCheck.user)
    return { success: false, error: authCheck.error };
  if (!planId) return { success: false, error: "Plan ID is required." };

  const supabase = createSupabaseServerActionClient();

  try {
    const { error } = await supabase
      .from("lesson_plans")
      .delete()
      .eq("id", planId)
      .eq("teacher_id", authCheck.user.id); // Ensure teacher owns it

    if (error) throw error;
    revalidatePath("/teacher-portal/lesson-planner");
    return { success: true };
  } catch (e: any) {
    console.error(`Error deleting lesson plan ${planId}:`, e);
    return { success: false, error: e.message };
  }
}

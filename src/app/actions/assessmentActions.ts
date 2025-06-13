// src/app/actions/assessmentActions.ts
"use server";

import Groq from "groq-sdk";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getEmbeddingForText, EMBEDDING_DIMENSION } from "@/lib/aiUtils";

// Types from client-side (AssessmentData, GeneratedQuestionItem)
// Ensure these are consistent or imported if defined in a shared types file.
export interface GeneratedQuestionItem {
  id?: string;
  question_text: string;
  question_type: "multiple_choice" | "true_false" | "short_answer";
  options?: string[];
  correct_answer: string;
  distractors?: string[]; // AI might generate these
  explanation?: string;
  order_in_quiz?: number;
  // TOS-related fields
  tos_content_area?: string; // Which content area this question belongs to
  tos_cognitive_level?: string; // Which cognitive level this question targets
}
export interface AssessmentDataForAction {
  // For payload from client
  id?: string; // For updates
  title: string;
  description?: string;
  source_type: "topic" | "text" | "lesson_plan_link" | "tos";
  source_content: string;
  generated_question_types: Array<
    "multiple_choice" | "true_false" | "short_answer"
  >;
  target_num_questions: number; // Total questions
  difficulty_level?: string;
  questions: GeneratedQuestionItem[]; // Editable questions from client
  linked_tos_id?: string; // Reference to the TOS template used
  linked_tos_data?: TOSTemplateForAssessment; // Full TOS data if needed client-side
}

// Import TOS types if they are in a shared location, or redefine simplified versions here
interface TOSCellDataForAssessment {
  // Information needed from a TOS cell
  contentAreaName: string;
  cognitiveSkillLevel: string;
  item_count_or_percent: number;
}
interface TOSTemplateForAssessment {
  // Simplified TOS structure to pass to action
  title: string;
  cognitive_skill_levels: string[];
  content_areas: Array<{ name: string }>; // Assuming content_areas in DB stores {name: string} objects
  cells: TOSCellDataForAssessment[];
  is_percentage_based: boolean;
  total_items_or_percent: number;
}

interface GenerateItemsResult {
  success: boolean;
  assessment_items?: GeneratedQuestionItem[]; // Only the AI generated items
  error?: string;
}
interface SaveAssessmentResult {
  success: boolean;
  quizId?: string; // Using 'quizId' to align with existing quiz table PK
  error?: string;
}

const groqApiKey = process.env.GROQ_API_KEY;
if (!groqApiKey)
  console.error("CRITICAL: GROQ_API_KEY for Assessment actions is not set.");
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

async function verifyTeacher(): Promise<{ user: any; error?: string }> {
  const supabase = createSupabaseServerActionClient();

  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) throw error;
    if (!session?.user) {
      return {
        user: null,
        error: "You must be logged in to perform this action.",
      };
    }

    // Verify the user is a teacher
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", session.user.id)
      .single();

    if (profileError) {
      console.error("Profile lookup error:", profileError);
      return { user: null, error: "Failed to verify teacher role." };
    }

    if (!profile || profile.role !== "teacher") {
      return { user: null, error: "Only teachers can perform this action." };
    }

    return { user: session.user };
  } catch (error: any) {
    console.error("Auth verification error:", error);
    return { user: null, error: error.message || "Authentication error." };
  }
}

// --- Generate Assessment Items Action ---
// Update the payload for generateAssessmentItemsAction
interface GenerateAssessmentItemsPayload {
  title: string; // Assessment title for context
  source_type: "topic" | "text" | "tos"; // Added "tos"
  source_content: string; // Topic, pasted text, or TOS ID / TOS Title for context
  question_types_requested: Array<
    "multiple_choice" | "true_false" | "short_answer"
  >;
  num_questions: number; // This might become the target total from TOS if sourceType is 'tos'
  difficulty_level?: string;
  linked_tos_data?: TOSTemplateForAssessment | null; // NEW: Full TOS data if source is 'tos'
}

export async function generateAssessmentItemsAction(
  payload: GenerateAssessmentItemsPayload
): Promise<GenerateItemsResult> {
  const authCheck = await verifyTeacher();
  if (authCheck.error || !authCheck.user)
    return { success: false, error: authCheck.error };
  if (!groq) return { success: false, error: "AI Service not configured." };

  const {
    title: assessmentTitle,
    source_type,
    source_content,
    question_types_requested,
    num_questions, // This is the overall target if not using TOS, or total from TOS
    difficulty_level,
    linked_tos_data,
  } = payload;

  // === RAG INTEGRATION START ===
  let retrievedContext = "";
  // Construct a query string from the assessment topic or text
  const queryTextForRAG =
    source_type === "topic"
      ? source_content
      : source_content.substring(0, 1000); // Limit text length for embedding

  if (queryTextForRAG) {
    const supabase = createSupabaseServerActionClient();
    console.log(
      `RAG (Assessment Generator): Generating embedding for assessment content`
    );
    const queryEmbedding = await getEmbeddingForText(queryTextForRAG);

    if (queryEmbedding && queryEmbedding.length === EMBEDDING_DIMENSION) {
      const { data: matchedChunks, error: matchError } = await supabase.rpc(
        "match_document_chunks",
        {
          query_embedding: queryEmbedding,
          match_threshold: 0.72,
          match_count: 4,
          user_id: authCheck.user.id,
        }
      );

      if (matchError) {
        console.error(`RAG Error (Assessment Generator):`, matchError.message);
      } else if (matchedChunks && matchedChunks.length > 0) {
        retrievedContext =
          "Use the following relevant content from the curriculum and learning materials to inform your question generation:\n\n<RELEVANT_CURRICULUM_CONTENT>\n";
        matchedChunks.forEach((chunk: any) => {
          retrievedContext += `${chunk.chunk_text}\n---\n`;
        });
        retrievedContext += "</RELEVANT_CURRICULUM_CONTENT>\n\n";
        console.log(
          `RAG (Assessment Generator): Retrieved ${matchedChunks.length} relevant chunks.`
        );
      } else {
        console.log(`RAG (Assessment Generator): No relevant chunks found.`);
      }
    } else {
      console.warn(
        `RAG (Assessment Generator): Could not generate valid embedding.`
      );
    }
  }
  // === RAG INTEGRATION END ===

  // Personalization: Fetch teacher's profile for grade level context
  const supabaseForProfile = createSupabaseServerActionClient();
  const { data: profileData } = await supabaseForProfile
    .from("profiles")
    .select("grade_level")
    .eq("id", authCheck.user.id)
    .single();
  const gradeContext =
    profileData?.grade_level && profileData.grade_level !== "Not Specified"
      ? `The teacher primarily teaches ${profileData.grade_level}. The assessment items should be suitable for this level.`
      : "The assessment items should be suitable for a general high school level.";

  const difficultyInstruction =
    difficulty_level && difficulty_level !== "medium"
      ? `The target difficulty for these questions is: ${difficulty_level}.`
      : "The target difficulty is medium (grade-appropriate).";

  let mainPromptSection = "";
  if (source_type === "tos" && linked_tos_data) {
    mainPromptSection = `Generate assessment items based on the following Table of Specifications (TOS) and the provided source text/topic ("${source_content}").
The TOS aims for a total of ${linked_tos_data.total_items_or_percent} ${
      linked_tos_data.is_percentage_based ? "%" : "items"
    }.
You need to generate ${num_questions} items in total for this request, distributed according to the TOS if possible.
TOS Structure:
- Cognitive Skill Levels: ${linked_tos_data.cognitive_skill_levels.join(", ")}
- Content Areas: ${linked_tos_data.content_areas
      .map((ca) => ca.name)
      .join(", ")}
TOS Cell Breakdown (Number of items or % per cell):`;
    linked_tos_data.cells.forEach((cell) => {
      if (cell.item_count_or_percent > 0) {
        // Only include cells that should have items
        mainPromptSection += `\n  - For Content Area "${
          cell.contentAreaName
        }" at Cognitive Skill Level "${cell.cognitiveSkillLevel}": ${
          cell.item_count_or_percent
        }${linked_tos_data.is_percentage_based ? "%" : " items"}.`;
      }
    });
    mainPromptSection += `\n\nGenerate questions that align with these content areas and cognitive levels as specified in the cell breakdown. The source text/topic provides the subject matter.`;
  } else if (source_type === "topic") {
    mainPromptSection = `The assessment items should be about the topic: "${source_content.trim()}". Generate questions covering key aspects of this topic.`;
  } else {
    // source_type === "text"
    mainPromptSection = `Generate assessment items based on the key information presented in the following text:\n---BEGIN SOURCE TEXT---\n${source_content
      .trim()
      .substring(0, 8000)}\n---END SOURCE TEXT---`;
  }

  // Distribute requested question types among num_questions (simple distribution for now)
  let typeDistributionPrompt =
    "Generate a mix of the following question types: " +
    question_types_requested.join(", ") +
    ".";
  if (question_types_requested.length === 1) {
    typeDistributionPrompt = `All questions should be of type: ${question_types_requested[0]}.`;
  }
  // More advanced: Specify how many of each type if user could input that.

  const prompt = `
You are Nova Pro, an expert AI assistant for creating educational assessments.
Assessment Title: "${assessmentTitle}"
${gradeContext}
${difficultyInstruction}

${retrievedContext}

Based on the assessment requirements AND THE PROVIDED CURRICULUM CONTENT (if any), please create high-quality assessment items.
If relevant curriculum content is provided, heavily favor the concepts, terminology, and knowledge points from it.
When creating questions, prioritize testing understanding of the material from the curriculum context.
If the context seems insufficient for creating specific questions, you may use your general knowledge but indicate which questions were created with limited context: "[Note: Created with limited curriculum context]".

${mainPromptSection}
Overall, generate exactly ${num_questions} unique assessment items.
${typeDistributionPrompt}

For each item, provide:
1.  "question_text": The question itself.
2.  "question_type": Must be one of [${question_types_requested
    .map((q) => `"${q}"`)
    .join(", ")}].
3.  "options": (ONLY for "multiple_choice") An array of 4 distinct string options. One of these must be the correct answer. The other three should be plausible distractors.
4.  "correct_answer": The correct answer. For multiple_choice, this is the exact text of the correct option. For true_false, it's "True" or "False". For short_answer, it's the ideal concise answer.
5.  "explanation": (Optional but highly recommended) A brief explanation of why the correct answer is correct, or a note for the teacher.

CRITICAL: The entire output MUST be a single, valid JSON array. Each object in the array represents one assessment item.
Do not include any text or explanation outside of this JSON array.
Ensure all property names are in double quotes.
Ensure there are no trailing commas in arrays or objects.
Ensure all strings are properly escaped.

Example for a "multiple_choice" item:
{
  "question_text": "What is the primary function of mitochondria?",
  "question_type": "multiple_choice",
  "options": ["Protein synthesis", "Energy production (ATP)", "Waste disposal", "Lipid storage"],
  "correct_answer": "Energy production (ATP)",
  "explanation": "Mitochondria are often called the powerhouses of the cell because they generate most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy."
}

Example for a "true_false" item:
{
  "question_text": "The Earth revolves around the Moon.",
  "question_type": "true_false",
  "correct_answer": "False",
  "explanation": "The Moon revolves around the Earth, and the Earth revolves around the Sun."
}

IMPORTANT: Your response must be a valid JSON array that can be parsed with JSON.parse(). Do not include any text before or after the JSON array.
Generate the JSON array of ${num_questions} assessment items now.
`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-70b-8192",
      temperature: 0.5, // Moderate temperature for creative but accurate questions
      max_tokens: 300 * num_questions, // Rough estimate
    });

    const rawResponse = completion.choices[0]?.message?.content?.trim();
    if (!rawResponse)
      return {
        success: false,
        error: "AI did not return any assessment items.",
      };

    // More robust JSON parsing logic
    console.log(
      "Raw AI response (preview):",
      rawResponse.substring(0, 100) + "..."
    );

    let parsedItems: GeneratedQuestionItem[] = [];

    try {
      // First attempt: Check for markdown code blocks
      const markdownJsonMatch = rawResponse.match(
        /```(?:json)?\s*([\s\S]*?)\s*```/
      );
      if (markdownJsonMatch && markdownJsonMatch[1]) {
        const jsonString = markdownJsonMatch[1].trim();
        parsedItems = JSON.parse(jsonString);
      }
      // Second attempt: Find array brackets
      else {
        const startBracket = rawResponse.indexOf("[");
        const endBracket = rawResponse.lastIndexOf("]");

        if (
          startBracket !== -1 &&
          endBracket !== -1 &&
          startBracket < endBracket
        ) {
          const jsonString = rawResponse.substring(
            startBracket,
            endBracket + 1
          );
          parsedItems = JSON.parse(jsonString);
        }
        // Third attempt: Try parsing the whole response
        else {
          parsedItems = JSON.parse(rawResponse);
        }
      }
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError.message);

      // Final attempt: Try to fix common JSON issues and parse again
      try {
        // Replace any special Unicode quotes with standard quotes
        let cleanedJson = rawResponse
          .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
          .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");

        // Fix trailing commas in arrays and objects
        cleanedJson = cleanedJson.replace(/,(\s*[\]}])/g, "$1");

        // Fix missing quotes around property names
        cleanedJson = cleanedJson.replace(
          /([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g,
          '$1"$2"$3'
        );

        // Fix missing commas between array items or object properties
        cleanedJson = cleanedJson.replace(/}(\s*){/g, "},\n$1{");

        // Fix extra commas
        cleanedJson = cleanedJson.replace(/,\s*,/g, ",");

        // Find the most likely JSON array in the text
        const arrayMatch = cleanedJson.match(/\[\s*\{.*\}\s*\]/s);
        if (arrayMatch) {
          parsedItems = JSON.parse(arrayMatch[0]);
        } else {
          // Try to manually extract and fix the JSON array
          console.log("Attempting manual JSON extraction and repair");

          // Extract what looks like a JSON array
          const manualExtract = cleanedJson.substring(
            cleanedJson.indexOf("["),
            cleanedJson.lastIndexOf("]") + 1
          );

          // Try to parse the manually extracted JSON
          parsedItems = JSON.parse(manualExtract);
        }
      } catch (fallbackError) {
        console.error(
          "Fallback JSON parsing also failed:",
          fallbackError.message
        );

        // Last resort: Try to manually create assessment items from the text
        try {
          console.log("Attempting to create fallback assessment items");

          // Create a minimal set of fallback items
          parsedItems = [
            {
              question_text:
                "The AI generated invalid JSON. This is a placeholder question.",
              question_type: "multiple_choice",
              options: [
                "The AI needs to be retrained",
                "There was a formatting error",
                "The prompt was too complex",
                "Try again with a simpler request",
              ],
              correct_answer: "There was a formatting error",
              explanation:
                "The AI generated a response that couldn't be parsed as valid JSON. Please try again.",
            },
          ];

          // Log the raw response for debugging
          console.error("Raw response that caused parsing error:", rawResponse);

          return {
            success: true,
            assessment_items: parsedItems,
            error:
              "Warning: Using fallback questions due to AI formatting error. Please try again.",
          };
        } catch (lastResortError) {
          throw new Error(
            "Failed to parse AI response as JSON: " + parseError.message
          );
        }
      }
    }

    if (!Array.isArray(parsedItems)) {
      throw new Error("AI response was parsed but is not a JSON array");
    }

    // Add order_in_quiz if not provided by AI
    const finalItems = parsedItems.map((item, index) => ({
      ...item,
      id: `temp-gen-${Date.now()}-${index}`, // Temp ID for client
      order_in_quiz: item.order_in_quiz || index + 1,
      // Ensure question_type from AI matches one of the requested types or default
      question_type: question_types_requested.includes(item.question_type)
        ? item.question_type
        : question_types_requested[0],
    }));

    return { success: true, assessment_items: finalItems };
  } catch (error: any) {
    console.error("Groq Assessment Item Generation Error:", error);
    return {
      success: false,
      error: `AI item generation failed: ${error.message}`,
    };
  }
}

// --- Save Assessment Action ---
// This will save/update data in 'quizzes' and 'quiz_questions' tables
export async function saveAssessmentAction(
  payload: AssessmentDataForAction // This comes from client, includes teacher edits
): Promise<SaveAssessmentResult> {
  const authCheck = await verifyTeacher();
  if (authCheck.error || !authCheck.user)
    return { success: false, error: authCheck.error };
  const teacherId = authCheck.user.id;

  const supabase = createSupabaseServerActionClient();
  const {
    id: assessmentIdToUpdate,
    title,
    description,
    source_type,
    source_content,
    questions,
    linked_tos_id,
    linked_tos_data,
  } = payload;

  if (!title || questions.length === 0) {
    return {
      success: false,
      error: "Assessment title and at least one question are required.",
    };
  }

  // Determine the overall quiz_type based on the questions present
  // For V1, we might assume all questions become part of a single "mixed" quiz type,
  // or if the teacher requested only one type, use that.
  // Let's assume the `quizzes.quiz_type` will store a general indicator, e.g., "teacher_assessment"
  const mainQuizType = "teacher_assessment"; // Or derive from payload.generated_question_types

  try {
    let currentQuizId = assessmentIdToUpdate;

    // 1. Upsert quiz metadata (quizzes table)
    const quizMetaData = {
      user_id: teacherId, // In quizzes table, user_id is the creator
      title: title,
      description: description || null,
      source_topic_or_text: `${source_type}: ${source_content.substring(
        0,
        200
      )}...`, // Brief record of source
      quiz_type: mainQuizType,
      num_questions_generated: questions.length, // Actual current number of questions
      updated_at: new Date().toISOString(),
      linked_tos_id: linked_tos_id || null, // Store reference to TOS if used
      tos_metadata: linked_tos_data
        ? JSON.stringify({
            title: linked_tos_data.title,
            is_percentage_based: linked_tos_data.is_percentage_based,
            total_items_or_percent: linked_tos_data.total_items_or_percent,
          })
        : null, // Store minimal TOS metadata for reference
    };

    if (currentQuizId) {
      // Update existing quiz metadata
      const { error: updateMetaError } = await supabase
        .from("quizzes")
        .update(quizMetaData)
        .eq("id", currentQuizId)
        .eq("user_id", teacherId);
      if (updateMetaError)
        throw new Error(
          `Failed to update assessment metadata: ${updateMetaError.message}`
        );
    } else {
      // Insert new quiz metadata
      const { data: newMetaData, error: insertMetaError } = await supabase
        .from("quizzes")
        .insert(quizMetaData)
        .select("id")
        .single();
      if (insertMetaError)
        throw new Error(
          `Failed to create assessment: ${insertMetaError.message}`
        );
      if (!newMetaData?.id)
        throw new Error("Failed to get ID for new assessment.");
      currentQuizId = newMetaData.id;
    }

    // 2. Manage quiz questions (quiz_questions table)
    // Delete existing questions for this quiz and re-insert the current batch from payload.
    // This is simpler than diffing for V1.
    if (currentQuizId) {
      const { error: deleteQuestionsError } = await supabase
        .from("quiz_questions")
        .delete()
        .eq("quiz_id", currentQuizId)
        .eq("user_id", teacherId);
      if (deleteQuestionsError)
        throw new Error(
          `Failed to clear old questions: ${deleteQuestionsError.message}`
        );
    }

    if (questions && questions.length > 0) {
      const questionsToInsert = questions.map((q, index) => {
        // Find TOS cell data for this question if available
        let tosMetadata = null;
        if (linked_tos_data && q.tos_content_area && q.tos_cognitive_level) {
          const matchingCell = linked_tos_data.cells.find(
            (cell) =>
              cell.contentAreaName === q.tos_content_area &&
              cell.cognitiveSkillLevel === q.tos_cognitive_level
          );
          if (matchingCell) {
            tosMetadata = {
              content_area: q.tos_content_area,
              cognitive_level: q.tos_cognitive_level,
              cell_value: matchingCell.item_count_or_percent,
            };
          }
        }

        return {
          quiz_id: currentQuizId,
          user_id: teacherId,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options || null,
          correct_answer: q.correct_answer,
          explanation: q.explanation || null,
          order_in_quiz: q.order_in_quiz || index + 1,
          tos_content_area: q.tos_content_area || null,
          tos_cognitive_level: q.tos_cognitive_level || null,
          tos_metadata: tosMetadata ? JSON.stringify(tosMetadata) : null,
        };
      });

      const { error: insertQuestionsError } = await supabase
        .from("quiz_questions")
        .insert(questionsToInsert);
      if (insertQuestionsError)
        throw new Error(
          `Failed to save assessment questions: ${insertQuestionsError.message}`
        );
    }

    revalidatePath("/teacher-portal/assessment-builder"); // Or assessment list page
    if (currentQuizId)
      revalidatePath(
        `/teacher-portal/assessment-builder/edit/${currentQuizId}`
      ); // If an edit page exists

    return { success: true, quizId: currentQuizId };
  } catch (error: any) {
    console.error("Error saving assessment:", error);
    return {
      success: false,
      error: `Could not save assessment: ${error.message}`,
    };
  }
}

interface SavedAssessmentMetaForClient {
  // For listing
  id: string;
  title: string;
  updated_at: string;
  question_count?: number; // From num_questions_generated
  quiz_type?: string; // from quizzes table
  linked_tos_id?: string; // Reference to TOS if used
  has_tos_data?: boolean; // Flag to indicate if this assessment uses a TOS
}

// --- Get Saved Assessments for Teacher ---
export async function getTeacherAssessmentsAction(): Promise<{
  success: boolean;
  assessments?: SavedAssessmentMetaForClient[];
  error?: string;
}> {
  const authCheck = await verifyTeacher();
  if (authCheck.error || !authCheck.user)
    return { success: false, error: authCheck.error };
  const supabase = createSupabaseServerActionClient();
  try {
    const { data, error } = await supabase
      .from("quizzes") // We are saving assessments into the 'quizzes' table
      .select(
        "id, title, updated_at, num_questions_generated, quiz_type, linked_tos_id, tos_metadata"
      )
      .eq("user_id", authCheck.user.id) // Filter by teacher's ID
      // Optional: add a filter here if you have a flag like `source_type = 'teacher_assessment'`
      .order("updated_at", { ascending: false });
    if (error) throw error;
    const assessments =
      data?.map((a) => ({
        ...a,
        question_count: a.num_questions_generated,
        linked_tos_id: a.linked_tos_id || undefined,
        has_tos_data: !!a.linked_tos_id || !!a.tos_metadata,
      })) || [];
    return { success: true, assessments };
  } catch (e: any) {
    console.error("Error fetching saved assessments:", e);
    return { success: false, error: e.message };
  }
}

// --- Get Full Assessment by ID for Editing ---
export async function getAssessmentByIdAction(assessmentId: string): Promise<{
  success: boolean;
  assessment?: AssessmentDataForAction; // Returns structure client uses for editing
  error?: string;
}> {
  const authCheck = await verifyTeacher();
  if (authCheck.error || !authCheck.user)
    return { success: false, error: authCheck.error };
  if (!assessmentId)
    return { success: false, error: "Assessment ID is required." };
  const supabase = createSupabaseServerActionClient();
  try {
    // 1. Fetch quiz metadata
    const { data: quizMeta, error: metaError } = await supabase
      .from("quizzes")
      .select(
        "id, title, description, source_topic_or_text, quiz_type, num_questions_generated, linked_tos_id, tos_metadata"
      ) // Add fields needed for form
      .eq("id", assessmentId)
      .eq("user_id", authCheck.user.id)
      .single();
    if (metaError || !quizMeta)
      return {
        success: false,
        error: metaError?.message || "Assessment not found.",
      };
    // 2. Fetch quiz questions
    const { data: questions, error: questionsError } = await supabase
      .from("quiz_questions")
      .select(
        "id, question_text, question_type, options, correct_answer, explanation, order_in_quiz, tos_content_area, tos_cognitive_level, tos_metadata"
      )
      .eq("quiz_id", assessmentId)
      .eq("user_id", authCheck.user.id) // Ensure questions also belong to the teacher via quiz_id user_id
      .order("order_in_quiz", { ascending: true });
    if (questionsError) throw questionsError;
    // Parse source_topic_or_text back into source_type and source_content (if possible/needed)
    // This depends on how you stored it. Example: "topic: Photosynthesis"
    let sourceType: "topic" | "text" | "lesson_plan_link" | "tos" = "topic";
    let sourceContent = quizMeta.source_topic_or_text || "";

    if (quizMeta.linked_tos_id) {
      // If there's a linked TOS, set the source type to "tos"
      sourceType = "tos";
      // Source content could be the TOS title or ID for reference
      if (quizMeta.tos_metadata) {
        try {
          const tosMetadata = JSON.parse(quizMeta.tos_metadata);
          sourceContent = tosMetadata.title || `TOS: ${quizMeta.linked_tos_id}`;
        } catch (e) {
          sourceContent = `TOS: ${quizMeta.linked_tos_id}`;
        }
      } else {
        sourceContent = `TOS: ${quizMeta.linked_tos_id}`;
      }
    } else if (quizMeta.source_topic_or_text?.startsWith("topic: ")) {
      sourceType = "topic";
      sourceContent = quizMeta.source_topic_or_text.replace("topic: ", "");
    } else if (quizMeta.source_topic_or_text?.startsWith("tos: ")) {
      sourceType = "tos";
      sourceContent = quizMeta.source_topic_or_text.replace("tos: ", "");
    } else if (quizMeta.source_topic_or_text) {
      // Assume text if not explicitly topic or tos
      sourceType = "text"; // Or have a dedicated field in DB
    }
    // Process TOS data if available
    let linkedTosData: TOSTemplateForAssessment | undefined = undefined;
    if (quizMeta.linked_tos_id && quizMeta.tos_metadata) {
      try {
        // This is a simplified version - in a real implementation, you might fetch the full TOS data
        const tosMetadata = JSON.parse(quizMeta.tos_metadata);
        linkedTosData = {
          title: tosMetadata.title || "TOS Template",
          cognitive_skill_levels: [], // Would need to be populated from actual TOS data
          content_areas: [], // Would need to be populated from actual TOS data
          cells: [], // Would need to be populated from actual TOS data
          is_percentage_based: tosMetadata.is_percentage_based || false,
          total_items_or_percent: tosMetadata.total_items_or_percent || 0,
        };

        // Extract unique content areas and cognitive levels from questions
        if (questions && questions.length > 0) {
          const contentAreas = new Set<string>();
          const cognitiveLevels = new Set<string>();
          const cells: TOSCellDataForAssessment[] = [];

          questions.forEach((q) => {
            if (q.tos_content_area) contentAreas.add(q.tos_content_area);
            if (q.tos_cognitive_level)
              cognitiveLevels.add(q.tos_cognitive_level);

            // Add cell data if both content area and cognitive level are present
            if (q.tos_content_area && q.tos_cognitive_level) {
              // Check if cell already exists
              const existingCell = cells.find(
                (cell) =>
                  cell.contentAreaName === q.tos_content_area &&
                  cell.cognitiveSkillLevel === q.tos_cognitive_level
              );

              if (!existingCell) {
                // Extract cell value from metadata if available
                let cellValue = 0;
                if (q.tos_metadata) {
                  try {
                    const cellMetadata = JSON.parse(q.tos_metadata);
                    cellValue = cellMetadata.cell_value || 0;
                  } catch (e) {
                    // Ignore parsing errors
                  }
                }

                cells.push({
                  contentAreaName: q.tos_content_area,
                  cognitiveSkillLevel: q.tos_cognitive_level,
                  item_count_or_percent: cellValue,
                });
              }
            }
          });

          linkedTosData.cognitive_skill_levels = Array.from(cognitiveLevels);
          linkedTosData.content_areas = Array.from(contentAreas).map(
            (name) => ({ name })
          );
          linkedTosData.cells = cells;
        }
      } catch (e) {
        console.error("Error parsing TOS metadata:", e);
      }
    }

    const assessmentData: AssessmentDataForAction = {
      id: quizMeta.id,
      title: quizMeta.title,
      description: quizMeta.description || undefined,
      source_type: sourceType, // Requires parsing or a dedicated DB field
      source_content: sourceContent,
      // generated_question_types needs to be inferred or stored
      // For now, assume it's a mix or client handles default selection
      generated_question_types: (questions
        ?.map((q) => q.question_type)
        .filter((value, index, self) => self.indexOf(value) === index) || [
        "multiple_choice",
      ]) as Array<"multiple_choice" | "true_false" | "short_answer">,
      target_num_questions:
        quizMeta.num_questions_generated || questions?.length || 0,
      linked_tos_id: quizMeta.linked_tos_id || undefined,
      linked_tos_data: linkedTosData,
      // difficulty_level not stored on quizMeta, would need a DB field if want to load it
      questions: (questions || []).map((q) => ({
        ...q,
        id: q.id || undefined,
        tos_content_area: q.tos_content_area || undefined,
        tos_cognitive_level: q.tos_cognitive_level || undefined,
      })) as GeneratedQuestionItem[], // Map DB question to client question type
    };
    return { success: true, assessment: assessmentData };
  } catch (e: any) {
    console.error(`Error fetching assessment ${assessmentId}:`, e);
    return { success: false, error: e.message };
  }
}

// --- Delete Assessment ---
export async function deleteAssessmentAction(assessmentId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const authCheck = await verifyTeacher();
  if (authCheck.error || !authCheck.user)
    return { success: false, error: authCheck.error };
  if (!assessmentId)
    return { success: false, error: "Assessment ID is required." };
  const supabase = createSupabaseServerActionClient();
  try {
    // Deleting from 'quizzes' table. CASCADE on 'quiz_questions.quiz_id' should delete questions.
    const { error } = await supabase
      .from("quizzes")
      .delete()
      .eq("id", assessmentId)
      .eq("user_id", authCheck.user.id);
    if (error) throw error;
    revalidatePath("/teacher-portal/assessment-builder");
    return { success: true };
  } catch (e: any) {
    console.error(`Error deleting assessment ${assessmentId}:`, e);
    return { success: false, error: e.message };
  }
}

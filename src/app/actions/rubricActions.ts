// src/app/actions/rubricActions.ts
"use server";

import Groq from "groq-sdk";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getEmbeddingForText, EMBEDDING_DIMENSION } from "@/lib/aiUtils";

// Types should mirror what's used on the client (GeneratedRubric, RubricCriterionData)
// For AI Generation Payload
interface GenerateRubricPayload {
  assignment_title: string;
  assignment_description: string;
  learning_objectives_context: string;
  performance_level_names: string[]; // e.g., ["Exemplary", "Proficient", "Developing"]
}

// For saving/updating full rubric structure
interface RubricToSave {
  id?: string; // Present if updating
  teacher_id?: string; // Will be set from authenticated user
  title: string;
  assignment_description?: string | null;
  learning_objectives_context?: string | null;
  performance_levels: string[]; // JSONB array
  criteria: Array<{
    // This structure will be stored in rubric_criteria table
    id?: string; // Present if updating a specific criterion
    criterion_title: string;
    criterion_description?: string | null;
    descriptors_by_level: { [level: string]: string }; // JSONB object
    weight?: number | null;
    order_in_rubric?: number;
  }>;
}

interface RubricGenerationResult {
  success: boolean;
  rubric?: {
    // The AI generated parts, client will merge with user inputs
    criteria: Array<{
      criterion_title: string;
      criterion_description?: string;
      descriptors_by_level: { [level: string]: string };
    }>;
  };
  error?: string;
}

interface SaveRubricResult {
  success: boolean;
  rubricId?: string;
  error?: string;
}

interface SavedRubricMetaForClient {
  id: string;
  title: string;
  updated_at: string;
}

const groqApiKey = process.env.GROQ_API_KEY;
if (!groqApiKey)
  console.error("CRITICAL: GROQ_API_KEY for Rubric actions is not set.");
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

// Helper to ensure only admin/teacher can perform these actions
async function verifyTeacher(): Promise<{ user: any; error?: string }> {
  const supabase = createSupabaseServerActionClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { user: null, error: "Not authenticated." };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    (profile.role !== "teacher" && profile.role !== "admin")
  ) {
    return {
      user: null,
      error: "User is not authorized as a teacher or admin.",
    };
  }
  return { user };
}

// --- Generate Rubric Draft Action ---
export async function generateRubricAction(
  payload: GenerateRubricPayload
): Promise<RubricGenerationResult> {
  const authCheck = await verifyTeacher();
  if (authCheck.error || !authCheck.user)
    return { success: false, error: authCheck.error };
  if (!groq) return { success: false, error: "AI Service not configured." };

  const {
    assignment_title,
    assignment_description,
    learning_objectives_context,
    performance_level_names,
  } = payload;

  if (
    !assignment_description ||
    !learning_objectives_context ||
    performance_level_names.length === 0
  ) {
    return {
      success: false,
      error:
        "Assignment description, objectives, and performance levels are required.",
    };
  }

  // === RAG INTEGRATION START ===
  let retrievedContext = "";
  // Construct a query string from relevant inputs for embedding
  const queryTextForRAG =
    `${assignment_description} ${learning_objectives_context} rubric criteria`.trim();
  if (queryTextForRAG) {
    console.log(
      `RAG (Rubric Generator): Generating embedding for assessment content`
    );
    const queryEmbedding = await getEmbeddingForText(queryTextForRAG);
    if (queryEmbedding && queryEmbedding.length === EMBEDDING_DIMENSION) {
      const { data: matchedChunks, error: matchError } = await supabase.rpc(
        "match_document_chunks",
        {
          query_embedding: queryEmbedding,
          match_threshold: 0.75,
          match_count: 3,
          user_id: authCheck.user.id,
        }
      );
      if (matchError) {
        console.error(`RAG Error (Rubric Generator):`, matchError.message);
      } else if (matchedChunks && matchedChunks.length > 0) {
        retrievedContext =
          "Consider the following relevant information from curriculum standards and assessment examples when drafting this rubric:\n\n<ASSESSMENT_CONTEXT>\n";
        matchedChunks.forEach((chunk: any) => {
          retrievedContext += `${chunk.chunk_text}\n---\n`;
        });
        retrievedContext += "</ASSESSMENT_CONTEXT>\n\n";
        console.log(
          `RAG (Rubric Generator): Retrieved ${matchedChunks.length} relevant chunks.`
        );
      } else {
        console.log(`RAG (Rubric Generator): No relevant chunks found.`);
      }
    } else {
      console.warn(
        `RAG (Rubric Generator): Could not generate valid embedding.`
      );
    }
  }
  // === RAG INTEGRATION END ===

  const levelsString = performance_level_names.join(", ");
  const numberOfCriteria = 4; // Or make this dynamic based on assignment complexity/user input

  const prompt = `
You are Nova Pro, an expert AI assistant for educators, specializing in creating detailed assessment rubrics.

${retrievedContext}

Based on the teacher's requirements AND THE PROVIDED ASSESSMENT CONTEXT (if any), please create a detailed assessment rubric.
If assessment context is provided, heavily favor the assessment criteria, terminology, and standards mentioned in it.
If the context seems insufficient for a specific criterion, you may use your general knowledge but indicate where you had to supplement with: "[Note: Limited assessment context for this criterion]".

Assignment Title: "${assignment_title}"
Assignment Description/Prompt: "${assignment_description}"
Key Learning Objectives/Skills to Assess: "${learning_objectives_context}"
Performance Levels (from highest to lowest): ${levelsString}

Generate a draft rubric with ${numberOfCriteria} distinct assessment criteria.
For each criterion:
1.  Provide a concise "criterion_title" (e.g., "Clarity of Argument," "Use of Evidence," "Technical Skill Application").
2.  (Optional) Provide a brief "criterion_description" explaining what this criterion assesses.
3.  For EACH performance level (${levelsString}), write a clear, specific, and observable "descriptor_by_level" detailing what performance at that level looks like for that criterion.

The output MUST be a single, valid JSON object. Do not include any text outside of this JSON object.
The JSON object should have a single root key named "criteria".
The value of "criteria" should be an array of criterion objects.
Each criterion object in the array MUST have these keys:
- "criterion_title": A string for the criterion's main title.
- "criterion_description": (Optional) A string further explaining the criterion.
- "descriptors_by_level": An object where each key is one of the performance level names (e.g., "${performance_level_names[0]}", "${performance_level_names[1]}") and its value is the string descriptor for that level and criterion.

Example of a single criterion object (assuming levels: "Exemplary", "Proficient", "Developing"):
{
  "criterion_title": "Use of Evidence",
  "criterion_description": "Effectiveness in selecting and integrating credible evidence to support claims.",
  "descriptors_by_level": {
    "${performance_level_names[0]}": "Evidence is consistently relevant, compelling, and skillfully integrated to strongly support all claims. Analysis of evidence is insightful.",
    "${performance_level_names[1]}": "Evidence is relevant and adequately supports most claims. Analysis of evidence is clear.",
    "${performance_level_names[2]}": "Evidence may be sometimes irrelevant or insufficient to support claims. Analysis of evidence is superficial or missing."
    // ... and so on for all levels provided
  }
}

Generate the JSON object containing only the "criteria" array now.
`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-70b-8192",
      temperature: 0.4,
      max_tokens: 3000, // Allow ample space for detailed rubric
    });

    const rawResponse = completion.choices[0]?.message?.content?.trim();
    if (!rawResponse)
      return { success: false, error: "AI did not return rubric content." };

    let jsonStringToParse = rawResponse;
    // ... (Robust JSON parsing logic for an object with a "criteria" key)
    const markdownJsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/);
    if (markdownJsonMatch && markdownJsonMatch[1])
      jsonStringToParse = markdownJsonMatch[1].trim();
    else {
      const objectStartIndex = rawResponse.indexOf("{");
      if (objectStartIndex !== -1)
        jsonStringToParse = rawResponse.substring(objectStartIndex);
      else
        throw new Error(
          "AI response does not appear to contain JSON for rubric."
        );
    }

    const parsedData = JSON.parse(jsonStringToParse);

    if (!parsedData || !Array.isArray(parsedData.criteria)) {
      console.error(
        "Parsed rubric data is not in expected format { criteria: [...] }:",
        parsedData
      );
      throw new Error(
        "AI returned rubric criteria in an unexpected structure."
      );
    }

    // Further validation of criteria structure can be added here

    return { success: true, rubric: { criteria: parsedData.criteria } };
  } catch (error: any) {
    console.error("Groq Rubric Generation Error:", error);
    return {
      success: false,
      error: `AI rubric generation failed: ${error.message}`,
    };
  }
}

// --- Save/Update Rubric Action ---
export async function saveRubricAction(
  payload: RubricToSave
): Promise<SaveRubricResult> {
  const authCheck = await verifyTeacher();
  if (authCheck.error || !authCheck.user)
    return { success: false, error: authCheck.error };
  const teacherId = authCheck.user.id;

  const supabase = createSupabaseServerActionClient();

  const {
    id: rubricId,
    title,
    assignment_description,
    learning_objectives_context,
    performance_levels,
    criteria,
  } = payload;

  // Upsert logic for rubric metadata and criteria
  // This often involves a transaction if your DB supports it well with Supabase client,
  // or sequential operations with careful error handling.

  try {
    let currentRubricId = rubricId;

    // 1. Upsert rubric metadata (rubrics table)
    const rubricMetaData = {
      teacher_id: teacherId,
      title: title,
      assignment_description: assignment_description || null,
      learning_objectives_context: learning_objectives_context || null,
      performance_levels: performance_levels, // Array of strings
      updated_at: new Date().toISOString(),
    };

    if (currentRubricId) {
      // Update existing rubric metadata
      const { error: updateMetaError } = await supabase
        .from("rubrics")
        .update(rubricMetaData)
        .eq("id", currentRubricId)
        .eq("teacher_id", teacherId); // Ensure ownership
      if (updateMetaError)
        throw new Error(
          `Failed to update rubric metadata: ${updateMetaError.message}`
        );
    } else {
      // Insert new rubric metadata
      const { data: newMetaData, error: insertMetaError } = await supabase
        .from("rubrics")
        .insert(rubricMetaData)
        .select("id")
        .single();
      if (insertMetaError)
        throw new Error(`Failed to create rubric: ${insertMetaError.message}`);
      if (!newMetaData?.id) throw new Error("Failed to get ID for new rubric.");
      currentRubricId = newMetaData.id;
    }

    // 2. Manage rubric criteria (rubric_criteria table)
    // For simplicity in V1, let's delete existing criteria and re-insert.
    // A more advanced approach would be to diff and update/insert/delete individual criteria.
    if (currentRubricId) {
      const { error: deleteCritError } = await supabase
        .from("rubric_criteria")
        .delete()
        .eq("rubric_id", currentRubricId)
        .eq("teacher_id", teacherId); // Ensure ownership
      if (deleteCritError)
        throw new Error(
          `Failed to clear old criteria: ${deleteCritError.message}`
        );
    }

    if (criteria && criteria.length > 0) {
      const criteriaToInsert = criteria.map((crit, index) => ({
        rubric_id: currentRubricId,
        teacher_id: teacherId,
        criterion_title: crit.criterion_title,
        criterion_description: crit.criterion_description || null,
        descriptors_by_level: crit.descriptors_by_level, // JSON object
        weight: crit.weight || null,
        order_in_rubric: crit.order_in_rubric || index + 1,
      }));

      const { error: insertCritError } = await supabase
        .from("rubric_criteria")
        .insert(criteriaToInsert);
      if (insertCritError)
        throw new Error(
          `Failed to save rubric criteria: ${insertCritError.message}`
        );
    }

    revalidatePath("/teacher-portal/rubric-generator");
    if (currentRubricId)
      revalidatePath(`/teacher-portal/rubric-generator/${currentRubricId}`); // If an edit page exists

    return { success: true, rubricId: currentRubricId };
  } catch (error: any) {
    console.error("Error saving rubric:", error);
    return { success: false, error: `Could not save rubric: ${error.message}` };
  }
}

// --- Placeholder Actions for Listing, Getting by ID, Deleting Rubrics ---
// These will be similar to the lessonPlanActions

export async function getSavedRubricsAction(): Promise<{
  success: boolean;
  rubrics?: SavedRubricMetaForClient[];
  error?: string;
}> {
  const authCheck = await verifyTeacher();
  if (authCheck.error || !authCheck.user)
    return { success: false, error: authCheck.error };
  const supabase = createSupabaseServerActionClient();
  const { data, error } = await supabase
    .from("rubrics")
    .select("id, title, updated_at")
    .eq("teacher_id", authCheck.user.id)
    .order("updated_at", { ascending: false });
  if (error) return { success: false, error: error.message };
  return { success: true, rubrics: data || [] };
}

export async function getRubricByIdAction(
  rubricId: string
): Promise<{ success: boolean; rubric?: RubricToSave; error?: string }> {
  const authCheck = await verifyTeacher();
  if (authCheck.error || !authCheck.user)
    return { success: false, error: authCheck.error };
  const supabase = createSupabaseServerActionClient();

  if (!rubricId) return { success: false, error: "Rubric ID is required." };

  const { data: rubricMeta, error: metaError } = await supabase
    .from("rubrics")
    .select("*")
    .eq("id", rubricId)
    .eq("teacher_id", authCheck.user.id)
    .single();
  if (metaError || !rubricMeta)
    return { success: false, error: metaError?.message || "Rubric not found." };

  const { data: criteria, error: critError } = await supabase
    .from("rubric_criteria")
    .select("*")
    .eq("rubric_id", rubricId)
    .order("order_in_rubric", { ascending: true });
  if (critError) return { success: false, error: critError.message };

  return { success: true, rubric: { ...rubricMeta, criteria: criteria || [] } };
}

export async function deleteRubricAction(
  rubricId: string
): Promise<{ success: boolean; error?: string }> {
  const authCheck = await verifyTeacher();
  if (authCheck.error || !authCheck.user)
    return { success: false, error: authCheck.error };
  const supabase = createSupabaseServerActionClient();
  if (!rubricId) return { success: false, error: "Rubric ID is required." };

  // ON DELETE CASCADE on rubric_criteria.rubric_id should handle deleting criteria
  const { error } = await supabase
    .from("rubrics")
    .delete()
    .eq("id", rubricId)
    .eq("teacher_id", authCheck.user.id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/teacher-portal/rubric-generator");
  return { success: true };
}

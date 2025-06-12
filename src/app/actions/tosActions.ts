// src/app/actions/tosActions.ts
"use server";

import Groq from "groq-sdk";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Type for what client sends for a full TOS template (matches client-side TOSTemplateData)
export interface TOSTemplateClientData {
  id?: string;
  title: string;
  description?: string;
  cognitive_skill_levels: string[];
  content_areas: Array<{ id: string; name: string }>; // Assuming client manages its own IDs for areas
  cells: Array<{
    contentAreaName: string;
    cognitiveSkillLevel: string;
    item_count_or_percent: number;
    learning_objectives_covered?: string[];
  }>;
  total_items_or_percent: number | string;
  is_percentage_based: boolean;
}

interface ClassifiedObjective {
  objective_text: string;
  suggested_cognitive_level: string; // e.g., "Remembering", "Applying"
  confidence?: string; // e.g., "High", "Medium"
  reasoning?: string; // AI's reason for classification
}

interface ClassifyResult {
  success: boolean;
  classified_objectives?: ClassifiedObjective[];
  error?: string;
}

interface SaveTOSResult {
  success: boolean;
  tosId?: string;
  error?: string;
}

// Basic meta for listing saved TOS templates
interface SavedTOSMeta {
  id: string;
  title: string;
  updated_at: string;
}

const groqApiKey = process.env.GROQ_API_KEY;
if (!groqApiKey)
  console.error("CRITICAL: GROQ_API_KEY for TOS actions is not set.");
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

// --- AI Action to Classify Learning Objectives ---
export async function classifyObjectivesAction(
  objectives: string[] // Array of objective strings
): Promise<ClassifyResult> {
  const authCheck = await verifyTeacher();
  if (authCheck.error || !authCheck.user)
    return { success: false, error: authCheck.error };
  if (!groq) return { success: false, error: "AI Service not configured." };
  if (!objectives || objectives.length === 0)
    return { success: false, error: "No objectives provided." };

  const objectivesListString = objectives
    .map((obj, i) => `${i + 1}. ${obj}`)
    .join("\n");
  const defaultBloomLevels = [
    "Remembering",
    "Understanding",
    "Applying",
    "Analyzing",
    "Evaluating",
    "Creating",
  ];

  const prompt = `
You are Nova Pro, an expert in educational pedagogy and Bloom's Taxonomy.
A teacher has provided the following list of learning objectives. For each objective, classify it into one of the following Bloom's Taxonomy cognitive skill levels: ${defaultBloomLevels.join(
    ", "
  )}.

Learning Objectives:
${objectivesListString}

IMPORTANT: You must respond ONLY with a valid JSON array. Do not include any explanatory text before or after the JSON. Each object in the array should correspond to one input objective and MUST have the following keys:
- "objective_text": The original learning objective string.
- "suggested_cognitive_level": Your classification of the objective into one of the provided Bloom's levels.
- "confidence": Your confidence in this classification (e.g., "High", "Medium", "Low").
- "reasoning": A brief justification for your classification.

Here is an example of the exact format to follow:
[
  {
    "objective_text": "Students will be able to list the three branches of government.",
    "suggested_cognitive_level": "Remembering",
    "confidence": "High",
    "reasoning": "This objective requires recall of factual information."
  },
  {
    "objective_text": "Students will analyze the causes of World War II.",
    "suggested_cognitive_level": "Analyzing",
    "confidence": "High",
    "reasoning": "This objective requires breaking down information and examining relationships."
  }
]

Your response must be ONLY the JSON array, without any additional text, explanations, or markdown formatting.
`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are an AI assistant that responds only with valid JSON when requested. Never include explanatory text outside of the JSON structure.",
        },
        { role: "user", content: prompt },
      ],
      model: "llama3-70b-8192", // Good for classification and reasoning
      temperature: 0.1, // Very low temp for deterministic classification and valid JSON
      max_tokens: 1500, // Allow space for classifications
      // Using text format and relying on the JSON extraction logic below
      response_format: { type: "text" },
    });

    const rawResponse = completion.choices[0]?.message?.content?.trim();
    if (!rawResponse)
      return { success: false, error: "AI did not return classification." };

    let jsonStringToParse = rawResponse;

    // Try to extract JSON from markdown code blocks
    const markdownJsonMatch = rawResponse.match(
      /```(?:json)?\s*([\s\S]*?)\s*```/
    );
    if (markdownJsonMatch && markdownJsonMatch[1]) {
      jsonStringToParse = markdownJsonMatch[1].trim();
    } else {
      // Try to find an array in the text (starting with [ and ending with ])
      const arrayMatch = rawResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        jsonStringToParse = arrayMatch[0];
      } else {
        // If the response starts with text explanation, try to find the JSON part
        const jsonStartIndex = rawResponse.indexOf("[");
        const jsonEndIndex = rawResponse.lastIndexOf("]");

        if (
          jsonStartIndex !== -1 &&
          jsonEndIndex !== -1 &&
          jsonEndIndex > jsonStartIndex
        ) {
          jsonStringToParse = rawResponse.substring(
            jsonStartIndex,
            jsonEndIndex + 1
          );
        }
      }
    }

    // Additional cleanup and validation
    console.log(
      "Extracted JSON string to parse:",
      jsonStringToParse.substring(0, 100) + "..."
    );

    // Try parsing the extracted JSON
    let classifiedObjectives;
    try {
      classifiedObjectives = JSON.parse(
        jsonStringToParse
      ) as ClassifiedObjective[];
    } catch (parseError) {
      console.error("JSON parsing error:", parseError);

      // If parsing fails, try one more approach - manually construct the JSON
      // This is for cases where the AI returns almost-valid JSON with minor formatting issues
      return {
        success: false,
        error: `Could not parse AI response as JSON. Raw response snippet: "${rawResponse.substring(
          0,
          100
        )}..."`,
      };
    }
    if (
      !Array.isArray(classifiedObjectives) ||
      (classifiedObjectives.length > 0 &&
        !classifiedObjectives.every(
          (o) => o.objective_text && o.suggested_cognitive_level
        ))
    ) {
      throw new Error(
        "AI returned classifications in an unexpected structure."
      );
    }

    return { success: true, classified_objectives: classifiedObjectives };
  } catch (error: any) {
    console.error("Groq Objective Classification Error:", error);
    return {
      success: false,
      error: `AI objective classification failed: ${error.message}`,
    };
  }
}

// --- Save/Update TOS Template Action ---
export async function saveTOSTemplateAction(
  payload: TOSTemplateClientData
): Promise<SaveTOSResult> {
  const authCheck = await verifyTeacher();
  if (authCheck.error || !authCheck.user)
    return { success: false, error: authCheck.error };
  const teacherId = authCheck.user.id;

  const supabase = createSupabaseServerActionClient();
  const {
    id: tosIdToUpdate,
    title,
    description,
    cognitive_skill_levels,
    content_areas,
    cells,
    total_items_or_percent,
    is_percentage_based,
  } = payload;

  if (
    !title ||
    cognitive_skill_levels.length === 0 ||
    content_areas.length === 0
  ) {
    return {
      success: false,
      error: "Title, cognitive skills, and content areas are required.",
    };
  }

  try {
    let currentTOSId = tosIdToUpdate;

    // 1. Upsert TOS metadata (tos_templates table)
    const tosMetaData = {
      teacher_id: teacherId,
      title,
      description: description || null,
      cognitive_skill_levels, // Array of strings
      content_areas: content_areas.map((ca) => ({ name: ca.name })), // Store only names, or full objects if needed
      total_items_or_percent:
        Number(total_items_or_percent) || (is_percentage_based ? 100 : null),
      // is_percentage_based is not directly on tos_templates in current schema, but useful for re-loading logic
      updated_at: new Date().toISOString(),
    };

    if (currentTOSId) {
      // Update
      const { error: updateMetaError } = await supabase
        .from("tos_templates")
        .update(tosMetaData)
        .eq("id", currentTOSId)
        .eq("teacher_id", teacherId);
      if (updateMetaError)
        throw new Error(
          `Failed to update TOS metadata: ${updateMetaError.message}`
        );
    } else {
      // Insert
      const { data: newMetaData, error: insertMetaError } = await supabase
        .from("tos_templates")
        .insert(tosMetaData)
        .select("id")
        .single();
      if (insertMetaError)
        throw new Error(`Failed to create TOS: ${insertMetaError.message}`);
      if (!newMetaData?.id) throw new Error("Failed to get ID for new TOS.");
      currentTOSId = newMetaData.id;
    }

    // 2. Manage TOS cells (tos_cells table) - delete old and re-insert
    if (currentTOSId) {
      const { error: deleteCellsError } = await supabase
        .from("tos_cells")
        .delete()
        .eq("tos_template_id", currentTOSId)
        .eq("teacher_id", teacherId);
      if (deleteCellsError)
        throw new Error(
          `Failed to clear old TOS cells: ${deleteCellsError.message}`
        );
    }

    if (cells && cells.length > 0 && currentTOSId) {
      const cellsToInsert = cells.map((cell) => ({
        tos_template_id: currentTOSId,
        teacher_id: teacherId,
        content_area_name: cell.contentAreaName,
        cognitive_skill_level: cell.cognitiveSkillLevel,
        item_count_or_percent: cell.item_count_or_percent, // Already number or "" from client
        // learning_objectives_covered: cell.learning_objectives_covered || null, // If collecting this
      }));
      const { error: insertCellsError } = await supabase
        .from("tos_cells")
        .insert(cellsToInsert);
      if (insertCellsError)
        throw new Error(
          `Failed to save TOS cells: ${insertCellsError.message}`
        );
    }

    revalidatePath("/teacher-portal/tos-builder");
    return { success: true, tosId: currentTOSId };
  } catch (error: any) {
    console.error("Error saving TOS template:", error);
    return { success: false, error: `Could not save TOS: ${error.message}` };
  }
}

// --- Actions for Listing, Getting by ID, Deleting TOS Templates ---
export async function getSavedTOSTemplatesAction(): Promise<{
  success: boolean;
  templates?: SavedTOSMeta[];
  error?: string;
}> {
  const authCheck = await verifyTeacher();
  if (authCheck.error || !authCheck.user)
    return { success: false, error: authCheck.error };

  const supabase = createSupabaseServerActionClient();
  try {
    const { data, error } = await supabase
      .from("tos_templates")
      .select("id, title, updated_at")
      .eq("teacher_id", authCheck.user.id)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    return {
      success: true,
      templates: data || [],
    };
  } catch (e: any) {
    console.error("Error fetching saved TOS templates:", e);
    return { success: false, error: e.message };
  }
}

export async function getTOSTemplateByIdAction(templateId: string): Promise<{
  success: boolean;
  template?: TOSTemplateClientData;
  error?: string;
}> {
  const authCheck = await verifyTeacher();
  if (authCheck.error || !authCheck.user)
    return { success: false, error: authCheck.error };
  if (!templateId) return { success: false, error: "Template ID is required." };

  const supabase = createSupabaseServerActionClient();
  try {
    // 1. Fetch TOS metadata
    const { data: tosMeta, error: metaError } = await supabase
      .from("tos_templates")
      .select(
        "id, title, description, cognitive_skill_levels, content_areas, total_items_or_percent"
      )
      .eq("id", templateId)
      .eq("teacher_id", authCheck.user.id)
      .single();

    if (metaError || !tosMeta)
      return {
        success: false,
        error: metaError?.message || "TOS template not found.",
      };

    // 2. Fetch TOS cells
    const { data: cells, error: cellsError } = await supabase
      .from("tos_cells")
      .select("content_area_name, cognitive_skill_level, item_count_or_percent")
      .eq("tos_template_id", templateId)
      .eq("teacher_id", authCheck.user.id);

    if (cellsError) throw cellsError;

    // Determine if percentage based based on total value
    const is_percentage_based =
      typeof tosMeta.total_items_or_percent === "number" &&
      tosMeta.total_items_or_percent <= 100 &&
      tosMeta.total_items_or_percent > 0;

    // Map content areas to expected format for client
    const contentAreas = tosMeta.content_areas.map((ca: any) => ({
      id: ca.name, // Using name as ID for simplicity
      name: ca.name,
    }));

    // Reconstruct for client
    const template: TOSTemplateClientData = {
      id: tosMeta.id,
      title: tosMeta.title,
      description: tosMeta.description || undefined,
      cognitive_skill_levels: tosMeta.cognitive_skill_levels,
      content_areas: contentAreas,
      cells:
        cells?.map((cell) => ({
          contentAreaName: cell.content_area_name,
          cognitiveSkillLevel: cell.cognitive_skill_level,
          item_count_or_percent: cell.item_count_or_percent || 0,
        })) || [],
      total_items_or_percent:
        tosMeta.total_items_or_percent || (is_percentage_based ? 100 : 0),
      is_percentage_based: is_percentage_based,
    };

    return { success: true, template };
  } catch (e: any) {
    console.error(`Error fetching TOS template ${templateId}:`, e);
    return { success: false, error: e.message };
  }
}

export async function deleteTOSTemplateAction(
  templateId: string
): Promise<{ success: boolean; error?: string }> {
  const authCheck = await verifyTeacher();
  if (authCheck.error || !authCheck.user)
    return { success: false, error: authCheck.error };
  if (!templateId) return { success: false, error: "Template ID is required." };

  const supabase = createSupabaseServerActionClient();
  try {
    // Delete from 'tos_templates' table. Cascade should handle related cells.
    const { error } = await supabase
      .from("tos_templates")
      .delete()
      .eq("id", templateId)
      .eq("teacher_id", authCheck.user.id);

    if (error) throw error;

    revalidatePath("/teacher-portal/tos-builder");
    return { success: true };
  } catch (e: any) {
    console.error(`Error deleting TOS template ${templateId}:`, e);
    return { success: false, error: e.message };
  }
}

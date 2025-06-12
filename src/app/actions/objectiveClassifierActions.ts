// src/app/actions/objectiveClassifierActions.ts
"use server";

import Groq from "groq-sdk";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getEmbeddingForText, EMBEDDING_DIMENSION } from "@/lib/aiUtils";

// Types for the TOS Objective Classifier
interface ObjectiveClassificationPayload {
  objectives: string[];
  grade_level?: string;
  subject?: string;
}

interface ClassificationResult {
  success: boolean;
  classifications?: Array<{
    objective: string;
    bloom_taxonomy_level: string;
    depth_of_knowledge_level: string;
    standard_alignment?: string;
    suggested_activities?: string[];
    suggested_assessments?: string[];
  }>;
  error?: string;
}

// Setup Groq API
const groqApiKey = process.env.GROQ_API_KEY;
if (!groqApiKey)
  console.error("CRITICAL: GROQ_API_KEY for Objective Classifier is not set.");
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

// Classify learning objectives according to taxonomies
export async function classifyObjectivesAction(
  payload: ObjectiveClassificationPayload
): Promise<ClassificationResult> {
  const authCheck = await verifyTeacher();
  if (authCheck.error || !authCheck.user)
    return { success: false, error: authCheck.error };
  if (!groq) return { success: false, error: "AI Service not configured." };

  const { objectives, grade_level, subject } = payload;

  if (!objectives || objectives.length === 0) {
    return {
      success: false,
      error: "No learning objectives provided for classification.",
    };
  }

  // === RAG INTEGRATION START ===
  let retrievedContext = "";
  // Combine all objectives for the embedding query
  const queryTextForRAG = objectives.join(" ").substring(0, 1500); // Limit length

  if (queryTextForRAG) {
    const supabase = createSupabaseServerActionClient();
    console.log(
      `RAG (Objective Classifier): Generating embedding for learning objectives`
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
        console.error(`RAG Error (Objective Classifier):`, matchError.message);
      } else if (matchedChunks && matchedChunks.length > 0) {
        retrievedContext =
          "Consider the following curriculum standards and educational taxonomy frameworks when classifying the objectives:\n\n<STANDARDS_CONTEXT>\n";
        matchedChunks.forEach((chunk: any) => {
          retrievedContext += `${chunk.chunk_text}\n---\n`;
        });
        retrievedContext += "</STANDARDS_CONTEXT>\n\n";
        console.log(
          `RAG (Objective Classifier): Retrieved ${matchedChunks.length} relevant chunks.`
        );
      } else {
        console.log(`RAG (Objective Classifier): No relevant chunks found.`);
      }
    } else {
      console.warn(
        `RAG (Objective Classifier): Could not generate valid embedding.`
      );
    }
  }
  // === RAG INTEGRATION END ===

  const objectivesFormatted = objectives.map((obj) => `- "${obj}"`).join("\n");
  const contextInfo = `${grade_level ? `Grade Level: ${grade_level}` : ""}${
    subject ? `\nSubject: ${subject}` : ""
  }`;

  const prompt = `
You are Nova Pro, an expert AI assistant for educators, specializing in educational taxonomies and standards.

${retrievedContext}

Based on the provided objectives AND THE STANDARDS CONTEXT (if any), please analyze and classify each learning objective.
If standards context is provided, heavily favor the taxonomies, frameworks, and educational standards mentioned in it.
Your classifications should align with the curriculum standards when available, using their terminology and structure.
If the context seems insufficient for classifying a particular objective, you may use your general knowledge but indicate: "[Note: Limited standards context for this classification]".

Your task is to analyze and classify each of the following learning objectives:
${objectivesFormatted}

${contextInfo ? `Additional context:\n${contextInfo}\n` : ""}

For each objective, determine:
1. The most appropriate Bloom's Taxonomy level (Remember, Understand, Apply, Analyze, Evaluate, Create)
2. The Webb's Depth of Knowledge (DOK) level (1-Recall, 2-Skill/Concept, 3-Strategic Thinking, 4-Extended Thinking)
3. Suggest 2-3 instructional activities aligned with this objective
4. Suggest 1-2 assessment methods appropriate for measuring this objective

The output MUST be a single, valid JSON array. Each object in the array should represent one classified objective.
Each object should have these keys:
- "objective": The original objective text
- "bloom_taxonomy_level": The determined Bloom's level
- "depth_of_knowledge_level": The determined DOK level (as "DOK-1", "DOK-2", "DOK-3", or "DOK-4")
- "suggested_activities": An array of 2-3 strings describing aligned activities
- "suggested_assessments": An array of 1-2 strings describing assessment methods

Generate a comprehensive, accurate classification for each objective now.
`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-70b-8192",
      temperature: 0.3, // Lower temperature for more precise classification
      max_tokens: 2500, // Allow ample space for multiple objectives
    });

    const rawResponse = completion.choices[0]?.message?.content?.trim();
    if (!rawResponse) {
      return {
        success: false,
        error: "AI did not return classification content.",
      };
    }

    // Extract JSON from the response
    let jsonStringToParse = rawResponse;
    const markdownJsonMatch = rawResponse.match(
      /```(?:json)?\s*([\s\S]*?)\s*```/
    );
    if (markdownJsonMatch && markdownJsonMatch[1]) {
      jsonStringToParse = markdownJsonMatch[1].trim();
    } else {
      const startBracket = rawResponse.indexOf("[");
      const endBracket = rawResponse.lastIndexOf("]");
      if (
        startBracket !== -1 &&
        endBracket !== -1 &&
        startBracket < endBracket
      ) {
        jsonStringToParse = rawResponse.substring(startBracket, endBracket + 1);
      }
    }

    // Parse the JSON
    const classifications = JSON.parse(jsonStringToParse);

    if (!Array.isArray(classifications)) {
      throw new Error("AI response was parsed but is not a JSON array");
    }

    return { success: true, classifications };
  } catch (error: any) {
    console.error("Objective Classification Error:", error);
    return {
      success: false,
      error: `Classification failed: ${error.message}`,
    };
  }
}

// src/app/actions/quizActions.ts
"use server";

import Groq from "groq-sdk";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const groqApiKey = process.env.GROQ_API_KEY;
if (!groqApiKey) console.error("CRITICAL: GROQ_API_KEY for quiz actions is not set.");
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

interface GenerateQuizPayload {
  title: string;
  sourceType: "topic" | "text";
  sourceContent: string;
  quizType: string; // e.g., "multiple_choice", "true_false"
  numQuestions: number;
}

// Structure expected from AI for a single question
interface AIQuestionFormat {
  question_text: string;
  options?: string[]; // For multiple_choice
  correct_answer: string; // Text of correct option for MCQ, "True" or "False" for T/F
  explanation?: string; // Explanation for the answer
}

interface ActionResult {
  success: boolean;
  error?: string;
  quizId?: string;
  questionsGeneratedCount?: number;
}

export async function generateQuizAction(
  payload: GenerateQuizPayload
): Promise<ActionResult> {
  if (!groq) {
    return { success: false, error: "AI Service (Groq) for quiz generation is not configured." };
  }

  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "User not authenticated." };
  }

  const { title, sourceType, sourceContent, quizType, numQuestions } = payload;
  if (!title.trim() || !sourceContent.trim() || !quizType || numQuestions <= 0) {
    return { success: false, error: "Missing required fields for quiz generation." };
  }

  // 1. Create the Quiz entry in the database
  let quizId: string;
  try {
    const { data: quizInsertData, error: quizInsertError } = await supabase
      .from("quizzes")
      .insert({
        user_id: user.id,
        title: title.trim(),
        source_topic_or_text: sourceType === "topic" ? `Topic: ${sourceContent.trim()}` : sourceContent, // Store source
        quiz_type: quizType,
        num_questions_generated: 0, // Will update this after questions are inserted
      })
      .select("id")
      .single();

    if (quizInsertError) throw quizInsertError;
    if (!quizInsertData || !quizInsertData.id) throw new Error("Failed to create quiz record or retrieve its ID.");
    quizId = quizInsertData.id;
  } catch (error: unknown) {
    console.error("Error creating quiz in DB:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Could not create quiz: ${errorMessage}` };
  }

  // 2. Prompt Groq to generate quiz questions
  const profileInfo = await supabase.from('profiles').select('grade_level').eq('id', user.id).single();
  const gradeLevel = profileInfo.data?.grade_level;
  let personalizationInstruction = "Target the questions and explanations at a general high school level.";
  if (gradeLevel && gradeLevel !== "Not Specified") {
    personalizationInstruction = `Target the questions and explanations for a ${gradeLevel} student.`;
  }

  let questionTypeInstruction = "";
  let exampleFormat = "";
  if (quizType === "multiple_choice") {
    questionTypeInstruction = "Each question should be multiple-choice with 4 distinct options (A, B, C, D).";
    exampleFormat = `Example for one question object:
    {
      "question_text": "What is the capital of France?",
      "options": ["Berlin", "Madrid", "Paris", "Rome"],
      "correct_answer": "Paris",
      "explanation": "Paris is the capital and most populous city of France."
    }`;
  } else if (quizType === "true_false") {
    questionTypeInstruction = "Each question should be a statement that is either true or false.";
    exampleFormat = `Example for one question object:
    {
      "question_text": "The Earth is flat.",
      "correct_answer": "False",
      "explanation": "The Earth is an oblate spheroid, not flat."
    }`;
  }
  // Add more types (short_answer) later if needed

  const sourceMaterialInstruction = sourceType === "topic"
    ? `The quiz should be about the topic: "${sourceContent.trim()}". Generate questions covering key aspects of this topic.`
    : `Generate questions based on the key information presented in the following text:\n---BEGIN SOURCE TEXT---\n${sourceContent.trim().substring(0, 8000)}\n---END SOURCE TEXT---`;


  const prompt = `You are an expert quiz creator, Nova.
${personalizationInstruction}
${sourceMaterialInstruction}
Generate exactly ${numQuestions} unique ${questionTypeInstruction}

The output MUST be a single, valid JSON array. Each object in the array represents a single quiz question and MUST follow this structure:
${exampleFormat}
Ensure 'correct_answer' for multiple choice exactly matches one of the provided 'options' text. For True/False, 'correct_answer' should be "True" or "False".
Provide a brief 'explanation' for each answer.

Your entire response must be ONLY the JSON array, starting with '[' and ending with ']'. Do not include any other text, titles, or introductions.`;

  let generatedQuestions: AIQuestionFormat[] = [];
  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-70b-8192", // Good for structured JSON and reasoning
      temperature: 0.5,
      max_tokens: 300 * numQuestions, // Estimate tokens needed based on question count
    });

    const rawResponse = completion.choices[0]?.message?.content?.trim();
    if (!rawResponse) throw new Error("AI did not return any content for the quiz.");

    let jsonStringToParse = rawResponse;
    // ... (robust JSON parsing logic from flashcard/essay outline actions)
    const markdownJsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/);
    if (markdownJsonMatch && markdownJsonMatch[1]) jsonStringToParse = markdownJsonMatch[1].trim();
    else {
      const arrayStartIndex = rawResponse.indexOf('[');
      if (arrayStartIndex !== -1) jsonStringToParse = rawResponse.substring(arrayStartIndex);
      else throw new Error("AI response does not appear to contain a JSON array for questions.");
    }

    const parsedData = JSON.parse(jsonStringToParse);
    if (!Array.isArray(parsedData)) throw new Error("AI did not return a JSON array for quiz questions.");

    generatedQuestions = parsedData.filter(item =>
        typeof item === 'object' && item !== null &&
        typeof item.question_text === 'string' && item.question_text.trim() !== '' &&
        typeof item.correct_answer === 'string' && item.correct_answer.trim() !== '' &&
        (quizType !== "multiple_choice" || (Array.isArray(item.options) && item.options.length === 4 && item.options.every((opt: string) => typeof opt === 'string')))
    ).map((item, index) => ({ // Add order and ensure structure
        question_text: item.question_text,
        options: item.options,
        correct_answer: item.correct_answer,
        explanation: item.explanation || "No explanation provided.",
        question_type: quizType, // Set question type based on quiz type
        order_in_quiz: index + 1,
    })) as AIQuestionFormat[]; // This mapping needs to align with DB table structure

    if (generatedQuestions.length === 0 && parsedData.length > 0) {
        console.warn("Parsed quiz data but items did not meet structure requirements:", parsedData);
    }
    if (generatedQuestions.length === 0) {
        throw new Error("AI generated no valid quiz questions from the source.");
    }

  } catch (error: unknown) {
    console.error("Error generating quiz questions with Groq:", error);
    await supabase.from("quizzes").delete().eq("id", quizId);
    console.log(`Attempted to delete empty quiz ${quizId} after AI failure.`);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `AI quiz generation failed: ${errorMessage}` };
  }

  // 3. Insert generated questions into the database
  try {
    const questionsToInsert = generatedQuestions.map((q, index) => ({
      quiz_id: quizId,
      user_id: user.id,
      question_text: q.question_text,
      question_type: quizType, // All questions in this V1 quiz are of the same type
      options: q.options || null, // Store as JSONB array
      correct_answer: q.correct_answer,
      explanation: q.explanation || "Explanation not provided.",
      order_in_quiz: index + 1,
    }));

    if (questionsToInsert.length > 0) {
      const { error: questionsInsertError } = await supabase
        .from("quiz_questions")
        .insert(questionsToInsert);

      if (questionsInsertError) throw questionsInsertError;

      // Update the num_questions_generated in the quizzes table
      await supabase
        .from("quizzes")
        .update({ num_questions_generated: questionsToInsert.length })
        .eq("id", quizId);
    }

    revalidatePath("/quizzes"); // For quiz list page
    revalidatePath(`/quizzes/take/${quizId}`); // For the quiz taking page

    return { success: true, quizId, questionsGeneratedCount: generatedQuestions.length };

  } catch (error: any) {
    console.error("Error saving quiz questions to DB:", error);
    // Quiz entry exists, but questions failed to save. Consider deleting the quiz entry.
    await supabase.from("quizzes").delete().eq("id", quizId);
    console.log(`Attempted to delete quiz ${quizId} after question saving failure.`);
    return { success: false, error: `Could not save quiz questions: ${error.message}`, quizId };
  }
}

// Interfaces for client-side quiz taking
export interface QuizQuestionForTaking {
  id: string;
  question_text: string;
  question_type: string; // "multiple_choice", "true_false"
  options?: string[]; // For MCQ
  order_in_quiz: number;
  // We don't send correct_answer or explanation to the client *while taking* the quiz
}

export interface QuizForTaking {
  id: string;
  title: string;
  description: string | null;
  quiz_type: string;
  questions: QuizQuestionForTaking[];
}

interface GetQuizResult {
  success: boolean;
  quiz?: QuizForTaking;
  error?: string;
}

export async function getQuizForTakingAction(quizId: string): Promise<GetQuizResult> {
  if (!quizId) return { success: false, error: "Quiz ID is required." };

  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: "User not authenticated." };

  try {
    // Fetch quiz details
    const { data: quizData, error: quizError } = await supabase
      .from("quizzes")
      .select("id, title, description, quiz_type")
      .eq("id", quizId)
      .eq("user_id", user.id) // Ensure user owns the quiz
      .single();

    if (quizError) throw quizError;
    if (!quizData) return { success: false, error: "Quiz not found or access denied." };

    // Fetch questions for this quiz, ordered
    const { data: questionsData, error: questionsError } = await supabase
      .from("quiz_questions")
      .select("id, question_text, question_type, options, order_in_quiz") // Select only needed fields
      .eq("quiz_id", quizId)
      .eq("user_id", user.id) // Ensures questions are for this user's quiz
      .order("order_in_quiz", { ascending: true });

    if (questionsError) throw questionsError;

    const quizWithQuestions: QuizForTaking = {
      ...quizData,
      questions: questionsData || [],
    };

    return { success: true, quiz: quizWithQuestions };

  } catch (error: any) {
    console.error(`Error fetching quiz ${quizId} for taking:`, error);
    return { success: false, error: `Could not load quiz: ${error.message}` };
  }
}

// Interface for a question when fetching results (includes sensitive data)
export interface QuizQuestionWithAnswer {
  id: string;
  question_text: string;
  question_type: string;
  options?: string[];
  correct_answer: string;
  explanation: string | null;
  order_in_quiz: number;
}

export interface QuizWithFullAnswers {
  id: string;
  title: string;
  description: string | null;
  quiz_type: string;
  questions: QuizQuestionWithAnswer[];
}

interface GetQuizResultsActionResult {
  success: boolean;
  quiz?: QuizWithFullAnswers;
  error?: string;
}

export async function getQuizResultsDataAction(quizId: string): Promise<GetQuizResultsActionResult> {
  if (!quizId) return { success: false, error: "Quiz ID is required." };

  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: "User not authenticated." };

  try {
    // Fetch quiz details
    const { data: quizData, error: quizError } = await supabase
      .from("quizzes")
      .select("id, title, description, quiz_type")
      .eq("id", quizId)
      .eq("user_id", user.id) // Ensure user owns the quiz
      .single();

    if (quizError) throw quizError;
    if (!quizData) return { success: false, error: "Quiz not found or access denied." };

    // Fetch questions for this quiz, including correct_answer and explanation
    const { data: questionsData, error: questionsError } = await supabase
      .from("quiz_questions")
      .select("id, question_text, question_type, options, correct_answer, explanation, order_in_quiz") // Fetch all needed fields
      .eq("quiz_id", quizId)
      .eq("user_id", user.id)
      .order("order_in_quiz", { ascending: true });

    if (questionsError) throw questionsError;

    const quizWithFullData: QuizWithFullAnswers = {
      ...quizData,
      questions: questionsData || [],
    };

    return { success: true, quiz: quizWithFullData };

  } catch (error: any) {
    console.error(`Error fetching quiz results data for ${quizId}:`, error);
    return { success: false, error: `Could not load quiz results: ${error.message}` };
  }
}

// We'll add actions to fetch quiz details and quiz questions later for the "take quiz" page.
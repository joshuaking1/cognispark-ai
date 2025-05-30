// src/app/actions/generateConversationTitleAction.ts
"use server";

import Groq from "groq-sdk";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";

const groqApiKey = process.env.GROQ_API_KEY;

if (!groqApiKey) {
    console.error("CRITICAL: GROQ_API_KEY for title generation is not set.");
    // Consider throwing an error if essential for functionality
}
// Initialize Groq client only if API key is available
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

export async function generateConversationTitle(
  conversationId: string
): Promise<{ success: boolean; title?: string; error?: string }> {
  if (!groq) { // Check if Groq client was initialized
    return { success: false, error: "AI Service (Groq) for title generation is not configured." };
  }
  if (!conversationId) {
    return { success: false, error: "Conversation ID is required for title generation." };
  }

  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Auth error in generateConversationTitle:", authError);
    return { success: false, error: "User not authenticated." };
  }

  // 1. Fetch the first few messages of the conversation
  const { data: messages, error: messagesError } = await supabase
    .from("chat_messages")
    .select("sender, content")
    .eq("user_id", user.id) // Ensure user owns the messages
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(4); // Adjust limit as needed for good context

  if (messagesError || !messages || messages.length === 0) {
    console.error("Messages error for title gen:", messagesError, "Count:", messages?.length);
    return { success: false, error: "Could not fetch messages to generate title." };
  }

  // 2. Prepare context for Groq
  const contextForTitle = messages
    .map(msg => `${msg.sender === 'user' ? 'User' : 'Nova'}: ${msg.content}`)
    .join("\n")
    .substring(0, 2000); // Limit context length for safety

  const prompt = `Based on the following conversation excerpt, generate a very short, concise title (ideally 3-5 words, max 7 words) that summarizes the main topic. Output only the title itself, no "Title:" prefix, no quotes, no extra explanations.\n\nConversation Excerpt:\n${contextForTitle}\n\nGenerated Title:`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-8b-8192", // Or a smaller/faster model if available and suitable
      temperature: 0.2, // Low temperature for more deterministic titles
      max_tokens: 25,    // Max length for the title
      stream: false,
    });

    let title = completion.choices[0]?.message?.content?.trim() || "";
    // Clean up: remove potential "Title: " prefix or surrounding quotes
    title = title.replace(/^title:\s*/i, '').replace(/^"|"$/g, '').replace(/^\*\*"|\"|\*\*"$/g, '').trim();

    if (!title) {
      return { success: false, error: "AI could not generate a valid title string." };
    }

    // 3. Upsert the title in the `conversations` table
    const { error: upsertError } = await supabase
      .from("conversations")
      .upsert(
        { id: conversationId, user_id: user.id, title: title, updated_at: new Date().toISOString() },
        { onConflict: "id" } // If `id` (conversationId) exists, update it. Ensure `user_id` matches via RLS or a WHERE clause if not using RLS for this.
                               // Since user_id is part of the payload, RLS will enforce it on update/insert.
      );

    if (upsertError) {
      console.error("Error upserting conversation title:", upsertError);
      return { success: false, error: "Could not save generated title." };
    }

    return { success: true, title: title };

  } catch (error: any) {
    console.error("Error generating title with Groq:", error);
    // Avoid exposing raw Groq errors to client if sensitive
    return { success: false, error: "AI title generation encountered an issue." };
  }
}

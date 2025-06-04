"use server";

import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface VoiceChatSession {
  id: string;
  user_id: string;
  started_at: Date;
  ended_at: Date | null;
  duration_seconds: number | null;
  status: "active" | "completed" | "error";
  error_message?: string;
}

/**
 * Start a new voice chat session and record it in the database
 */
export async function startVoiceChatSession(): Promise<{ 
  sessionId: string | null; 
  error?: string 
}> {
  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("Auth error in startVoiceChatSession:", userError);
    return { sessionId: null, error: "Authentication required" };
  }

  // Create a new voice chat session record
  const { data, error } = await supabase
    .from("voice_chat_sessions")
    .insert({
      user_id: user.id,
      started_at: new Date().toISOString(),
      status: "active"
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating voice chat session:", error);
    return { sessionId: null, error: "Failed to create voice chat session" };
  }

  return { sessionId: data.id };
}

/**
 * End a voice chat session and update its status and duration
 */
export async function endVoiceChatSession(
  sessionId: string,
  status: "completed" | "error" = "completed",
  errorMessage?: string
): Promise<{ success: boolean; error?: string }> {
  if (!sessionId) {
    return { success: false, error: "Session ID is required" };
  }

  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("Auth error in endVoiceChatSession:", userError);
    return { success: false, error: "Authentication required" };
  }

  // First get the session to calculate duration
  const { data: session, error: fetchError } = await supabase
    .from("voice_chat_sessions")
    .select("started_at")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (fetchError) {
    console.error("Error fetching voice chat session:", fetchError);
    return { success: false, error: "Failed to fetch voice chat session" };
  }

  const startedAt = new Date(session.started_at);
  const endedAt = new Date();
  const durationSeconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);

  // Update the session with end time and duration
  const { error: updateError } = await supabase
    .from("voice_chat_sessions")
    .update({
      ended_at: endedAt.toISOString(),
      duration_seconds: durationSeconds,
      status,
      error_message: errorMessage
    })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Error updating voice chat session:", updateError);
    return { success: false, error: "Failed to update voice chat session" };
  }

  return { success: true };
}

/**
 * Get the voice chat history for the current user
 */
export async function getVoiceChatHistory(): Promise<VoiceChatSession[]> {
  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("Auth error in getVoiceChatHistory:", userError);
    return [];
  }

  const { data, error } = await supabase
    .from("voice_chat_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false });

  if (error) {
    console.error("Error fetching voice chat history:", error);
    return [];
  }

  return data.map(session => ({
    ...session,
    started_at: new Date(session.started_at),
    ended_at: session.ended_at ? new Date(session.ended_at) : null
  }));
}

/**
 * Get statistics about voice chat usage
 */
export async function getVoiceChatStats(): Promise<{
  totalSessions: number;
  totalDuration: number;
  averageDuration: number;
}> {
  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("Auth error in getVoiceChatStats:", userError);
    return { totalSessions: 0, totalDuration: 0, averageDuration: 0 };
  }

  const { data, error } = await supabase
    .from("voice_chat_sessions")
    .select("duration_seconds")
    .eq("user_id", user.id)
    .eq("status", "completed");

  if (error) {
    console.error("Error fetching voice chat stats:", error);
    return { totalSessions: 0, totalDuration: 0, averageDuration: 0 };
  }

  const totalSessions = data.length;
  const totalDuration = data.reduce((sum, session) => sum + (session.duration_seconds || 0), 0);
  const averageDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;

  return {
    totalSessions,
    totalDuration,
    averageDuration
  };
}

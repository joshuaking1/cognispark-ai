// src/app/actions/adminActions.ts
"use server";

import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface SnippetPayload {
  id?: string; // For updates
  snippet_type: string;
  title?: string | null;
  content: string;
  link_url?: string | null;
  is_active: boolean;
}

interface AdminActionResult {
  success: boolean;
  error?: string;
  data?: any;
}

// Helper to ensure only admin can perform these actions
async function verifyAdmin(): Promise<{ user: any; error?: string }> {
  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { user: null, error: "Not authenticated." };

  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("is_admin").eq("id", user.id).single();
  
  if (profileError || !profile?.is_admin) {
    return { user: null, error: "User is not authorized as an admin." };
  }
  return { user };
}


export async function createAppContentSnippetAction(payload: SnippetPayload): Promise<AdminActionResult> {
  const adminCheck = await verifyAdmin();
  if (adminCheck.error || !adminCheck.user) return { success: false, error: adminCheck.error };

  const supabase = createSupabaseServerActionClient(); // Re-init for the operation scope

  // If setting a new tip as active, ensure others of the same type are deactivated
  if (payload.is_active && payload.snippet_type === "tip_of_the_day") {
    const { error: deactivateError } = await supabase
      .from("app_content_snippets")
      .update({ is_active: false })
      .eq("snippet_type", "tip_of_the_day")
      .eq("is_active", true);
    if (deactivateError) console.warn("Failed to deactivate old active tips:", deactivateError.message);
  }

  const { data, error } = await supabase
    .from("app_content_snippets")
    .insert({ ...payload, created_by: adminCheck.user.id })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/manage-tips"); // Path where admins manage
  revalidatePath("/dashboard");        // Path where users see the tip
  return { success: true, data };
}

export async function updateAppContentSnippetAction(payload: SnippetPayload): Promise<AdminActionResult> {
  const adminCheck = await verifyAdmin();
  if (adminCheck.error || !adminCheck.user) return { success: false, error: adminCheck.error };
  if (!payload.id) return { success: false, error: "Snippet ID is required for update."};

  const supabase = createSupabaseServerActionClient();

  if (payload.is_active && payload.snippet_type === "tip_of_the_day") {
    const { error: deactivateError } = await supabase
      .from("app_content_snippets")
      .update({ is_active: false })
      .eq("snippet_type", "tip_of_the_day")
      .eq("is_active", true)
      .neq("id", payload.id); // Don't deactivate the one we are about to activate
    if (deactivateError) console.warn("Failed to deactivate old active tips:", deactivateError.message);
  }
  
  const { id, ...updateData } = payload;
  const { data, error } = await supabase
    .from("app_content_snippets")
    .update({ ...updateData, updated_at: new Date().toISOString() }) // Assuming you add updated_at to table
    .eq("id", id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/manage-tips");
  revalidatePath("/dashboard");
  return { success: true, data };
}

export async function deleteAppContentSnippetAction(id: string): Promise<AdminActionResult> {
  const adminCheck = await verifyAdmin();
  if (adminCheck.error) return { success: false, error: adminCheck.error };
  if (!id) return { success: false, error: "Snippet ID required."};

  const supabase = createSupabaseServerActionClient();
  const { error } = await supabase.from("app_content_snippets").delete().eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/manage-tips");
  revalidatePath("/dashboard");
  return { success: true };
}

// Action for users to fetch the active tip (used by dashboard)
export async function getActiveTipOfTheDayAction(): Promise<{ tip: SnippetPayload | null }> {
    const supabase = createSupabaseServerActionClient(); // Or browser client if called client-side
    const { data, error } = await supabase
        .from("app_content_snippets")
        .select("title, content, link_url, snippet_type")
        .eq("snippet_type", "tip_of_the_day")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(); // Use maybeSingle as there might be no active tip

    if (error) {
        console.error("Error fetching active tip:", error);
        return { tip: null };
    }
    return { tip: data as SnippetPayload | null };
}
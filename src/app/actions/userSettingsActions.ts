// src/app/actions/userSettingsActions.ts
"use server";

import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
// import { randomUUID } from "crypto"; // Not strictly needed if Cloudinary generates public_id

// Import Cloudinary SDK
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse } from 'cloudinary';

// Configure Cloudinary (should ideally be done once, e.g. in a config file)
// This configuration will use environment variables set on Vercel/locally
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true, // Use https
    });
} else {
    console.warn("CLOUDINARY environment variables not fully set. Avatar uploads will likely fail.");
}

// Ensure this matches your Supabase bucket name exactly (case-sensitive)
const AVATAR_BUCKET = "avatars";

interface UpdateProfilePayload {
  fullName?: string | null; // Allow null to clear (camelCase in payload, will be mapped to full_name in DB)
  date_of_birth?: string | null; // YYYY-MM-DD string, allow null
  grade_level?: string | null;   // Allow null
  subjects_of_interest?: string[]; // Array of strings
  learning_goals?: string[]; // New field for learning goals
  has_completed_onboarding?: boolean; // New field
}

interface ActionResult {
  success: boolean;
  error?: string;
  data?: any; // For updateUserProfile's response
  avatarUrl?: string; // Specifically for avatar action
}

export async function updateUserProfile(
  payload: UpdateProfilePayload
): Promise<ActionResult> {
  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "User not authenticated." };
  }

  const updates: Partial<UpdateProfilePayload & { updated_at: string }> = {
    updated_at: new Date().toISOString(),
  };

  let hasMeaningfulChanges = false; // Track if more than just onboarding status is changing

  if (payload.fullName !== undefined) {
    if (payload.fullName !== null && payload.fullName.trim().length < 2 && payload.fullName.trim().length !== 0) {
      return { success: false, error: "Full name must be at least 2 characters or empty to clear." };
    }
    updates.full_name = payload.fullName === null ? null : (payload.fullName.trim() === "" ? null : payload.fullName.trim());
    hasMeaningfulChanges = true;
  }

  if (payload.date_of_birth !== undefined) {
    updates.date_of_birth = payload.date_of_birth === "" ? null : payload.date_of_birth;
    hasMeaningfulChanges = true;
  }

  if (payload.grade_level !== undefined) {
    updates.grade_level = payload.grade_level === "Not Specified" ? null : payload.grade_level;
    hasMeaningfulChanges = true;
  }

  if (payload.subjects_of_interest !== undefined) {
    updates.subjects_of_interest = payload.subjects_of_interest.length === 0 ? [] : payload.subjects_of_interest;
    hasMeaningfulChanges = true;
  }

  if (payload.learning_goals !== undefined) {
    // Ensure learning_goals is an array, even if empty
    updates.learning_goals = Array.isArray(payload.learning_goals) ? payload.learning_goals : [];
    hasMeaningfulChanges = true;
  }

  if (payload.has_completed_onboarding !== undefined) {
    updates.has_completed_onboarding = payload.has_completed_onboarding;
    // We don't necessarily set hasMeaningfulChanges = true just for this,
    // as the "No changes provided" message is for profile data.
  }

  // Check if any actual profile data fields were intended for update,
  // OR if only the onboarding status is being updated.
  if (!hasMeaningfulChanges && payload.has_completed_onboarding === undefined && payload.learning_goals === undefined) {
    return { success: true, error: "No profile changes provided to update." }; // Using 'error' field for info message here, client can interpret
  }
  // If only onboarding status or learning goals changed, it's still a valid update.
  if (!hasMeaningfulChanges && 
      (payload.has_completed_onboarding !== undefined || payload.learning_goals !== undefined) && 
      Object.keys(payload).length === 1) {
     // This is fine, proceed with update just for onboarding status or learning goals
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updates as any) // Cast as any if `updates` type is too strict due to optional fields
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    console.error("Error updating profile (incl. onboarding):", error);
    return { success: false, error: `Failed to update profile: ${error.message}` };
  }

  // Revalidate paths if profile data that might be shown on them changed.
  // Onboarding status change doesn't usually require revalidating data-display paths by itself.
  if (hasMeaningfulChanges) {
    revalidatePath("/dashboard");
    revalidatePath("/settings");
  }

  return { success: true, data };
}

export async function deleteAccountAction(): Promise<ActionResult> {
  const supabase = createSupabaseServerActionClient();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session?.user) {
    return { success: false, error: "User not authenticated or session expired." };
  }

  try {
    // Delete user's profile data first
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', session.user.id);

    if (profileError) {
      console.error("Error deleting profile:", profileError);
      return { success: false, error: `Failed to delete profile: ${profileError.message}` };
    }

    // Delete user's authentication data
    const { error: authError } = await supabase.auth.admin.deleteUser(session.user.id);

    if (authError) {
      console.error("Error deleting user:", authError);
      return { success: false, error: `Failed to delete user: ${authError.message}` };
    }

    // Clear session and sign out
    await supabase.auth.signOut();

    return { success: true, data: { message: "Account successfully deleted." } };

  } catch (error: any) {
    console.error("Error deleting account:", error);
    return { 
      success: false, 
      error: `Failed to delete account: ${error.message || 'Unknown error occurred'}` 
    };
  }
}

export async function changeUserPasswordAction(newPassword: string): Promise<ActionResult> {
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: "New password must be at least 6 characters long." };
  }

  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "User not authenticated. Please log in again." };
  }

  // Update the user's password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    console.error("Error changing password (Supabase Auth):", updateError);
    if (updateError.message.includes("same as the existing password")) {
      return { success: false, error: "New password cannot be the same as the old password." };
    }
    if (updateError.message.includes("weak password")) {
      return { success: false, error: "The new password is too weak." };
    }
    if (updateError.message.includes("User not found") || updateError.message.includes("No user found")) {
      return { success: false, error: "Authentication error. Please try logging out and back in." };
    }
    return { success: false, error: `Failed to change password: ${updateError.message}` };
  }

  // Password changed successfully.
  // Supabase handles session invalidation on other devices automatically here.
  // No specific revalidation of paths needed unless UI elements change based on password status.
  return { success: true };
}

export async function uploadAvatarAction(
  formData: FormData
): Promise<ActionResult> {
  // Check if Cloudinary SDK was configured (i.e., if API key is present)
  if (!cloudinary.config().api_key) {
    console.error("uploadAvatarAction: Cloudinary is not configured due to missing environment variables.");
    return { success: false, error: "Avatar image service is not configured on the server." };
  }

  const supabase = createSupabaseServerActionClient(); // Still needed for user auth & updating profile table
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user || !user.id) {
    console.error("uploadAvatarAction: Auth error or no user/user.id.", authError);
    return { success: false, error: "User not authenticated for avatar upload." };
  }

  const file = formData.get("avatar") as File | null;
  if (!file) {
    return { success: false, error: "No avatar file provided." };
  }

  // File validation (size, type)
  if (file.size > 2 * 1024 * 1024) { // 2MB limit
    return { success: false, error: "Avatar image is too large (max 2MB)." };
  }
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { success: false, error: "Invalid avatar file type. Only JPG, PNG, WEBP allowed." };
  }

  try {
    // Convert File to a buffer for Cloudinary upload_stream
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloudinary
    const uploadResult = await new Promise<UploadApiResponse | undefined>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `cognispark_ai/avatars/${user.id}`,
          overwrite: true,
          resource_type: "image"
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload stream error:', error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      uploadStream.end(buffer);
    });

    if (!uploadResult || !uploadResult.secure_url) {
      console.error("Cloudinary upload failed or did not return a secure_url. Result:", uploadResult);
      return { success: false, error: "Failed to upload avatar to image service." };
    }

    const newAvatarUrl = uploadResult.secure_url;
    console.log("DEBUG: Avatar uploaded to Cloudinary:", newAvatarUrl);
    console.log("DEBUG: Cloudinary Public ID:", uploadResult.public_id); // Useful for potential deletion later

    // Update the avatar_url in the user's Supabase 'profiles' table
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ avatar_url: newAvatarUrl, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (profileUpdateError) {
      console.error("Error updating Supabase profile with Cloudinary avatar URL:", profileUpdateError);
      // Important: If DB update fails, try to delete the image from Cloudinary to avoid orphans
      try {
        await cloudinary.uploader.destroy(uploadResult.public_id);
        console.log(`DEBUG: Deleted orphaned avatar from Cloudinary: ${uploadResult.public_id}`);
      } catch (deleteError) {
        console.error(`DEBUG: Failed to delete orphaned Cloudinary avatar ${uploadResult.public_id}:`, deleteError);
      }
      return { success: false, error: "Avatar image uploaded, but failed to update user profile." };
    }

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    // If Navbar shows avatar, revalidatePath("/") or layout path if possible.

    return { success: true, avatarUrl: newAvatarUrl };

  } catch (error: any) {
    console.error("Error during avatar processing (Cloudinary):", error);
    // Check if it's a Cloudinary specific error if possible
    let errorMessage = "Avatar processing failed unexpectedly.";
    if (error.message) {
        errorMessage = error.message;
    }
    if (error.http_code) { // Cloudinary errors often have http_code
        errorMessage = `Image service error (${error.http_code}): ${error.message}`;
    }
    return { success: false, error: errorMessage };
  }
}
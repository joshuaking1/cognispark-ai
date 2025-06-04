"use server";

import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

const KNOWLEDGE_BASE_PDFS = "knowledge-base-pdfs"; // <<< Your PDF bucket name

interface KnowledgeUploadResult {
  success: boolean;
  documentId?: string;
  error?: string;
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

export async function uploadKnowledgeDocumentAction(
  formData: FormData
): Promise<KnowledgeUploadResult> {
  const adminCheck = await verifyAdmin();
  if (adminCheck.error || !adminCheck.user) {
    return { success: false, error: adminCheck.error };
  }
  const adminUserId = adminCheck.user.id;

  const supabase = createSupabaseServerActionClient(); // Use a fresh instance for the operation

  const file = formData.get("document") as File | null;
  if (!file) {
    return { success: false, error: "No document file provided." };
  }

  // File validation
  if (file.type !== "application/pdf") {
    return { success: false, error: "Invalid file type. Only PDF documents are allowed." };
  }
  if (file.size > 25 * 1024 * 1024) { // 25MB limit (adjust as needed)
    return { success: false, error: "PDF file is too large (max 25MB)." };
  }

  const fileExtension = "pdf"; // We only accept PDFs
  const uniqueFileName = `${randomUUID()}.${fileExtension}`;
  // Store in a folder structure, e.g., by original uploader admin ID or just a flat structure
  const filePath = `${adminUserId}/${uniqueFileName}`; // Example: admin_user_id/random_name.pdf

  // 1. Upload PDF to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(KNOWLEDGE_BASE_PDFS)
    .upload(filePath, file, {
      cacheControl: '3600', // Optional
      upsert: false,        // Ensure new file path for each upload
    });

  if (uploadError) {
    console.error("Supabase Storage PDF Upload Error:", uploadError);
    return { success: false, error: `Failed to upload PDF: ${uploadError.message}` };
  }

  if (!uploadData || !uploadData.path) {
    return { success: false, error: "PDF upload failed (no path returned)." };
  }

  // 2. Create initial record in `knowledge_documents` table
  const { data: documentRecord, error: insertError } = await supabase
    .from("knowledge_documents")
    .insert({
      file_name: file.name, // Original filename
      supabase_storage_path: uploadData.path, // Path in Supabase storage
      status: "pending_processing", // Initial status
      uploaded_by: adminUserId,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Error creating knowledge document record:", insertError);
    // Critical: File uploaded but DB record failed. Attempt to delete orphaned file.
    await supabase.storage.from(KNOWLEDGE_BASE_PDFS).remove([uploadData.path]);
    console.log(`Cleaned up orphaned PDF ${uploadData.path} after DB insert failure.`);
    return { success: false, error: `Failed to record document in database: ${insertError.message}` };
  }

  if (!documentRecord || !documentRecord.id) {
    return { success: false, error: "Document recorded, but failed to retrieve its ID." };
  }

  console.log(`Document ${documentRecord.id} (${file.name}) uploaded and pending processing.`);

  // 3. TRIGGER ASYNCHRONOUS PROCESSING (Important!)
  //    This is where you would invoke your Supabase Edge Function to process the PDF.
  //    The Edge Function will handle text extraction, chunking, embedding, and saving to `document_chunks`.

  //    Option A: Invoke Edge Function directly via fetch
  //    (Ensure the Edge Function is set up to handle this invocation, possibly secured)
  const processFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-knowledge-pdf`;
  try {
    // Fire-and-forget the invocation. We don't wait for it to complete here.
    // The Edge Function should update the document_status itself.
    fetch(processFunctionUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // Add Authorization header if your Edge Function is protected (e.g., using service_role_key or a specific function invoke key)
            // 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` // Example
        },
        body: JSON.stringify({ documentId: documentRecord.id, storagePath: uploadData.path })
    });
    console.log(`Triggered processing for document ${documentRecord.id}`);
  } catch (invokeError) {
    console.error(`Failed to trigger processing for document ${documentRecord.id}:`, invokeError);
    // Update status to error if trigger fails critically
    await supabase.from("knowledge_documents").update({ status: 'trigger_failed', error_message: 'Failed to start processing.'}).eq('id', documentRecord.id);
  }

  // Option B: Use Supabase Database Webhooks
  //    - Create a webhook on INSERT into `knowledge_documents` table where status = 'pending_processing'.
  //    - This webhook then calls your `process-knowledge-pdf` Edge Function.
  //    - This is often more robust as it decouples upload from triggering.

  revalidatePath("/admin/manage-knowledge"); // Refresh the admin list
  return { success: true, documentId: documentRecord.id };
}

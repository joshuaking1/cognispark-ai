// src/app/actions/ocrActions.ts
"use server";

import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
// Imports the Google Cloud client library
import { ImageAnnotatorClient } from '@google-cloud/vision';

const OCR_IMAGE_BUCKET = "homework-images"; // Ensure this is your bucket name

interface OCRResult {
  success: boolean;
  text?: string;
  error?: string;
  imageUrl?: string;
}

// Initialize the Google Cloud Vision client
// This will automatically use credentials from GOOGLE_APPLICATION_CREDENTIALS env var
// or from GOOGLE_SERVICE_ACCOUNT_JSON_CONTENTS if parsed correctly.
let visionClient: ImageAnnotatorClient | null = null;

try {
    // Check if JSON contents are provided
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON_CONTENTS) {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_CONTENTS);
        visionClient = new ImageAnnotatorClient({ credentials });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // This path is more for local server environments where the file path is set
        visionClient = new ImageAnnotatorClient();
    } else {
        console.warn("OCR Action: Google Cloud credentials not fully configured. OCR will be disabled.");
    }
} catch (e: any) {
    console.error("OCR Action: Error initializing Google Cloud Vision client:", e.message);
    visionClient = null; // Ensure client is null if initialization fails
}


async function callActualOCRService(imageUrl: string): Promise<string | null> {
  if (!visionClient) {
    console.error("OCR Service: Vision client not initialized. Cannot perform OCR.");
    // Fallback or specific error handling if needed
    // For now, let's simulate a more informative error to the user
    throw new Error("AI Vision Service is not configured on the server.");
  }

  try {
    const [result] = await visionClient.textDetection(imageUrl);
    const detections = result.textAnnotations;
    if (detections && detections.length > 0 && detections[0].description) {
      // The first annotation (index 0) usually contains the full detected text block.
      return detections[0].description.trim();
    } else {
      console.log("OCR Service: No text detected in the image.", imageUrl);
      return null; // Or return an empty string, or a specific "no text found" message
    }
  } catch (error: any) {
    console.error("Google Cloud Vision API Error:", error.message);
    // You might want to inspect `error.code` or other details for more specific handling
    throw new Error(`Failed to extract text using Vision API: ${error.message}`);
  }
}


export async function processImageWithOCRAction(formData: FormData): Promise<OCRResult> {
  const supabase = createSupabaseServerActionClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: "User not authenticated." };
  }

  const file = formData.get("image") as File | null;
  // ... (file validation from previous step remains the same) ...
  if (!file) return { success: false, error: "No image file provided." };
  if (file.size > 5 * 1024 * 1024) return { success: false, error: "File is too large (max 5MB)." };
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) return { success: false, error: "Invalid file type." };


  const fileExtension = file.name.split('.').pop() || 'png';
  const filePath = `${user.id}/${randomUUID()}.${fileExtension}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(OCR_IMAGE_BUCKET)
    .upload(filePath, file);

  if (uploadError) return { success: false, error: `Failed to upload image: ${uploadError.message}` };
  if (!uploadData?.path) return { success: false, error: "Failed to upload image (no path)." };

  const { data: publicUrlData } = supabase.storage
    .from(OCR_IMAGE_BUCKET)
    .getPublicUrl(uploadData.path);

  if (!publicUrlData?.publicUrl) return { success: false, error: "Image uploaded, but could not retrieve its URL." };
  const imageUrl = publicUrlData.publicUrl;

  // 2. Call Actual OCR Service
  if (!visionClient) { // Double check if visionClient initialized
      return { success: false, error: "AI Vision Service is not available.", imageUrl: imageUrl };
  }

  try {
    const extractedText = await callActualOCRService(imageUrl);
    
    if (extractedText) {
        return { success: true, text: extractedText, imageUrl: imageUrl };
    } else {
        // If callActualOCRService returns null (e.g. no text detected), treat as success but no text
        return { success: true, text: "", imageUrl: imageUrl, error: "No text could be detected in the image." };
    }
  } catch (ocrError: any) {
    console.error("OCR Service Call Error in Action:", ocrError);
    return { success: false, error: `OCR processing failed: ${ocrError.message}`, imageUrl: imageUrl };
  }
}
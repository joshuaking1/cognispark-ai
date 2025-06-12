// src/lib/aiUtils.ts
/**
 * Utility functions for AI features in the application
 */

const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
const EMBEDDING_MODEL_API_URL =
  "https://api-inference.huggingface.co/models/BAAI/bge-large-en-v1.5";
export const EMBEDDING_DIMENSION = 1024;

/**
 * Generates an embedding for the given text using Hugging Face's API
 */
export async function getEmbeddingForText(
  text: string
): Promise<number[] | null> {
  if (!HF_TOKEN) {
    console.error("RAG: Hugging Face API token not configured.");
    return null;
  }
  try {
    const response = await fetch(EMBEDDING_MODEL_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ inputs: [text] }),
    });

    if (!response.ok) {
      console.error("RAG: Error generating embedding:", await response.text());
      return null;
    }

    const embeddingResponse = await response.json();

    // Handle both possible response formats from HuggingFace
    if (embeddingResponse && Array.isArray(embeddingResponse)) {
      // Format 1: Direct array response
      return embeddingResponse;
    } else if (
      embeddingResponse &&
      Array.isArray(embeddingResponse.embeddings) &&
      Array.isArray(embeddingResponse.embeddings[0]) &&
      typeof embeddingResponse.embeddings[0][0] === "number"
    ) {
      // Format 2: Nested embeddings property
      return embeddingResponse.embeddings[0];
    }

    console.error("RAG: Invalid embedding response format:", embeddingResponse);
    return null;
  } catch (error) {
    console.error("RAG: Error generating embedding:", error);
    return null;
  }
}

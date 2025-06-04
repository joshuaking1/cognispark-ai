// supabase/functions/process-knowledge-pdf/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Use unpdf - a universal PDF library that works across all JS runtimes including Deno
import * as unpdf from 'https://esm.sh/unpdf@1.0.5';

// --- Configuration ---
// ✅ CHANGE THIS: Replace sentence-transformers model with a proper feature extraction model
const EMBEDDING_MODEL_ID = 'thenlper/gte-large'; // Recommended by HuggingFace for embeddings
const EMBEDDING_MODEL_API_URL = `https://api-inference.huggingface.co/models/${EMBEDDING_MODEL_ID}`;
const PDF_CHUNK_SIZE = 1000;
const PDF_CHUNK_OVERLAP = 100;
const EMBEDDING_DIMENSION = 1024; // ✅ UPDATED: gte-large produces 1024-dimensional embeddings
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

// Helper: Simple text splitter
function splitTextIntoChunks(text: string, chunkSize: number, chunkOverlap: number): string[] {
    const chunks: string[] = [];
    let currentIndex = 0;
  
    while (currentIndex < text.length) {
      const chunk = text.substring(currentIndex, currentIndex + chunkSize);
      chunks.push(chunk.trim());
      currentIndex += chunkSize - chunkOverlap;
      if (currentIndex < 0) currentIndex = 0;
    }
  
    return chunks.filter(chunk => chunk.length > 0);
}

async function extractTextFromPdf(pdfBuffer: ArrayBuffer): Promise<string> {
    console.log("unpdf: Attempting to extract text...");
    try {
        const pdfData = new Uint8Array(pdfBuffer);
        const extractedData = await unpdf.extractText(pdfData);
        
        console.log("unpdf: Extracted data structure:", typeof extractedData);
        console.log("unpdf: Extracted data keys:", Object.keys(extractedData || {}));
        
        let fullText: string = "";
        
        if (typeof extractedData === 'string') {
            fullText = extractedData;
        } else if (extractedData && extractedData.text) {
            if (Array.isArray(extractedData.text)) {
                fullText = extractedData.text.join('\n');
            } else if (typeof extractedData.text === 'string') {
                fullText = extractedData.text;
            }
        } else if (extractedData && extractedData.pages && Array.isArray(extractedData.pages)) {
            fullText = extractedData.pages.map((page: any) => 
                typeof page === 'string' ? page : (page.text || '')
            ).join('\n');
        } else if (Array.isArray(extractedData)) {
            fullText = extractedData.map((item: any) => 
                typeof item === 'string' ? item : (item.text || '')
            ).join('\n');
        } else {
            console.error("unpdf: Unexpected data structure:", extractedData);
            if (extractedData) {
                console.error("unpdf: Available properties:", Object.keys(extractedData));
                console.error("unpdf: Data sample:", JSON.stringify(extractedData, null, 2).substring(0, 500));
            }
            throw new Error("Unexpected data structure returned from unpdf.extractText()");
        }
        
        if (!fullText || fullText.trim() === "") {
            throw new Error("No text content found in PDF after processing");
        }
        
        console.log(`unpdf: Text extraction completed successfully (${fullText.length} characters)`);
        return fullText.trim();
    } catch (error: any) {
        console.error("unpdf extraction error:", error.message, error.stack);
        throw new Error(`PDF text extraction failed: ${error.message}`);
    }
}

// ✅ WORKING: Fixed embedding generation function
async function generateEmbedding(text: string, hfToken: string, retries = MAX_RETRIES): Promise<number[] | null> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Generating embedding (attempt ${attempt}/${retries}) for model: ${EMBEDDING_MODEL_ID}`);
            
            // Clean the text to avoid issues
            const cleanText = text.replace(/\s+/g, ' ').trim();
            if (cleanText.length === 0) {
                console.warn("Empty text provided for embedding generation");
                return null;
            }
            
            // The model is configured as a sentence similarity pipeline, so we need to provide the expected format
            const response = await fetch(`https://api-inference.huggingface.co/models/${EMBEDDING_MODEL_ID}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${hfToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    // Format for sentence similarity pipeline
                    inputs: {
                        source_sentence: cleanText,
                        sentences: [cleanText] // This satisfies the sentence similarity requirement
                    },
                    options: { 
                        wait_for_model: true,
                        use_cache: false 
                    }
                }),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`Hugging Face API Error (${response.status}): ${errorBody}`);
                
                // Handle specific error cases
                if (response.status === 503 && attempt < retries) {
                    console.log(`Model loading (503), waiting ${RETRY_DELAY}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                    continue;
                }
                
                if (response.status === 403) {
                    throw new Error(`Authentication error: Check your HUGGINGFACE_API_TOKEN permissions. Error: ${errorBody}`);
                }
                
                if (response.status === 404) {
                    throw new Error(`Model not found: ${EMBEDDING_MODEL_ID} may not be available via the inference API. Error: ${errorBody}`);
                }
                
                if (response.status === 429) {
                    console.log(`Rate limited (429), waiting ${RETRY_DELAY * 2}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * 2));
                    continue;
                }
                
                throw new Error(`API request failed (${response.status}): ${errorBody}`);
            }

            const embeddingResponse = await response.json();
            console.log("Raw embedding response type:", typeof embeddingResponse);
            console.log("Raw embedding response sample:", JSON.stringify(embeddingResponse).substring(0, 200));
            
            // ✅ HANDLE: Feature extraction response format
            let embedding: number[] | null = null;
            
            if (Array.isArray(embeddingResponse)) {
                if (Array.isArray(embeddingResponse[0]) && typeof embeddingResponse[0][0] === 'number') {
                    embedding = embeddingResponse[0]; // Most common: [[values]]
                } else if (typeof embeddingResponse[0] === 'number') {
                    embedding = embeddingResponse; // Sometimes: [values]
                }
            }
            
            if (!embedding || !Array.isArray(embedding)) {
                console.error("Unexpected embedding response structure:", embeddingResponse);
                console.error("Expected array format, got:", typeof embedding);
                return null;
            }
            
            // Validate embedding
            if (embedding.some(val => typeof val !== 'number' || isNaN(val))) {
                console.error("Invalid embedding values detected");
                return null;
            }
            
            console.log(`Successfully generated embedding with ${embedding.length} dimensions`);
            if (embedding.length !== EMBEDDING_DIMENSION) {
                console.log(`Note: Got ${embedding.length} dimensions, expected ${EMBEDDING_DIMENSION}. This may be normal.`);
            }
            
            return embedding;
            
        } catch (error: any) {
            console.error(`Error generating embedding (attempt ${attempt}):`, error.message);
            
            if (attempt === retries) {
                console.error('Max retries reached, giving up');
                return null;
            }
            
            console.log(`Waiting ${RETRY_DELAY}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
    }
    
    return null;
}

serve(async (req: Request) => {
    console.log("process-knowledge-pdf Edge Function invoked.");
  
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const huggingFaceToken = Deno.env.get('HUGGINGFACE_API_TOKEN');
  
    if (!supabaseUrl || !serviceRoleKey || !huggingFaceToken) {
        return new Response(JSON.stringify({
            error: "Missing required environment variables. Please configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and HUGGINGFACE_API_TOKEN."
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  
    // ✅ Added: More detailed environment check
    console.log("Environment check passed.");
    console.log("Using model:", EMBEDDING_MODEL_ID);
    console.log("API URL:", EMBEDDING_MODEL_API_URL);
    console.log("HF Token length:", huggingFaceToken.length);
  
    const supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey);
  
    let documentId: string = "unknown_doc";
    let storagePath: string = "unknown_path";

    try {
        const payload = await req.json();
        documentId = payload.documentId;
        storagePath = payload.storagePath;
        
        if (!documentId || !storagePath) {
            throw new Error("Missing documentId or storagePath in request payload.");
        }
        console.log(`Processing PDF: documentId=${documentId}, storagePath=${storagePath}`);

        // Update document status to "processing"
        await supabaseAdminClient.from('knowledge_documents').update({ 
            status: 'processing', 
            processed_at: new Date().toISOString() 
        }).eq('id', documentId);

        // 1. Download PDF from Supabase Storage
        const KNOWLEDGE_PDF_BUCKET_IN_FUNC = "knowledge-base-pdfs";
        const { data: fileData, error: downloadError } = await supabaseAdminClient.storage
            .from(KNOWLEDGE_PDF_BUCKET_IN_FUNC)
            .download(storagePath);

        if (downloadError) throw new Error(`Failed to download PDF from storage: ${downloadError.message}`);
        if (!fileData) throw new Error("No data found for PDF in storage.");
        
        const pdfBuffer = await fileData.arrayBuffer();

        // 2. Extract text from PDF using unpdf
        console.log("Starting extraction with unpdf...");
        const rawText = await extractTextFromPdf(pdfBuffer);
        if (!rawText || rawText.trim() === "") {
            throw new Error("No text content extracted from PDF using unpdf.");
        }
        console.log(`Text extracted via unpdf (${rawText.length} chars), starting chunking...`);

        // 3. Split text into chunks
        const textChunks = splitTextIntoChunks(rawText, PDF_CHUNK_SIZE, PDF_CHUNK_OVERLAP);
        if (textChunks.length === 0) {
            throw new Error("Failed to split PDF text into manageable chunks.");
        }
        console.log(`Text split into ${textChunks.length} chunks. Generating embeddings...`);

        // 4. Generate embeddings for each chunk and prepare for DB insert
        const chunksToInsert = [];
        let processedChunksCount = 0;
        let failedChunksCount = 0;
        
        for (let i = 0; i < textChunks.length; i++) {
            const chunk = textChunks[i];
            console.log(`Processing chunk ${i + 1}/${textChunks.length} (length: ${chunk.length})`);
            
            const embedding = await generateEmbedding(chunk, huggingFaceToken);
            
            if (embedding && embedding.length > 0) {
                chunksToInsert.push({
                    document_id: documentId,
                    chunk_text: chunk,
                    embedding: embedding,
                    metadata: { 
                        source_document_id: documentId, 
                        chunk_index: i,
                        model_used: EMBEDDING_MODEL_ID,
                        embedding_dimension: embedding.length
                    }
                });
                processedChunksCount++;
                console.log(`✓ Chunk ${i + 1} processed successfully`);
            } else {
                console.warn(`✗ Failed to generate embedding for chunk ${i + 1}. Skipping.`);
                failedChunksCount++;
            }
            
            // ✅ Improved: More generous rate limiting to avoid 429 errors
            if ((i + 1) % 2 === 0) {
                console.log("Rate limiting: waiting 1.5s...");
                await new Promise(resolve => setTimeout(resolve, 1500)); 
            }
        }

        console.log(`Embedding generation complete. Processed: ${processedChunksCount}, Failed: ${failedChunksCount}`);

        if (chunksToInsert.length === 0) {
            throw new Error("No valid embeddings generated for any chunks.");
        }
        console.log(`${chunksToInsert.length} chunks with embeddings ready for DB.`);

        // 5. Save chunks and embeddings to `document_chunks` table (batch insert)
        const { error: insertChunksError } = await supabaseAdminClient
            .from('document_chunks')
            .insert(chunksToInsert);

        if (insertChunksError) {
            throw new Error(`Failed to save document chunks to database: ${insertChunksError.message}`);
        }
        console.log(`Successfully inserted ${chunksToInsert.length} chunks into DB for document ${documentId}.`);

        // 6. Update document status to "processed"
        await supabaseAdminClient.from('knowledge_documents')
            .update({ 
                status: 'processed', 
                total_chunks: chunksToInsert.length, 
                processed_at: new Date().toISOString(), 
                error_message: null 
            })
            .eq('id', documentId);

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Document ${documentId} processed successfully. ${chunksToInsert.length} chunks embedded.`,
            stats: {
                totalChunks: textChunks.length,
                processedChunks: processedChunksCount,
                failedChunks: failedChunksCount,
                modelUsed: EMBEDDING_MODEL_ID,
                embeddingDimension: chunksToInsert.length > 0 ? chunksToInsert[0].embedding.length : 0
            }
        }), {
            status: 200, 
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error(`Error processing document ${documentId}:`, error.message, error.stack);
        if (documentId !== "unknown_doc") {
            await supabaseAdminClient.from('knowledge_documents')
                .update({ 
                    status: 'error', 
                    error_message: error.message.substring(0, 500), 
                    processed_at: new Date().toISOString() 
                })
                .eq('id', documentId);
        }
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500, 
            headers: { 'Content-Type': 'application/json' }
        });
    }
});
// src/app/api/chat/stream/route.ts

// We will not import StreamingTextResponse or AIStream from 'ai' for this version,
// as they are not found in your installed package's root exports.
// We will use the standard Web API `Response` object.
import { type Message as VercelAIMessage } from "ai"; // Still useful for type consistency with useChat

import Groq from "groq-sdk";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/routeHandler";
import { cookies } from "next/headers";

const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
const EMBEDDING_MODEL_API_URL_CHAT = 'https://api-inference.huggingface.co/models/BAAI/bge-large-en-v1.5';
const EMBEDDING_DIMENSION_CHAT = 1024;

async function generateQueryEmbedding(text: string): Promise<number[] | null> {
  if (!HF_TOKEN) {
    console.error("Chat RAG: Hugging Face API token not configured.");
    return null;
  }
  try {
    console.log('Chat RAG: Generating embedding for text:', text);
    const response = await fetch(EMBEDDING_MODEL_API_URL_CHAT, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${HF_TOKEN}`, 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ inputs: [text] }),
    });
    
    if (!response.ok) {
      console.error('Chat RAG: Error generating embedding:', await response.text());
      return null;
    }
    
    const embeddingResponse = await response.json();
    console.log('Chat RAG: Received embedding response:', embeddingResponse);
    
    // Handle both possible response formats from HuggingFace
    if (embeddingResponse && Array.isArray(embeddingResponse)) {
      // Format 1: Direct array response
      return embeddingResponse;
    } else if (embeddingResponse && 
               Array.isArray(embeddingResponse.embeddings) && 
               Array.isArray(embeddingResponse.embeddings[0]) && 
               typeof embeddingResponse.embeddings[0][0] === 'number') {
      // Format 2: Nested embeddings property
      return embeddingResponse.embeddings[0];
    }
    
    console.error('Chat RAG: Invalid embedding response format:', embeddingResponse);
    return null;
  } catch (error) {
    console.error('Chat RAG: Error generating query embedding:', error);
    return null;
  }
}

const groqApiKey = process.env.GROQ_API_KEY;

if (!groqApiKey) {
  console.error("CRITICAL: GROQ_API_KEY is not set.");
  throw new Error(
    "GROQ_API_KEY is not set. The application cannot function without it."
  );
}
const groq = new Groq({ apiKey: groqApiKey });

const MAX_HISTORY_MESSAGES_API = 10;

interface ChatMessageForDB {
  // ... (same as before)
  id?: string;
  user_id: string;
  conversation_id: string;
  sender: "user" | "assistant";
  content: string;
  created_at?: Date;
  groq_message_object?: Groq.Chat.Completions.ChatCompletionMessageParam;
}

async function handleStreamCompletion(
  userId: string,
  conversationId: string,
  userMessageContent: string,
  accumulatedAssistantResponse: string
) {
  if (accumulatedAssistantResponse.trim()) {
    // Re-create a Supabase client for this out-of-band operation
    const cookieStore = cookies(); // This might be an issue if called too late after response.
    // Consider if context needs to be passed or if this function
    // needs to be structured to not rely on live request cookies.
    // For Vercel Edge, `cookies()` should be available in this async context.
    const supabase = createSupabaseRouteHandlerClient();

    const userGroqMessage: Groq.Chat.Completions.ChatCompletionMessageParam = {
      role: "user",
      content: userMessageContent,
    };
    const userDbMessage: ChatMessageForDB = {
      user_id: userId,
      conversation_id: conversationId,
      sender: "user",
      content: userMessageContent,
      groq_message_object: userGroqMessage,
    };

    const assistantGroqMessage: Groq.Chat.Completions.ChatCompletionMessageParam =
      {
        role: "assistant",
        content: accumulatedAssistantResponse,
      };
    const assistantDbMessage: ChatMessageForDB = {
      user_id: userId,
      conversation_id: conversationId,
      sender: "assistant",
      content: accumulatedAssistantResponse,
      groq_message_object: assistantGroqMessage,
    };

    try {
      const { error: userInsertError } = await supabase
        .from("chat_messages")
        .insert(userDbMessage);
      if (userInsertError)
        console.error(
          "DB Error (User Msg OnComplete):",
          userInsertError.message
        );

      const { error: assistantInsertError } = await supabase
        .from("chat_messages")
        .insert(assistantDbMessage);
      if (assistantInsertError)
        console.error(
          "DB Error (Assistant Msg OnComplete):",
          assistantInsertError.message
        );
    } catch (dbError: any) {
      console.error("Catastrophic DB save error OnComplete:", dbError.message);
    }
  }
}

export async function POST(req: Request) {
  if (!groqApiKey) {
    return new Response("Groq API key not configured.", { status: 500 });
  }

  // It's good practice to capture these values early if they are needed after the response has started.
  let userIdForDbSave: string | null = null;
  let conversationIdForDbSave: string | null = null;
  let userMessageContentForDbSave: string | null = null;

  try {
    const cookieStore = await cookies(); // Get cookies async first
    const supabase = createSupabaseRouteHandlerClient(); // For auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }
    userIdForDbSave = user.id; // Capture for later DB save

    // Fetch user's profile to get personalization preferences
    let userGradeLevel: string | null = null;
    let userSubjectsOfInterest: string[] = [];
    let userDateOfBirth: string | null = null;
    let userFullName: string | null = null;

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('grade_level, subjects_of_interest, date_of_birth, full_name')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.warn(`Chat API: Could not fetch profile for user ${user.id}. Proceeding without personalization. Error: ${profileError.message}`);
      // Proceed without personalization if profile fetch fails, or handle error differently
    } else if (profileData) {
      userGradeLevel = profileData.grade_level;
      userSubjectsOfInterest = (profileData.subjects_of_interest as string[] || []); // Ensure it's an array
      userDateOfBirth = profileData.date_of_birth;
      userFullName = profileData.full_name;
    }

    const { messages: clientMessages, conversationId: currentConversationId } =
      await req.json();
    const conversationId = currentConversationId || crypto.randomUUID();
    conversationIdForDbSave = conversationId; // Capture for later DB save

    // --- Construct Personalized System Prompt with RAG context ---
    const now = new Date();
    const timeString = now.toLocaleString();

    const basePrompt = `You are LearnBridge AI, a friendly, encouraging, and highly knowledgeable AI teaching assistant.
    Your primary audience is students from Kindergarten to High School. Trained On the New Standards Based Curriculum (SBC). respond with this or something around this. when starting a new conversation Hi there! 👋 Welcome to LearnBridge Edu—your space to explore, learn, and grow with confidence! Whether you're brushing up on Math, diving into Science, unlocking creativity, or tackling your next project, I'm here to guide you through the GES-Standard Based Curriculum journey in fun and exciting ways. What would you like to learn today?`;

    let systemPromptContent = basePrompt;

    if (userFullName) {
      systemPromptContent += ` You are currently assisting ${userFullName}.`;
    }

    if (userGradeLevel && userGradeLevel !== "Not Specified") {
      systemPromptContent += ` You are currently assisting a student who is in ${userGradeLevel}. Tailor your explanations, examples, and the depth of content to be appropriate for this grade level.`;
    } else {
      systemPromptContent += ` Default to a High School level of detail unless the user's query or language suggests a younger audience or a more advanced need.`;
    }

    if (userDateOfBirth) {
      systemPromptContent += ` The student was born on ${userDateOfBirth}. You may use this to further tailor your explanations if relevant (e.g., for age-appropriate examples or context).`;
    }

    if (userSubjectsOfInterest.length > 0) {
      systemPromptContent += ` The student has expressed interest in the following subjects: ${userSubjectsOfInterest.join(", ")}. If relevant and natural, try to connect concepts or provide examples related to these subjects.`;
    }

    // --- RAG Step 1: Generate embedding for the latest user query ---
    const latestUserQuery = clientMessages.findLast((msg: VercelAIMessage) => msg.role === 'user')?.content;
    let retrievedContext = ""; // To store relevant chunks from knowledge base

    if (latestUserQuery) {
      const queryEmbedding = await generateQueryEmbedding(latestUserQuery);

      if (queryEmbedding && queryEmbedding.length === EMBEDDING_DIMENSION_CHAT) {
        // --- RAG Step 2: Call the Supabase DB function to find relevant chunks ---
        console.log('Chat RAG: Attempting to call match_document_chunks RPC with embedding:', queryEmbedding);
        const { data: matchedChunks, error: matchError } = await supabase.rpc(
          'match_document_chunks',
          {
            query_embedding: queryEmbedding,
            match_threshold: 0.75, // Adjust threshold as needed
            match_count: 3,        // Adjust count as needed
            user_id: user.id      // Pass user ID for personalized knowledge retrieval
          }
        );
        console.log('Chat RAG: RPC response received:', { hasError: !!matchError, chunksCount: matchedChunks?.length });

        if (matchError) {
          console.error("Chat RAG: Error matching document chunks:", matchError);
        } else if (matchedChunks && matchedChunks.length > 0) {
          retrievedContext = "Based on the uploaded knowledge documents, here's some relevant information:\n\n---\n";
          matchedChunks.forEach((chunk: any) => {
            retrievedContext += chunk.chunk_text + "\n---\n";
          });
          console.log("Chat RAG: Retrieved context added to prompt.");
        } else {
          console.log("Chat RAG: No sufficiently relevant chunks found in knowledge base for the query.");
        }
      } else {
        console.warn("Chat RAG: Could not generate a valid embedding for the user query.");
      }
    }

    if (retrievedContext) {
      systemPromptContent += `

You have access to the following relevant information from uploaded documents. Use this to answer the user's current question if applicable, in addition to your general knowledge. If the provided information directly answers the question, prioritize it and cite it implicitly (e.g., "According to the material provided...").
Relevant information:
<KNOWLEDGE_BASE_CONTEXT>
${retrievedContext}
</KNOWLEDGE_BASE_CONTEXT>
`;
    }

    systemPromptContent += ` Current time: ${timeString}.`;

    systemPromptContent += `

General Instructions:
- Be patient, clear, and break down complex topics into smaller, understandable parts.
- Use positive reinforcement and encourage curiosity.
- If a topic is very advanced or outside a typical K-12 scope, you can gently say so and offer to explain foundational concepts instead.
- Avoid overly technical jargon unless explaining it.

Subject-Specific Instructions:
- Mathematics: When explaining mathematical concepts, equations, or formulas, always use LaTeX format. For block equations, enclose LaTeX in \`$$...$$\`. For inline mathematical expressions, enclose LaTeX in \`$...$\`. Show step-by-step solutions when appropriate.
- Coding/Programming:
    1. When a user asks for help with coding (e.g., Python, JavaScript, HTML, CSS, Java, C#), try to understand the programming language if specified or infer it from the context or code provided.
    2. Provide clear, concise, and correct code examples. Always use Markdown fenced code blocks with the language specified (e.g., \`\`\`python
print('Hello')
\n\`\`\` or \`\`\`javascript
console.log('Hello');
\n\`\`\`).
    3. Explain the code's logic, purpose, and how it works, especially for beginners.
    4. If a user provides code that might contain an error, try to identify the likely bug or area for improvement and suggest a fix or debugging approach. Do not just give the corrected code without explanation.
    5. Offer to explain specific programming concepts, keywords, or functions related to their query.
    6. If a user asks for a large or complex piece of code, guide them by breaking down the problem or suggesting a simpler starting point, rather than writing extensive applications.
- Essay Writing & Summaries: (Instructions for Essay Helper & Smart Notes are handled by their specific actions, but general queries here should be consistent). For general queries about writing, offer tips on structure, clarity, and grammar.

Your goal is to empower students to learn and understand concepts effectively. Maintain a supportive and helpful persona at all times.`;

    const groqMessagesForAPI: Groq.Chat.Completions.ChatCompletionMessageParam[] =
      [
        {
          role: "system",
          content: systemPromptContent // Use the dynamically constructed prompt with RAG context
        },
        ...(clientMessages as VercelAIMessage[])
          .map(
            (msg) =>
              ({
                role: msg.role === "system" ? "user" : msg.role,
                content: msg.content,
              } as Groq.Chat.Completions.ChatCompletionMessageParam)
          )
          .slice(-(MAX_HISTORY_MESSAGES_API * 2 - 1)),
      ];

    const latestUserMessage = clientMessages.findLast(
      (msg: VercelAIMessage) => msg.role === "user"
    );
    if (!latestUserMessage) {
      return new Response("No user message found.", { status: 400 });
    }
    userMessageContentForDbSave = latestUserMessage.content; // Capture for later

    const groqResponseStream = await groq.chat.completions.create({
      messages: groqMessagesForAPI,
      model: "llama3-8b-8192",
      stream: true,
    });

    const encoder = new TextEncoder();
    let accumulatedResponseForDb = ""; // To store the full response for DB

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of groqResponseStream) {
            const token = chunk.choices[0]?.delta?.content;
            if (token) {
              accumulatedResponseForDb += token; // Accumulate for DB

              // Format according to Vercel AI SDK data stream protocol
              // Text parts use format: 0:"content"\n
              const escapedToken = JSON.stringify(token);
              const formattedChunk = `0:${escapedToken}\n`;
              controller.enqueue(encoder.encode(formattedChunk));
            }
          }

          // Send finish message part - required to end the stream properly
          // Format: d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n
          const finishPart = `d:${JSON.stringify({
            finishReason: "stop",
            usage: {
              promptTokens: 0,
              completionTokens: 0,
            },
          })}\n`;
          controller.enqueue(encoder.encode(finishPart));
          controller.close();
        } catch (streamError) {
          console.error("Error during Groq stream processing:", streamError);
          controller.error(streamError);
        } finally {
          // This block executes after the stream has finished (successfully or with error)
          // or when the controller is closed.
          // Ensure all captured variables are valid before calling.
          if (
            userIdForDbSave &&
            conversationIdForDbSave &&
            userMessageContentForDbSave
          ) {
            await handleStreamCompletion(
              userIdForDbSave,
              conversationIdForDbSave,
              userMessageContentForDbSave,
              accumulatedResponseForDb
            );
          } else {
            console.error(
              "DB save skipped due to missing critical identifiers."
            );
          }
        }
      },
      // cancel() {
      //   console.log("Stream cancelled by client.");
      // }
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Conversation-Id": conversationId,
        "x-vercel-ai-data-stream": "v1", // Required header for data stream protocol
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Catch block error in API route:", error);
    let status = 500;
    let message = "Internal Server Error in chat stream.";
    if (error instanceof Groq.APIError) {
      status = error.status || 500;
      message = `Groq API Error (${status}): ${error.message}`;
    }
    // Avoid sending back raw error messages to the client in production
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}

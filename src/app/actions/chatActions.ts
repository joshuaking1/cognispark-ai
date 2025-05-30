// src/app/actions/chatActions.ts
"use server";

import Groq from "groq-sdk";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const groqApiKey = process.env.GROQ_API_KEY;

if (!groqApiKey) {
  console.error("GROQ_API_KEY is not set in environment variables.");
}

const groq = new Groq({ apiKey: groqApiKey });

const MAX_HISTORY_MESSAGES = 10;

interface ChatMessage {
  id?: string;
  user_id: string;
  conversation_id: string;
  sender: "user" | "assistant";
  content: string;
  created_at?: Date;
  groq_message_object?: Groq.Chat.Completions.ChatCompletionMessageParam;
}

// This function processes the stream internally and saves the full response.
// It serves as an intermediate step before implementing full client-side streaming.
export async function askNova(
  userMessageText: string,
  currentConversationId: string | null
): Promise<{
  response: string | null;
  error?: string;
  conversationId?: string;
}> {
  if (!groqApiKey) {
    return { response: null, error: "AI Service is not configured." };
  }
  if (!userMessageText) {
    return { response: null, error: "Please provide a message." };
  }

  const supabase = createSupabaseServerActionClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("User not authenticated:", userError);
    return { response: null, error: "User not authenticated." };
  }

  const conversationId = currentConversationId || crypto.randomUUID();

  const userGroqMessage: Groq.Chat.Completions.ChatCompletionMessageParam = {
    role: "user",
    content: userMessageText,
  };
  const userDbMessage: ChatMessage = {
    user_id: user.id,
    conversation_id: conversationId,
    sender: "user",
    content: userMessageText,
    groq_message_object: userGroqMessage,
  };

  const { error: insertUserMsgError } = await supabase
    .from("chat_messages")
    .insert(userDbMessage);

  if (insertUserMsgError) {
    console.error("Error saving user message to DB:", insertUserMsgError);
    return { response: null, error: "Failed to save your message." };
  }

  const { data: dbHistory } = await supabase
    .from("chat_messages")
    .select("sender, content, groq_message_object")
    .eq("user_id", user.id)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(MAX_HISTORY_MESSAGES * 2);

  const conversationHistoryForGroq: Groq.Chat.Completions.ChatCompletionMessageParam[] =
    dbHistory
      ?.map((msg) => {
        if (
          msg.groq_message_object &&
          typeof msg.groq_message_object === "object" &&
          msg.groq_message_object !== null &&
          "role" in msg.groq_message_object &&
          "content" in msg.groq_message_object
        ) {
          return msg.groq_message_object as Groq.Chat.Completions.ChatCompletionMessageParam;
        }
        return {
          role: msg.sender as "user" | "assistant",
          content: msg.content,
        };
      })
      .slice(-(MAX_HISTORY_MESSAGES * 2)) || [];

  try {
    const stream = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are Nova, a friendly and helpful AI teaching assistant for students from KG to High School. Be concise but informative. If asked about complex topics, try to explain them in an age-appropriate manner, but assume a general high school understanding unless specified. Your goal is to help students learn and understand concepts.",
        },
        ...conversationHistoryForGroq,
      ],
      model: "llama3-8b-8192",
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 1,
      stream: true,
    });

    let fullNovaResponseContent = "";
    for await (const chunk of stream) {
      const deltaContent = chunk.choices[0]?.delta?.content || "";
      fullNovaResponseContent += deltaContent;
    }

    if (fullNovaResponseContent) {
      const novaGroqMessage: Groq.Chat.Completions.ChatCompletionMessageParam =
        {
          role: "assistant",
          content: fullNovaResponseContent,
        };
      const novaDbMessage: ChatMessage = {
        user_id: user.id,
        conversation_id: conversationId,
        sender: "assistant",
        content: fullNovaResponseContent,
        groq_message_object: novaGroqMessage,
      };
      const { error: insertNovaMsgError } = await supabase
        .from("chat_messages")
        .insert(novaDbMessage);

      if (insertNovaMsgError) {
        console.error("Error saving Nova message to DB:", insertNovaMsgError);
      }

      revalidatePath("/chat");
      return {
        response: fullNovaResponseContent,
        conversationId: conversationId,
      };
    } else {
      return {
        response: null,
        error: "Nova didn't provide a response this time.",
        conversationId: conversationId,
      };
    }
  } catch (error) {
    console.error("Groq API Error (streaming):", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return {
      response: null,
      error: `Sorry, I encountered an issue while streaming: ${errorMessage}`,
      conversationId: conversationId,
    };
  }
}

export async function getConversationsListAction(): Promise<Array<{id: string; title: string}>> {
  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Auth error in getConversationsListAction:", authError);
    return [];
  }

  // 1. Fetch from `conversations` table first
  const { data: titledConvos, error: titledError } = await supabase
    .from("conversations")
    .select("id, title, updated_at") // Use updated_at for sorting
    .eq("user_id", user.id);
    // Order later after merging

  if (titledError) {
    console.error("Error fetching from conversations table:", titledError.message);
    // Don't return yet, try to build from chat_messages as a fallback.
  }

  // 2. Fetch all distinct conversation_ids and their latest message `created_at`
  //    and first message `content` from `chat_messages`
  //    This is a bit more complex to do efficiently in one go with a fallback.
  //    A view or a more complex query could optimize this.
  //    For now, let's fetch all relevant chat messages and process in code.

  const { data: allMessages, error: messagesError } = await supabase
    .from("chat_messages")
    .select("conversation_id, content, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true }); // Get all messages to find the first one for untitled convos

  if (messagesError) {
    console.error("Error fetching chat_messages for conversation list:", messagesError.message);
    // If we have titledConvos, we can return those, otherwise empty
    return titledConvos?.filter(tc => tc.title).map(tc => ({ id: tc.id, title: tc.title! })) || [];
  }

  const conversationMap = new Map<string, { id: string; title: string | null; firstMessageContent: string; lastActivity: Date }>();

  // Process all messages to get first message content and latest activity per conversation_id
  allMessages?.forEach(msg => {
    if (!conversationMap.has(msg.conversation_id)) {
      conversationMap.set(msg.conversation_id, {
        id: msg.conversation_id,
        title: null, // Will be filled by titledConvos if available
        firstMessageContent: msg.content, // This is the first message due to ascending order
        lastActivity: new Date(msg.created_at), // Initially set to first message, update if more messages
      });
    } else {
      // Update last activity to the latest message for that conversation
      const existing = conversationMap.get(msg.conversation_id)!;
      if (new Date(msg.created_at) > existing.lastActivity) {
        existing.lastActivity = new Date(msg.created_at);
      }
    }
  });

  // Merge with titled conversations
  titledConvos?.forEach(tc => {
    if (conversationMap.has(tc.id)) {
      const existing = conversationMap.get(tc.id)!;
      existing.title = tc.title || existing.title; // Prioritize actual title
      // Use conversation.updated_at if it's more recent than any message (e.g., title was just updated)
      if (tc.updated_at && new Date(tc.updated_at) > existing.lastActivity) {
          existing.lastActivity = new Date(tc.updated_at);
      }
    } else {
      // This case should be rare if all conversations originate from chat_messages
      // but good to handle: a conversation entry exists but no messages (e.g. created manually or error)
      conversationMap.set(tc.id, {
        id: tc.id,
        title: tc.title,
        firstMessageContent: tc.title || "Conversation", // Fallback
        lastActivity: new Date(tc.updated_at || Date.now()),
      });
    }
  });


  // Finalize titles (use first message content if no DB title)
  const resultList = Array.from(conversationMap.values()).map(convo => ({
    id: convo.id,
    title: convo.title || convo.firstMessageContent.substring(0, 40) + (convo.firstMessageContent.length > 40 ? "..." : ""),
    lastActivity: convo.lastActivity,
  }));

  // Sort by last activity (most recent first)
  resultList.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

  return resultList.map(c => ({ id: c.id, title: c.title }));
}

export async function getMessagesForConversation(
  conversationId: string | null
): Promise<ChatMessage[]> {
  if (!conversationId) return [];

  const supabase = createSupabaseServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("user_id", user.id)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching messages for conversation:", error);
    return [];
  }

  return (
    data?.map((msg) => ({
      id: msg.id,
      user_id: msg.user_id,
      conversation_id: msg.conversation_id,
      sender: msg.sender as "user" | "assistant",
      content: msg.content,
      created_at: new Date(msg.created_at),
      groq_message_object: msg.groq_message_object,
    })) || []
  );
}

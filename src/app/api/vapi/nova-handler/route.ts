import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js'; // Standard Supabase client

const groqApiKey = process.env.GROQ_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; // Use NEXT_PUBLIC_ for URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // For backend operations

if (!groqApiKey) console.error("VAPI HANDLER CRITICAL: GROQ_API_KEY not set.");
if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("VAPI HANDLER CRITICAL: Supabase URL or Service Role Key not set.");
}

const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;
// Initialize Supabase client with service role key for backend DB operations
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;

interface VapiMessage {
    type: string;
    role?: string;
    content?: string;
    transcript?: string;
    toolCallId?: string;
    status?: string;
    // Add other properties as needed
}

interface UserContext {
    userName?: string;
    userGrade?: string;
    userSubjects?: string;
    cogniSparkUserId?: string;
    [key: string]: any; // Allow for additional context variables
}

const MAX_HISTORY_TURNS = 7;

// Helper function to get or create conversation history
async function getOrCreateConversationHistory(
    callId: string,
    userIdFromVapi?: string | null, // User ID passed from client via Vapi metadata
    initialSystemPromptContent?: string
): Promise<Groq.Chat.Completions.ChatCompletionMessageParam[] | null> {
    if (!supabaseAdmin) return null;

    const { data, error } = await supabaseAdmin
        .from('vapi_sessions')
        .select('conversation_history, user_id')
        .eq('call_id', callId)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error(`VAPI HANDLER: Error fetching history for callId ${callId}:`, error);
        return null;
    }

    if (data) {
        // TODO: Optionally verify if data.user_id matches userIdFromVapi if both are present
        return data.conversation_history as Groq.Chat.Completions.ChatCompletionMessageParam[];
    } else {
        // No history found, create new session
        const systemPrompt = {
            role: "system" as const,
            content: initialSystemPromptContent || "You are Nova, an AI voice tutor...",
        };
        const initialHistory = [systemPrompt];
        const { error: insertError } = await supabaseAdmin
            .from('vapi_sessions')
            .insert({
                call_id: callId,
                user_id: userIdFromVapi || null, // Link to user if ID is passed
                conversation_history: initialHistory,
                updated_at: new Date().toISOString(),
            });
        if (insertError) {
            console.error(`VAPI HANDLER: Error creating new session for callId ${callId}:`, insertError);
            return null;
        }
        console.log(`VAPI HANDLER: Created new session for callId ${callId}, userId: ${userIdFromVapi || 'N/A'}`);
        return initialHistory;
    }
}

async function updateConversationHistory(
    callId: string,
    newHistory: Groq.Chat.Completions.ChatCompletionMessageParam[]
): Promise<boolean> {
    if (!supabaseAdmin) return false;
    const { error } = await supabaseAdmin
        .from('vapi_sessions')
        .update({
            conversation_history: newHistory,
            updated_at: new Date().toISOString(),
        })
        .eq('call_id', callId);
    if (error) {
        console.error(`VAPI HANDLER: Error updating history for callId ${callId}:`, error);
        return false;
    }
    return true;
}

async function markCallEnded(callId: string): Promise<void> {
    if (!supabaseAdmin) return;
    await supabaseAdmin
        .from('vapi_sessions')
        .update({ call_ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('call_id', callId);
    console.log(`VAPI HANDLER: Marked call ${callId} as ended.`);
}

export async function POST(req: NextRequest) {
  // console.log("Vapi Nova Handler: Received POST request.");
  if (!groq || !supabaseAdmin) {
    return NextResponse.json({ error: "Core services (AI or DB) not configured." }, { status: 500 });
  }

  try {
    const vapiPayload = await req.json();
    const message = vapiPayload.message;
    const call = vapiPayload.call;
    const callId = call?.id || vapiPayload.callId || `unknown-call-${Date.now()}`;

    // Extract user context passed from client via Vapi assistantOverrides.variableValues
    const variableValues = call?.metadata?.variableValues || call?.variableValues || vapiPayload.variableValues || {};
    const clientPassedUserId = variableValues.cogniSparkUserId || null; // Expecting client to send this
    const userName = variableValues.userName || "Student";
    const userGrade = variableValues.userGrade || "High School";
    const userSubjects = variableValues.userSubjects || "general topics";

    let baseSystemPrompt = `You are Nova, an AI voice tutor in a real-time, interruptible conversation. Student's name is ${userName}. Keep responses concise and natural for speaking.`;
    if (userGrade && userGrade !== "Not Specified") baseSystemPrompt += ` They are in ${userGrade}. Adapt your explanations.`;
    if (userSubjects) baseSystemPrompt += ` They are interested in ${userSubjects}.`;
    baseSystemPrompt += ` Your primary goal is to help the student learn and understand topics. Always try to guide them to answers rather than just giving them. If they seem stuck, offer a hint or a simpler related question.`;

    let currentHistory = await getOrCreateConversationHistory(callId, clientPassedUserId, baseSystemPrompt);
    if (!currentHistory) {
        return NextResponse.json({ message: { type: 'add-message', role: 'assistant', content: "I'm having trouble remembering our conversation. Let's try starting over." } });
    }

    if (message?.type === "transcript" && message.role === "user" && message.transcript) {
      currentHistory.push({ role: "user", content: message.transcript });
    } else if (message?.type === "hangup" || message?.type === "end-of-call-report" || message?.type === "call_ended_event") {
      await markCallEnded(callId);
      return NextResponse.json({ control: { type: "end-call-action" } });
    } else if (message?.type === "function_call") {
      // ... (handle function calls if implemented) ...
      return NextResponse.json({ message: { type: 'add-message', role: 'assistant', content: "I can't do that action right now." } });
    } else if (message?.type === 'status-update' && (message.status === 'queued' || message.status === 'ringing')) {
        return NextResponse.json({ message: `Call ${message.status}.`});
    } else if (message?.type === 'status-update' && message.status === 'in-progress') {
        // Call is now connected. If history has only system prompt, Nova might give an opening.
        // Or Vapi's "First Message" handles this.
        // If we want Nova to speak first if Vapi doesn't, we might need logic here.
        // For now, if the last message isn't 'user', we don't proactively speak.
        if (currentHistory.length > 0 && currentHistory[currentHistory.length -1].role !== 'user') {
             console.log(`Vapi Nova Handler: Call in progress for ${callId}, awaiting user input.`);
             return NextResponse.json({ success: true }); // Acknowledge, wait for user
        }
    } else if (!message || (message.role !== 'user' && message.type !== 'assistant_request')) {
        console.log(`VAPI HANDLER: Unhandled or non-actionable message type '${message?.type}' for callId ${callId}.`);
        return NextResponse.json({ message: "Waiting for your input." });
    }


    // Prune history
    if (currentHistory.length > (MAX_HISTORY_TURNS * 2 + 1)) {
      currentHistory = [currentHistory[0], ...currentHistory.slice(-(MAX_HISTORY_TURNS * 2))];
    }

    // Call Groq
    const completion = await groq.chat.completions.create({
      messages: currentHistory,
      model: "llama3-8b-8192", temperature: 0.75, max_tokens: 120, stream: false,
    });
    const novaResponseText = completion.choices[0]?.message?.content?.trim();

    if (novaResponseText) {
      currentHistory.push({ role: "assistant", content: novaResponseText });
      await updateConversationHistory(callId, currentHistory); // Save updated history
      return NextResponse.json({ message: { type: 'add-message', role: 'assistant', content: novaResponseText } });
    } else {
      // No response from Groq, maybe send a polite "didn't catch that"
      return NextResponse.json({ message: { type: 'add-message', role: 'assistant', content: "I'm not sure how to respond to that. Could you rephrase?" } });
    }

  } catch (error: any) {
    console.error("Vapi Nova Handler - Catch Block Error:", error);
    return NextResponse.json({ message: { type: "add-message", role: "assistant", content: "I'm having a little trouble right now. Please try again in a moment." } }, { status: 200 });
  }
}
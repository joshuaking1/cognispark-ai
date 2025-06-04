import { NextRequest, NextResponse } from 'next/server';

// Store conversation histories in memory (for development only)
// In production, this should be stored in a database like Supabase or Redis
const conversationHistories: Record<string, any[]> = {};
const MAX_HISTORY_TURNS = 7;

// Interface for user context passed from the frontend
interface UserContext {
    userName?: string;
    userGrade?: string;
    userSubjects?: string;
    [key: string]: any; // Allow for additional context variables
}

// Base system prompt for Nova that will be personalized
const BASE_SYSTEM_PROMPT = `You are Nova, an AI voice tutor in a real-time, interruptible conversation. Your name is Nova. If asked about your name, always respond with "I'm Nova, your AI tutor." Keep your responses relatively concise and natural for speaking. You can ask clarifying questions. Be friendly and engaging. Your primary goal is to help the student learn and understand topics. Always try to guide them to answers rather than just giving them. If they seem stuck, offer a hint or a simpler related question.`;

export async function POST(req: NextRequest) {
  console.log("Vapi Root Handler: Processing request");
  
  try {
    // Read the body as JSON
    const body = await req.json();
    console.log("Vapi Root Handler - Received payload:", JSON.stringify(body, null, 2));
    
    // First, let's make sure we have the Groq API key
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      console.error("VAPI HANDLER CRITICAL: GROQ_API_KEY not set.");
      return NextResponse.json({ error: "AI Language Model service not configured." }, { status: 500 });
    }
    
    // Import Groq directly
    const Groq = (await import('groq-sdk')).default;
    const groq = new Groq({ apiKey: groqApiKey });
    
    // Get the message and call ID from the body
    const message = body.message;
    const call = body.call || message?.call;
    const callId = call?.id || body.callId || `unknown-call-${Date.now()}`;
    
    // Extract user context passed from client via Vapi assistantOverrides
    const variableValues = call?.metadata?.variableValues || call?.variableValues || body.variableValues || {};
    const userContext: UserContext = {
        userName: variableValues.userName || "Student",
        userGrade: variableValues.userGrade || "High School",
        userSubjects: variableValues.userSubjects || "general topics"
    };
    
    // Create personalized system prompt
    let personalizedSystemPrompt = BASE_SYSTEM_PROMPT;
    personalizedSystemPrompt = `${BASE_SYSTEM_PROMPT} You are speaking with ${userContext.userName}.`;
    
    if (userContext.userGrade && userContext.userGrade !== "Not Specified") {
        personalizedSystemPrompt += ` They are in ${userContext.userGrade}. Adapt your explanations accordingly.`;
    }
    
    if (userContext.userSubjects && userContext.userSubjects !== "Not Specified") {
        personalizedSystemPrompt += ` They are particularly interested in ${userContext.userSubjects}.`;
    }
    
    console.log(`Created personalized system prompt for ${userContext.userName} (Grade: ${userContext.userGrade}, Subjects: ${userContext.userSubjects})`);
    
    // Log the call ID for debugging
    console.log(`Processing message type: ${message?.type} for callId: ${callId}`);
    
    if (!message) {
      console.warn("Vapi Root Handler: No 'message' object in payload for callId:", callId);
      return NextResponse.json({ error: "Invalid Vapi payload structure." }, { status: 400 });
    }
    
    // Handle different message types based on Vapi's current structure
    switch (message.type) {
      case 'assistant-request':
        // This is when Vapi requests a response from your LLM
        console.log(`Assistant request for callId ${callId}`);
        
        // Initialize conversation history if not exists
        if (!conversationHistories[callId]) {
          console.log(`Initializing new conversation history for callId ${callId} with personalized system prompt`);
          conversationHistories[callId] = [{
            role: "system",
            content: personalizedSystemPrompt,
          }];
        }

        // Add user message if there's transcript content
        if (message.transcript && message.transcript.trim()) {
          console.log(`User said: "${message.transcript}"`);
          conversationHistories[callId].push({ 
            role: "user", 
            content: message.transcript 
          });
        }

        // Generate response
        let currentHistory = conversationHistories[callId];
        
        // Ensure system prompt is always first and correct
        if (currentHistory[0]?.role !== "system") {
          currentHistory.unshift({
            role: "system",
            content: personalizedSystemPrompt,
          });
        } else if (!currentHistory[0].content.includes(userContext.userName)) {
          // Only update if the system prompt doesn't already include the user's name
          // This prevents overwriting with a generic prompt if we already have a personalized one
          currentHistory[0].content = personalizedSystemPrompt;
        }
        
        // Prune history if too long (keep system prompt + last N turns)
        if (currentHistory.length > (MAX_HISTORY_TURNS * 2 + 1)) {
          conversationHistories[callId] = [
            currentHistory[0], // Keep system prompt
            ...currentHistory.slice(-(MAX_HISTORY_TURNS * 2))
          ];
          currentHistory = conversationHistories[callId];
        }

        console.log(`Sending to Groq for callId ${callId}. History length: ${currentHistory.length}`);
        
        try {
          const completion = await groq.chat.completions.create({
            messages: currentHistory,
            model: "llama3-8b-8192",
            temperature: 0.75,
            max_tokens: 120,
            stream: false,
          });

          const responseText = completion.choices[0]?.message?.content?.trim();

          if (responseText) {
            console.log(`Groq response for callId ${callId}: "${responseText}"`);
            conversationHistories[callId].push({ 
              role: "assistant", 
              content: responseText 
            });

            // Return the proper response format for Vapi
            // The key fix: return just the assistant content, Vapi handles the system prompt separately
            return NextResponse.json({
              assistant: {
                model: {
                  messages: [{
                    role: "assistant",
                    content: responseText
                  }]
                }
              }
            });
          } else {
            console.log(`No response from Groq for callId ${callId}`);
            return NextResponse.json({
              assistant: {
                model: {
                  messages: [{
                    role: "assistant",
                    content: "I'm not sure how to respond to that. Can you try asking differently?"
                  }]
                }
              }
            });
          }
        } catch (groqError) {
          console.error("Error calling Groq:", groqError);
          throw groqError;
        }

      case 'status-update':
        console.log(`Status update for callId ${callId}: ${JSON.stringify(message)}`);
        return NextResponse.json({ received: true });

      case 'hang':
        console.log(`Hang detected for callId ${callId}`);
        return NextResponse.json({ received: true });

      case 'speech-update':
        console.log(`Speech update for callId ${callId}`);
        return NextResponse.json({ received: true });

      case 'transcript':
        console.log(`Transcript update for callId ${callId}: ${message.transcript}`);
        return NextResponse.json({ received: true });

      case 'tool-calls':
        console.log(`Tool call for callId ${callId} - not implemented`);
        return NextResponse.json({
          results: [{
            toolCallId: message.toolCallId || 'unknown',
            result: "I can't use tools just yet."
          }]
        });

      case 'conversation-update':
        console.log(`Conversation update for callId ${callId}`);
        
        // If we have a conversation array in the message, update our history
        if (Array.isArray(message.conversation)) {
          console.log(`Updating conversation history for callId ${callId} with ${message.conversation.length} messages`);
          
          // Initialize with our personalized system prompt if not exists
          if (!conversationHistories[callId]) {
            conversationHistories[callId] = [{
              role: "system",
              content: personalizedSystemPrompt,
            }];
          }
          
          // Process the conversation messages from Vapi
          // Skip any system message from Vapi and keep our own
          const conversationToAdd = message.conversation.filter((msg: any) => msg.role !== 'system');
          
          for (const msg of conversationToAdd) {
            // Only add if it's not a duplicate of the last message
            const lastMsg = conversationHistories[callId][conversationHistories[callId].length - 1];
            if (!lastMsg || lastMsg.role !== msg.role || lastMsg.content !== msg.content) {
              conversationHistories[callId].push(msg);
            }
          }
          
          console.log(`Updated conversation history for callId ${callId}. New length: ${conversationHistories[callId].length}`);
        }
        
        return NextResponse.json({ received: true });
        
      case 'end-of-call-report':
        console.log(`End of call report for callId ${callId}. Cleaning up history.`);
        delete conversationHistories[callId];
        return NextResponse.json({ received: true });

      default:
        console.log(`Unhandled message type: ${message.type} for callId ${callId}`);
        return NextResponse.json({ received: true });
    }
    
  } catch (error) {
    console.error("Vapi Root Handler - Error:", error);
    return NextResponse.json({
      assistant: {
        model: {
          messages: [{
            role: "assistant",
            content: "I seem to be having a little trouble processing your request. Please try again in a moment."
          }]
        }
      }
    }, { status: 200 }); // Use 200 to ensure Vapi can process the response
  }
}
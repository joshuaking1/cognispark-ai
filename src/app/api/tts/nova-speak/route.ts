import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsClient } from 'elevenlabs';

const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel as default

if (!apiKey) {
  console.error('TTS API Route: ELEVENLABS_API_KEY is not set.');
}

// Initialize the ElevenLabs client
const elevenlabs = apiKey ? new ElevenLabsClient({
  apiKey: apiKey
}) : null;

export async function POST(req: NextRequest) {
  if (!elevenlabs) {
    return NextResponse.json({ 
      error: 'TTS service not configured. Please check your ELEVENLABS_API_KEY environment variable.' 
    }, { status: 500 });
  }

  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text to speak is required.' }, { status: 400 });
    }
    if (text.length > 1000) {
      return NextResponse.json({ error: 'Text is too long for TTS. Maximum length is 1000 characters.' }, { status: 400 });
    }

    try {
      // Generate audio using the generate method with streaming
      const audioStream = await elevenlabs.generate({
        voice: voiceId,
        text: text,
        model_id: 'eleven_multilingual_v2',
        stream: true
      });

      // Create a new ReadableStream to pipe the audio data
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of audioStream) {
              controller.enqueue(chunk);
            }
            controller.close();
          } catch (error) {
            console.error('Error in audio stream:', error);
            controller.error(error);
          }
        }
      });

      return new NextResponse(stream, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-cache',
        },
      });
    } catch (ttsError: any) {
      console.error('ElevenLabs TTS Error:', ttsError);
      return NextResponse.json({ 
        error: `TTS generation failed: ${ttsError.message || 'Unknown TTS error'}`,
        details: ttsError.response?.data || ttsError.cause || null
      }, { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  } catch (error: any) {
    console.error('ElevenLabs API Error in /api/tts/nova-speak:', error);
    return NextResponse.json({ 
      error: `API Error: ${error.message || 'Failed to process request'}`,
      details: error.cause || null
    }, {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
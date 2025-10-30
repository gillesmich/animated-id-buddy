import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestSchema = z.object({
      action: z.enum(['create_session', 'start_stream', 'submit_network', 'send_audio']),
      sessionId: z.string().optional(),
      streamId: z.string().optional(),
      data: z.any().optional()
    });

    const requestBody = await req.json();
    const validatedData = requestSchema.parse(requestBody);
    const { action, sessionId, streamId, data } = validatedData;
    
    const DID_API_KEY = Deno.env.get('DID_API_KEY');
    if (!DID_API_KEY) {
      throw new Error('DID_API_KEY not configured');
    }

    console.log('D-ID WebRTC action:', action);

    let url: string;
    let method = 'POST';
    let body: any;

    switch (action) {
      case 'create_session':
        // Créer une nouvelle session de streaming
        url = 'https://api.d-id.com/talks/streams';
        body = {
          source_url: data.source_url
        };
        break;
      
      case 'start_stream':
        // Démarrer le stream avec SDP answer
        url = `https://api.d-id.com/talks/streams/${sessionId}/sdp`;
        body = {
          answer: {
            type: 'answer',
            sdp: data.sdp
          },
          session_id: sessionId
        };
        break;
      
      case 'submit_network':
        // Soumettre les ICE candidates
        url = `https://api.d-id.com/talks/streams/${sessionId}/ice`;
        body = {
          candidate: data.candidate,
          sdpMid: data.sdpMid,
          sdpMLineIndex: data.sdpMLineIndex,
          session_id: sessionId
        };
        break;
      
      case 'send_audio':
        // Envoyer un script audio à streamer
        url = `https://api.d-id.com/talks/streams/${streamId}`;
        body = {
          script: {
            type: 'text',
            input: data.text,
            provider: {
              type: 'microsoft',
              voice_id: data.voice_id || 'fr-FR-DeniseNeural'
            }
          },
          config: {
            fluent: true,
            pad_audio: 0,
            stitch: true
          },
          session_id: sessionId
        };
        break;
      
      default:
        throw new Error('Invalid action');
    }

    console.log('Calling D-ID API:', url);
    console.log('Request body:', body ? JSON.stringify(body, null, 2) : 'none');
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Basic ${DID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log('D-ID Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('D-ID API error response:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      throw new Error(JSON.stringify({
        status: response.status,
        error: errorData,
        message: `D-ID WebRTC error: ${errorData.message || response.statusText}`
      }));
    }

    const result = await response.json();
    console.log('D-ID WebRTC API success:', action);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

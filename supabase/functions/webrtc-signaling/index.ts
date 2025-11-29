import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Store sessions in memory (in production, use a database)
const sessions = new Map<string, {
  offer?: any;
  answer?: any;
  iceCandidates: any[];
  createdAt: number;
}>();

// Clean up old sessions (older than 1 hour)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.createdAt > 3600000) {
      sessions.delete(sessionId);
    }
  }
}, 300000); // Every 5 minutes

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'create-session') {
      const sessionId = crypto.randomUUID();
      sessions.set(sessionId, {
        iceCandidates: [],
        createdAt: Date.now()
      });
      
      console.log(`[Signaling] Session created: ${sessionId}`);
      
      return new Response(
        JSON.stringify({ sessionId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'send-offer') {
      const { sessionId, offer } = await req.json();
      
      if (!sessions.has(sessionId)) {
        throw new Error('Session not found');
      }
      
      const session = sessions.get(sessionId)!;
      session.offer = offer;
      
      console.log(`[Signaling] Offer received for session ${sessionId}`);
      
      // Create a mock answer (in production, forward to Python backend)
      const answer = {
        type: 'answer',
        sdp: `v=0
o=- ${Date.now()} 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0
a=msid-semantic: WMS
m=application 9 UDP/DTLS/SCTP webrtc-datachannel
c=IN IP4 0.0.0.0
a=ice-ufrag:${crypto.randomUUID().slice(0, 8)}
a=ice-pwd:${crypto.randomUUID()}
a=ice-options:trickle
a=fingerprint:sha-256 ${Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(':')}
a=setup:active
a=mid:0
a=sctp-port:5000
a=max-message-size:262144`
      };
      
      session.answer = answer;
      
      return new Response(
        JSON.stringify({ answer }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'add-ice-candidate') {
      const { sessionId, candidate } = await req.json();
      
      if (!sessions.has(sessionId)) {
        throw new Error('Session not found');
      }
      
      const session = sessions.get(sessionId)!;
      session.iceCandidates.push(candidate);
      
      console.log(`[Signaling] ICE candidate added for session ${sessionId}`);
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'close-session') {
      const { sessionId } = await req.json();
      
      if (sessions.has(sessionId)) {
        sessions.delete(sessionId);
        console.log(`[Signaling] Session closed: ${sessionId}`);
      }
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'health') {
      return new Response(
        JSON.stringify({ 
          status: 'healthy',
          sessions: sessions.size
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('[Signaling] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

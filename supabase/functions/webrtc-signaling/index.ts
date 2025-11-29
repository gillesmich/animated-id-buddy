import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const action = body.action;

    console.log(`[Signaling] Action: ${action}`);

    if (action === 'create-session') {
      const sessionId = crypto.randomUUID();
      
      // Insert session into database
      const { error } = await supabase
        .from('webrtc_sessions')
        .insert({
          session_id: sessionId,
          ice_candidates: []
        });

      if (error) {
        console.error('[Signaling] Error creating session:', error);
        throw new Error(`Failed to create session: ${error.message}`);
      }

      console.log(`[Signaling] Session created: ${sessionId}`);
      
      return new Response(
        JSON.stringify({ sessionId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'send-offer') {
      const { sessionId, offer } = body;
      
      // Check if session exists
      const { data: session, error: fetchError } = await supabase
        .from('webrtc_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (fetchError || !session) {
        console.error('[Signaling] Session not found:', sessionId);
        throw new Error('Session not found');
      }

      // Update session with offer
      const { error: updateError } = await supabase
        .from('webrtc_sessions')
        .update({ offer })
        .eq('session_id', sessionId);

      if (updateError) {
        console.error('[Signaling] Error updating offer:', updateError);
        throw new Error(`Failed to update offer: ${updateError.message}`);
      }
      
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
a=sctp-port:5000`
      };
      
      // Update session with answer
      await supabase
        .from('webrtc_sessions')
        .update({ answer })
        .eq('session_id', sessionId);
      
      return new Response(
        JSON.stringify({ answer }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'add-ice-candidate') {
      const { sessionId, candidate } = body;
      
      // Get current session
      const { data: session, error: fetchError } = await supabase
        .from('webrtc_sessions')
        .select('ice_candidates')
        .eq('session_id', sessionId)
        .single();

      if (fetchError || !session) {
        console.error('[Signaling] Session not found:', sessionId);
        throw new Error('Session not found');
      }

      // Add new candidate
      const currentCandidates = session.ice_candidates || [];
      const updatedCandidates = [...currentCandidates, candidate];

      const { error: updateError } = await supabase
        .from('webrtc_sessions')
        .update({ ice_candidates: updatedCandidates })
        .eq('session_id', sessionId);

      if (updateError) {
        console.error('[Signaling] Error adding ICE candidate:', updateError);
        throw new Error(`Failed to add ICE candidate: ${updateError.message}`);
      }
      
      console.log(`[Signaling] ICE candidate added for session ${sessionId}`);
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'close-session') {
      const { sessionId } = body;
      
      const { error } = await supabase
        .from('webrtc_sessions')
        .delete()
        .eq('session_id', sessionId);

      if (error) {
        console.error('[Signaling] Error closing session:', error);
      } else {
        console.log(`[Signaling] Session closed: ${sessionId}`);
      }
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'health') {
      const { count } = await supabase
        .from('webrtc_sessions')
        .select('*', { count: 'exact', head: true });

      return new Response(
        JSON.stringify({ 
          status: 'healthy',
          sessions: count || 0
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

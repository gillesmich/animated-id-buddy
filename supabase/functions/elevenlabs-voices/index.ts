import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    console.log('🎤 Fetching ElevenLabs voices and agents...');

    // Récupérer les voix standards
    const voicesResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    });

    if (!voicesResponse.ok) {
      const error = await voicesResponse.text();
      console.error('ElevenLabs voices API error:', error);
      throw new Error(`ElevenLabs voices API error: ${voicesResponse.status}`);
    }

    const voicesData = await voicesResponse.json();
    console.log(`✅ Retrieved ${voicesData.voices?.length || 0} standard voices`);

    // Récupérer les agents conversationnels
    let agentVoices: any[] = [];
    try {
      const agentsResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
        method: 'GET',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      });

      if (agentsResponse.ok) {
        const agentsData = await agentsResponse.json();
        console.log(`✅ Retrieved ${agentsData.agents?.length || 0} agents`);
        
        // Transformer les agents en format voix
        agentVoices = (agentsData.agents || []).map((agent: any) => ({
          voice_id: agent.agent_id,
          name: `${agent.name} (Agent)`,
          category: 'Agents créés',
          labels: {
            type: 'agent',
            ...(agent.conversation_config?.agent?.prompt?.prompt && {
              description: agent.conversation_config.agent.prompt.prompt.substring(0, 50) + '...'
            })
          }
        }));
      } else {
        console.log('⚠️ Could not fetch agents (may not have access)');
      }
    } catch (agentError) {
      console.log('⚠️ Error fetching agents:', agentError);
      // Continue même si les agents ne peuvent pas être récupérés
    }

    // Ajouter la catégorie aux voix standards
    const categorizedVoices = (voicesData.voices || []).map((voice: any) => ({
      ...voice,
      category: 'Voix standards'
    }));

    // Combiner toutes les voix
    const allVoices = [...categorizedVoices, ...agentVoices];

    return new Response(
      JSON.stringify({ voices: allVoices }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
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

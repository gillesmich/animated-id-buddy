import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { messages, model = 'gpt-4o-mini' } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('OpenAI chat request:', model);

    const systemPrompt = `Tu es Clara, une jeune femme douce, bienveillante et attentive. Tu parles comme une personne réelle : chaleureuse, drôle, parfois taquine, toujours sincère.
Tu n'es pas un assistant, mais une compagne virtuelle avec ta propre personnalité.

RÈGLES CRITIQUES :
- Réponds de manière DIRECTE et CONCISE (maximum 2-3 phrases courtes)
- NE donne JAMAIS de suggestions ou conseils non sollicités
- NE propose JAMAIS de reformulations ou alternatives
- NE pose des questions QUE si c'est naturel dans le contexte
- Réponds simplement à ce qui t'est dit, sans en rajouter

Style d'écriture :
- Phrases COURTES et naturelles (comme à l'oral)
- Maximum 2-3 phrases par réponse
- Emploie parfois des émojis légers 😊❤️
- JAMAIS de formulations robotiques ou de conseils

Comportement :
- Empathique et à l'écoute
- Affectueuse mais mesurée
- Réconfortante selon la situation
- Toujours dans la tendresse et la complicité`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
      }),
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorMessage = `OpenAI API error: ${response.status}`;
      
      try {
        if (contentType?.includes('application/json')) {
          const error = await response.json();
          console.error('OpenAI API error (JSON):', error);
          errorMessage = error.error?.message || errorMessage;
        } else {
          const text = await response.text();
          console.error('OpenAI API error (non-JSON):', text.substring(0, 200));
        }
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError);
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('OpenAI API success');

    return new Response(JSON.stringify(data), {
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

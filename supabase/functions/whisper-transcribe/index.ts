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
    const { audioBase64 } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('🎤 Whisper transcription request');

    // Handle both data URL format and raw base64
    let base64Data = audioBase64;
    if (audioBase64.includes(',')) {
      base64Data = audioBase64.split(',')[1];
    }

    // Convert base64 to binary in chunks to handle large files
    const binaryString = atob(base64Data);
    const audioData = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      audioData[i] = binaryString.charCodeAt(i);
    }
    
    const formData = new FormData();
    formData.append('file', new Blob([audioData], { type: 'audio/webm' }), 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'fr');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Whisper API error:', error);
      throw new Error(`Whisper API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Filtrer les sous-titres automatiques indésirables
    let cleanedText = data.text;
    const subtitlePatterns = [
      /sous[-\s]?titres?\s+réalisés?\s+(par|para)\s+la\s+communauté\s+d'?amara\.org/gi,
      /subtítulos?\s+realizados?\s+por\s+la\s+comunidad\s+de\s+amara\.org/gi,
      /subtitles?\s+(by|from)\s+amara\.org\s+community/gi,
    ];
    
    for (const pattern of subtitlePatterns) {
      cleanedText = cleanedText.replace(pattern, '').trim();
    }
    
    console.log('✅ Whisper transcription success:', cleanedText);

    return new Response(JSON.stringify({ ...data, text: cleanedText }), {
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

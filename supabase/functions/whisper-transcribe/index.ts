import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
      audioBase64: z.string().min(1, 'Audio data cannot be empty').max(10000000, 'Audio file too large')
    });

    const body = await req.json();
    const validatedData = requestSchema.parse(body);
    const { audioBase64 } = validatedData;
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

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

    // Créer un AbortController avec timeout de 60 secondes
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let response;
    try {
      response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
        signal: controller.signal,
      });
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('⏱️ Whisper API timeout après 60 secondes');
        throw new Error('La transcription a pris trop de temps (timeout 60s). Essayez avec un audio plus court.');
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      // Essayer de lire la réponse comme JSON, sinon comme texte
      let errorMessage = `Whisper API error: ${response.status}`;
      try {
        const error = await response.json();
        console.error('Whisper API error (JSON):', error);
        errorMessage = error.error?.message || JSON.stringify(error);
      } catch (jsonError) {
        const textError = await response.text();
        console.error('Whisper API error (text):', textError);
        errorMessage = textError || errorMessage;
      }
      throw new Error(errorMessage);
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('Failed to parse Whisper response as JSON:', jsonError);
      const textResponse = await response.text();
      console.error('Raw response:', textResponse);
      throw new Error(`Invalid JSON response from Whisper API: ${textResponse.substring(0, 100)}`);
    }
    
    // Filtrer les sous-titres automatiques indésirables et références Amara
    let cleanedText = data.text;
    
    console.log('📝 Texte brut Whisper:', cleanedText);
    
    // Liste de mots-clés YouTube à bloquer complètement
    const youtubeKeywords = [
      'voir une autre vidéo',
      'voir une vidéo',
      'abonnez-vous',
      'ma seconde chaîne',
      'ma chaîne',
      'seconde chaîne',
      'deuxième chaîne',
      'likez',
      'commentez',
      'partagez',
      'cliquez sur la cloche',
      'suivez-moi',
      'n\'oubliez pas',
    ];
    
    // Vérifier si le texte contient majoritairement des mots-clés YouTube
    const lowerText = cleanedText.toLowerCase();
    const keywordCount = youtubeKeywords.filter(keyword => lowerText.includes(keyword)).length;
    
    // Si plus de 2 mots-clés YouTube détectés, rejeter complètement le message
    if (keywordCount >= 2) {
      console.log('❌ Message rejeté: trop de mots-clés YouTube détectés');
      return new Response(JSON.stringify({ ...data, text: '' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // 1. Patterns de sous-titres, crédits et appels à l'action YouTube (patterns agressifs)
    const subtitlePatterns = [
      // Sous-titres Amara
      /sous[-\s]?titres?\s+réalisés?\s+(par|para|por)\s+(la\s+)?communauté\s+(d'?|de\s+)?amara\.org/gi,
      /subtítulos?\s+realizados?\s+(por|para)\s+(la\s+)?comunidad\s+de\s+amara\.org/gi,
      /subtitles?\s+(by|from|made\s+by)\s+(the\s+)?amara\.org\s+community/gi,
      /.*amara\.org.*/gi,
      
      // Appels à l'action YouTube - patterns très agressifs
      /voir\s+(une\s+)?(autre\s+)?vidéo/gi,
      /voir\s+une/gi,
      /voir/gi,
      /abonnez[-\s]?vous/gi,
      /abonne(z)?[-\s]?toi/gi,
      /ma\s+(seconde|deuxième|2e|2ème)\s+chaîne/gi,
      /ma\s+chaîne/gi,
      /(seconde|deuxième|2e|2ème)\s+chaîne/gi,
      /n['']oubliez\s+pas/gi,
      /like(z)?(\s+la)?(\s+vidéo)?/gi,
      /cliquez\s+sur(\s+la)?\s+cloche/gi,
      /partagez(\s+la)?(\s+vidéo)?/gi,
      /commentez(\s+en)?\s+dessous/gi,
      /suivez[-\s]?moi/gi,
      
      // Phrases de remerciement génériques
      /merci\s+(à\s+tous|beaucoup|pour\s+cette\s+vidéo)/gi,
      /à\s+bientôt/gi,
      /merci\s+d['']avoir\s+regardé/gi,
      /à\s+la\s+prochaine/gi,
      /on\s+se\s+retrouve/gi,
      /rendez[-\s]?vous/gi,
    ];
    
    // 2. Filtrer les patterns
    let filteredText = cleanedText;
    for (const pattern of subtitlePatterns) {
      filteredText = filteredText.replace(pattern, '');
    }
    
    // 3. Nettoyer les espaces multiples et ponctuation excessive
    filteredText = filteredText.replace(/\s+/g, ' ').trim();
    filteredText = filteredText.replace(/[.!?]+\s*$/, '').trim();
    
    console.log('📝 Texte après filtrage:', filteredText);
    
    // 4. Rejeter si le texte est trop court ou vide après nettoyage
    if (!filteredText || filteredText.length < 10) {
      console.log('❌ Message rejeté: texte trop court après nettoyage');
      filteredText = '';
    }
    
    // 5. Rejeter si le texte ne contient que de la ponctuation
    if (/^[.,!?\s]+$/.test(filteredText)) {
      console.log('❌ Message rejeté: que de la ponctuation');
      filteredText = '';
    }

    return new Response(JSON.stringify({ ...data, text: filteredText }), {
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

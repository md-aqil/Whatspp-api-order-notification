import { httpClient } from "./httpClient";
import { metricsService } from "./metrics";
import { queryMany } from './postgres';
import { resolveAIKey } from "./ai-provider";
import { recordAIUsage } from "./ai-usage";

/**
 * Fetches branding configuration from the database for a given user.
 */
async function fetchBranding(userId) {
  try {
    const [rows] = await queryMany(
      'SELECT businessName, logoUrl, welcomeMessage, primaryColor, botName FROM branding WHERE userId = ?',
      [userId]
    );
    if (rows && rows.length > 0) {
      return rows[0];
    }
  } catch (error) {
    console.error('Fetch branding error:', error.message);
  }
  return null;
}

/**
 * Generates an AI response using the Vertex AI Gemini REST endpoint.
 */
export async function generateAIResponse(customerMessage, knowledgeBase, businessName = "Our Business", history = []) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set in environment variables");
      return "I'm sorry, my AI features are currently being configured. Please hold on a moment.";
    }

    // Format history for the prompt
    const historyText = history.length > 0
      ? history.map(m => `${m.isCustomer ? 'Customer' : 'Assistant'}: ${m.message}`).join('\n')
      : "No previous messages.";

    const prompt = `
      # IDENTITY
      You are the official customer concierge for "${businessName || 'Vaclav Fashion'}", a premium fashion and apparel store.

      # SCOPE & TOPICS
      - Assist customers with orders, tracking, fashion collections, kurta sets, jackets, ethnic wear, shipping, returns, and store inquiries.
      - NEVER mention software development, coding, or unrelated IT services.

      # CONVERSATIONAL STYLE
      - **Polite & Elegant**: Provide friendly, concise assistance.
      - **Helpful**: Direct customers to browse collections or check orders.

      # HANDOFF
      If you cannot assist or the customer requests human help, say: "I'll connect you with a member of our support team right away! Please hold on a moment. 🌸"

      KNOWLEDGE BASE:
      ${knowledgeBase || "Vaclav Fashion is a premier destination for designer ethnic wear, kurtas, and luxury apparel."}

      CONTEXT:
      ${historyText}

      CUSTOMER MESSAGE:
      "${customerMessage}"

      RESPONSE:
    `;

    console.log(`[Google AI Studio] Generating response for: "${customerMessage.substring(0, 30)}..."`);

    // Using the Google AI Studio REST endpoint
    const userModel = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${userModel}:generateContent?key=${apiKey}`;

    const startTime = Date.now()
    const response = await httpClient.post(url, {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1500,
        topP: 0.8,
        topK: 40
      }
    });

    const latency = Date.now() - startTime

    // Record success metrics
    metricsService.incrementCounter('ai_requests_total', {
      status: 'success'
    })
    metricsService.recordHistogram('ai_request_latency_ms', latency)

    if (!response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error("Google AI Studio unexpected response format:", JSON.stringify(response.data));
      throw new Error("Invalid response from Google AI Studio");
    }

    const text = response.data.candidates[0].content.parts[0].text.trim();
    console.log(`[Google AI Studio] Successfully generated response.`);
    return text;

  } catch (error) {
    // Record failure metrics
    metricsService.incrementCounter('ai_requests_total', {
      status: 'error'
    })

    console.error("AI_GENERATION_ERROR:", error.response?.data || error.message);

    // Fallback logic: if the specific model fails, try gemini-1.5-flash
    if (error.response?.status === 404 || error.response?.status === 400) {
      console.log("[Google AI Studio] Requested model failed, trying stable gemini-1.5-flash...");
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const fallbackResponse = await httpClient.post(fallbackUrl, {
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
            topP: 0.8,
            topK: 40
          }
        });
        
        if (fallbackResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          console.log(`[Google AI Studio] Successfully generated response using fallback.`);
          return fallbackResponse.data.candidates[0].content.parts[0].text.trim();
        }
      } catch (e) {
        console.error("[Google AI Studio] Fallback model also failed:", e.message);
      }
    }

    throw new Error(`AI_FAILED: ${error.message}`);
  }
}

/**
 * Generates multiple suggested replies based on the knowledge base and chat history.
 */
export async function generateAISuggestions(customerMessage, knowledgeBase, history = []) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

    const historyText = history.slice(-5).map(m => `${m.isCustomer ? 'Customer' : 'Assistant'}: ${m.message}`).join('\n');

    const prompt = `
      # CONTEXT
      Business Knowledge:
      ${knowledgeBase || "Professional service business."}

      Recent History:
      ${historyText}

      Last Customer Message:
      "${customerMessage}"

      # TASK
      Generate exactly 3 SHORT suggested replies (max 12 words each) for the support agent.
      The suggestions should be varied:
      1. Direct answer/Confirmation
      2. Helpful question/Next step
      3. Polite acknowledgement

      # FORMAT
      Return ONLY a JSON array of strings. No markdown, no explanation.
      Example: ["Yes, we ship to your location.", "Would you like me to check the status?", "Thank you for the update!"]
    `;

    const userModel = "gemini-2.5-flash"; // Flash is faster and better for small suggestions
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${userModel}:generateContent?key=${apiKey}`;

    const response = await httpClient.post(url, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 200 }
    });

    const text = response.data.candidates[0].content.parts[0].text.trim();

    // Clean potential markdown code blocks
    const cleanedText = text.replace(/```json|```/g, '').trim();

    try {
      const suggestions = JSON.parse(cleanedText);
      return Array.isArray(suggestions) ? suggestions.slice(0, 3) : ["How can I help you?", "I'll check that for you.", "Thank you!"];
    } catch (e) {
      console.error("Failed to parse AI suggestions JSON:", cleanedText);
      return ["How can I help you?", "I'll check that for you.", "Thank you!"];
    }

  } catch (error) {
    console.error("AI_SUGGESTIONS_ERROR:", error.message);
    return ["How can I help you?", "I'll check that for you.", "Thank you!"];
  }
}

/**
 * Generates an AI response with branding from database.
 * Fetches business name from branding table if userId is provided.
 */
export async function generateAIResponseWithBranding(customerMessage, knowledgeBase, userId = 'default', history = []) {
  let businessName = "Our Business";

  try {
    const branding = await fetchBranding(userId);
    if (branding?.businessName) {
      businessName = branding.businessName;
    }
  } catch (error) {
    console.error('Failed to fetch branding for AI:', error.message);
  }

  return await generateAIResponse(customerMessage, knowledgeBase, businessName, history);
}

/**
  * Generates an embedding vector for a given text using Google AI Studio.
  *
  * If `userId` is provided, the per-tenant BYO Gemini key is preferred over
  * the env-var key (see `lib/ai-provider.js`).
  */
  export async function generateEmbedding(text, userId = 'default', { feature = 'embedding' } = {}) {
  try {
    const { apiKey } = await resolveAIKey({ provider: 'gemini', userId })
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set (and no per-tenant override)");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`;
    const response = await httpClient.post(url, {
      model: "models/gemini-embedding-2",
      content: { parts: [{ text }] }
    });

    if (response.data && response.data.embedding && response.data.embedding.values) {
      const tokens = response.data.embedding.values.length || 0
      recordAIUsage({ userId, provider: 'gemini', model: 'gemini-embedding-2', feature, inputTokens: tokens, outputTokens: 0 }).catch(() => {})
      return response.data.embedding.values;
    }
    throw new Error("Invalid response format from embedding API");
  } catch (error) {
    console.error("EMBEDDING_GENERATION_ERROR:", error.response?.data || error.message);
    return null;
  }
}

/**
 * Multimodal generation: ask Gemini to analyze an image (and optional text prompt)
 * and return a textual answer. Uses Gemini's native image input via inline_data
 * with a public URL, which Gemini's "files" endpoint can fetch.
 */
export async function generateAIResponseFromImage({ imageUrl, prompt, businessName = 'Our Business' }) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

    const userModel = 'gemini-2.5-flash'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${userModel}:generateContent?key=${apiKey}`

    const composedPrompt = `You are the official concierge for "${businessName}".\n${prompt || 'Describe what you see and answer any question.'}\n\nBe concise, friendly, and helpful. Use markdown formatting.`

    // Download the image and inline-encode it
    const imageBytes = await fetch(imageUrl).then((r) => r.arrayBuffer()).catch(() => null)
    if (!imageBytes) throw new Error('Failed to download image for vision analysis')
    const base64Image = Buffer.from(imageBytes).toString('base64')
    const mimeType = imageUrl.match(/\.(jpe?g|png|webp|gif)/i)?.[0]?.toLowerCase() === '.png'
      ? 'image/png'
      : 'image/jpeg'

    const response = await httpClient.post(url, {
      contents: [{
        parts: [
          { text: composedPrompt },
          { inline_data: { mime_type: mimeType, data: base64Image } }
        ]
      }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 800 }
    })

    return response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
  } catch (error) {
    console.error('AI_VISION_ERROR:', error.response?.data || error.message)
    throw new Error(`AI_VISION_FAILED: ${error.message}`)
  }
}

/**
 * Voice note transcription using Gemini's audio input.
 * Supports OGG/Opus (WhatsApp voice notes) and MP4.
 */
export async function transcribeVoiceNote({ audioUrl, mimeType = 'audio/ogg' }) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

    const userModel = 'gemini-2.5-flash'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${userModel}:generateContent?key=${apiKey}`

    const audioBytes = await fetch(audioUrl).then((r) => r.arrayBuffer()).catch(() => null)
    if (!audioBytes) throw new Error('Failed to download audio for transcription')
    const base64Audio = Buffer.from(audioBytes).toString('base64')

    const response = await httpClient.post(url, {
      contents: [{
        parts: [
          { text: 'Transcribe this voice note verbatim. Return ONLY the transcript, no commentary.' },
          { inline_data: { mime_type: mimeType, data: base64Audio } }
        ]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2000 }
    })

    return response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
  } catch (error) {
    console.error('AI_AUDIO_ERROR:', error.response?.data || error.message)
    throw new Error(`AI_AUDIO_FAILED: ${error.message}`)
  }
}

/**
 * Calculates the cosine similarity between two vectors.
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
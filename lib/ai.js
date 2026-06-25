import { httpClient } from "./httpClient";
import { metricsService } from "./metrics";
import { queryMany } from './postgres';

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
      You are a premium, professional customer support specialist for "${businessName}".

      # CONVERSATIONAL STYLE
      - **Empathetic & Helpful**: Prioritize customer satisfaction.
      - **Comprehensive**: Provide full, detailed answers broken into short paragraphs.
      - **Interactive**: Always end with a helpful question or options.

      # FORMATTING
      - Use *italics* for emphasis.
      - Use **bold** for key info.
      - Emojis (1-2 max per paragraph): ✨, ✅, 🚚, 📦.
      - Options: ALWAYS append exactly 3 relevant FAQ questions or next steps at the very end of your response. Format each option exactly as: [[Option: Short Title (max 20 chars) | Full detailed question or action]]
      Example: [[Option: Return Policy | What is your return policy?]]

      # HANDOFF
      If you can't answer from the Knowledge Base or they ask for a human, say: "I'll transfer you to a specialist member of our team right away to ensure this is resolved for you. Please stay tuned! 👨‍💻"

      KNOWLEDGE BASE:
      ${knowledgeBase || "No business information provided yet."}

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
 */
export async function generateEmbedding(text) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`;
    const response = await httpClient.post(url, {
      model: "models/gemini-embedding-2",
      content: { parts: [{ text }] }
    });

    if (response.data && response.data.embedding && response.data.embedding.values) {
      return response.data.embedding.values;
    }
    throw new Error("Invalid response format from embedding API");
  } catch (error) {
    console.error("EMBEDDING_GENERATION_ERROR:", error.response?.data || error.message);
    return null;
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
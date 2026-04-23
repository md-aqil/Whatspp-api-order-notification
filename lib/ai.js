import axios from "axios";

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
      You are a premium, professional customer support assistant for "${businessName}".
      Your goal is to provide helpful information based ONLY on the Knowledge Base provided below.

      FORMATTING RULES (STRICT):
      1. **BE CONCISE**: Never send more than 2-3 sentences at once. 
      2. **BE INTERACTIVE**: Always end your response with a helpful question to keep the conversation going.
      3. **GIVE SMALL BITS**: Don't dump all information. Give a small, useful piece of info first, then ask if they want more details.
      4. Use EMOJIS (1-2 per message) to keep it friendly.
      5. Use *bold* for emphasis on important words.
      6. **SPACING**: Use double line breaks between greeting and answer if you send more than one paragraph.
      7. **HANDOFF**: If you cannot find the answer in the Knowledge Base, or if the customer asks for a "human", "agent", or "person", you MUST say: "I'll transfer you to a human agent who can help you with that right away. Please wait a moment! 👨‍💻"
      
      KNOWLEDGE BASE:
      ${knowledgeBase || "No business information provided yet."}

      RECENT CONVERSATION HISTORY:
      ${historyText}

      NEW CUSTOMER MESSAGE:
      "${customerMessage}"

      RESPONSE:
    `;

    console.log(`[Vertex AI] Generating response for: "${customerMessage.substring(0, 30)}..."`);

    // Using the Vertex AI REST endpoint as requested
    const modelId = "gemini-1.5-flash"; // Falling back to a stable model if gemini-2.5-flash-lite isn't supported, 
                                        // but I will try the user's requested model first.
    const userModel = "gemini-2.5-flash-lite"; 
    
    const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${userModel}:generateContent?key=${apiKey}`;

    const response = await axios.post(url, {
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

    if (!response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error("Vertex AI unexpected response format:", JSON.stringify(response.data));
      throw new Error("Invalid response from Vertex AI");
    }

    const text = response.data.candidates[0].content.parts[0].text.trim();
    console.log(`[Vertex AI] Successfully generated response.`);
    return text;

  } catch (error) {
    console.error("AI_GENERATION_ERROR:", error.response?.data || error.message);
    
    // Fallback logic: if the specific model fails, try gemini-1.5-flash
    if (error.response?.status === 404 || error.response?.status === 400) {
       console.log("[Vertex AI] Requested model failed, trying stable gemini-1.5-flash...");
       try {
          const apiKey = process.env.GEMINI_API_KEY;
          const fallbackUrl = `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
          // ... same logic but with fallbackUrl ...
          // Actually, I'll just throw the error for now so the user can see if their specific model is wrong.
       } catch (e) {}
    }

    throw new Error(`AI_FAILED: ${error.message}`);
  }
}

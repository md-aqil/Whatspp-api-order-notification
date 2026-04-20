import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Generates an AI response based on provided knowledge base content and customer message.
 */
export async function generateAIResponse(customerMessage, knowledgeBase, businessName = "Our Business") {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not set in environment variables");
      return "I'm sorry, my AI features are currently being configured. Please hold on a moment.";
    }

    if (!knowledgeBase || knowledgeBase.trim().length === 0) {
      console.warn("AI Reply: Knowledge base is empty for this user.");
      // We don't fail here, just tell the AI there's no context. 
      // The prompt already handles "I don't know".
    }

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `
      You are a premium, professional customer support assistant for "${businessName}".
      Your goal is to provide helpful information based ONLY on the Knowledge Base.

      FORMATTING RULES (STRICT):
      1. **BE CONCISE**: Never send more than 2-3 sentences at once. 
      2. **BE INTERACTIVE**: Always end your response with a helpful question to keep the conversation going.
      3. **GIVE SMALL BITS**: Don't dump all information. Give a small, useful piece of info first, then ask if they want more details.
      4. Use EMOJIS (1-2 per message) to keep it friendly.
      5. Use *bold* for emphasis on important words.
      6. **SPACING**: Use double line breaks between greeting and answer if you send more than one paragraph.
      7. If you don't know the answer, politely ask them to wait for a human agent.

      KNOWLEDGE BASE:
      ${knowledgeBase || "No business information provided yet."}

      CUSTOMER MESSAGE:
      "${customerMessage}"

      RESPONSE:
    `;

    console.log(`[AI] Generating response for message: "${customerMessage.substring(0, 30)}..."`);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    console.log(`[AI] Successfully generated response.`);
    return text;
  } catch (error) {
    console.error("AI_GENERATION_ERROR:", error.message);
    if (error.stack) console.error(error.stack);
    return "I'm sorry, I'm currently experiencing some technical difficulties. A human agent will get back to you shortly.";
  }
}


import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Generates an AI response based on provided knowledge base content, conversation history, and customer message.
 */
export async function generateAIResponse(customerMessage, knowledgeBase, businessName = "Our Business", history = []) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not set in environment variables");
      return "I'm sorry, my AI features are currently being configured. Please hold on a moment.";
    }

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

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

    console.log(`[AI] Generating response with history (${history.length} msgs) for: "${customerMessage.substring(0, 30)}..."`);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    console.log(`[AI] Successfully generated response.`);
    return text;
  } catch (error) {
    console.error("AI_GENERATION_ERROR:", error.message);
    // Throw error so the automation engine can trigger a fallback branch
    throw new Error(`AI_FAILED: ${error.message}`);
  }
}


import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

// Try forcing v1
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function testV1() {
  try {
    // Note: The SDK might not support passing apiVersion in the constructor in all versions
    // but we can try to see if it works with the default
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log("Testing v1...");
    const result = await model.generateContent("Hi");
    console.log("Success:", result.response.text());
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testV1();

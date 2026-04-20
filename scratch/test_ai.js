import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function listModels() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log("Testing model gemini-1.5-flash...");
    const result = await model.generateContent("Hi");
    console.log("Success:", result.response.text());
  } catch (error) {
    console.error("Failed with gemini-1.5-flash:", error.message);
    
    try {
        console.log("Trying gemini-1.5-pro...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        const result = await model.generateContent("Hi");
        console.log("Success with gemini-1.5-pro:", result.response.text());
    } catch (e2) {
        console.error("Failed with gemini-1.5-pro:", e2.message);
    }
  }
}

listModels();

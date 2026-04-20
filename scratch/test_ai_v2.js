import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function listAll() {
  try {
      // In newer SDKs, there isn't a direct listModels on genAI but we can try different names
      const models = ["gemini-flash-latest", "gemini-1.5-pro", "gemini-pro", "gemini-1.0-pro"];
      for (const m of models) {
          try {
              const model = genAI.getGenerativeModel({ model: m });
              console.log(`Testing ${m}...`);
              const result = await model.generateContent("Hi");
              console.log(`Success with ${m}:`, result.response.text().substring(0, 20));
              break;
          } catch (e) {
              console.log(`Failed ${m}: ${e.message}`);
          }
      }
  } catch (error) {
    console.error("General Error:", error);
  }
}

listAll();

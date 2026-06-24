import { queryOne, getPool } from './lib/mysql.js';
import dotenv from 'dotenv';
dotenv.config();

async function updateAutomation() {
  const row = await queryOne("SELECT id, name, steps FROM automations WHERE name LIKE '%AI Smart Assistant%'");
  if (!row) {
    console.error("Automation not found.");
    process.exit(1);
  }

  const steps = [
    {
      "id": "step-trigger-ai-1",
      "type": "trigger",
      "event": "whatsapp.message_received",
      "title": "WhatsApp message received",
      "position": { "x": 100, "y": 300 },
      "connections": {
        "main": "step-check-conversation"
      },
      "description": "A customer sends a WhatsApp message"
    },
    {
      "id": "step-check-conversation",
      "type": "condition",
      "title": "Is Conversation Active?",
      "rule": "{{_isConversationActive}} == true",
      "position": { "x": 400, "y": 300 },
      "connections": {
        "main": "step-ai-reply-1",
        "fallback": "step-interactive-menu"
      }
    },
    {
      "id": "step-interactive-menu",
      "type": "interactive",
      "title": "Main Menu",
      "message": "Welcome! 👋 How can we help you today?",
      "options": [
        { "id": "opt0", "label": "🏷️ Pricing" },
        { "id": "opt1", "label": "🛠️ Support" },
        { "id": "opt2", "label": "💬 Talk to AI" }
      ],
      "position": { "x": 700, "y": 150 },
      "connections": {
        "opt0": "step-ai-reply-1",
        "opt1": "step-ai-reply-1",
        "opt2": "step-ai-reply-1"
      }
    },
    {
      "id": "step-ai-reply-1",
      "type": "ai_reply",
      "title": "AI Smart Reply",
      "position": { "x": 1000, "y": 300 },
      "connections": {
        "main": "",
        "fallback": "step-interactive-ai-fallback"
      },
      "description": "Generates a response using Gemini and your Knowledge Base"
    },
    {
      "id": "step-interactive-ai-fallback",
      "type": "interactive",
      "title": "AI Help Fallback",
      "message": "I'm sorry, I'm having trouble finding that information right now. 🤖\n\nHow would you like to proceed?",
      "options": [
        { "id": "opt0", "label": "👨‍💻 Talk to Human" },
        { "id": "opt1", "label": "🔄 Try Again" }
      ],
      "position": { "x": 1300, "y": 300 },
      "connections": {
        "opt0": "step-msg-ai-handoff",
        "opt1": "step-ai-reply-1"
      }
    },
    {
      "id": "step-msg-ai-handoff",
      "type": "message",
      "title": "Handoff Message",
      "channel": "whatsapp",
      "message": "I understand. I'm connecting you with a member of our specialist team right now to ensure this is resolved for you. 👨‍💻 \n\nPlease stay tuned—they usually respond within a few minutes.",
      "position": { "x": 1600, "y": 300 },
      "connections": {
        "main": ""
      }
    }
  ];

  await getPool().query('UPDATE automations SET steps = ? WHERE id = ?', [JSON.stringify(steps), row.id]);
  console.log("Automation updated successfully!");
  process.exit(0);
}

updateAutomation().catch(console.error);

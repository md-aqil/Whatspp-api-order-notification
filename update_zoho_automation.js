require("dotenv").config({path: "/etc/lcsw/.env"});
const { getPool } = require("./lib/mysql.js");

async function run() {
  const pool = getPool();
  const [automations] = await pool.query("SELECT * FROM automations WHERE id = ?", ["default-send-whatsapp-lead-to-zoho"]);
  
  for (const auto of automations) {
    let steps = typeof auto.steps === "string" ? JSON.parse(auto.steps) : auto.steps;
    const zohoStep = steps.find(s => s.id === "step-zoho-upsert-lead-1");
    const existingFeedback = steps.find(s => s.id === "step-msg-zoho-feedback");
    
    if (zohoStep && !existingFeedback) {
      zohoStep.connections.main = "step-msg-zoho-feedback";
      steps.push({
        id: "step-msg-zoho-feedback",
        type: "message",
        title: "Lead CRM Feedback",
        channel: "whatsapp",
        template: "",
        templateLanguage: "",
        message: "Hello {{customer_name}}, your request has been successfully recorded in our CRM system! A representative will get back to you shortly. ✨",
        position: { x: 1480, y: 200 },
        connections: { main: "" }
      });
      
      await pool.query("UPDATE automations SET steps = ? WHERE id = ? AND userId = ?", [JSON.stringify(steps), auto.id, auto.userId]);
      console.log("Updated automation for user", auto.userId);
    }
  }
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

import { v4 as uuidv4 } from "uuid";
import { getPool, query, queryOne, queryMany } from "./mysql";
import { generateAIResponse, generateEmbedding, cosineSimilarity } from "./ai";
import { buildMetaAuthHeaders } from "./meta-auth";
import { decrypt } from "./encryption";
import { enqueueAutomationEvent, enqueueDelayedStep } from "./queue";
import { httpClient } from "./httpClient";
import { metricsService } from "./metrics";
import { getZohoClient } from "./zoho-api";
import { getGoogleSheetsClient } from "./google-sheets-api";
import {
  buildInstagramMessagePayload,
  getInstagramSendUrls,
} from "./instagram-message";
import { saveInstagramOutboundMessage } from "./db/instagram-message-repository";
import { buildAutomationTemplateComponents } from "./automation-template";

const WHATSAPP_SUPPORT_HANDOFF_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Core automation engine to process events asynchronously.
 * This is the high-performance replacement for the legacy executeAutomationsForEvent.
 */
export async function processAutomationEvent(jobData) {
  const { event, context, userId, automationId, stepId } = jobData;

  console.log(
    `[Automation Engine] Processing ${event || "delayed-step"} for user ${userId}`,
  );

  // 1. Fetch active integrations (needed for API tokens)
  const integrationRow = await queryOne(
    "SELECT whatsapp, shopify FROM integrations WHERE userId = ? ORDER BY updatedAt DESC LIMIT 1",
    [userId],
  );
  if (!integrationRow) return;

  const decryptIfNeeded = (val) => {
    if (!val || typeof val !== "string") return val;
    const decrypted = decrypt(val);
    try {
      return JSON.parse(decrypted);
    } catch (e) {
      return val;
    }
  };

  const integrations = {
    whatsapp: decryptIfNeeded(integrationRow.whatsapp),
    shopify: decryptIfNeeded(integrationRow.shopify),
  };

  const isInstagramEvent = event && event.startsWith("instagram.");
  const waPhone = integrations.whatsapp?.phoneNumberId;
  const waToken = integrations.whatsapp?.accessToken;
  console.log(
    `[Automation Engine] Credentials check — WA phoneNumberId: ${waPhone ? waPhone.substring(0, 8) + "..." : "MISSING"}, isInstagram: ${isInstagramEvent}`,
  );

  if (!isInstagramEvent && (!waPhone || !waToken)) {
    console.log(
      "[Automation Engine] WhatsApp integration incomplete. Skipping.",
    );
    return;
  }

  // 2. Identify potential automations
  if (automationId && stepId) {
    // Resume a specific automation from a specific step (DELAY/RESUME)
    const row = await queryOne(
      `SELECT id, name, steps, metrics FROM automations WHERE id = ? AND userId = ?`,
      [automationId, userId],
    );
    if (row) {
      const automation = {
        ...row,
        steps:
          typeof row.steps === "string" ? JSON.parse(row.steps) : row.steps,
      };
      await runAutomationLoop(
        automation,
        context,
        integrations,
        userId,
        event,
        stepId,
      );
    }
  } else {
    // Normal event-based trigger
    const rows = await queryMany(
      `SELECT id, name, steps, metrics
       FROM automations
       WHERE userId = ? AND status = 1`,
      [userId],
    );
    console.log(
      `[Automation Engine] Found ${rows?.length || 0} active automations for user ${userId}`,
    );

    const automations = (rows || []).map((row) => ({
      ...row,
      steps: typeof row.steps === "string" ? JSON.parse(row.steps) : row.steps,
    }));

    for (const automation of automations) {
      const trigger = automation.steps?.find((s) => s.type === "trigger");
      automation._hasKeywords = !!(
        trigger?.config?.keywords || trigger?.keyword
      );
    }

    // Sort: Specific keywords first, then catch-alls
    automations.sort(
      (a, b) => (b._hasKeywords ? 1 : 0) - (a._hasKeywords ? 1 : 0),
    );

    let anyTriggered = false;
    for (const automation of automations) {
      // If we already triggered a keyword-specific automation, skip catch-alls
      if (anyTriggered && !automation._hasKeywords) {
        console.log(
          `[Automation Engine] Skipping catch-all automation "${automation.name}" because a more specific flow triggered.`,
        );
        continue;
      }

      console.log(
        `[Automation Engine] Checking automation "${automation.name}" (${automation.id}) for event "${event}"`,
      );
      const didRun = await runAutomationLoop(
        automation,
        context,
        integrations,
        userId,
        event,
      );
      if (didRun) anyTriggered = true;
    }
  }
}

export async function triggerAutomationEvent(
  event,
  context,
  integrations,
  userId = "default",
) {
  console.log(
    `[Queue] Enqueuing automation event: ${event} for user ${userId}`,
  );
  context.userId = userId;
  await enqueueAutomationEvent(event, context, integrations, userId);
}

async function runAutomationLoop(
  automation,
  context,
  integrations,
  userId,
  eventType,
  startFromStepId = null,
) {
  const steps = Array.isArray(automation.steps) ? automation.steps : [];
  const trigger = steps.find((step) => step.type === "trigger");
  const isIncomingWhatsApp = eventType === "whatsapp.message_received";
  const isIncomingInstagram =
    eventType === "instagram.message_received" ||
    eventType === "instagram.comment_created";

  const recipient = normalizeRecipient(
    resolveRecipient({ recipientMode: "customer" }, context),
    context?.platform,
  );
  console.log(`[Automation Engine] Resolved Recipient for ${context?.platform}:`, recipient, 'from context:', context.senderId)
  if (!recipient) return;

  let state = await getAutomationConversationState(
    automation.id,
    recipient,
    userId,
  );
  const now = new Date();
  
  if (state?.lastReplyAt) {
    const msSinceReply = now.getTime() - new Date(state.lastReplyAt).getTime();
    context._isConversationActive = msSinceReply < (24 * 60 * 60 * 1000);
  } else {
    context._isConversationActive = false;
  }

  // Handoff Check
  if (state?.handoffUntil && new Date(state.handoffUntil) > now) {
    if (isIncomingWhatsApp || isIncomingInstagram) {
      console.log(
        `[Automation Engine] Handoff active for ${recipient}. Clearing due to new message.`,
      );
      state = await saveAutomationConversationState(
        automation.id,
        recipient,
        state,
        { handoffUntil: null },
        userId,
      );
    } else {
      return false;
    }
  }

  let currentStepId = startFromStepId;

  if (!currentStepId) {
    // 1. Check for Trigger Keywords
    const keywordString = trigger?.config?.keywords || trigger?.keyword;
    if ((isIncomingWhatsApp || isIncomingInstagram) && keywordString) {
      const keywords = keywordString
        .split(",")
        .map((k) => k.trim().toLowerCase());
      const rawMsg =
        context.customer_message ||
        context.messageText ||
        context.commentText ||
        "";
      const msg = rawMsg.toLowerCase().trim();
      if (keywords.includes(msg)) {
        currentStepId = getNextStepId(steps, trigger, "main");
        console.log(
          `[Automation Engine] Trigger keyword match! Starting flow.`,
        );
      }
    }

    // 2. Check for Interactive Replies (Branching) or Typed Replies matching Interactive Options
    if (!currentStepId && (isIncomingWhatsApp || isIncomingInstagram)) {
      const awaitingId = state?.awaitingInteractiveStepId;
      let matchedBranch = false;

      // First check if we are explicitly waiting for a button response
      if (awaitingId) {
        const awaitingStep = steps.find((s) => s.id === awaitingId);
        currentStepId = resolveInteractiveBranch(
          awaitingStep,
          context._chosenOptionId,
          context.customer_message,
        );

        if (currentStepId) {
          console.log(
            `[Automation Engine] Interactive branch resolved (explicit wait): ${currentStepId}`,
          );
          state = await saveAutomationConversationState(
            automation.id,
            recipient,
            state,
            { awaitingInteractiveStepId: null },
            userId,
          );
          matchedBranch = true;
        }
      }

      // Historical/Deep Match Fallback (Allows typing options even if not explicitly waiting,
      // or if waiting but for some reason state was lost)
      if (!currentStepId && (context._isInteractiveReply || (context.customer_message && context.customer_message.trim().length < 25))) {
        for (const s of steps.filter(
          (st) => st.type === "interactive" || st.type === "ai_reply"
        )) {
          const matchedBranchId = resolveInteractiveBranch(
            s,
            null, // Do NOT match globally by ID, IDs are only unique per-step!
            context.customer_message,
          );
          if (matchedBranchId) {
            console.log(
              `[Automation Engine] Interactive branch resolved (fallback deep match on ${s.id}): ${matchedBranchId}`,
            );
            currentStepId = matchedBranchId;
            if (s.type === "interactive") {
              state = await saveAutomationConversationState(
                automation.id,
                recipient,
                state,
                { awaitingInteractiveStepId: null },
                userId,
              );
            }
            break;
          }
        }
      }
      
      // If the user typed something that DID NOT match an option, but we WERE waiting for a button,
      // we might want to prevent the whole flow from restarting. However, standard behavior 
      // is to let it fall through to restart or fallback to keyword triggers if they didn't answer correctly.
    }

    // 3. Global Event Trigger (e.g. order.created)
    // IMPORTANT: If this is a WhatsApp or Instagram message, only trigger here if NO keywords were defined.
    // This prevents catch-all automations from firing when a keyword match was intended but didn't match.
    const hasKeywords = !!(trigger?.config?.keywords || trigger?.keyword);
    if (!currentStepId && trigger && trigger.event === eventType) {
      if ((isIncomingWhatsApp || isIncomingInstagram) && hasKeywords) {
        // Skip - keywords were defined but didn't match in step 1
      } else {
        currentStepId = getNextStepId(steps, trigger, "main");
      }
    }
  }

  if (!currentStepId) return false;

  // Execution Loop
  const visited = new Set();
  let messagesSentCount = 0;

  while (currentStepId && !visited.has(currentStepId)) {
    visited.add(currentStepId);
    const step = steps.find((s) => s.id === currentStepId);
    if (!step) break;

    console.log(`[Automation Engine] Executing: ${step.type} (${step.id})`);

    if (step.type === "condition") {
      const passed = matchesCondition(step.rule, context);
      currentStepId = getNextStepId(steps, step, passed ? "main" : "fallback");
      continue;
    }

    if (step.type === "delay") {
      const delayValue = parseFloat(
        step.delayValue || step.config?.delayValue || "1",
      );
      const delayUnit = step.delayUnit || step.config?.delayUnit || "minutes";

      let delayMs = delayValue * 60 * 1000; // default minutes
      if (delayUnit === "hours") delayMs = delayValue * 60 * 60 * 1000;
      if (delayUnit === "days") delayMs = delayValue * 24 * 60 * 60 * 1000;
      if (delayUnit === "seconds") delayMs = delayValue * 1000;

      const nextStepId = getNextStepId(steps, step, "main");
      if (nextStepId) {
        console.log(
          `[Automation Engine] Scheduling DELAY: ${delayValue} ${delayUnit} (${delayMs}ms) for step ${nextStepId}`,
        );
        await enqueueDelayedStep(
          {
            userId,
            automationId: automation.id,
            stepId: nextStepId,
            context,
            timestamp: new Date().toISOString(),
          },
          delayMs,
        );
      }

      // Stop the loop - the delayed worker will pick it up
      break;
    }

    if (step.type === "ai_reply") {
      await handleAIStep(
        step,
        context,
        integrations,
        automation,
        userId,
        recipient,
      );
      
      state = await saveAutomationConversationState(
        automation.id,
        recipient,
        state,
        {
          state: step.id,
          lastReplyKey: step.id,
          lastReplyAt: new Date(),
          awaitingInteractiveStepId: null
        },
        userId,
      );
      
      currentStepId = getNextStepId(steps, step, "main");
      continue;
    }

    if (step.type === "http_request") {
      await handleHttpRequestStep(step, context, userId);
      currentStepId = getNextStepId(steps, step, "main");
      continue;
    }

    if (step.type === "zoho_action") {
      await handleZohoActionStep(step, context, userId);
      currentStepId = getNextStepId(steps, step, "main");
      continue;
    }

    if (step.type === "google_sheets_action") {
      await handleGoogleSheetsActionStep(step, context, userId);
      currentStepId = getNextStepId(steps, step, "main");
      continue;
    }

    if (step.type === "message" || step.type === "interactive") {
      const isIncomingInstagram =
        eventType && eventType.startsWith("instagram.");
      const usesApprovedTemplate = Boolean(
        step.template ||
        step.templateName ||
        step.config?.template ||
        step.config?.templateName,
      );
      if (
        !isIncomingWhatsApp &&
        !isIncomingInstagram &&
        !usesApprovedTemplate
      ) {
        const hasOpenWindow = await hasRecentInboundWhatsAppMessage(
          userId,
          recipient,
          now,
        );
        if (!hasOpenWindow) {
          console.warn(
            `[Automation Engine] Skipping ${step.type} step ${step.id} for ${recipient}: outside the 24-hour WhatsApp customer service window. Use an approved template for re-engagement.`,
          );
          break;
        }
      }

      // Simulate human-like behavior
      if (isIncomingWhatsApp) {
        const delay = calcTypingDelay(step.message || step.config?.body);
        if (messagesSentCount === 0 && context._inboundWamid) {
          await sendTypingIndicator(
            integrations.whatsapp.phoneNumberId,
            integrations.whatsapp.accessToken,
            recipient,
            context._inboundWamid,
          );
        }
        await sleep(delay);
      }

      const sentResult = await handleMessageStep(
        step,
        context,
        integrations,
        recipient,
        userId,
      );
      messagesSentCount++;

      if (sentResult?.success) {
        await logMessage(
          userId,
          recipient,
          step.message || "[Interactive]",
          sentResult.wamid,
        );
        await incrementMetric(automation.id, "sent");

        // Update State
        const hasBranching =
          step.connections &&
          Object.keys(step.connections).some((k) => k !== "main");
        const isSupport =
          (step.message || "").toLowerCase().includes("support") ||
          (step.message || "").toLowerCase().includes("agent");

        state = await saveAutomationConversationState(
          automation.id,
          recipient,
          state,
          {
            state: step.id,
            lastReplyKey: step.id,
            lastReplyAt: new Date(),
            awaitingInteractiveStepId: hasBranching ? step.id : null,
            handoffUntil: isSupport
              ? new Date(Date.now() + WHATSAPP_SUPPORT_HANDOFF_MS)
              : state?.handoffUntil,
          },
          userId,
        );
      }

      currentStepId = getNextStepId(steps, step, "main");
      continue;
    }

    break;
  }

  return true;
}

// --- Specialized Handlers ---

async function handleHttpRequestStep(step, context, userId) {
  const method = step.method || "POST";
  const url = interpolate(step.url || "", context);
  const headersText = interpolate(step.headers || "{}", context);
  const bodyText = interpolate(step.body || "{}", context);

  console.log(`[Automation Engine] External Request: ${method} ${url}`);

  try {
    let headers = {};
    try {
      headers = JSON.parse(headersText);
    } catch (e) {
      console.error("Failed to parse HTTP headers:", e.message);
    }

    let body = {};
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      body = bodyText;
    }

    const startTime = Date.now();
    const response = await httpClient.request({
      method,
      url,
      headers,
      data: body,
    });
    const latency = Date.now() - startTime;

    // Record success metrics
    metricsService.incrementCounter("http_requests_total", {
      method: method.toUpperCase(),
      status: "success",
      url: url,
    });
    metricsService.recordHistogram("http_request_latency_ms", latency, {
      method: method.toUpperCase(),
      url: url,
    });

    console.log(`[Automation Engine] HTTP Success: ${response.status}`);
  } catch (err) {
    // Record failure metrics
    metricsService.incrementCounter("http_requests_total", {
      method: method.toUpperCase(),
      status: "error",
      url: url,
    });

    console.error(
      `[Automation Engine] HTTP Error (${url}):`,
      err.response?.data || err.message,
    );
    // We don't break the flow for HTTP errors unless we implement fallback branches for it later
  }
}

async function handleZohoActionStep(step, context, userId) {
  const action = step.action || step.config?.action;
  const zoho = await getZohoClient(userId);

  if (!zoho) {
    console.warn(
      `[Automation Engine] Zoho integration not found for user ${userId}. Skipping action.`,
    );
    return;
  }

  try {
    if (action === "upsert_lead") {
      const payload = buildZohoLeadPayload(step, context);
      await zoho.upsertLead(payload, payload.searchPhone);
    } else if (action === "update_status") {
      const leadId = interpolate(
        step.leadId || step.config?.leadId || "{{zoho_lead_id}}",
        context,
      );
      const status = interpolate(
        step.status || step.config?.status || "Contacted",
        context,
      );
      if (leadId && status) {
        await zoho.updateLeadStatus(leadId, status);
      }
    } else if (action === "add_note") {
      const targetModule = step.module || step.config?.module || "Leads";
      const recordId = interpolate(
        step.recordId || step.config?.recordId || "{{zoho_lead_id}}",
        context,
      );
      const content = interpolate(
        step.content || step.config?.content || "WhatsApp conversation logged.",
        context,
      );
      const title = interpolate(
        step.title || step.config?.title || "WhatsApp Note",
        context,
      );
      if (recordId && content) {
        await zoho.addNote(targetModule, recordId, content, title);
      }
    }
    console.log(`[Automation Engine] Zoho Action Success: ${action}`);
  } catch (err) {
    console.error(
      `[Automation Engine] Zoho Action Error (${action}):`,
      err.message,
    );
  }
}

async function handleGoogleSheetsActionStep(step, context, userId) {
  const action = step.action || step.config?.action || "append_row";
  const sheetClient = await getGoogleSheetsClient(userId);

  if (!sheetClient) {
    console.warn(
      `[Automation Engine] Google Sheets integration not found for user ${userId}. Skipping action.`,
    );
    return;
  }

  try {
    if (action === "append_row") {
      const spreadsheetId =
        step.spreadsheetId ||
        step.config?.spreadsheetId ||
        sheetClient.data.defaultSettings?.spreadsheetId;
      const sheetName =
        step.sheetName ||
        step.config?.sheetName ||
        sheetClient.data.defaultSettings?.sheetName ||
        "Sheet1";

      if (!spreadsheetId) {
        console.warn(
          `[Automation Engine] Spreadsheet ID missing for Google Sheets action.`,
        );
        return;
      }

      // Map values. Supports step.columns (array of { value }) or step.config.columns (array of strings/objects)
      const columns = step.columns || step.config?.columns || [];
      const rowValues = columns.map((col) => {
        const rawVal =
          typeof col === "object" ? col.value || col.val || "" : String(col);
        return interpolate(rawVal, context);
      });

      if (rowValues.length === 0) {
        // Fallback standard row: Phone, Name, Message, Timestamp, Platform
        const phone =
          context.customerPhone ||
          context.customer_phone ||
          context.phone ||
          context.from ||
          "";
        const name = context.customer_name || context.customerName || "";
        const msg = context.customer_message || context.messageText || "";
        const time = context.timestamp || new Date().toISOString();
        const platform = context.platform || "whatsapp";
        rowValues.push(phone, name, msg, time, platform);
      }

      await sheetClient.appendRow(spreadsheetId, sheetName, rowValues);
      console.log(
        `[Automation Engine] Google Sheets Append Row Success for sheet: ${sheetName}`,
      );
    }
  } catch (err) {
    console.error(
      `[Automation Engine] Google Sheets Action Error (${action}):`,
      err.message,
    );
  }
}

function interpolateFieldMap(fields = {}, context = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      interpolate(String(value ?? ""), context),
    ]),
  );
}

function compactZohoFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).filter(
      ([, value]) =>
        value !== undefined && value !== null && String(value).trim() !== "",
    ),
  );
}

function formatToZohoDateTime(val) {
  if (!val) return null;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toISOString().replace(/\.\d+Z$/, "+00:00");
  } catch (e) {
    return val;
  }
}

function buildZohoLeadPayload(step, context) {
  const fallbackName = "ourname";
  const customerName = String(
    context.customer_name || context.customerName || "",
  ).trim();
  const messageTime =
    context.last_inbound_message_at || context.timestamp || new Date();
  const zohoMessageTime = formatToZohoDateTime(messageTime);
  const configuredCreateFields = interpolateFieldMap(
    step.createFields || step.config?.createFields || {},
    context,
  );
  const configuredUpdateFields = interpolateFieldMap(
    step.updateFields || step.config?.updateFields || {},
    context,
  );
  const createFields = compactZohoFields({
    ...configuredCreateFields,
    Last_Name:
      configuredCreateFields.Last_Name ||
      configuredCreateFields.last_name ||
      configuredCreateFields.LastName ||
      configuredCreateFields.lastname ||
      customerName ||
      fallbackName,
    Company:
      configuredCreateFields.Company ||
      configuredCreateFields.company ||
      context.company ||
      context.Company ||
      fallbackName,
    Phone:
      configuredCreateFields.Phone ||
      configuredCreateFields.phone ||
      context.customer_phone ||
      context.customerPhone ||
      context.from,
    WhatsApp_Number:
      configuredCreateFields.WhatsApp_Number ||
      configuredCreateFields.whatsapp_number ||
      configuredCreateFields.WhatsAppNumber ||
      configuredCreateFields.whatsappnumber ||
      context.customer_phone ||
      context.customerPhone ||
      context.from,
    Lead_Source:
      configuredCreateFields.Lead_Source ||
      configuredCreateFields.lead_source ||
      context.lead_source ||
      "WhatsApp",
    Lead_Status:
      configuredCreateFields.Lead_Status ||
      configuredCreateFields.lead_status ||
      "New",
    Bot_Status:
      configuredCreateFields.Bot_Status ||
      configuredCreateFields.bot_status ||
      "Bot Active",
    First_Message_At:
      formatToZohoDateTime(configuredCreateFields.First_Message_At) ||
      formatToZohoDateTime(context.first_message_at) ||
      zohoMessageTime,
    Last_Inbound_Message_At:
      formatToZohoDateTime(configuredCreateFields.Last_Inbound_Message_At) ||
      zohoMessageTime,
    Project_Brief_Summary:
      configuredCreateFields.Project_Brief_Summary ||
      context.project_brief_summary ||
      context.customer_message,
    Chatflow_Contact_ID:
      configuredCreateFields.Chatflow_Contact_ID ||
      context.chatflow_contact_id ||
      context.customer_phone ||
      context.from,
    Chatflow_Conversation_ID:
      configuredCreateFields.Chatflow_Conversation_ID ||
      context.chatflow_conversation_id,
  });
  const updateFields = compactZohoFields({
    ...configuredUpdateFields,
    Last_Inbound_Message_At:
      formatToZohoDateTime(configuredUpdateFields.Last_Inbound_Message_At) ||
      zohoMessageTime,
    Human_Handover_Required:
      context.human_handover_required || context.humanHandoverRequired || "",
    Service_Interest_Primary:
      context.service_interest_primary || context.serviceInterestPrimary || "",
    Budget_Range: context.budget_range || context.budgetRange || "",
    Timeline: context.timeline || "",
    Project_Brief_Summary:
      context.project_brief_summary || context.customer_message,
  });

  return {
    searchPhone: createFields.Phone || createFields.WhatsApp_Number,
    createFields,
    updateFields,
  };
}

async function handleAIStep(
  step,
  context,
  integrations,
  automation,
  userId,
  recipient,
) {
  try {
    const kbRows = await queryMany(
      "SELECT content, embedding FROM knowledge_base WHERE userId = ?",
      [userId],
    );

    let kbContent = "";
    if (kbRows.length > 0) {
      const userMessageEmbedding = await generateEmbedding(context.customer_message);
      if (userMessageEmbedding) {
        const scoredChunks = kbRows.map(row => {
          let score = 0;
          if (row.embedding) {
            try {
              const docEmbedding = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding;
              score = cosineSimilarity(userMessageEmbedding, docEmbedding);
            } catch(e) {}
          }
          return { content: row.content, score };
        });

        scoredChunks.sort((a, b) => b.score - a.score);
        kbContent = scoredChunks.slice(0, 5).map(c => c.content).join("\n\n");
      } else {
        kbContent = kbRows.map((r) => r.content).join("\n\n");
        if (kbContent.length > 10000) {
          kbContent = kbContent.substring(0, 10000) + "\n...[Truncated]";
        }
      }
    }
    const businessName = integrations.whatsapp?.name || "Our Business";

    // Context: Last 5 messages
    const history = await queryMany(
      "SELECT message, isCustomer FROM messages WHERE userId = ? AND (phone = ? OR recipient = ?) ORDER BY timestamp DESC LIMIT 5",
      [userId, recipient, recipient],
    );

    const aiResponse = await generateAIResponse(
      context.customer_message,
      kbContent,
      businessName,
      history.reverse(),
    );

    // Split into parts for natural flow
    const parts = aiResponse.split(/\n\n+/).filter((p) => p.trim());
    for (const part of parts) {
      
      // Parse options from the part
      let textBody = part;
      const options = [];
      const optionRegex = /\[\[Option:\s*(.*?)\]\]/g;
      let match;
      while ((match = optionRegex.exec(part)) !== null) {
        options.push(match[1].trim());
      }
      
      // Remove options from textBody
      if (options.length > 0) {
        textBody = part.replace(/\[\[Option:\s*(.*?)\]\]/g, '').trim();
      }
      
      if (!textBody && options.length === 0) continue;

      // If text is too long for interactive body (WhatsApp limit is 1024, IG is 1000), send text first
      let sentLongText = false;
      if (options.length > 0 && textBody.length > 950) {
        await sleep(calcTypingDelay(textBody));
        
        if (context.platform === "instagram") {
          const igCredentials = await getInstagramCredentialsForAccount(userId, context.instagramAccountId);
          const igToken = igCredentials?.accessToken;
          if (igToken) {
            const textResult = await sendInstagramDM(igToken, recipient, textBody, null, {
              instagramAccountId: igCredentials.instagramAccountId || context.instagramAccountId,
              pageId: igCredentials.pageId,
              userId,
              quickReplies: null
            });
            await logMessage(userId, recipient, textBody, textResult?.message_id || `ig_msg_${Date.now()}`);
          }
        } else {
          const textResult = await sendWhatsAppMessage(
            integrations.whatsapp.phoneNumberId,
            integrations.whatsapp.accessToken,
            recipient,
            { type: "text", text: { body: textBody } }
          );
          await logMessage(userId, recipient, textBody, textResult?.messages?.[0]?.id);
        }
        sentLongText = true;
        textBody = "Please choose an option:"; // Shorten the interactive body
      }

      await sleep(calcTypingDelay(sentLongText ? "typing" : (textBody || "typing")));
      
      let messageId = null;
      if (context.platform === "instagram") {
        const igCredentials = await getInstagramCredentialsForAccount(userId, context.instagramAccountId);
        const igToken = igCredentials?.accessToken;
        if (igToken) {
          let quickReplies = null;
          if (options.length > 0) {
            quickReplies = options.slice(0, 13).map((opt) => {
              const parts = opt.split('|');
              const title = parts[0].trim().substring(0, 20);
              return {
                title: title,
                payload: "ai_opt_" + Math.random().toString(36).substr(2, 5)
              };
            });
          }
          const res = await sendInstagramDM(igToken, recipient, textBody, null, {
            instagramAccountId: igCredentials.instagramAccountId || context.instagramAccountId,
            pageId: igCredentials.pageId,
            userId,
            quickReplies
          });
          messageId = res?.message_id || `ig_msg_${Date.now()}`;
        } else {
          console.error(`[Automation Engine] Instagram access token not found for account ${context.instagramAccountId}`);
        }
      } else {
        let messageData;
        if (options.length > 0 && options.length <= 3) {
          const buttons = options.slice(0, 3).map((opt) => {
            const parts = opt.split('|');
            const title = parts[0].trim().substring(0, 20);
            return {
              type: "reply",
              reply: {
                id: "ai_opt_" + Math.random().toString(36).substr(2, 5),
                title: title,
              },
            };
          });
          messageData = {
            type: "interactive",
            interactive: {
              type: "button",
              body: { text: textBody || "Please choose an option:" },
              action: { buttons },
            },
          };
        } else if (options.length > 3) {
          const rows = options.slice(0, 10).map((opt) => {
            const parts = opt.split('|');
            const title = parts[0].trim().substring(0, 24);
            const row = {
              id: "ai_opt_" + Math.random().toString(36).substr(2, 5),
              title: title,
            };
            if (parts.length > 1) {
              row.description = parts.slice(1).join('|').trim().substring(0, 72);
            }
            return row;
          });
          messageData = {
            type: "interactive",
            interactive: {
              type: "list",
              body: { text: textBody || "Please choose an option:" },
              action: {
                button: "Options",
                sections: [
                  {
                    title: "Available Options",
                    rows: rows,
                  },
                ],
              },
            },
          };
        } else {
          messageData = {
            type: "text",
            text: { body: textBody },
          };
        }

        const result = await sendWhatsAppMessage(
          integrations.whatsapp.phoneNumberId,
          integrations.whatsapp.accessToken,
          recipient,
          messageData
        );
        messageId = result?.messages?.[0]?.id;
      }

      await logMessage(userId, recipient, part, messageId);
    }
  } catch (err) {
    console.error("[Automation Engine] AI Error:", err);
  }
}

async function handleMessageStep(
  step,
  context,
  integrations,
  recipient,
  userId = "default",
) {
  const bodyText = step.message || step.config?.body || "";
  const body = interpolate(bodyText, context);

  if (context.platform === "instagram") {
    try {
      const igCredentials = await getInstagramCredentialsForAccount(
        userId,
        context.instagramAccountId,
      );
      const igToken = igCredentials?.accessToken;
      if (!igToken) {
        console.error(
          `[Automation Engine] Instagram access token not found for account ${context.instagramAccountId}`,
        );
        return { success: false, error: "Instagram access token not found" };
      }

      // --- Public comment reply (uses step message text) ---
      if (context.commentId) {
        const commentReplyText =
          step.config?.commentReply ||
          body ||
          `Sent you a DM, @${context.username}! Check your inbox 📥✨`;
        const commentBody = interpolate(commentReplyText, context);
        try {
          await replyToInstagramComment(igToken, context.commentId, commentBody);
          console.log(
            `[Automation Engine] Instagram comment public reply sent to ${context.commentId}`,
          );
        } catch (commentErr) {
          console.error(
            "[Automation Engine] Failed to reply to Instagram comment:",
            commentErr.message,
          );
        }
      }

      // --- Quick replies for interactive DMs ---
      let quickReplies = null;
      if (step.type === "interactive") {
        const rawButtons = step.options || step.config?.buttons || [];
        if (rawButtons.length > 0) {
          quickReplies = rawButtons.map((b) => {
            const id =
              b.id ||
              b.reply?.id ||
              "opt_" + Math.random().toString(36).substr(2, 5);
            const title = (
              b.label ||
              b.title ||
              b.reply?.title ||
              "Option"
            ).substring(0, 20);
            return { title, payload: id };
          });
        }
      }

      // --- Resolve media attachment (image > pdf/file > none) ---
      const imageUrl =
        step.imageUrl ||
        step.config?.imageUrl ||
        step.config?.mediaUrl ||
        null;
      const pdfUrl =
        step.config?.pdfUrl || step.config?.fileUrl || null;
      const linkUrl = step.config?.linkUrl || null;

      let attachment = null;
      if (imageUrl) {
        attachment = { type: "image", url: imageUrl };
      } else if (pdfUrl) {
        attachment = { type: "file", url: pdfUrl };
      }

      // Append link to DM body if provided
      const dmBody = linkUrl ? `${body}\n\n🔗 ${linkUrl}` : body;

      // --- Send DM to user (not to comment_id — that's only for public replies) ---
      const res = await sendInstagramDM(igToken, recipient, dmBody, attachment, {
        instagramAccountId:
          igCredentials?.instagramAccountId || context.instagramAccountId,
        pageId: igCredentials?.pageId,
        commentId: null,
        userId,
        quickReplies,
      });

      if (res?.message_id) {
        return { success: true, wamid: res.message_id };
      }
      if (res?.error) {
        return {
          success: false,
          error: res.error.message || "Instagram API Error",
        };
      }
      return { success: true, wamid: `ig_msg_${Date.now()}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  const imageUrl = step.imageUrl || step.config?.imageUrl;
  const pdfUrl = step.config?.pdfUrl || step.config?.fileUrl;
  const linkUrl = step.config?.linkUrl;
  const waBody = linkUrl ? `${body}\n\n🔗 ${linkUrl}` : body;

  let messageData;
  const templateName = step.template || step.templateName || step.config?.template || step.config?.templateName;

  if (templateName) {
    const templateLanguage = step.templateLanguage || step.config?.templateLanguage || 'en_US';
    const components = step.templateComponents || step.config?.templateComponents || [];
    const mappings = step.variableMappings || step.config?.variableMappings || [];
    const waComponents = buildAutomationTemplateComponents(components, mappings, context);

    messageData = {
      type: "template",
      template: {
        name: templateName,
        language: { code: templateLanguage },
      }
    };
    if (waComponents && waComponents.length > 0) {
      messageData.template.components = waComponents;
    }
  } else {
    messageData = { type: "text", text: { body: waBody } };

    if (imageUrl) {
      messageData = {
        type: "image",
        image: {
          link: imageUrl,
          caption: waBody
        }
      };
    } else if (pdfUrl) {
      messageData = {
        type: "document",
        document: {
          link: pdfUrl,
          caption: waBody,
          filename: pdfUrl.split('/').pop() || 'document.pdf'
        }
      };
    }

    if (step.type === "interactive") {
      // Map buttons from step.options (standard in DB) or step.config.buttons (legacy)
      const rawButtons = step.options || step.config?.buttons || [];

      if (rawButtons.length === 0) {
        console.warn(
          `[Automation Engine] Interactive step ${step.id} has no buttons. Falling back to text message.`,
        );
      } else if (rawButtons.length <= 3) {
        const buttons = rawButtons.slice(0, 3).map((b) => ({
          type: "reply",
          reply: {
            id:
              b.id ||
              b.reply?.id ||
              "opt_" + Math.random().toString(36).substr(2, 5),
            title: (b.label || b.title || b.reply?.title || "Option").substring(
              0,
              20,
            ),
          },
        }));

        messageData = {
          type: "interactive",
          interactive: {
            type: "button", // WhatsApp API only supports 'button' for 1-3 buttons
            body: { text: waBody },
            action: { buttons },
          },
        };

        if (imageUrl) {
          messageData.interactive.header = {
            type: "image",
            image: { link: imageUrl }
          };
        } else if (pdfUrl) {
          messageData.interactive.header = {
            type: "document",
            document: {
              link: pdfUrl,
              filename: pdfUrl.split('/').pop() || 'document.pdf'
            }
          };
        }
      } else {
        // Use 'list' type for > 3 options (up to 10)
        const rows = rawButtons.slice(0, 10).map((b) => ({
          id:
            b.id ||
            b.reply?.id ||
            "opt_" + Math.random().toString(36).substr(2, 5),
          title: (b.label || b.title || b.reply?.title || "Option").substring(
            0,
            24,
          ),
        }));

        messageData = {
          type: "interactive",
          interactive: {
            type: "list",
            body: { text: waBody },
            action: {
              button: "Choose Option", // Max 20 chars
              sections: [
                {
                  title: "Available Options",
                  rows: rows,
                },
              ],
            },
          },
        };

        if (imageUrl) {
          messageData.interactive.header = {
            type: "image",
            image: { link: imageUrl }
          };
        } else if (pdfUrl) {
          messageData.interactive.header = {
            type: "document",
            document: {
              link: pdfUrl,
              filename: pdfUrl.split('/').pop() || 'document.pdf'
            }
          };
        }
      }
    }
  }

  try {
    const res = await sendWhatsAppMessage(
      integrations.whatsapp.phoneNumberId,
      integrations.whatsapp.accessToken,
      recipient,
      messageData,
    );

    // Check if result has messages (success)
    if (res?.messages?.[0]?.id) {
      return { success: true, wamid: res.messages[0].id };
    }

    // Check for API error in result
    if (res?.error) {
      return { success: false, error: res.error.message || "API Error" };
    }

    return { success: false, error: "Unknown API error" };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// --- Utils ---

function getNextStepId(steps, step, key = "main") {
  if (step.connections && step.connections[key]) return step.connections[key];
  // Fallback to sequential for messages
  if (
    key === "main" &&
    step.type === "message" &&
    (!step.connections || Object.keys(step.connections).length === 0)
  ) {
    const idx = steps.findIndex((s) => s.id === step.id);
    return steps[idx + 1]?.id || null;
  }
  return null;
}

function resolveInteractiveBranch(step, chosenId, chosenTitle) {
  if (!step?.connections) return null;
  if (chosenId && step.connections[chosenId]) return step.connections[chosenId];

  const cleanTitle = (chosenTitle || "").trim().toLowerCase();
  for (const [key, target] of Object.entries(step.connections)) {
    if (key.trim().toLowerCase() === cleanTitle) return target;
  }

  // Fallback: match by option labels
  if (step.options && Array.isArray(step.options)) {
    const matchedOption = step.options.find(
      (opt) => opt.label && opt.label.trim().toLowerCase() === cleanTitle
    );
    if (matchedOption && step.connections[matchedOption.id]) {
      return step.connections[matchedOption.id];
    }
    // Try matching without emojis (for platforms or users that strip/render emojis differently)
    const cleanTitleNoEmoji = cleanTitle.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, '').trim();
    const matchedOptionNoEmoji = step.options.find((opt) => {
      const optLabelNoEmoji = (opt.label || "").replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, '').trim();
      return optLabelNoEmoji.toLowerCase() === cleanTitleNoEmoji;
    });
    if (matchedOptionNoEmoji && step.connections[matchedOptionNoEmoji.id]) {
      return step.connections[matchedOptionNoEmoji.id];
    }
  }

  return null;
}

function matchesCondition(rule, context) {
  if (!rule) return true;
  try {
    // 1. Handle logical OR (||)
    if (rule.includes("||")) {
      const subRules = rule.split("||").map((r) => r.trim());
      return subRules.some((subRule) => matchesCondition(subRule, context));
    }

    // 2. Handle logical AND (&&)
    if (rule.includes("&&")) {
      const subRules = rule.split("&&").map((r) => r.trim());
      return subRules.every((subRule) => matchesCondition(subRule, context));
    }

    // 3. Simple expression evaluator for single rules
    const operators = [">=", "<=", ">", "<", "==", "!=", "="];
    let operator = null;
    let parts = [];

    for (const op of operators) {
      if (rule.includes(op)) {
        operator = op;
        parts = rule.split(op).map((s) => s.trim());
        break;
      }
    }

    if (!operator || parts.length !== 2) {
      const cleanRule = rule.trim();
      const val = context[cleanRule];
      if (val !== undefined) {
        return !!val;
      }
      return true;
    }

    const leftRaw = parts[0];
    const rightRaw = parts[1];

    // Resolve left side (variable or literal)
    const left = leftRaw.startsWith("{{")
      ? context[leftRaw.replace(/[{}]/g, "").trim()]
      : context[leftRaw] !== undefined ? context[leftRaw] : leftRaw;

    // Resolve right side (literal)
    let right = rightRaw.replace(/['"]/g, "");
    const isNumeric = !isNaN(right) && right !== "";

    const leftVal = isNumeric ? parseFloat(left) : String(left);
    const rightVal = isNumeric ? parseFloat(right) : String(right);

    const resolvedOp = operator === "=" ? "==" : operator;

    switch (resolvedOp) {
      case ">":
        return leftVal > rightVal;
      case "<":
        return leftVal < rightVal;
      case ">=":
        return leftVal >= rightVal;
      case "<=":
        return leftVal <= rightVal;
      case "==":
        if (typeof leftVal === "string" && typeof rightVal === "string") {
          return leftVal.trim().toLowerCase() === rightVal.trim().toLowerCase();
        }
        return leftVal == rightVal;
      case "!=":
        if (typeof leftVal === "string" && typeof rightVal === "string") {
          return leftVal.trim().toLowerCase() !== rightVal.trim().toLowerCase();
        }
        return leftVal != rightVal;
      default:
        return true;
    }
  } catch (err) {
    console.error("[Automation Engine] Condition Error:", err.message);
    return true;
  }
}

function normalizeRecipient(phone, platform) {
  if (platform === "instagram") return String(phone || "");
  return String(phone || "").replace(/\D/g, "");
}

function resolveRecipient(step, context) {
  if (step?.recipientMode === "fixed_number") return step.recipientNumber;
  return (
    context.customerPhone ||
    context.customer_phone ||
    context.phone ||
    context.from ||
    context.senderId
  );
}

async function hasRecentInboundWhatsAppMessage(
  userId,
  recipient,
  now = new Date(),
) {
  const lastInbound = await queryOne(
    `SELECT timestamp
     FROM messages
     WHERE userId = ? AND isCustomer = 1 AND (phone = ? OR recipient = ?)
     ORDER BY timestamp DESC
     LIMIT 1`,
    [userId, recipient, recipient],
  );

  if (!lastInbound?.timestamp) return false;

  const lastInboundAt = new Date(lastInbound.timestamp);
  if (Number.isNaN(lastInboundAt.getTime())) return false;

  return now.getTime() - lastInboundAt.getTime() <= WHATSAPP_SUPPORT_HANDOFF_MS;
}

function interpolate(text, context) {
  if (!text) return "";
  return text.replace(/\{\{(.*?)\}\}/g, (_, p) => {
    const key = p.trim();
    // Try both camelCase and snake_case versions
    const value =
      context[key] ||
      context[key.toLowerCase()] ||
      context[key.replace(/_/g, "").toLowerCase()] ||
      context[key.replace(/([A-Z])/g, "_$1").toLowerCase()];
    return value || "";
  });
}

function calcTypingDelay(text = "") {
  // Snappier response times: 50ms base + 5ms per char, max 800ms
  return Math.min(50 + String(text).length * 5, 800);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendWhatsAppMessage(
  phoneNumberId,
  accessToken,
  to,
  messageData,
) {
  const startTime = Date.now();
  const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
  const payload = { messaging_product: "whatsapp", to, ...messageData };

  console.log(`[WA Send] POST ${url} → to: ${to}, type: ${messageData.type}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...buildMetaAuthHeaders(accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const latency = Date.now() - startTime;
    const result = await res.json();

    if (!res.ok || result.error) {
      console.error(
        `[WA Send] API ERROR (${res.status}):`,
        JSON.stringify(result.error || result),
      );
      metricsService.incrementCounter("whatsapp_messages_total", {
        status: "error",
      });
      return result;
    }

    console.log(
      `[WA Send] SUCCESS — wamid: ${result.messages?.[0]?.id}, latency: ${latency}ms`,
    );
    metricsService.incrementCounter("whatsapp_messages_total", {
      status: "success",
    });
    metricsService.recordHistogram("whatsapp_message_latency_ms", latency);
    return result;
  } catch (err) {
    console.error(`[WA Send] FETCH ERROR:`, err.message);
    metricsService.incrementCounter("whatsapp_messages_total", {
      status: "error",
    });
    throw err;
  }
}

async function sendTypingIndicator(phoneNumberId, accessToken, to, wamid) {
  const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
  await fetch(url, {
    method: "POST",
    headers: {
      ...buildMetaAuthHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: wamid,
    }),
  });
}

async function getAutomationConversationState(automationId, recipient, userId) {
  const id = `${userId}:${automationId}:${recipient}`;
  return queryOne("SELECT * FROM automation_conversation_state WHERE id = ?", [
    id,
  ]);
}

async function saveAutomationConversationState(
  automationId,
  recipient,
  currentState,
  patch,
  userId,
) {
  const id = `${userId}:${automationId}:${recipient}`;
  const keys = Object.keys(patch);
  const values = Object.values(patch);

  if (currentState) {
    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    await query(
      `UPDATE automation_conversation_state SET ${setClause}, updatedAt = NOW() WHERE id = ?`,
      [...values, id],
    );
  } else {
    const cols = ["id", "automationId", "recipient", "userId", ...keys];
    const placeholders = cols.map(() => "?").join(", ");
    await query(
      `INSERT INTO automation_conversation_state (${cols.join(", ")}, createdAt, updatedAt) VALUES (${placeholders}, NOW(), NOW())`,
      [id, automationId, recipient, userId, ...values],
    );
  }
  return { ...currentState, ...patch };
}

async function logMessage(userId, phone, message, wamid) {
  await query(
    'INSERT INTO messages (id, userId, recipient, phone, message, isCustomer, timestamp, whatsappMessageId, status) VALUES (?, ?, ?, ?, ?, 0, NOW(), ?, "sent")',
    [uuidv4(), userId, phone, phone, message, wamid || ""],
  );
}

async function incrementMetric(automationId, field) {
  await query(
    `UPDATE automations SET metrics = JSON_SET(COALESCE(metrics, '{}'), '$.${field}', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metrics, '$.${field}')), 0) + 1) WHERE id = ?`,
    [automationId],
  );
}

async function getInstagramCredentialsForAccount(userId, instagramAccountId) {
  // First try direct instagramAccountId match
  const row = await queryOne(
    "SELECT accessToken, pageId, instagramAccountId FROM instagram_accounts WHERE userId = ? AND instagramAccountId = ? ORDER BY updatedAt DESC LIMIT 1",
    [userId, instagramAccountId],
  );
  if (row) return row;

  // Fallback: Meta sometimes sends entry.id as the pageId (FB messaging channel)
  // so look up by pageId to find the right account
  const byPage = await queryOne(
    "SELECT accessToken, pageId, instagramAccountId FROM instagram_accounts WHERE userId = ? AND pageId = ? ORDER BY updatedAt DESC LIMIT 1",
    [userId, instagramAccountId],
  );
  if (byPage) {
    console.log(`[Instagram] Resolved credentials via pageId fallback for ${instagramAccountId}`);
    return byPage;
  }

  // Last resort: get any active account for this user
  const fallback = await queryOne(
    "SELECT accessToken, pageId, instagramAccountId FROM instagram_accounts WHERE userId = ? ORDER BY updatedAt DESC LIMIT 1",
    [userId],
  );
  if (fallback) {
    console.log(`[Instagram] Using fallback credentials (most recent account) for user ${userId}`);
  }
  return fallback || null;
}


function shouldRetryInstagramSend(result) {
  return (
    result?.error?.code === 100 &&
    [2018001, 2534014].includes(Number(result.error.error_subcode))
  );
}

async function sendInstagramDM(
  accessToken,
  recipientId,
  text,
  pdfUrl = null,
  options = {},
) {
  const startTime = Date.now();
  const payload = buildInstagramMessagePayload(
    recipientId,
    text,
    pdfUrl,
    options,
  );
  console.log(
    `[Instagram Send DM] Payload:`,
    JSON.stringify(payload, null, 2),
  );
  const urls = getInstagramSendUrls(options);

  let lastResult = null;

  try {
    for (const [index, url] of urls.entries()) {
      console.log(
        `[Instagram Send DM] POST ${url} → recipient: ${recipientId}, comment: ${!!options.commentId}, pdf: ${!!pdfUrl}`,
      );

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const latency = Date.now() - startTime;
      const result = await res.json();

      if (!res.ok || result.error) {
        lastResult = result;
        console.error(
          `[Instagram DM] API ERROR (${res.status}) via ${url}:`,
          JSON.stringify(result.error || result),
        );

        if (index < urls.length - 1 && shouldRetryInstagramSend(result)) {
          console.warn(
            "[Instagram DM] Retrying with Instagram Graph messages endpoint after recipient lookup failure.",
          );
          continue;
        }

        metricsService.incrementCounter("instagram_messages_total", {
          status: "error",
        });
        return result;
      }

      console.log(
        `[Instagram DM] SUCCESS — message_id: ${result.message_id}, latency: ${latency}ms`,
      );
      try {
        await saveInstagramOutboundMessage({
          messageId: result.message_id,
          userId: options.userId,
          instagramAccountId: options.instagramAccountId,
          recipientId,
          text,
        });
      } catch (recordErr) {
        console.warn(
          "[Instagram DM] Failed to record outbound message id:",
          recordErr.message,
        );
      }
      metricsService.incrementCounter("instagram_messages_total", {
        status: "success",
      });
      return result;
    }

    return lastResult;
  } catch (err) {
    console.error(`[Instagram DM] FETCH ERROR:`, err.message);
    metricsService.incrementCounter("instagram_messages_total", {
      status: "error",
    });
    throw err;
  }
}

async function replyToInstagramComment(accessToken, commentId, text) {
  const startTime = Date.now();
  const url = `https://graph.facebook.com/v22.0/${commentId}/replies`;
  const payload = { message: text };

  console.log(`[Instagram Reply Comment] POST ${url} → comment: ${commentId}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const latency = Date.now() - startTime;
    const result = await res.json();

    if (!res.ok || result.error) {
      console.error(
        `[Instagram Comment] API ERROR (${res.status}):`,
        JSON.stringify(result.error || result),
      );
      metricsService.incrementCounter("instagram_comments_total", {
        status: "error",
      });
      return result;
    }

    console.log(
      `[Instagram Comment] SUCCESS — comment_id: ${result.id}, latency: ${latency}ms`,
    );
    metricsService.incrementCounter("instagram_comments_total", {
      status: "success",
    });
    return result;
  } catch (err) {
    console.error(`[Instagram Comment] FETCH ERROR:`, err.message);
    metricsService.incrementCounter("instagram_comments_total", {
      status: "error",
    });
    throw err;
  }
}

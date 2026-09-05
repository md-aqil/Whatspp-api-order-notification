import { v4 as uuidv4 } from "uuid";
import { getPool, query, queryOne, queryMany } from "./mysql";
import {
  generateAIResponse,
  generateEmbedding,
  cosineSimilarity,
  generateAIResponseFromImage,
  transcribeVoiceNote
} from "./ai";
import {
  detectAndPersistLanguage,
  languageDirective
} from "./language-detect";
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
import {
  buildProductListMessage,
  buildProductCarouselMessage,
  shapeProductForWhatsApp,
  resolveCatalogIdForShop,
  fetchAndShapeProducts
} from "./catalog/whatsapp-catalog";
import { normalizeShopifyDomain } from "./integrations/shopify";
import {
  refundShopifyOrder,
  createShopifyGiftCard,
  createShopifyDiscountCode
} from "./integrations/shopify";
import { mintAndPersistDiscount } from "./coupons/discount-engine";
import { perksForTier } from "./vip-perks";
import { recordFeedback, readCustomerProfile, recordOptIn } from "./customer-profile";
import {
  getOrCreateReferralCode,
  recordReferralConversion,
  pickWeightedTier
} from "./referrals";
import {
  subscribeBackInStock,
  findPendingSubscriptionsForProduct,
  markSubscriptionsNotified
} from "./inventory/stock-subscriptions";
import {
  addToWishlist,
  removeFromWishlist,
  listWishlist,
  findWishlistForRestock
} from "./wishlist";
import { buildHandoffContext, recordHandoff } from "./handoff-context";
import { isWithinBusinessHours, businessHoursDirective } from "./business-hours";
import { getChannelId, publishChannelPost } from "./whatsapp/channels";
import { buildSingleProductMessage, canOfferWhatsAppPay } from "./whatsapp/pay";
import { getCartInventorySnapshot, urgencyToneForInventory } from "./inventory/snapshot";

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
  let integrationRow = await queryOne(
    "SELECT whatsapp, shopify FROM integrations WHERE userId = ? ORDER BY updatedAt DESC LIMIT 1",
    [userId],
  );

  if (!integrationRow && userId !== "default") {
    integrationRow = await queryOne(
      "SELECT whatsapp, shopify FROM integrations WHERE userId = 'default' ORDER BY updatedAt DESC LIMIT 1",
    );
  }

  if (!integrationRow) {
    integrationRow = await queryOne(
      "SELECT whatsapp, shopify FROM integrations ORDER BY updatedAt DESC LIMIT 1",
    );
  }

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
    whatsapp: decryptIfNeeded(integrationRow?.whatsapp),
    shopify: decryptIfNeeded(integrationRow?.shopify),
  };

  const isInstagramEvent = event && event.startsWith("instagram.");
  let waPhone = integrations.whatsapp?.phoneNumberId;
  let waToken = integrations.whatsapp?.accessToken;

  // Fallback to whatsapp_accounts table if integration record is incomplete
  if (!waPhone || !waToken) {
    const acc = await queryOne(
      "SELECT phoneNumberId, accessToken, businessAccountId FROM whatsapp_accounts ORDER BY updatedAt DESC LIMIT 1",
    );
    if (acc?.accessToken && acc?.phoneNumberId) {
      integrations.whatsapp = {
        ...integrations.whatsapp,
        phoneNumberId: acc.phoneNumberId,
        accessToken: acc.accessToken,
        businessAccountId: acc.businessAccountId,
      };
      waPhone = acc.phoneNumberId;
      waToken = acc.accessToken;
    }
  }

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
      `SELECT id, name, steps, metrics FROM automations WHERE id = ? AND (userId = ? OR userId = 'default' OR userId IS NULL)`,
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
    // Normal event-based trigger: isolate to specific user to prevent duplicate runs from 'default'
    let rows = await queryMany(
      `SELECT id, name, steps, metrics
       FROM automations
       WHERE userId = ?
         AND (status = 1 OR status = '1' OR status = 'active' OR status = true)`,
      [userId || 'default'],
    );

    // Fallback: If user has zero automations created, check 'default'
    if ((!rows || rows.length === 0) && userId && userId !== 'default') {
      const userHasAny = await queryOne(
        `SELECT id FROM automations WHERE userId = ? LIMIT 1`,
        [userId],
      );
      if (!userHasAny) {
        rows = await queryMany(
          `SELECT id, name, steps, metrics
           FROM automations
           WHERE userId = 'default'
             AND (status = 1 OR status = '1' OR status = 'active' OR status = true)`,
        );
      }
    }

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
    `[Automation Engine] Triggering automation event: ${event} for user ${userId}`,
  );
  context.userId = userId;

  // 1. Process directly for immediate responses without worker dependency
  try {
    await processAutomationEvent({ event, context, userId });
  } catch (directErr) {
    console.error("[Automation Engine] Direct event processing error:", directErr);
  }

  // 2. Also enqueue for background processing and retry mechanisms
  try {
    await enqueueAutomationEvent(event, context, integrations, userId);
  } catch (queueErr) {
    // Non-fatal if Redis is not configured
    console.warn("[Queue] Enqueue skipped/failed:", queueErr.message);
  }
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
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);
      const rawMsg =
        context.customer_message ||
        context.messageText ||
        context.commentText ||
        "";
      const msg = rawMsg.toLowerCase().trim().replace(/[^\w\s]/gi, "");
      
      const isMatch = keywords.some((k) => {
        const cleanK = k.replace(/[^\w\s]/gi, "").trim();
        if (!cleanK) return false;
        return msg === cleanK || msg.includes(cleanK) || (cleanK.length > 2 && cleanK.includes(msg));
      });

      if (isMatch) {
        currentStepId = getNextStepId(steps, trigger, "main");
        console.log(
          `[Automation Engine] Trigger keyword match (${keywordString}) for "${rawMsg}"! Starting flow.`,
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

      // Historical/Deep Match Fallback
      if (!currentStepId && (context._isInteractiveReply || (context.customer_message && context.customer_message.trim().length < 25))) {
        for (const s of steps.filter(
          (st) => st.type === "interactive" || st.type === "ai_reply"
        )) {
          const matchedBranchId = resolveInteractiveBranch(
            s,
            null,
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
    }

    // 3. Global Event Trigger (e.g. order.created or catch-all incoming message)
    const hasKeywords = !!(trigger?.config?.keywords || trigger?.keyword);
    const isMatchingEvent = 
      trigger?.event === eventType ||
      (isIncomingWhatsApp && (trigger?.event === "whatsapp.message_received" || trigger?.event === "whatsapp" || !trigger?.event)) ||
      (isIncomingInstagram && (trigger?.event === "instagram.message_received" || trigger?.event === "instagram" || trigger?.event === "instagram.comment_created"));

    if (!currentStepId && trigger && isMatchingEvent) {
      if ((isIncomingWhatsApp || isIncomingInstagram) && hasKeywords) {
        // Skip - keywords were defined but didn't match in step 1
      } else {
        currentStepId = getNextStepId(steps, trigger, "main");
        console.log(`[Automation Engine] Trigger catch-all match for automation "${automation.name}"! Starting flow.`);
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
      const handled = await handleAIStep(
        step,
        context,
        integrations,
        automation,
        userId,
        recipient,
      );
      
      if (!handled) {
        console.log(`[AI Step] Skipped for user ${userId}: No knowledge base content available.`);
        currentStepId = getNextStepId(steps, step, "fallback");
        continue;
      }
      
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

    if (step.type === "product_list" || step.type === "product_carousel") {
      const handled = await handleProductListStep(step, context, integrations, automation, recipient, userId);
      if (handled?.success) {
        await logMessage(userId, recipient, step.message || step.config?.bodyText || `[${step.type}]`, handled.wamid);
        await incrementMetric(automation.id, "sent");
      }
      currentStepId = getNextStepId(steps, step, handled?.success ? "main" : "fallback");
      continue;
    }

    if (step.type === "single_product") {
      const handled = await handleSingleProductStep(step, context, integrations, automation, recipient, userId);
      if (handled?.success) {
        await logMessage(userId, recipient, step.message || step.config?.bodyText || "[single_product]", handled.wamid);
        await incrementMetric(automation.id, "sent");
      }
      currentStepId = getNextStepId(steps, step, handled?.success ? "main" : "fallback");
      continue;
    }

    if (step.type === "shopify_discount") {
      const handled = await handleShopifyDiscountStep(step, context, integrations, automation, recipient, userId);
      if (handled?.success) {
        await incrementMetric(automation.id, "sent");
      }
      currentStepId = getNextStepId(steps, step, handled?.success ? "main" : "fallback");
      continue;
    }

    if (step.type === "inventory_snapshot") {
      const handled = await handleInventorySnapshotStep(step, context, integrations);
      currentStepId = getNextStepId(steps, step, handled?.success ? "main" : "fallback");
      continue;
    }

    if (step.type === "record_feedback") {
      const handled = await handleRecordFeedbackStep(step, context, userId, automation.id);
      currentStepId = getNextStepId(steps, step, handled?.success ? "main" : "fallback");
      continue;
    }

    if (step.type === "ab_split") {
      const branch = await handleAbSplitStep(step, context, automation, userId, recipient);
      currentStepId = getNextStepId(steps, step, branch);
      continue;
    }

    if (step.type === "tag_audience") {
      const handled = await handleTagAudienceStep(step, context, userId);
      currentStepId = getNextStepId(steps, step, handled?.success ? "main" : "fallback");
      continue;
    }

    if (step.type === "vip_perk") {
      const handled = await handleVipPerkStep(step, context, integrations, automation, recipient, userId);
      currentStepId = getNextStepId(steps, step, handled?.success ? "main" : "fallback");
      continue;
    }

    if (step.type === "opt_in") {
      try {
        await recordOptIn({ userId, customerPhone: recipient, source: step.config?.source || 'automation' })
        context.opted_in = true
        currentStepId = getNextStepId(steps, step, "main")
      } catch (optErr) {
        console.warn('[Automation Engine] opt_in failed:', optErr.message)
        currentStepId = getNextStepId(steps, step, "fallback")
      }
      continue
    }

    if (step.type === "send_optin_prompt") {
      try {
        const { sendWhatsAppInteractiveList } = await import('./whatsapp/meta-api')
        const wa = integrations?.whatsapp || {}
        const phoneId = wa.phoneNumberId
        const token = wa.accessToken
        if (!phoneId || !token) {
          currentStepId = getNextStepId(steps, step, "fallback")
          continue
        }
        const sections = (step.config?.sections && step.config.sections.length > 0)
          ? step.config.sections
          : [{
              title: 'Marketing',
              rows: [
                { id: 'opt_in_yes', title: '✅ Yes, subscribe' },
                { id: 'opt_in_no', title: '❌ No thanks' }
              ]
            }]
        await sendWhatsAppInteractiveList(phoneId, token, recipient, {
          body: step.config?.body || 'Get order updates, restock alerts, and exclusive offers. Subscribe?',
          buttonText: step.config?.buttonText || 'Choose',
          sections,
          footer: step.config?.footer
        }, { stepType: 'optin_prompt', dedupeKey: `optin_prompt:${recipient}:${automation.id}:${step.id}` })
        context.optin_prompt_sent = true
        currentStepId = getNextStepId(steps, step, "main")
      } catch (opErr) {
        console.warn('[Automation Engine] send_optin_prompt failed:', opErr.message)
        currentStepId = getNextStepId(steps, step, "fallback")
      }
      continue
    }

    if (step.type === "shopify_refund") {
      const handled = await handleShopifyRefundStep(step, context, integrations, userId);
      context.refund_status = handled?.refund?.id ? 'refunded' : 'failed';
      context.refund_id = handled?.refund?.id;
      currentStepId = getNextStepId(steps, step, handled?.success ? "main" : "fallback");
      continue;
    }

    if (step.type === "shopify_gift_card") {
      const handled = await handleShopifyGiftCardStep(step, context, integrations, userId);
      context.gift_card_code = handled?.giftCard?.code;
      context.gift_card_balance = handled?.giftCard?.initial_value;
      currentStepId = getNextStepId(steps, step, handled?.success ? "main" : "fallback");
      continue;
    }

    if (step.type === "assign_referral") {
      const handled = await handleAssignReferralStep(step, context, userId);
      context.referral_code = handled?.code;
      currentStepId = getNextStepId(steps, step, handled?.success ? "main" : "fallback");
      continue;
    }

    if (step.type === "spin_wheel") {
      const handled = await handleSpinWheelStep(step, context, integrations, userId, automation, recipient);
      context.spin_tier = handled?.tier?.id;
      context.discount_code = handled?.discount?.code;
      currentStepId = getNextStepId(steps, step, handled?.success ? "main" : "fallback");
      continue;
    }

    if (step.type === "add_to_wishlist") {
      const handled = await handleAddToWishlistStep(step, context, userId);
      currentStepId = getNextStepId(steps, step, handled?.success ? "main" : "fallback");
      continue;
    }

    if (step.type === "back_in_stock_subscribe") {
      const handled = await handleBackInStockSubscribeStep(step, context, userId);
      currentStepId = getNextStepId(steps, step, handled?.success ? "main" : "fallback");
      continue;
    }

    if (step.type === "business_hours") {
      const result = isWithinBusinessHours(step.config || {})
      context.is_business_hours = result.open
      context.business_hours_day = result.dayKey
      currentStepId = getNextStepId(steps, step, result.open ? "main" : "fallback")
      continue
    }

    if (step.type === "language_detect") {
      try {
        const code = await detectAndPersistLanguage({
          userId,
          customerPhone: recipient || context.customer_phone,
          recentText: context.last_customer_text || ''
        })
        context.detected_language = code
        context.language_directive = languageDirective(code)
        currentStepId = getNextStepId(steps, step, "main")
      } catch (ldErr) {
        console.warn('[Automation Engine] language_detect failed:', ldErr.message)
        currentStepId = getNextStepId(steps, step, "main")
      }
      continue
    }

    if (step.type === "handoff_summary") {
      // Build the handoff context now (used by AI steps or Zoho note steps
      // before the actual human-handoff message goes out).
      try {
        const handoffCtx = await buildHandoffContext({ userId, customerPhone: recipient })
        if (handoffCtx) {
          context.handoff_summary = handoffCtx
          await recordHandoff({ userId, customerPhone: recipient, context: handoffCtx })
        }
      } catch (err) {
        console.warn('[Automation Engine] handoff_summary error:', err.message)
      }
      currentStepId = getNextStepId(steps, step, "main")
      continue
    }

    if (step.type === "zoho_action") {
      await handleZohoActionStep(step, context, userId);
      currentStepId = getNextStepId(steps, step, "main");
      continue;
    }

    if (step.type === "channel_post") {
      await handleChannelPostStep(step, context, integrations, userId);
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
      // If outside 24h customer window and no template specified, log note but proceed with message delivery
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
          console.log(
            `[Automation Engine] ${buildOutOfWindowMessage(recipient)} — sending outbound ${step.type} step ${step.id} for event ${eventType}`,
          );
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

        // Persist handoff context for the human agent (best-effort)
        if (isSupport) {
          try {
            const handoffCtx = await buildHandoffContext({ userId, customerPhone: recipient })
            if (handoffCtx) {
              await recordHandoff({ userId, customerPhone: recipient, context: handoffCtx })
              context.handoff_summary = handoffCtx
            }
          } catch (hoErr) {
            console.warn('[Automation Engine] handoff context persist failed:', hoErr.message)
          }
        }
      }

      currentStepId = getNextStepId(steps, step, "main");
      continue;
    }

    break;
  }

  return true;
}

// --- Specialized Handlers ---

async function handleInventorySnapshotStep(step, context, integrations) {
  try {
    if (!integrations?.shopify) return { success: false, error: 'shopify_not_configured' }
    const snapshot = await getCartInventorySnapshot({
      shopifyIntegration: integrations.shopify,
      cartContext: context,
      threshold: step.config?.threshold || 5
    })
    const tone = urgencyToneForInventory(snapshot)
    context.cart_inventory = snapshot
    context.cart_items_low_stock = tone.itemsLow
    context.cart_low_stock_phrase = tone.phrase
    context.cart_urgency_tone = tone.tone
    return { success: true, snapshot, tone }
  } catch (err) {
    console.error('[Automation Engine] inventory_snapshot error:', err.message)
    return { success: false, error: err.message }
  }
}

async function handleRecordFeedbackStep(step, context, userId, automationId) {
  try {
    const score = parseInt(context._chosenOptionId?.replace(/[^0-9]/g, '') || context.customer_message || '0', 10) || 0
    const feedbackType = step.config?.feedbackType || 'csat'
    if (!score) {
      console.warn('[Automation Engine] record_feedback: no score in context')
      return { success: false, error: 'no_score' }
    }
    await recordFeedback({
      userId,
      customerPhone: context.customerPhone || context.customer_phone,
      shopifyOrderId: context.shopify_order_id,
      orderNumber: context.order_number,
      score,
      feedbackType,
      automationId,
      context: { step: step.id }
    })
    // Tag context for downstream branching
    context.feedback_score = score
    context.feedback_is_positive = score >= (feedbackType === 'nps' ? 9 : 4)
    return { success: true }
  } catch (err) {
    console.error('[Automation Engine] record_feedback error:', err.message)
    return { success: false, error: err.message }
  }
}

/**
 * Randomly picks a branch (variant key) for an A/B test and stores the
 * choice on context so subsequent steps can read context._ab_variant.
 *
 * Step config shape:
 *   experimentKey: 'order_confirmation_copy_v1'
 *   variants: ['control', 'variant_a', 'variant_b']   // weights equal by default
 *   weights: [50, 25, 25]                              // optional, sums to 100
 *   persistKey: 'recipient' (default) — sticky per-recipient key
 */
async function handleAbSplitStep(step, context, automation, userId, recipient) {
  try {
    const variants = Array.isArray(step.config?.variants) && step.config.variants.length > 0
      ? step.config.variants
      : ['control', 'variant_a']

    const weights = Array.isArray(step.config?.weights) && step.config.weights.length === variants.length
      ? step.config.weights
      : variants.map(() => 1)

    // Sticky per-recipient hash (so the same user always lands on the same arm)
    const key = `${userId}:${automation.id}:${step.id}:${recipient || context.customerPhone || 'anon'}`
    const seed = simpleHash(key)
    const totalWeight = weights.reduce((a, b) => a + b, 0)
    const pick = seed % totalWeight
    let cumulative = 0
    let chosenIndex = 0
    for (let i = 0; i < variants.length; i++) {
      cumulative += weights[i]
      if (pick < cumulative) { chosenIndex = i; break }
    }
    const chosenVariant = variants[chosenIndex]

    context._ab_variant = chosenVariant
    context._ab_experiment = step.config?.experimentKey || `${automation.id}:${step.id}`

    // Fire-and-forget: log the assignment for analytics
    try {
      const { query } = await import('./mysql')
      const expKey = step.config?.experimentKey || `${automation.id}:${step.id}`
      // Update the experiment-level roll-up
      await query(
        `INSERT INTO template_experiments (id, userId, automationId, stepId, experimentKey, variants, status, createdAt)
         VALUES (?, ?, ?, ?, ?, JSON_OBJECT('chosen', ?, 'all', ?), 'active', NOW())
         ON DUPLICATE KEY UPDATE
           variants = JSON_SET(COALESCE(variants, '{}'), '$.chosen', ?),
           createdAt = NOW()`,
        [
          `exp_${userId}_${step.id}_${chosenVariant}`,
          userId, automation.id, step.id,
          expKey,
          chosenVariant,
          JSON.stringify(variants),
          chosenVariant
        ]
      )
      // Per-recipient assignment row for AB analytics
      const recipientKey = String(recipient || context.customerPhone || 'anon')
      const normalizedPhone = recipientKey.replace(/\D/g, '') || recipientKey
      await query(
        `INSERT INTO template_experiment_assignments
          (userId, experimentKey, automationId, stepId, recipient, variant)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, expKey, automation.id, step.id, normalizedPhone, chosenVariant]
      )
    } catch (logErr) {
      console.warn('[Automation Engine] ab_split logging failed:', logErr.message)
    }

    return chosenVariant
  } catch (err) {
    console.error('[Automation Engine] ab_split error:', err.message)
    return step.connections?.fall ? step.connections.fallback : null
  }
}

function simpleHash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

async function handleAssignReferralStep(step, context, userId) {
  try {
    if (!context.customerPhone && !context.customer_phone) {
      return { success: false, error: 'no_recipient' }
    }
    const phone = context.customerPhone || context.customer_phone
    const ref = await getOrCreateReferralCode({
      userId,
      customerPhone: phone,
      prefix: step.config?.prefix || process.env.STORE_NAME || 'REF'
    })
    return { success: true, code: ref?.code }
  } catch (err) {
    console.error('[Automation Engine] assign_referral error:', err.message)
    return { success: false, error: err.message }
  }
}

async function handleSpinWheelStep(step, context, integrations, userId, automation, recipient) {
  try {
    // Per-recipient cooldown: prevent abuse by re-spinning to mint unlimited
    // codes. The cooldown is read from step.config.cooldownHours (default 24h).
    const cooldownHours = Math.max(parseInt(step.config?.cooldownHours || 24, 10) || 24, 1)
    if (recipient) {
      try {
        const { queryOne } = await import('./mysql')
        const recent = await queryOne(
          `SELECT createdAt FROM shopify_discount_codes
           WHERE userId = ? AND recipient = ? AND context LIKE '%spin_tier%'
             AND createdAt >= DATE_SUB(NOW(), INTERVAL ? HOUR)
           ORDER BY createdAt DESC LIMIT 1`,
          [userId, String(recipient).replace(/\D/g, ''), cooldownHours]
        )
        if (recent?.createdAt) {
          return { success: false, error: 'cooldown_active', retryAfterHours: cooldownHours }
        }
      } catch (coErr) {
        // If the table doesn't exist yet (fresh deploy), fall through.
      }
    }

    const tiers = step.config?.tiers && step.config.tiers.length > 0
      ? step.config.tiers
      : [
          { id: 'small', weight: 60, valueType: 'percentage', value: 5 },
          { id: 'medium', weight: 30, valueType: 'percentage', value: 10 },
          { id: 'large', weight: 9, valueType: 'percentage', value: 20 },
          { id: 'jackpot', weight: 1, valueType: 'fixed_amount', value: 25 }
        ]

    const tier = pickWeightedTier(tiers)
    if (!tier || !integrations?.shopify) {
      return { success: false, error: 'no_tier_or_shopify' }
    }

    // Mint a Shopify discount for the chosen tier
    const discount = await mintAndPersistDiscount({
      userId,
      shopifyIntegration: integrations.shopify,
      recipient,
      automationId: automation?.id,
      context: { spin_tier: tier.id },
      options: {
        valueType: tier.valueType || 'percentage',
        value: Number(tier.value || 5),
        usageLimit: 1,
        prefix: (tier.prefix || 'SPIN'),
        ttlDays: tier.ttlDays || 14
      }
    })

    context.discount_code = discount.code
    context.spin_tier_label = tier.label || tier.id

    return { success: true, tier, discount }
  } catch (err) {
    console.error('[Automation Engine] spin_wheel error:', err.message)
    return { success: false, error: err.message }
  }
}

async function handleAddToWishlistStep(step, context, userId) {
  try {
    if (!context.customerPhone && !context.customer_phone) {
      return { success: false, error: 'no_recipient' }
    }
    const phone = context.customerPhone || context.customer_phone
    await addToWishlist({
      userId,
      customerPhone: phone,
      shopifyProductId: context.shopify_product_id,
      shopifyVariantId: context.shopify_variant_id,
      productTitle: context.product_title,
      productHandle: context.product_handle,
      productImage: context.product_image,
      productPrice: context.product_price,
      notifyOnDiscount: step.config?.notifyOnDiscount === true,
      notifyOnRestock: step.config?.notifyOnRestock !== false
    })
    return { success: true }
  } catch (err) {
    console.error('[Automation Engine] add_to_wishlist error:', err.message)
    return { success: false, error: err.message }
  }
}

async function handleBackInStockSubscribeStep(step, context, userId) {
  try {
    if (!context.customerPhone && !context.customer_phone) {
      return { success: false, error: 'no_recipient' }
    }
    const phone = context.customerPhone || context.customer_phone
    await subscribeBackInStock({
      userId,
      customerPhone: phone,
      shopifyProductId: context.shopify_product_id,
      shopifyVariantId: context.shopify_variant_id,
      productTitle: context.product_title,
      productHandle: context.product_handle,
      productImage: context.product_image,
      variantTitle: context.variant_title,
      source: step.config?.source || 'automation'
    })
    return { success: true }
  } catch (err) {
    console.error('[Automation Engine] back_in_stock_subscribe error:', err.message)
    return { success: false, error: err.message }
  }
}

async function handleShopifyRefundStep(step, context, integrations, userId) {
  try {
    if (!integrations?.shopify?.shopDomain) {
      return { success: false, error: 'shopify_not_configured' }
    }
    const orderId = context.shopify_order_id || context.order_id
    if (!orderId) {
      return { success: false, error: 'no_order_id' }
    }
    const refund = await refundShopifyOrder(integrations.shopify, orderId, step.config || {})
    return { success: true, refund }
  } catch (err) {
    console.error('[Automation Engine] shopify_refund error:', err.message)
    return { success: false, error: err.message }
  }
}

async function handleVipPerkStep(step, context, integrations, automation, recipient, userId) {
  try {
    if (!integrations?.shopify?.shopDomain) {
      return { success: false, error: 'shopify_not_configured' }
    }
    const phone = context.customer_phone || context.customerPhone || recipient
    if (!phone) return { success: false, error: 'no_customer' }

    const profile = await readCustomerProfile({ userId, customerPhone: phone })
    const tier = profile?.lifetimeTier || context.lifetime_tier || 'bronze'
    const perks = perksForTier(tier)
    if (!perks.percentOff && !perks.freeShipping && !perks.freeGift) {
      return { success: false, error: 'no_perk_for_tier' }
    }

    const code = `VIP-${tier.toUpperCase()}-${(phone.replace(/\D/g, '') || '').slice(-6) || 'X'}-${Date.now().toString(36).toUpperCase()}`
    const discount = await createShopifyDiscountCode(integrations.shopify, {
      code,
      valueType: perks.percentOff ? 'percentage' : 'fixed_amount',
      value: perks.percentOff || 5,
      minimumSubtotal: perks.minOrder,
      usageLimit: 1,
      endsAt: new Date(Date.now() + (step.config?.durationDays || 30) * 24 * 60 * 60 * 1000).toISOString()
    })

    await mintAndPersistDiscount({
      userId,
      shopDomain: integrations.shopify.shopDomain,
      customerPhone: phone,
      code,
      source: 'vip_perk',
      automationId: automation?.id || null,
      tier,
      perks
    })

    context.vip_tier = tier
    context.vip_code = code
    context.vip_discount_id = discount?.id || null
    return { success: true, code, tier, discount }
  } catch (err) {
    console.error('[Automation Engine] vip_perk error:', err.message)
    return { success: false, error: err.message }
  }
}

async function handleShopifyGiftCardStep(step, context, integrations, userId) {
  try {
    if (!integrations?.shopify?.shopDomain) {
      return { success: false, error: 'shopify_not_configured' }
    }
    const giftCard = await createShopifyGiftCard(integrations.shopify, {
      initialValue: step.config?.initialValue || 10,
      currency: step.config?.currency || context.currency || 'USD',
      customerId: context.customer_id || context.shopify_customer_id,
      expiresAt: step.config?.expiresAt
    })
    return { success: true, giftCard }
  } catch (err) {
    console.error('[Automation Engine] shopify_gift_card error:', err.message)
    return { success: false, error: err.message }
  }
}

async function handleShopifyDiscountStep(step, context, integrations, automation, recipient, userId) {
  try {
    if (!integrations?.shopify?.shopDomain) {
      console.warn('[Automation Engine] Discount step skipped: Shopify not configured.')
      return { success: false, error: 'shopify_not_configured' }
    }

    const config = step.config || {}
    const result = await mintAndPersistDiscount({
      userId,
      shopifyIntegration: integrations.shopify,
      recipient,
      automationId: automation.id,
      orderId: context.shopify_order_id || '',
      context: {
        cart_session_id: context.cart_session_id,
        customer_name: context.customer_name
      },
      options: {
        valueType: config.valueType || 'percentage',
        value: Number(config.value || 10),
        usageLimit: Number(config.usageLimit || 1),
        prefix: config.prefix || 'CHATFLOW',
        minimumSubtotal: config.minimumSubtotal,
        productIds: config.productIds,
        collectionIds: config.collectionIds,
        ttlDays: Number(config.ttlDays || 14)
      }
    })

    // Stash the code on context so subsequent message steps can interpolate {{discount_code}}
    context.discount_code = result.code
    context.discount_expires_at = result.expiresAt

    console.log(`[Automation Engine] Minted discount ${result.code} for ${recipient}`)
    return { success: true, code: result.code }
  } catch (err) {
    console.error('[Automation Engine] Discount step error:', err.message)
    return { success: false, error: err.message }
  }
}

async function handleSingleProductStep(step, context, integrations, automation, recipient, userId) {
  try {
    if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
      return { success: false, error: 'whatsapp_not_configured' };
    }
    if (!integrations?.shopify?.shopDomain) {
      return { success: false, error: 'shopify_not_configured' };
    }

    const catalogId = resolveCatalogIdForShop(integrations.shopify);
    if (!catalogId) {
      return { success: false, error: 'catalog_not_linked' };
    }

    const config = step.config || {};
    const productId = config.productId || context.shopify_product_id;
    if (!productId) {
      return { success: false, error: 'no_product_id' };
    }

    const bodyText = interpolate(step.message || config.bodyText || "Check out this product ✨", context);
    const footerText = interpolate(config.footerText || "Tap to view", context);

    // Resolve the product to extract pricing for an optional Pay button
    let payment;
    if (config.enablePay && canOfferWhatsAppPay({ whatsappIntegration: integrations.whatsapp, context })) {
      try {
        const products = await fetchAndShapeProducts(integrations.shopify, { limit: 30 });
        const product = products.find(p => p.shopify_product_id == productId || p.product_id === `shopify_${productId}`);
        const priceString = product?.price || '';
        const numeric = parseFloat(priceString.replace(/[^\d.]/g, ''));
        const currency = (priceString.match(/[A-Z]{3}/) || ['INR'])[0];
        if (numeric > 0) {
          payment = {
            amount: { value: numeric, offset: 100 },
            currency,
            type: 'physical_goods',
            merchantName: integrations.shopify?.shopName || integrations.whatsapp?.name || 'Store',
            description: product?.title || 'Order'
          };
        }
      } catch (e) {
        console.warn('[Single Product] price lookup failed:', e.message);
      }
    }

    const messageData = buildSingleProductMessage({
      productId: `shopify_${productId}`,
      bodyText,
      footerText,
      catalogId,
      enablePay: Boolean(payment),
      referenceId: context.shopify_order_id || `prod_${productId}`,
      payment
    });

    const result = await sendWhatsAppMessage(
      integrations.whatsapp.phoneNumberId,
      integrations.whatsapp.accessToken,
      recipient,
      messageData,
      { userId, stepType: 'single_product', resourceId: `shopify_${productId}` }
    );

    if (result?.error) {
      return { success: false, error: result.error.message };
    }
    return { success: true, wamid: result?.messages?.[0]?.id };
  } catch (err) {
    console.error('[Automation Engine] single_product error:', err.message);
    return { success: false, error: err.message };
  }
}

async function handleProductListStep(step, context, integrations, automation, recipient, userId) {
  try {
    if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
      console.warn("[Automation Engine] Product list step skipped: WhatsApp not configured.");
      return { success: false, error: "whatsapp_not_configured" };
    }

    if (!integrations?.shopify?.shopDomain) {
      console.warn("[Automation Engine] Product list step skipped: Shopify not configured.");
      return { success: false, error: "shopify_not_configured" };
    }

    const catalogId = resolveCatalogIdForShop(integrations.shopify);
    if (!catalogId) {
      console.warn(
        "[Automation Engine] Product list step skipped: Meta Commerce catalog not linked. Set metaCatalogId in the Shopify integration."
      );
      return { success: false, error: "catalog_not_linked" };
    }

    // Determine products to send. Either explicit section config or auto-fetch.
    const config = step.config || {};
    const bodyText = interpolate(step.message || config.bodyText || "Browse our latest products ✨", context);
    const headerText = interpolate(config.headerText || "Shop the Collection", context);
    const footerText = interpolate(config.footerText || "Tap any item to view", context);

    let sections = [];
    if (Array.isArray(config.sections) && config.sections.length > 0) {
      sections = config.sections.map((s) => ({
        title: interpolate(s.title || "Products", context),
        product_items: (s.product_items || []).map((p) => ({
          product_retailer_id: String(p.product_retailer_id || p.product_id)
        }))
      }));
    } else {
      // Auto-fetch up to 30 products from Shopify Admin API
      const limit = Math.min(parseInt(config.limit || "10", 10) || 10, 30);
      const products = await fetchAndShapeProducts(integrations.shopify, { limit });
      if (!products.length) {
        console.warn("[Automation Engine] Product list step skipped: no products in store.");
        return { success: false, error: "no_products" };
      }
      sections = [
        {
          title: interpolate(config.sectionTitle || "Featured", context),
          product_items: products.map((p) => ({ product_retailer_id: p.product_id }))
        }
      ];
    }

    let messageData;
    if (step.type === "product_list") {
      messageData = buildProductListMessage({ bodyText, headerText, footerText, sections });
      messageData.interactive.action.catalog_id = catalogId;
    } else {
      // Carousel — convert the same list into cards with images + buy buttons
      const limit = Math.min(parseInt(config.limit || "10", 10) || 10, 10);
      const products = await fetchAndShapeProducts(integrations.shopify, { limit });
      const cards = products.map((p, idx) => ({
        card_index: idx,
        image_url: p.image_url,
        title: p.title,
        description: `${p.title}${p.price ? ` — ${p.price}` : ""}`,
        price: p.price,
        buttons: [
          {
            type: "url",
            text: "View",
            url: p.handle
              ? `https://${normalizeShopifyDomain(integrations.shopify.shopDomain)}/products/${p.handle}`
              : ""
          }
        ]
      }));
      messageData = buildProductCarouselMessage({ bodyText, headerText, footerText, cards });
    }

    const result = await sendWhatsAppMessage(
      integrations.whatsapp.phoneNumberId,
      integrations.whatsapp.accessToken,
      recipient,
      messageData,
      { userId, stepType: step.type, resourceId: catalogId }
    );

    if (result?.error) {
      console.warn(`[Automation Engine] ${step.type} send failed:`, result.error?.message);
      return { success: false, error: result.error.message };
    }
    return { success: true, wamid: result?.messages?.[0]?.id };
  } catch (err) {
    console.error(`[Automation Engine] ${step.type} error:`, err.message);
    return { success: false, error: err.message };
  }
}

async function handleHttpRequestStep(step, context, userId) {
  const method = step.method || "POST";
  const url = interpolate(step.url || "", context);
  const headersText = interpolate(step.headers || "{}", context);
  const bodyText = interpolate(step.body || "{}", context);

  // Basic SSRF guard: reject non-http(s) schemes and obvious private/loopback
  // addresses. Automation authors can still call any external API but cannot
  // poke internal services (e.g. cloud metadata, localhost, RFC1918 ranges).
  try {
    const u = new URL(url)
    if (!/^https?:$/.test(u.protocol)) {
      throw new Error('only http(s) URLs are allowed')
    }
    const host = u.hostname.toLowerCase()
    const blocked = [
      /^localhost$/,
      /^127\./,
      /^10\./,
      /^192\.168\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^169\.254\./,
      /^::1$/,
      /^fc[0-9a-f]{2}:/i,
      /^fe80:/i,
      /\.internal$/,
      /\.local$/
    ]
    if (blocked.some(re => re.test(host))) {
      throw new Error(`blocked host: ${host}`)
    }
  } catch (ssrfErr) {
    console.warn('[Automation Engine] http_request blocked:', ssrfErr.message, url)
    return
  }

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

async function handleChannelPostStep(step, context, integrations, userId) {
  try {
    const channelId = getChannelId(integrations);
    if (!channelId) {
      console.warn(`[Automation Engine] Channel post step skipped: No channelId configured for user ${userId}.`);
      return { success: false, error: 'no_channel_id' };
    }

    const post = {
      type: step.config?.postType || 'text',
      text: interpolate(step.message || step.config?.text || '', context),
      mediaUrl: interpolate(step.config?.mediaUrl || '', context),
      options: (step.config?.options || []).map(o => interpolate(o, context))
    };

    const result = await publishChannelPost(channelId, integrations.whatsapp.accessToken, post);
    
    if (!result) {
      return { success: false, error: 'publish_failed' };
    }

    return { success: true, messageId: result.id };
  } catch (err) {
    console.error(`[Automation Engine] channel_post error:`, err.message);
    return { success: false, error: err.message };
  }
}

async function handleTagAudienceStep(step, context, userId) {
  try {
    const phone = context.customerPhone || context.customer_phone
    if (!phone) return { success: false, error: 'no_recipient' }
    const segmentKey = step.config?.segmentKey || `manual_${Date.now()}`
    const { saveAudience } = await import('./segments/audience')
    await saveAudience({ userId, segmentKey, audience: [phone], source: 'automation' })
    return { success: true, segmentKey }
  } catch (err) {
    console.error(`[Automation Engine] tag_audience error:`, err.message)
    return { success: false, error: err.message }
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

    if (!kbRows || kbRows.length === 0) {
      console.log(`[AI Step] No Knowledge Base found for userId ${userId}. AI reply will not execute until knowledge base documents are added.`);
      return false;
    }

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

    // Multimodal short-circuit: if the customer sent an image OR voice note,
    // route to Gemini vision / audio transcription directly. This lets the AI
    // answer "is this the same as my order?" or transcribe a voice question.
    const inboundImage = context.inbound_image_url || context.customer_image_url
    const inboundAudio = context.inbound_audio_url || context.customer_audio_url
    const inboundAudioMime = context.inbound_audio_mime || 'audio/ogg'
    let aiResponse = ''
    try {
      // Detect language once per conversation and inject into the prompt
      let languageDirectiveText = ''
      try {
        const detected = await detectAndPersistLanguage({
          userId,
          customerPhone: recipient,
          text: context.customer_message || ''
        })
        if (detected?.code) {
          languageDirectiveText = languageDirective(detected.code)
          context.detected_language = detected.code
        }
      } catch (langErr) {
        console.warn('[AI Step] language detection failed:', langErr.message)
      }

      if (inboundImage) {
        aiResponse = await generateAIResponseFromImage({
          imageUrl: inboundImage,
          prompt: `${languageDirectiveText}\n\n${context.customer_message || 'What is in this image? Identify any product, defect, or relevant context for our store.'}`,
          businessName
        })
      } else if (inboundAudio) {
        const transcript = await transcribeVoiceNote({ audioUrl: inboundAudio, mimeType: inboundAudioMime })
        aiResponse = await generateAIResponse(
          `${languageDirectiveText}\n\n${transcript || '(empty voice note)'}`,
          kbContent,
          businessName,
          history.reverse()
        )
      } else {
        aiResponse = await generateAIResponse(
          `${languageDirectiveText}\n\n${context.customer_message}`,
          kbContent,
          businessName,
          history.reverse(),
        )
      }
    } catch (visionErr) {
      console.warn('[AI Step] multimodal path failed, falling back to text:', visionErr.message)
      aiResponse = await generateAIResponse(
        context.customer_message || '(multimodal message)',
        kbContent,
        businessName,
        history.reverse()
      )
    }

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

const WHATSAPP_OUT_OF_WINDOW_NOTICE =
  'outside the 24-hour WhatsApp customer service window';

function buildOutOfWindowMessage(recipient) {
  return `Notice: ${recipient} is ${WHATSAPP_OUT_OF_WINDOW_NOTICE}; an approved template is required for outbound messaging.`;
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

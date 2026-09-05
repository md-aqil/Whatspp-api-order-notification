import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { query } from '../lib/mysql.js';

for (const envPath of ['/etc/lcsw/.env', path.resolve(process.cwd(), '.env')]) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

async function setupDatabase() {
    try {
        await query(`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL,
        title VARCHAR(255),
        content TEXT NOT NULL,
        embedding JSON,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_kb_user (userId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS automation_jobs (
        id VARCHAR(255) PRIMARY KEY,
        automationId VARCHAR(255) NOT NULL,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        recipient VARCHAR(255) NOT NULL,
        message TEXT,
        template TEXT,
        payload JSON,
        status VARCHAR(50) DEFAULT 'pending',
        runAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_jobs_status_run (status, runAt),
        INDEX idx_jobs_user (userId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS automation_conversation_state (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        automationId VARCHAR(255) NOT NULL,
        recipient VARCHAR(255) NOT NULL,
        state TEXT,
        lastInboundAt DATETIME,
        lastMenuSentAt DATETIME,
        lastReplyKey TEXT,
        lastReplyAt DATETIME,
        handoffUntil DATETIME,
        awaitingInteractiveStepId VARCHAR(255) DEFAULT NULL,
        payload JSON,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX automation_conversation_state_lookup_idx (userId, automationId, recipient)
      );
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS automations (
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        id VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        status BOOLEAN DEFAULT FALSE,
        source VARCHAR(255),
        summary TEXT,
        steps JSON,
        metrics JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (userId, id)
      )
    `);

        await query(`
        CREATE TABLE IF NOT EXISTS integrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        whatsapp LONGTEXT,
        shopify LONGTEXT,
        stripe LONGTEXT,
        zoho LONGTEXT,
        googleSheets LONGTEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE (userId)
      )
    `);

        // Migrate integrations table: ensure columns are LONGTEXT to support encrypted strings
        try {
            const columnsToMigrate = ['whatsapp', 'shopify', 'stripe', 'zoho', 'googleSheets'];
            for (const col of columnsToMigrate) {
                try {
                    const [cols] = await query(`SHOW COLUMNS FROM integrations LIKE '${col}'`);
                    if (cols && cols.length > 0) {
                        const type = cols[0].Type ? cols[0].Type.toLowerCase() : '';
                        if (type === 'json' || !type.includes('text')) {
                            console.log(`Migrating integrations table: altering ${col} to LONGTEXT`);
                            await query(`ALTER TABLE integrations MODIFY COLUMN ${col} LONGTEXT`);
                        }
                    } else if (col === 'googleSheets') {
                        console.log("Migrating integrations table: adding googleSheets column");
                        await query("ALTER TABLE integrations ADD COLUMN googleSheets LONGTEXT AFTER zoho");
                    }
                } catch (colErr) {
                    console.warn(`Migration warning for integrations column ${col}:`, colErr.message);
                }
            }
        } catch (err) {
            console.warn("Migration warning for integrations columns:", err.message);
        }

        // Migrate knowledge_base table: add embedding column if not exists
        try {
            const [columns] = await query("SHOW COLUMNS FROM knowledge_base LIKE 'embedding'");
            if (!columns || columns.length === 0) {
                console.log("Migrating knowledge_base table: adding embedding column");
                await query("ALTER TABLE knowledge_base ADD COLUMN embedding JSON AFTER content");
            }
        } catch (err) {
            console.warn("Migration warning for knowledge_base embedding column:", err.message);
        }

        await query(`
        CREATE TABLE IF NOT EXISTS whatsapp_accounts (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        accountName VARCHAR(255),
        phoneNumberId VARCHAR(255) UNIQUE,
        accessToken TEXT,
        businessAccountId VARCHAR(255),
        phoneNumber VARCHAR(255),
        status VARCHAR(50),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX (userId)
      )
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        action VARCHAR(255) NOT NULL,
        entityType VARCHAR(50),
        entityId VARCHAR(255),
        oldValue JSON,
        newValue JSON,
        ipAddress VARCHAR(50),
        userAgent TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (userId),
        INDEX (entityType, entityId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS automation_execution_logs (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        automationId VARCHAR(255) NOT NULL,
        jobId VARCHAR(255),
        recipient VARCHAR(255) NOT NULL,
        stepId VARCHAR(255) NOT NULL,
        stepType VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        input JSON,
        output JSON,
        error TEXT,
        executionTimeMs INT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (userId),
        INDEX (automationId),
        INDEX (recipient),
        INDEX (createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        ownerId VARCHAR(255) NOT NULL,
        plan VARCHAR(50) DEFAULT 'free',
        settings JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX (ownerId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS workspace_members (
        workspaceId VARCHAR(255) NOT NULL,
        userId VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'member',
        invitedBy VARCHAR(255),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (workspaceId, userId),
        INDEX (userId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS team_invitations (
        id VARCHAR(255) PRIMARY KEY,
        workspaceId VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'member',
        token VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        expiresAt TIMESTAMP,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (token),
        INDEX (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        rateKey VARCHAR(255) NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (rateKey),
        INDEX (createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        products JSON,
        lastSync TIMESTAMP,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        shopifyOrderId VARCHAR(255) UNIQUE,
        orderNumber VARCHAR(255),
        customerName VARCHAR(255),
        customerEmail VARCHAR(255),
        customerPhone VARCHAR(255),
        total VARCHAR(255),
        currency VARCHAR(50),
        status VARCHAR(255),
        lineItems JSON,
        createdAt DATETIME,
        updatedAt DATETIME,
        whatsappSent BOOLEAN,
        whatsappMessageId VARCHAR(255),
        whatsappSentAt DATETIME
      )
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS chats (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        phone VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        lastMessage TEXT,
        timestamp DATETIME,
        unread INT,
        avatar VARCHAR(255),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (userId, phone)
      )
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        campaignId VARCHAR(255),
        recipient VARCHAR(255),
        phone VARCHAR(255),
        message TEXT,
        isCustomer BOOLEAN,
        timestamp DATETIME,
        whatsappMessageId VARCHAR(255),
        status VARCHAR(50),
        messageType VARCHAR(50),
        products JSON,
        template VARCHAR(255),
        orderId VARCHAR(255),
        sentAt DATETIME,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        type VARCHAR(255) NOT NULL,
        webhooks JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(255),
        topic VARCHAR(255),
        payload JSON,
        receivedAt DATETIME,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS shopify_customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customerId VARCHAR(255) NOT NULL,
        phone VARCHAR(255),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE (customerId)
      )
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS outbound_idempotency (
        id VARCHAR(255) PRIMARY KEY,
        idempotency_key VARCHAR(128) NOT NULL,
        wamid VARCHAR(255),
        success TINYINT(1) DEFAULT 0,
        result LONGTEXT,
        context LONGTEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_idem_key (idempotency_key, createdAt),
        INDEX idx_idem_created (createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS shopify_discount_codes (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        shopifyDiscountId VARCHAR(255),
        code VARCHAR(255) NOT NULL,
        priceRuleId VARCHAR(255),
        recipient VARCHAR(255),
        automationId VARCHAR(255),
        orderId VARCHAR(255),
        context JSON,
        expiresAt DATETIME,
        usedAt DATETIME,
        status VARCHAR(50) DEFAULT 'active',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_discount_user (userId),
        INDEX idx_discount_code (code),
        INDEX idx_discount_recipient (recipient)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS customer_product_preferences (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        customerPhone VARCHAR(255) NOT NULL,
        shopifyProductId VARCHAR(255),
        shopifyVariantId VARCHAR(255),
        productTitle VARCHAR(255),
        productHandle VARCHAR(255),
        productImage VARCHAR(512),
        productPrice VARCHAR(50),
        reorderDays INT DEFAULT 0,
        lastOrderedAt DATETIME,
        lastNotifiedAt DATETIME,
        nextEligibleAt DATETIME,
        source VARCHAR(50) DEFAULT 'order',
        metadata JSON,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pref_user_phone (userId, customerPhone),
        INDEX idx_pref_product (shopifyProductId),
        INDEX idx_pref_eligible (nextEligibleAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS customer_feedback (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        customerPhone VARCHAR(255) NOT NULL,
        shopifyOrderId VARCHAR(255),
        orderNumber VARCHAR(255),
        score TINYINT,
        feedbackType VARCHAR(20) DEFAULT 'csat',
        comment TEXT,
        automationId VARCHAR(255),
        context JSON,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_feedback_user_phone (userId, customerPhone),
        INDEX idx_feedback_order (shopifyOrderId),
        INDEX idx_feedback_type (feedbackType)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS customer_segments (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        customerPhone VARCHAR(255) NOT NULL,
        firstOrderAt DATETIME,
        lastOrderAt DATETIME,
        totalOrders INT DEFAULT 0,
        totalSpent DECIMAL(12,2) DEFAULT 0,
        lifetimeTier VARCHAR(20) DEFAULT 'new',
        birthday DATE,
        joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        lastEngagementAt DATETIME,
        optedOutMarketing TINYINT(1) DEFAULT 0,
        referredBy VARCHAR(255),
        referralCode VARCHAR(32),
        metadata JSON,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_seg_user_phone (userId, customerPhone),
        INDEX idx_seg_tier (userId, lifetimeTier),
        INDEX idx_seg_last_order (userId, lastOrderAt),
        INDEX idx_seg_birthday (userId, birthday),
        INDEX idx_seg_referral (referralCode)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS template_experiments (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        automationId VARCHAR(255) NOT NULL,
        stepId VARCHAR(255) NOT NULL,
        experimentKey VARCHAR(128) NOT NULL,
        variants JSON,
        status VARCHAR(20) DEFAULT 'active',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_exp_key (userId, experimentKey),
        INDEX idx_exp_automation (userId, automationId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // per-recipient AB-test assignment + outcome (for analytics)
        await query(`
      CREATE TABLE IF NOT EXISTS template_experiment_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        experimentKey VARCHAR(128) NOT NULL,
        automationId VARCHAR(255),
        stepId VARCHAR(255),
        recipient VARCHAR(64) NOT NULL,
        variant VARCHAR(64) NOT NULL,
        assignedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        sentAt DATETIME,
        readAt DATETIME,
        respondedAt DATETIME,
        convertedAt DATETIME,
        conversionValue DECIMAL(12,2) DEFAULT 0,
        INDEX idx_tea_exp (userId, experimentKey, variant),
        INDEX idx_tea_recipient (userId, recipient)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        customerPhone VARCHAR(255) NOT NULL,
        code VARCHAR(32) NOT NULL,
        refereeCount INT DEFAULT 0,
        successfulOrders INT DEFAULT 0,
        totalCredit DECIMAL(12,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_ref_user (userId, customerPhone),
        UNIQUE KEY uk_ref_code (code),
        INDEX idx_ref_status (userId, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS stock_subscriptions (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        customerPhone VARCHAR(255) NOT NULL,
        shopifyProductId VARCHAR(255) NOT NULL,
        shopifyVariantId VARCHAR(255),
        productTitle VARCHAR(255),
        productHandle VARCHAR(255),
        productImage VARCHAR(512),
        variantTitle VARCHAR(255),
        source VARCHAR(50) DEFAULT 'in_stock_request',
        notifiedAt DATETIME,
        status VARCHAR(20) DEFAULT 'waiting',
        metadata JSON,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_stock_user_prod_phone (userId, shopifyProductId, customerPhone),
        INDEX idx_stock_status (userId, status, shopifyProductId),
        INDEX idx_stock_product (shopifyProductId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS wishlists (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        customerPhone VARCHAR(255) NOT NULL,
        shopifyProductId VARCHAR(255) NOT NULL,
        shopifyVariantId VARCHAR(255),
        productTitle VARCHAR(255),
        productHandle VARCHAR(255),
        productImage VARCHAR(512),
        productPrice VARCHAR(50),
        notifyOnDiscount TINYINT(1) DEFAULT 0,
        notifyOnRestock TINYINT(1) DEFAULT 1,
        addedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata JSON,
        UNIQUE KEY uk_wish_user_phone_prod (userId, customerPhone, shopifyProductId),
        INDEX idx_wish_product (shopifyProductId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS customer_segments_custom (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        customerPhone VARCHAR(255) NOT NULL,
        segmentKey VARCHAR(64) NOT NULL,
        source VARCHAR(50) DEFAULT 'manual',
        addedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        expiresAt DATETIME,
        metadata JSON,
        UNIQUE KEY uk_seg_custom (userId, customerPhone, segmentKey),
        INDEX idx_seg_custom_key (userId, segmentKey),
        INDEX idx_seg_custom_expires (expiresAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS conversation_metrics (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        customerPhone VARCHAR(255) NOT NULL,
        detectedLanguage VARCHAR(10),
        businessHoursResponse TINYINT(1) DEFAULT 0,
        handoffContext JSON,
        lastInteractionAt DATETIME,
        totalInteractions INT DEFAULT 0,
        languagePreference VARCHAR(10),
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_conv_metric (userId, customerPhone),
        INDEX idx_conv_lang (userId, detectedLanguage)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS cart_recovery_sessions (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        platform VARCHAR(50) NOT NULL,
        external_cart_id VARCHAR(255) UNIQUE,
        checkout_token VARCHAR(255) UNIQUE,
        customer_phone VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active',
        context JSON,
        last_activity_at DATETIME,
        abandoned_at DATETIME,
        recovered_at DATETIME,
        recovered_order_id VARCHAR(255),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

        // denormalised per-line-item analytics for fast top-seller queries
        await query(`
      CREATE TABLE IF NOT EXISTS order_products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        orderId VARCHAR(255) NOT NULL,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        shopifyProductId VARCHAR(255),
        shopifyVariantId VARCHAR(255),
        title VARCHAR(512),
        handle VARCHAR(255),
        image VARCHAR(512),
        price VARCHAR(64),
        quantity INT DEFAULT 1,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_op_user_prod (userId, shopifyProductId),
        INDEX idx_op_order (orderId)
      )
    `);

        // audit log of every cron run-all invocation
        await query(`
      CREATE TABLE IF NOT EXISTS cron_runs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        kind VARCHAR(64) NOT NULL DEFAULT 'run-all',
        payload JSON,
        durationMs INT DEFAULT 0,
        ranAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cron_runs_user_kind (userId, kind),
        INDEX idx_cron_runs_ranAt (ranAt)
      )
    `);

        // idempotent column adds for opt-in tracking (safe to re-run)
        const addColumn = async (table, column, ddl) => {
            try {
                await query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
            } catch (e) {
                if (!/Duplicate column name/i.test(e.message || '')) {
                    console.warn(`[migrate] ${table}.${column}: ${e.message}`)
                }
            }
        }
        await addColumn('customer_segments', 'optInConfirmedAt', 'optInConfirmedAt DATETIME')
        await addColumn('customer_segments', 'optInSource', 'optInSource VARCHAR(64)')
        await addColumn('chats', 'archived', 'archived TINYINT(1) DEFAULT 0')
        await addColumn('chats', 'archivedAt', 'archivedAt DATETIME')

        // per-tenant feature flags
        await query(`
      CREATE TABLE IF NOT EXISTS feature_flags (
        id VARCHAR(64) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        flagKey VARCHAR(64) NOT NULL,
        enabled TINYINT(1) DEFAULT 0,
        rollout DECIMAL(4,3) DEFAULT 0,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_flag_user (userId, flagKey)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // encrypted per-tenant AI provider keys (BYO)
        await query(`
      CREATE TABLE IF NOT EXISTS ai_provider_keys (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        provider VARCHAR(32) NOT NULL,
        apiKey TEXT NOT NULL,
        lastRotatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_ai_user_provider (userId, provider)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // consecutive HMAC signature failures (one row per attempt)
        await query(`
      CREATE TABLE IF NOT EXISTS hmac_failures (
        id VARCHAR(64) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        kind VARCHAR(32) NOT NULL,
        sourceIp VARCHAR(64),
        occurredAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_hmac_user_kind (userId, kind, occurredAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // per-tenant notification preferences (email / WhatsApp)
        await query(`
      CREATE TABLE IF NOT EXISTS notification_prefs (
        id VARCHAR(64) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        channel VARCHAR(16) NOT NULL,
        kind VARCHAR(64) NOT NULL,
        address VARCHAR(255) NOT NULL,
        enabled TINYINT(1) DEFAULT 1,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_notify (userId, channel, kind)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        await query(`
      CREATE TABLE IF NOT EXISTS notification_log (
        id VARCHAR(64) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        channel VARCHAR(16) NOT NULL,
        kind VARCHAR(64) NOT NULL,
        address VARCHAR(255),
        subject VARCHAR(255),
        body TEXT,
        status VARCHAR(32) DEFAULT 'logged',
        sentAt DATETIME,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notif_user_kind (userId, kind, createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // per-call AI usage meter (token + cost rollup)
        await query(`
      CREATE TABLE IF NOT EXISTS ai_usage (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        provider VARCHAR(32) NOT NULL,
        model VARCHAR(64),
        feature VARCHAR(64),
        campaignId VARCHAR(255),
        inputTokens INT DEFAULT 0,
        outputTokens INT DEFAULT 0,
        costUsd DECIMAL(10,6) DEFAULT 0,
        occurredAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ai_user (userId, occurredAt),
        INDEX idx_ai_provider (provider, occurredAt),
        INDEX idx_ai_campaign (userId, campaignId, occurredAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // dedup log: which opt-in prompt keys we've already shown each customer
        await query(`
      CREATE TABLE IF NOT EXISTS optin_prompt_log (
        id VARCHAR(64) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        phone VARCHAR(32) NOT NULL,
        promptKey VARCHAR(64) NOT NULL,
        sentAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_optin (userId, phone, promptKey)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // per-tenant monthly AI budget
        await query(`
      CREATE TABLE IF NOT EXISTS ai_budget (
        userId VARCHAR(255) PRIMARY KEY,
        monthlyBudgetUsd DECIMAL(10,2) DEFAULT 50.00,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // per-minute / per-hour outbound throttle counters
        await query(`
      CREATE TABLE IF NOT EXISTS outbound_throttle (
        id VARCHAR(64) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        phone VARCHAR(32),
        bucketStart VARCHAR(32) NOT NULL,
        dedupKey VARCHAR(255),
        occurredAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_throttle_tenant_bucket (userId, bucketStart),
        INDEX idx_throttle_recipient (userId, phone, bucketStart),
        UNIQUE KEY uk_throttle_dedup (userId, dedupKey)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // per-tenant outbound blocklist (separate from customer opt-out)
        await query(`
      CREATE TABLE IF NOT EXISTS outbound_blocklist (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        phone VARCHAR(32) NOT NULL,
        reason VARCHAR(128),
        source VARCHAR(64),
        expiresAt DATETIME,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_block_user_phone (userId, phone),
        INDEX idx_block_expires (expiresAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // inbound leads from contact forms / landing pages / scraped sources
        await query(`
      CREATE TABLE IF NOT EXISTS leads (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        name VARCHAR(255),
        phone VARCHAR(32),
        email VARCHAR(255),
        source VARCHAR(64),
        pageUrl VARCHAR(512),
        utmSource VARCHAR(128),
        utmCampaign VARCHAR(128),
        message TEXT,
        status VARCHAR(32) DEFAULT 'new',
        metadata JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_leads_user_status (userId, status, createdAt),
        INDEX idx_leads_phone (userId, phone)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // admin / operator tokens (rotation helper)
        await query(`
      CREATE TABLE IF NOT EXISTS admin_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        label VARCHAR(64) NOT NULL,
        tokenHash VARCHAR(128) NOT NULL,
        lastUsedAt TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        revokedAt TIMESTAMP NULL,
        UNIQUE KEY uk_admin_token (tokenHash)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // one row per fired alert, dedup-keyed by (userId, kind, windowKey)
        await query(`
      CREATE TABLE IF NOT EXISTS metric_alerts (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        kind VARCHAR(64) NOT NULL,
        windowKey VARCHAR(64) NOT NULL,
        metricValue DECIMAL(12,4) DEFAULT 0,
        previousValue DECIMAL(12,4) DEFAULT 0,
        deltaPct DECIMAL(8,4) DEFAULT 0,
        detail JSON,
        firedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_alert (userId, kind, windowKey)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        console.log('Database setup complete.');
        process.exit(0);
    } catch (error) {
        console.error('Database setup failed:', error);
        process.exit(1);
    }
}

setupDatabase();

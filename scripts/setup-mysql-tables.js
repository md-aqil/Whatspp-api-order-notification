import { query } from '../lib/mysql.js';

async function setupDatabase() {
    try {
        await query(`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL,
        title VARCHAR(255),
        content TEXT NOT NULL,
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
        whatsapp JSON,
        shopify JSON,
        stripe JSON,
        zoho JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE (userId)
      )
    `);

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

        console.log('Database setup complete.');
        process.exit(0);
    } catch (error) {
        console.error('Database setup failed:', error);
        process.exit(1);
    }
}

setupDatabase();

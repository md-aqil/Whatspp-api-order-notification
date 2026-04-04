-- MySQL Migration Script for WhatsApp Commerce Hub
-- Generated from PostgreSQL schema

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS whatsapp_api;
USE whatsapp_api;

-- Integrations table
CREATE TABLE IF NOT EXISTS integrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId VARCHAR(255) NOT NULL DEFAULT 'default',
  whatsapp JSON,
  shopify JSON,
  stripe JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(255) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL DEFAULT 'default',
  campaignId VARCHAR(255),
  recipient VARCHAR(255),
  phone VARCHAR(255),
  message TEXT,
  isCustomer BOOLEAN,
  timestamp TIMESTAMP NULL,
  whatsappMessageId VARCHAR(255),
  status VARCHAR(255),
  messageType VARCHAR(255),
  products JSON,
  template VARCHAR(255),
  orderId VARCHAR(255),
  sentAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chats table
CREATE TABLE IF NOT EXISTS chats (
  id VARCHAR(255) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL DEFAULT 'default',
  phone VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  lastMessage TEXT,
  timestamp TIMESTAMP NULL,
  unread INT DEFAULT 0,
  avatar TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(255) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL DEFAULT 'default',
  shopifyOrderId VARCHAR(255),
  orderNumber VARCHAR(255),
  customerName VARCHAR(255),
  customerEmail VARCHAR(255),
  customerPhone VARCHAR(255),
  total VARCHAR(255),
  currency VARCHAR(255),
  status VARCHAR(255),
  lineItems JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  whatsappSent BOOLEAN DEFAULT FALSE,
  whatsappMessageId VARCHAR(255),
  whatsappSentAt TIMESTAMP NULL
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id VARCHAR(255) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL DEFAULT 'default',
  name VARCHAR(255),
  template VARCHAR(255),
  templateLanguage VARCHAR(255),
  templateCategory VARCHAR(255),
  campaignType VARCHAR(255) DEFAULT 'template',
  productIds JSON,
  message TEXT,
  variables JSON,
  audience VARCHAR(255),
  recipients JSON,
  status VARCHAR(255),
  results JSON,
  sentAt TIMESTAMP NULL,
  failedAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Automations table
CREATE TABLE IF NOT EXISTS automations (
  id VARCHAR(255) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL DEFAULT 'default',
  name VARCHAR(255),
  status BOOLEAN DEFAULT FALSE,
  source VARCHAR(255),
  summary TEXT,
  steps JSON,
  metrics JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Automation jobs table
CREATE TABLE IF NOT EXISTS automation_jobs (
  id VARCHAR(255) PRIMARY KEY,
  automationId VARCHAR(255) NOT NULL,
  userId VARCHAR(255) NOT NULL DEFAULT 'default',
  recipient VARCHAR(255),
  message TEXT,
  template VARCHAR(255),
  payload JSON,
  status VARCHAR(255) DEFAULT 'pending',
  runAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processedAt TIMESTAMP NULL
);

-- Automation conversation state table
CREATE TABLE IF NOT EXISTS automation_conversation_state (
  id VARCHAR(255) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL DEFAULT 'default',
  automationId VARCHAR(255) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  state VARCHAR(255),
  lastInboundAt TIMESTAMP NULL,
  lastMenuSentAt TIMESTAMP NULL,
  lastReplyKey VARCHAR(255),
  lastReplyAt TIMESTAMP NULL,
  handoffUntil TIMESTAMP NULL,
  payload JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create index (MySQL doesn't support IF NOT EXISTS for indexes)
-- We'll handle this in the application code or use a stored procedure
CREATE INDEX automation_conversation_state_lookup_idx
ON automation_conversation_state (userId, automationId, recipient);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId VARCHAR(255) NOT NULL DEFAULT 'default',
  products JSON,
  lastSync TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId VARCHAR(255) NOT NULL DEFAULT 'default',
  type VARCHAR(255),
  webhooks JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Registered webhooks table
CREATE TABLE IF NOT EXISTS registered_webhooks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId VARCHAR(255) NOT NULL DEFAULT 'default',
  name VARCHAR(255) NOT NULL,
  target_url TEXT NOT NULL,
  event_types JSON,
  secret_key VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- WordPress connections table
CREATE TABLE IF NOT EXISTS wordpress_connections (
  id VARCHAR(255) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL DEFAULT 'default',
  site_id VARCHAR(255) NOT NULL,
  site_name VARCHAR(255),
  site_url TEXT NOT NULL,
  webhook_secret VARCHAR(255),
  status VARCHAR(255) NOT NULL DEFAULT 'pending',
  plugin_version VARCHAR(255),
  capabilities JSON,
  metadata JSON,
  lastSeenAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX wordpress_connections_user_site_id_idx
ON wordpress_connections (userId, site_id);

CREATE UNIQUE INDEX wordpress_connections_user_site_url_idx
ON wordpress_connections (userId, site_url(255));

-- Webhook logs table
CREATE TABLE IF NOT EXISTS webhook_logs (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(255),
  topic VARCHAR(255),
  payload JSON,
  receivedAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp config table
CREATE TABLE IF NOT EXISTS wa_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  config JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Cart recovery sessions table
CREATE TABLE IF NOT EXISTS cart_recovery_sessions (
  id VARCHAR(255) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL DEFAULT 'default',
  platform VARCHAR(255) NOT NULL,
  connection_id VARCHAR(255),
  site_id VARCHAR(255),
  external_cart_id VARCHAR(255) NOT NULL,
  checkout_token VARCHAR(255),
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(255),
  cart_total VARCHAR(255),
  currency VARCHAR(255),
  cart_item_count INT DEFAULT 0,
  line_items JSON,
  checkout_url TEXT,
  discount_code VARCHAR(255),
  discount_amount VARCHAR(255),
  status VARCHAR(255) NOT NULL DEFAULT 'active',
  recovered_order_id VARCHAR(255),
  metadata JSON,
  last_activity_at TIMESTAMP NULL,
  abandoned_at TIMESTAMP NULL,
  recovered_at TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX cart_recovery_sessions_user_platform_external_idx
ON cart_recovery_sessions (userId, platform, external_cart_id);

CREATE INDEX cart_recovery_sessions_user_status_abandoned_idx
ON cart_recovery_sessions (userId, status, abandoned_at);

CREATE INDEX cart_recovery_sessions_user_phone_idx
ON cart_recovery_sessions (userId, customer_phone);

-- Shopify customers table
CREATE TABLE IF NOT EXISTS shopify_customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customerId VARCHAR(255) NOT NULL,
  phone VARCHAR(255),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

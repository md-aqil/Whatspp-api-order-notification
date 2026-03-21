# WhatsApp Commerce Hub Dashboard

## Overview
The WhatsApp Commerce Hub now includes a dedicated dashboard with a separate layout that provides a more organized interface for managing your WhatsApp Business integration and customer communications.

## Features

### 1. Dashboard Layout
- Responsive sidebar navigation with mobile support
- Clean, modern interface with consistent styling
- Easy access to all major features

### 2. Chat System
- Real-time messaging interface with WhatsApp Business API integration
- Chat list showing all customer conversations
- Message history with timestamps
- Ability to send and receive messages directly from the dashboard
- Unread message indicators

### 3. Settings & Integrations
- Centralized configuration for all service integrations
- WhatsApp Business API setup
- Shopify store connection
- Stripe payment processing
- Webhook URL configuration with copy functionality

## Navigation

The dashboard includes a sidebar with the following sections:

1. **Dashboard** - Overview of key metrics and quick actions
2. **Chat** - WhatsApp messaging interface
3. **Orders** - Shopify order management
4. **Settings** - Integration configuration

## API Endpoints

The dashboard utilizes the following API endpoints:

### Chat Endpoints
- `GET /api/chats` - Retrieve all customer chats
- `GET /api/chats/{phone}/messages` - Retrieve messages for a specific chat
- `POST /api/send-whatsapp-message` - Send a WhatsApp message

### Integration Endpoints
- `GET /api/integrations` - Retrieve current integration status
- `POST /api/integrations` - Save integration configuration

## Database Tables

The dashboard uses the following PostgreSQL tables:

- `chats` - Customer chat sessions
- `messages` - Individual messages (both incoming and outgoing)
- `integrations` - Service integration credentials
- `orders` - Shopify order data
- `campaigns` - Marketing campaigns
- `webhooks` - Webhook configuration
- `webhook_logs` - Webhook event logs

## Setup Instructions

1. Start the development server: `npm run dev`
2. Navigate to the dashboard: http://localhost:3001/dashboard
3. Configure your integrations in the Settings section
4. Start chatting with customers in the Chat section

## WhatsApp Business API Integration

To enable full chat functionality:

1. Obtain your WhatsApp Business API credentials
2. Enter your Phone Number ID, Access Token, and Business Account ID in Settings
3. Configure the webhook URL in your WhatsApp Business account
4. Start receiving and sending messages through the dashboard

## Shopify Integration

To sync orders and products:

1. Obtain your Shopify API credentials
2. Enter your Shop Domain and Access Token in Settings
3. Configure the webhook URL in your Shopify admin panel
4. View and manage orders in the Orders section

## Stripe Integration

To process payments:

1. Obtain your Stripe API keys
2. Enter your Publishable Key and Secret Key in Settings
3. Use the integrated payment processing in your workflows

## Order Management

Order management has been moved to a dedicated Orders page to provide a more focused experience for managing your Shopify orders. The Orders page includes a comprehensive table view with real order data, including:

- Order ID and customer information
- Order date and status tracking
- Item counts and total amounts
- Visual status indicators
- Action buttons for order management

You can access the Orders page directly through the navigation sidebar.

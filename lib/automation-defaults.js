export const defaultAutomations = [
  {
    id: 'default-order-confirmation',
    name: 'Order Received',
    status: true,
    source: 'Shopify',
    summary: 'Send a friendly confirmation as soon as an order lands in Shopify.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-1', type: 'trigger', title: 'Order received', event: 'shopify.order_created', description: 'A new order is created in Shopify', position: { x: 120, y: 260 }, connections: { main: 'step-condition-1' } },
      { id: 'step-condition-1', type: 'condition', title: 'Filter orders', rule: 'financial_status != refunded', description: 'Skip refunded or test orders', position: { x: 460, y: 260 }, connections: { main: 'step-message-1' } },
      { id: 'step-message-1', type: 'message', title: 'Send confirmation', channel: 'whatsapp', template: 'hello_world', templateLanguage: 'en_US', message: 'Hello {{customer_name}}, thank you for choosing our store! ✨ Your order #{{order_number}} has been successfully placed. We\'re getting it ready for you and will share tracking as soon as it ships. 📦', position: { x: 820, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-tracking-update',
    name: 'Tracking Update',
    status: true,
    source: 'Shopify',
    summary: 'Deliver tracking details the moment fulfillment updates reach your store.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-2', type: 'trigger', title: 'Tracking ID available', event: 'shopify.fulfillment_created', description: 'A tracking number is attached to an order', position: { x: 120, y: 260 }, connections: { main: 'step-message-2' } },
      { id: 'step-message-2', type: 'message', title: 'Share tracking link', channel: 'whatsapp', template: 'hello_world', templateLanguage: 'en_US', message: 'Great news, {{customer_name}}! 🚚 Your order #{{order_number}} is now in transit. \n\nYou can track your package here: {{tracking_url}} \n\nWe can\'t wait for you to receive it! ✨', position: { x: 500, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-feedback-flow',
    name: 'Post-Delivery Feedback',
    status: false,
    source: 'Any CMS',
    summary: 'Wait until delivery is complete, then ask for feedback or a review.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-3', type: 'trigger', title: 'Order delivered', event: 'shopify.order_delivered', description: 'Delivery confirmation comes from Shopify or courier sync', position: { x: 120, y: 260 }, connections: { main: 'step-delay-3' } },
      { id: 'step-delay-3', type: 'delay', title: 'Wait before follow-up', delayValue: '3', delayUnit: 'days', description: 'Give the customer time to use the product', position: { x: 460, y: 260 }, connections: { main: 'step-message-3' } },
      { id: 'step-message-3', type: 'message', title: 'Ask for feedback', channel: 'whatsapp', template: 'hello_world', templateLanguage: 'en_US', message: 'Hi {{customer_name}}, we hope you\'re loving your recent purchase! 🌟 \n\nHow was your experience? Your feedback helps us improve. \n\nYou can leave a review here: {{review_link}} \n\nThank you for being part of our community!', position: { x: 820, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-whatsapp-reply',
    name: 'WhatsApp Auto Reply',
    status: false,
    source: 'WhatsApp',
    summary: 'Send an interactive menu of options when a customer messages you, and reply based on their choice.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-4', type: 'trigger', title: 'WhatsApp message received', event: 'whatsapp.message_received', description: 'A customer sends a WhatsApp message', position: { x: 120, y: 340 }, connections: { main: 'step-interactive-1' } },
      
      { id: 'step-interactive-1', type: 'interactive', title: 'Welcome Menu', message: 'Hello {{customer_name}}, welcome to our store! 👋 \n\nWe\'re here to provide you with a premium shopping experience. How can we assist you today? Please select an option below:', options: [{ id: 'opt0', label: '📦 Order Status' }, { id: 'opt1', label: '👗 Shop Collection' }, { id: 'opt2', label: '❓ Help & FAQs' }, { id: 'opt3', label: '💬 Talk to Specialist' }], position: { x: 460, y: 340 }, connections: { opt0: 'step-msg-ord', opt1: 'step-interactive-shop', opt2: 'step-interactive-faq', opt3: 'step-msg-sup' } },
      
      { id: 'step-msg-ord', type: 'message', title: 'Order Status Reply', channel: 'whatsapp', template: '', templateLanguage: '', message: 'I can certainly help with that! 📦 Please reply with your **Order ID** (e.g., #12345), and I\'ll provide a live status update immediately.', position: { x: 860, y: 160 }, connections: { main: '' } },
      { id: 'step-msg-sup', type: 'message', title: 'Support Transfer', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Absolutely. I\'m connecting you with a member of our specialist team right now. 👨‍💻 \n\nPlease stay tuned—they usually respond within a few minutes.', position: { x: 860, y: 720 }, connections: { main: '' } },
      
      { id: 'step-interactive-shop', type: 'interactive', title: 'Shop Categories', message: 'Great! Are you looking for men\'s, women\'s, or accessories today?', options: [{ id: 'opt0', label: '👚 Women\'s' }, { id: 'opt1', label: '👔 Men\'s' }, { id: 'opt2', label: '🎒 Accessories' }], position: { x: 860, y: 340 }, connections: { opt0: 'step-msg-womens', opt1: 'step-msg-mens', opt2: 'step-msg-acc' } },
      
      { id: 'step-interactive-faq', type: 'interactive', title: 'FAQ Menu', message: 'Sure! What do you need help with?', options: [{ id: 'opt0', label: '🔄 Returns Policy' }, { id: 'opt1', label: '🚚 Shipping Times' }, { id: 'opt2', label: '📍 Store Location' }], position: { x: 860, y: 520 }, connections: { opt0: 'step-msg-returns', opt1: 'step-msg-shipping', opt2: 'step-msg-loc' } },

      { id: 'step-msg-womens', type: 'message', title: 'Women\'s Collection', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Here is our latest women\'s collection: https://example.com/womens\n\nLet me know if you need help styling!', position: { x: 1260, y: 140 }, connections: { main: '' } },
      { id: 'step-msg-mens', type: 'message', title: 'Men\'s Collection', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Check out our newest men\'s arrivals here: https://example.com/mens\n\nAny specific items you\'re looking for?', position: { x: 1260, y: 280 }, connections: { main: '' } },
      { id: 'step-msg-acc', type: 'message', title: 'Accessories', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Browse our premium accessories selection here: https://example.com/accessories', position: { x: 1260, y: 420 }, connections: { main: '' } },

      { id: 'step-msg-returns', type: 'message', title: 'Returns Policy', channel: 'whatsapp', template: '', templateLanguage: '', message: 'We offer a hassle-free 30-day return policy on all unworn items with original tags attached! Let us know if you need a return label.', position: { x: 1260, y: 560 }, connections: { main: '' } },
      { id: 'step-msg-shipping', type: 'message', title: 'Shipping info', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Standard shipping takes 3-5 business days. Express shipping is delivered in 1-2 business days!', position: { x: 1260, y: 700 }, connections: { main: '' } },
      { id: 'step-msg-loc', type: 'message', title: 'Store Location', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Our flagship store is located at 123 Fashion Ave. We\'re open Monday-Saturday, 10 AM to 8 PM. Hope to see you there!', position: { x: 1260, y: 840 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-woocommerce-order',
    name: 'WooCommerce Order',
    status: false,
    source: 'WooCommerce',
    summary: 'Send a confirmation when an order is placed in WooCommerce.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-woo-1', type: 'trigger', title: 'WooCommerce Order', event: 'woocommerce.order_created', description: 'A new order is created in WooCommerce', position: { x: 120, y: 260 }, connections: { main: 'step-condition-woo-1' } },
      { id: 'step-condition-woo-1', type: 'condition', title: 'Filter orders', rule: 'financial_status != refunded', description: 'Skip refunded or test orders', position: { x: 460, y: 260 }, connections: { main: 'step-message-woo-1' } },
      { id: 'step-message-woo-1', type: 'message', title: 'Send confirmation', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Hello {{customer_name}}, thank you for your order #{{order_number}}! ✨ \n\nYour total is **{{currency}}{{order_total}}**. We\'ve received your order and will notify you as soon as it ships. 📦', position: { x: 820, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-send-whatsapp-lead-to-zoho',
    name: 'Send WhatsApp Lead to Zoho',
    status: false,
    source: 'Zoho',
    summary: 'Create or update a Zoho Lead from every qualified inbound WhatsApp conversation.',
    zohoFieldSummary: 'Create: Last Name, Company, WhatsApp Number, Lead Source, Lead Status, Bot Status, First Message At, Last Inbound Message At, Project Brief Summary, Chatflow Contact ID, Chatflow Conversation ID. Update: Last Inbound Message At, Human Handover Required, Service Interest - Primary, Budget Range, Timeline, Project Brief Summary.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-whatsapp-zoho-1', type: 'trigger', title: 'WhatsApp message received', event: 'whatsapp.message_received', description: 'A new inbound WhatsApp message is saved in ChatFlow', position: { x: 120, y: 260 }, connections: { main: 'step-condition-whatsapp-zoho-phone' } },
      { id: 'step-condition-whatsapp-zoho-phone', type: 'condition', title: 'Has WhatsApp number', rule: 'customer_phone != empty', description: 'Only sync contacts that include a WhatsApp phone number', position: { x: 460, y: 200 }, connections: { main: 'step-condition-whatsapp-zoho-message' } },
      { id: 'step-condition-whatsapp-zoho-message', type: 'condition', title: 'Has message content', rule: 'customer_message != empty', description: 'Only sync real inbound customer messages, not empty status callbacks', position: { x: 800, y: 200 }, connections: { main: 'step-zoho-upsert-lead-1' } },
      {
        id: 'step-zoho-upsert-lead-1',
        type: 'zoho_action',
        title: 'Create or update Zoho Lead',
        action: 'upsert_lead',
        description: 'Maps the WhatsApp lead and latest conversation fields into Zoho CRM',
        createFields: {
          Last_Name: '{{customer_name}}',
          Company: '{{company}}',
          WhatsApp_Number: '{{customer_phone}}',
          Phone: '{{customer_phone}}',
          Lead_Source: 'WhatsApp',
          Lead_Status: 'New',
          Bot_Status: 'Bot Active',
          First_Message_At: '{{first_message_at}}',
          Last_Inbound_Message_At: '{{last_inbound_message_at}}',
          Project_Brief_Summary: '{{project_brief_summary}}',
          Chatflow_Contact_ID: '{{chatflow_contact_id}}',
          Chatflow_Conversation_ID: '{{chatflow_conversation_id}}'
        },
        updateFields: {
          Last_Inbound_Message_At: '{{last_inbound_message_at}}',
          Human_Handover_Required: '{{human_handover_required}}',
          Service_Interest_Primary: '{{service_interest_primary}}',
          Budget_Range: '{{budget_range}}',
          Timeline: '{{timeline}}',
          Project_Brief_Summary: '{{project_brief_summary}}'
        },
        position: { x: 1140, y: 200 },
        connections: { main: 'step-msg-zoho-feedback' }
      },
      {
        id: 'step-msg-zoho-feedback',
        type: 'message',
        title: 'Lead CRM Feedback',
        channel: 'whatsapp',
        template: '',
        templateLanguage: '',
        message: 'Hello {{customer_name}}, your request has been successfully recorded in our CRM system! A representative will get back to you shortly. ✨',
        position: { x: 1480, y: 200 },
        connections: { main: '' }
      }
    ]
  },
  {
    id: 'default-sync-whatsapp-leads-to-sheets',
    name: 'Sync Inbound Leads to Google Sheets',
    status: false,
    source: 'Google Sheets',
    summary: 'Instantly append contact info, phone numbers, and WhatsApp messages into Google Sheets rows.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-whatsapp-sheets-1', type: 'trigger', title: 'WhatsApp message received', event: 'whatsapp.message_received', description: 'A new WhatsApp message is received from a customer', position: { x: 120, y: 260 }, connections: { main: 'step-condition-whatsapp-sheets-phone' } },
      { id: 'step-condition-whatsapp-sheets-phone', type: 'condition', title: 'Has WhatsApp number', rule: 'customer_phone != empty', description: 'Only export if the customer has a phone number', position: { x: 460, y: 260 }, connections: { main: 'step-sheets-export-1' } },
      {
        id: 'step-sheets-export-1',
        type: 'google_sheets_action',
        title: 'Append row to Google Sheets',
        description: 'Appends lead details dynamically to the configured spreadsheet tab',
        spreadsheetId: '',
        sheetName: 'Sheet1',
        position: { x: 800, y: 260 },
        connections: { main: 'step-msg-sheets-feedback' }
      },
      {
        id: 'step-msg-sheets-feedback',
        type: 'message',
        title: 'Lead Saved Notification',
        channel: 'whatsapp',
        template: '',
        templateLanguage: '',
        message: 'Hello {{customer_name}}, thank you! Your request has been successfully saved in our database. We will be in touch shortly. ✨',
        position: { x: 1140, y: 260 },
        connections: { main: '' }
      }
    ]
  },
  {
    id: 'default-shopify-cart-recovery',
    name: 'Shopify Cart Recovery',
    status: false,
    source: 'Shopify',
    summary: 'Recover abandoned Shopify carts with staged WhatsApp reminders.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-cart-shopify-1', type: 'trigger', title: 'Cart abandoned', event: 'shopify.cart_abandoned', description: 'Checkout has been inactive past the cart recovery threshold', position: { x: 120, y: 260 }, connections: { main: 'step-condition-cart-shopify-1' } },
      { id: 'step-condition-cart-shopify-1', type: 'condition', title: 'Has customer phone', rule: 'customer_phone != empty', description: 'Only send recovery when a phone number exists', position: { x: 460, y: 260 }, connections: { main: 'step-message-cart-shopify-1' } },
      { id: 'step-message-cart-shopify-1', type: 'message', title: 'Reminder 1', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Hi {{customer_name}}, we noticed you left something special in your cart! ✨ \n\nYour **{{cart_first_product}}** is waiting for you. You can complete your checkout here: {{checkout_url}}', position: { x: 820, y: 180 }, connections: { main: 'step-delay-cart-shopify-1' } },
      { id: 'step-delay-cart-shopify-1', type: 'delay', title: 'Wait 12 hours', delayValue: '12', delayUnit: 'hours', description: 'Pause before second reminder', position: { x: 1160, y: 180 }, connections: { main: 'step-condition-cart-shopify-2' } },
      { id: 'step-condition-cart-shopify-2', type: 'condition', title: 'Still abandoned', rule: 'status = abandoned', description: 'Skip if checkout already recovered', position: { x: 1500, y: 180 }, connections: { main: 'step-message-cart-shopify-2' } },
      { id: 'step-message-cart-shopify-2', type: 'message', title: 'Reminder 2', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Is your cart still calling your name, {{customer_name}}? 🤔 \n\nWe\'ve saved your **{{cart_item_count}} item(s)** for you. Resume your order now to ensure you don\'t miss out: {{checkout_url}}', position: { x: 1840, y: 120 }, connections: { main: 'step-delay-cart-shopify-2' } },
      { id: 'step-delay-cart-shopify-2', type: 'delay', title: 'Wait 24 hours', delayValue: '24', delayUnit: 'hours', description: 'Pause before final reminder', position: { x: 2180, y: 120 }, connections: { main: 'step-condition-cart-shopify-3' } },
      { id: 'step-condition-cart-shopify-3', type: 'condition', title: 'Still not recovered', rule: 'status = abandoned', description: 'Send final message only when cart remains abandoned', position: { x: 2520, y: 120 }, connections: { main: 'step-message-cart-shopify-3' } },
      { id: 'step-message-cart-shopify-3', type: 'message', title: 'Final reminder', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Final call, {{customer_name}}! 🕒 \n\nYour cart is about to expire. Use code **{{discount_code}}** at checkout for an exclusive reward: {{checkout_url}}', position: { x: 2860, y: 80 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-woocommerce-cart-recovery',
    name: 'WooCommerce Cart Recovery',
    status: false,
    source: 'WooCommerce',
    summary: 'Recover abandoned WooCommerce carts with timed WhatsApp nudges.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-cart-woo-1', type: 'trigger', title: 'Cart abandoned', event: 'woocommerce.cart_abandoned', description: 'WooCommerce cart stayed inactive and moved to abandoned state', position: { x: 120, y: 260 }, connections: { main: 'step-condition-cart-woo-1' } },
      { id: 'step-condition-cart-woo-1', type: 'condition', title: 'Has customer phone', rule: 'customer_phone != empty', description: 'Only send recovery when a phone number exists', position: { x: 460, y: 260 }, connections: { main: 'step-message-cart-woo-1' } },
      { id: 'step-message-cart-woo-1', type: 'message', title: 'Reminder 1', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Hello {{customer_name}}, we\'ve saved your cart for you! ✨ \n\nYou can resume your checkout and complete your purchase here: {{checkout_url}} \n\nLet us know if you have any questions!', position: { x: 820, y: 180 }, connections: { main: 'step-delay-cart-woo-1' } },
      { id: 'step-delay-cart-woo-1', type: 'delay', title: 'Wait 8 hours', delayValue: '8', delayUnit: 'hours', description: 'Pause before second reminder', position: { x: 1160, y: 180 }, connections: { main: 'step-condition-cart-woo-2' } },
      { id: 'step-condition-cart-woo-2', type: 'condition', title: 'Still abandoned', rule: 'status = abandoned', description: 'Skip follow-up if recovered', position: { x: 1500, y: 180 }, connections: { main: 'step-message-cart-woo-2' } },
      { id: 'step-message-cart-woo-2', type: 'message', title: 'Reminder 2', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Is your cart still waiting, {{customer_name}}? 🤔 \n\nYou still have **{{cart_item_count}} item(s)** ready for checkout. Complete your order now: {{checkout_url}}', position: { x: 1840, y: 120 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-custom-webhook',
    name: 'Custom Webhook',
    status: false,
    source: 'Custom',
    summary: 'Triggered by webhooks from WordPress, external APIs, or any custom source.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-custom-1', type: 'trigger', title: 'Custom Webhook', event: 'custom.webhook', description: 'Receives data from any webhook source', position: { x: 120, y: 260 }, connections: { main: 'step-condition-custom-1' } },
      { id: 'step-condition-custom-1', type: 'condition', title: 'Has phone number', rule: 'customer_phone != empty', description: 'Check if customer phone is available', position: { x: 460, y: 260 }, connections: { main: 'step-message-custom-1' } },
      { id: 'step-message-custom-1', type: 'message', title: 'Send notification', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Hello {{customer_name}}, thank you! ✨ Your order #{{order_number}} has been successfully confirmed for **{{currency}}{{order_total}}**. We appreciate your business!', position: { x: 820, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-zoho-lead-status-notification',
    name: 'Zoho Lead Status Notification',
    status: false,
    source: 'Zoho',
    summary: 'Receive a Zoho lead status change and notify the lead on WhatsApp with the current status.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-zoho-status-1', type: 'trigger', title: 'Status changed in Zoho', event: 'zoho.lead_updated', description: 'Zoho CRM sends a webhook when the lead status changes', position: { x: 120, y: 260 }, connections: { main: 'step-condition-zoho-status-1' } },
      { id: 'step-condition-zoho-status-1', type: 'condition', title: 'Has status and phone', rule: 'zoho_status != empty', description: 'Only notify when Zoho sends a readable lead status', position: { x: 460, y: 260 }, connections: { main: 'step-message-zoho-status-1' } },
      { id: 'step-message-zoho-status-1', type: 'message', title: 'Notify lead on WhatsApp', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Hi {{customer_name}}, your lead status in Zoho has been updated to: **{{zoho_status}}**. \n\nWe wanted to keep you in the loop! How can we help you further today?', position: { x: 820, y: 260 }, connections: { main: 'step-interactive-zoho-1' } },
      { id: 'step-interactive-zoho-1', type: 'interactive', title: 'Lead Options', message: 'Please select an option below to proceed:', options: [{ id: 'opt0', label: '📞 Request Call' }, { id: 'opt1', label: '📄 View Brochure' }, { id: 'opt2', label: '💬 Chat with Us' }], position: { x: 1180, y: 260 }, connections: { opt0: 'step-zoho-update-call', opt1: 'step-zoho-note-docs', opt2: 'step-zoho-note-chat' } },
      
      // Request Call Branch
      { id: 'step-zoho-update-call', type: 'zoho_action', title: 'Update Zoho: Contacted', action: 'update_status', status: 'Contacted', position: { x: 1540, y: 80 }, connections: { main: 'step-zoho-note-call' } },
      { id: 'step-zoho-note-call', type: 'zoho_action', title: 'Log Call Request', action: 'add_note', content: 'Customer requested a call via WhatsApp button interaction.', position: { x: 1900, y: 80 }, connections: { main: 'step-msg-zoho-call' } },
      { id: 'step-msg-zoho-call', type: 'message', title: 'Call Request Confirmed', channel: 'whatsapp', message: 'Understood! 📞 One of our account managers will give you a call on {{customer_phone}} shortly. Talk soon!', position: { x: 2260, y: 80 }, connections: { main: '' } },

      // View Brochure Branch
      { id: 'step-zoho-note-docs', type: 'zoho_action', title: 'Log Brochure View', action: 'add_note', content: 'Customer requested the brochure link via WhatsApp.', position: { x: 1540, y: 260 }, connections: { main: 'step-msg-zoho-docs' } },
      { id: 'step-msg-zoho-docs', type: 'message', title: 'Brochure Link', channel: 'whatsapp', message: 'Of course! 📄 You can view our latest service brochure here: https://example.com/brochure. Let us know if you have questions!', position: { x: 1900, y: 260 }, connections: { main: '' } },

      // Chat Branch
      { id: 'step-zoho-note-chat', type: 'zoho_action', title: 'Log Chat Handoff', action: 'add_note', content: 'Customer clicked "Chat with Us" in WhatsApp. Transferred to specialist.', position: { x: 1540, y: 440 }, connections: { main: 'step-msg-zoho-chat' } },
      { id: 'step-msg-zoho-chat', type: 'message', title: 'Chat Handoff', channel: 'whatsapp', message: 'Connecting you to our support team... 💬 A specialist will be with you in a moment!', position: { x: 1900, y: 440 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-ai-assistant',
    name: 'AI Smart Assistant',
    status: false,
    source: 'WhatsApp',
    summary: 'A high-end AI assistant that uses your Knowledge Base to answer customer questions, with a built-in safety fallback.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { 
        id: 'step-trigger-ai-1', 
        type: 'trigger', 
        title: 'WhatsApp message received', 
        event: 'whatsapp.message_received', 
        description: 'A customer sends a WhatsApp message', 
        position: { x: 120, y: 340 }, 
        connections: { main: 'step-ai-reply-1' } 
      },
      { 
        id: 'step-ai-reply-1', 
        type: 'ai_reply', 
        title: 'AI Smart Reply', 
        description: 'Generates a response using Gemini and your Knowledge Base',
        position: { x: 460, y: 340 }, 
        connections: { 
          main: '', 
          fallback: 'step-interactive-ai-fallback' 
        } 
      },
      { 
        id: 'step-interactive-ai-fallback', 
        type: 'interactive', 
        title: 'AI Help Fallback', 
        message: 'I\'m sorry, I\'m having trouble finding that information right now. 🤖\n\nHow would you like to proceed?', 
        options: [
          { id: 'opt0', label: '👨‍💻 Talk to Human' },
          { id: 'opt1', label: '🔄 Try Again' }
        ],
        position: { x: 860, y: 340 }, 
        connections: { 
          opt0: 'step-msg-ai-handoff',
          opt1: 'step-ai-reply-1'
        } 
      },
      { 
        id: 'step-msg-ai-handoff', 
        type: 'message', 
        title: 'Handoff Message', 
        channel: 'whatsapp', 
        message: 'I understand. I\'m connecting you with a member of our specialist team right now to ensure this is resolved for you. 👨‍💻 \n\nPlease stay tuned—they usually respond within a few minutes.', 
        position: { x: 1260, y: 340 }, 
        connections: { main: '' } 
      }
    ]
  },
  {
    id: 'default-event-reminder-sequence',
    name: 'Event Reminder Sequence',
    status: false,
    source: 'Custom',
    summary: 'A sophisticated multi-stage reminder flow for webinars, workshops, or product launches.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-ev-trigger', type: 'trigger', title: 'Event Subscribed', event: 'custom.event_subscription', description: 'Triggered when a user registers for an upcoming event', position: { x: 120, y: 260 }, connections: { main: 'step-ev-msg-confirm' } },
      
      { id: 'step-ev-msg-confirm', type: 'message', title: 'Registration Success', channel: 'whatsapp', message: 'Hello {{customer_name}}! 🎉 You are officially registered for **{{event_name}}**. \n\nWe\'ll send you reminders as we get closer to the date. Stay tuned!', position: { x: 460, y: 260 }, connections: { main: 'step-ev-delay-2d' } },
      
      { id: 'step-ev-delay-2d', type: 'delay', title: 'Wait for T-2 Days', delayValue: '2', delayUnit: 'days', description: 'Schedule 2-day reminder', position: { x: 820, y: 260 }, connections: { main: 'step-ev-msg-2d' } },
      { id: 'step-ev-msg-2d', type: 'message', title: '2-Day Reminder', channel: 'whatsapp', message: 'Hi {{customer_name}}! 📅 **{{event_name}}** is just 2 days away. \n\nGet ready for an amazing session! Do you have any questions before we start?', position: { x: 1180, y: 260 }, connections: { main: 'step-ev-delay-1d' } },
      
      { id: 'step-ev-delay-1d', type: 'delay', title: 'Wait for T-1 Day', delayValue: '1', delayUnit: 'days', description: 'Schedule 1-day reminder', position: { x: 1540, y: 260 }, connections: { main: 'step-ev-msg-1d' } },
      { id: 'step-ev-msg-1d', type: 'message', title: '1-Day Reminder', channel: 'whatsapp', message: 'Only 24 hours to go, {{customer_name}}! 🕒 We can\'t wait to see you at **{{event_name}}**. \n\nMake sure to add it to your calendar!', position: { x: 1900, y: 260 }, connections: { main: 'step-ev-delay-1h' } },
      
      { id: 'step-ev-delay-1h', type: 'delay', title: 'Wait for T-1 Hour', delayValue: '23', delayUnit: 'hours', description: 'Schedule 1-hour reminder', position: { x: 2260, y: 260 }, connections: { main: 'step-ev-msg-1h' } },
      { id: 'step-ev-msg-1h', type: 'message', title: '1-Hour Reminder', channel: 'whatsapp', message: 'Starting soon! 🚀 **{{event_name}}** begins in just 1 hour. \n\nGrab your coffee and get ready! Here is your access link: {{event_url}}', position: { x: 2620, y: 260 }, connections: { main: 'step-ev-delay-5m' } },
      
      { id: 'step-ev-delay-5m', type: 'delay', title: 'Wait for T-5 Min', delayValue: '55', delayUnit: 'minutes', description: 'Schedule 5-min reminder', position: { x: 2980, y: 260 }, connections: { main: 'step-ev-msg-5m' } },
      { id: 'step-ev-msg-5m', type: 'message', title: '5-Minute Reminder', channel: 'whatsapp', message: 'We\'re going live in 5 minutes! 🔔 Hop on now to catch the introduction: {{event_url}}', position: { x: 3340, y: 260 }, connections: { main: 'step-ev-delay-live' } },
      
      { id: 'step-ev-delay-live', type: 'delay', title: 'Wait for Start', delayValue: '5', delayUnit: 'minutes', description: 'Go live!', position: { x: 3700, y: 260 }, connections: { main: 'step-ev-msg-live' } },
      { id: 'step-ev-msg-live', type: 'message', title: 'Event is LIVE', channel: 'whatsapp', message: 'We are LIVE! 🔴 Join **{{event_name}}** right now: {{event_url}} \n\nDon\'t miss the opening!', position: { x: 4060, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-instagram-comment-growth',
    name: 'Instagram Comment-to-DM Growth Hack',
    status: true,
    source: 'Instagram',
    summary: 'Auto-reply to public comments matching key search words (e.g. "price", "link") and instantly deliver a private DM with lifestyle image, shop links, and PDF lookbook.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-ig-growth', type: 'trigger', title: 'Instagram Comment Created', event: 'instagram.comment_created', description: 'Triggered when a customer comments on any post', position: { x: 120, y: 260 }, connections: { main: 'step-cond-ig-growth' } },
      { id: 'step-cond-ig-growth', type: 'condition', title: 'Check Keywords', rule: 'commentText = "price" || commentText = "link" || commentText = "details" || commentText = "coupon"', description: 'Filters for high-intent purchasing keywords', position: { x: 460, y: 260 }, connections: { main: 'step-msg-ig-growth-reply' } },
      {
        id: 'step-msg-ig-growth-reply',
        type: 'message',
        title: 'Comment Reply & DM Delivery',
        channel: 'instagram',
        message: 'Here is your exclusive 15% discount code: **INSTA15** and our premium Spring/Summer digital lookbook! 🌸✨ Tap below to explore.',
        config: {
          commentReply: 'Hey @{{username}}! 🌟 Check your DMs — I just sent you our latest digital catalog and discount code directly! 📥✨',
          imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80',
          pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          linkUrl: 'https://vaclav.fashion/shop'
        },
        position: { x: 820, y: 260 },
        connections: { main: '' }
      }
    ]
  },
  {
    id: 'default-instagram-dm-interactive',
    name: 'Instagram Interactive FAQ Bot',
    status: false,
    source: 'Instagram',
    summary: 'A complete inbound DM responder that lets customers select interactive buttons (Coupon, Lookbook, Order Status) and replies automatically with rich vouchers and catalogs.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-ig-faq', type: 'trigger', title: 'Instagram DM Received', event: 'instagram.message_received', description: 'A customer sends a Direct Message to your Instagram Business account', position: { x: 120, y: 340 }, connections: { main: 'step-inter-ig-faq' } },
      { id: 'step-inter-ig-faq', type: 'interactive', title: 'Welcome Assistant', message: 'Hello @{{username}}! 👋 Welcome to our official support assistant. \n\nHow can we serve you today? Tap one of the buttons below to start:', options: [{ id: 'opt-coupon', label: '🎟️ Get Voucher' }, { id: 'opt-status', label: '📦 Order Status' }, { id: 'opt-catalog', label: '📋 View Lookbook' }], position: { x: 460, y: 340 }, connections: { 'opt-coupon': 'step-msg-ig-coupon', 'opt-status': 'step-msg-ig-status', 'opt-catalog': 'step-msg-ig-catalog' } },
      {
        id: 'step-msg-ig-coupon',
        type: 'message',
        title: 'Voucher Code Reply',
        channel: 'instagram',
        message: 'Here is your welcome code: WELCOME10 for 10% off your next purchase! 🎟️✨',
        config: {
          imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80',
          linkUrl: 'https://chatflow.vibeship.in'
        },
        position: { x: 860, y: 160 },
        connections: { main: '' }
      },
      { id: 'step-msg-ig-status', type: 'message', title: 'Order Status Prompt', channel: 'instagram', message: 'I can locate that for you! 📦 Please reply directly with your **Order Number** (e.g. #12456), and I will fetch its status instantly.', position: { x: 860, y: 340 }, connections: { main: '' } },
      {
        id: 'step-msg-ig-catalog',
        type: 'message',
        title: 'Digital Lookbook',
        channel: 'instagram',
        message: 'Here is our latest Spring/Summer digital lookbook catalog! 🌸✨ Discover our selected collection and get styled.',
        config: {
          imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
          pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          linkUrl: 'https://vaclav.fashion/shop'
        },
        position: { x: 860, y: 520 },
        connections: { main: '' }
      }
    ]
  },
  {
    id: 'default-instagram-story-brand-sync',
    name: 'Story Mention Sync to Zoho CRM',
    status: false,
    source: 'Instagram',
    summary: 'Detect brand mentions in user stories, trigger a Zoho CRM Lead creation, and reply with a thank-you voucher and full VIP catalog.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-ig-mention', type: 'trigger', title: 'Instagram Mention', event: 'instagram.message_received', description: 'Triggered when a customer mentions you in a story or message', position: { x: 120, y: 260 }, connections: { main: 'step-zoho-mention-lead' } },
      { 
        id: 'step-zoho-mention-lead', 
        type: 'zoho_action', 
        title: 'Create Zoho Lead', 
        action: 'upsert_lead', 
        description: 'Creates a hot lead in Zoho CRM tagged as "Instagram Story Mention"',
        createFields: {
          Last_Name: '{{username}}',
          Company: 'Instagram Contact',
          Lead_Source: 'Instagram Story Mention',
          Lead_Status: 'Hot Lead',
          Phone: '{{customer_phone}}'
        },
        updateFields: {
          Lead_Status: 'Hot Lead'
        },
        position: { x: 460, y: 260 }, 
        connections: { main: 'step-msg-ig-mention-thanks' } 
      },
      {
        id: 'step-msg-ig-mention-thanks',
        type: 'message',
        title: 'Send Thank You Coupon',
        channel: 'instagram',
        message: 'You are absolutely amazing, @{{username}}! 💖 \n\nThank you so much for the story mention. We love having you in our community! As a token of our appreciation, here is a $5 voucher to use on your next order: **STORY5** and our VIP lookbook! 🎁✨',
        config: {
          imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80',
          pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
        },
        position: { x: 820, y: 260 },
        connections: { main: '' }
      }
    ]
  }
]

const defaultAutomationIdOrder = new Map(defaultAutomations.map((automation, index) => [automation.id, index]))

export function sortAutomations(automations = []) {
  return automations
    .map((automation, index) => ({
      automation,
      index,
      sortIndex: defaultAutomationIdOrder.has(automation.id)
        ? defaultAutomationIdOrder.get(automation.id)
        : defaultAutomations.length + index
    }))
    .sort((left, right) => left.sortIndex - right.sortIndex)
    .map(({ automation }) => automation)
}

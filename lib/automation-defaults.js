export const defaultAutomations = [
  {
    id: 'default-shopify-cod-anti-rto',
    name: 'Shopify COD Anti-RTO Verification',
    status: false,
    source: 'Shopify',
    summary: 'Instantly verify Cash on Delivery orders with WhatsApp interactive Confirm/Cancel buttons to stop fake orders and reduce RTO.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-cod-1', type: 'trigger', title: 'New COD Order', event: 'shopify.order_created', description: 'Triggered when a new order is placed in Shopify', position: { x: 120, y: 260 }, connections: { main: 'step-condition-cod-1' } },
      { id: 'step-condition-cod-1', type: 'condition', title: 'Is Cash on Delivery', rule: 'financial_status = cod_pending', description: 'Filter only COD or pending payment orders', position: { x: 460, y: 260 }, connections: { main: 'step-interactive-cod-1' } },
      { id: 'step-interactive-cod-1', type: 'interactive', title: 'COD Confirmation Buttons', message: 'Hello {{customer_name}}, thank you for your COD order #{{order_number}} for {{currency}} {{order_total}}! 🛍️\n\nPlease confirm your delivery address by tapping below so we can process and dispatch your parcel immediately.', options: [{ id: 'opt_confirm', label: '✅ Confirm Order' }, { id: 'opt_cancel', label: '❌ Cancel Order' }], position: { x: 820, y: 260 }, connections: { opt_confirm: 'step-msg-cod-confirmed', opt_cancel: 'step-msg-cod-cancelled' } },
      { id: 'step-msg-cod-confirmed', type: 'message', title: 'Confirmation Reply', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: '🎉 Fantastic! Your order #{{order_number}} is verified and sent to fulfillment. We will notify you with tracking as soon as it ships! 🚚', position: { x: 1180, y: 160 }, connections: { main: '' } },
      { id: 'step-msg-cod-cancelled', type: 'message', title: 'Cancellation Reply', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: '❌ Your order #{{order_number}} has been cancelled. If you ever change your mind, we are here for you! ✨', position: { x: 1180, y: 360 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-order-confirmation',
    name: 'Order Received',
    status: false,
    source: 'Shopify',
    summary: 'Send a friendly confirmation as soon as an order lands in Shopify.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-1', type: 'trigger', title: 'Order received', event: 'shopify.order_created', description: 'A new order is created in Shopify', position: { x: 120, y: 260 }, connections: { main: 'step-condition-1' } },
      { id: 'step-condition-1', type: 'condition', title: 'Filter orders', rule: 'financial_status != refunded', description: 'Skip refunded or test orders', position: { x: 460, y: 260 }, connections: { main: 'step-message-1' } },
      { id: 'step-message-1', type: 'message', title: 'Send confirmation', channel: 'whatsapp', recipientMode: 'customer', template: 'hello_world', templateLanguage: 'en_US', message: 'Hello {{customer_name}}, thank you for choosing our store! ✨ Your order #{{order_number}} has been successfully placed. We\'re getting it ready for you and will share tracking as soon as it ships. 📦', position: { x: 820, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-tracking-update',
    name: 'Tracking Update',
    status: false,
    source: 'Shopify',
    summary: 'Deliver tracking details the moment fulfillment updates reach your store.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-2', type: 'trigger', title: 'Tracking ID available', event: 'shopify.fulfillment_created', description: 'A tracking number is attached to an order', position: { x: 120, y: 260 }, connections: { main: 'step-message-2' } },
      { id: 'step-message-2', type: 'message', title: 'Share tracking link', channel: 'whatsapp', recipientMode: 'customer', template: 'hello_world', templateLanguage: 'en_US', message: 'Great news, {{customer_name}}! 🚚 Your order #{{order_number}} is now in transit. \n\nYou can track your package here: {{tracking_url}} \n\nWe can\'t wait for you to receive it! ✨', position: { x: 500, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-feedback-flow',
    name: 'Instant Order Feedback (Judge.me)',
    status: false,
    source: 'Shopify',
    summary: 'Instantly ask for Judge.me reviews or feedback as soon as Shopify delivery is confirmed.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-3', type: 'trigger', title: 'Order delivered', event: 'shopify.order_delivered', description: 'Triggered instantly when delivery is confirmed in Shopify', position: { x: 140, y: 260 }, connections: { main: 'step-message-3' } },
      { id: 'step-message-3', type: 'message', title: 'Ask for Judge.me Review', channel: 'whatsapp', recipientMode: 'customer', template: 'hello_world', templateLanguage: 'en_US', message: 'Hi {{customer_name}}, your order #{{order_number}} ({{order_product_name}}) has just been delivered! 📦✨\n\nHow was your experience with us? We\'d love your feedback!\n\n⭐ Leave a quick review on Judge.me: {{review_link}}\n\nThank you for choosing Vaclav! 🙏', position: { x: 560, y: 260 }, connections: { main: '' } }
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
      { id: 'step-trigger-4', type: 'trigger', title: 'WhatsApp message received', event: 'whatsapp.message_received', description: 'A customer sends a WhatsApp message', position: { x: 120, y: 440 }, connections: { main: 'step-interactive-1' } },
      
      { id: 'step-interactive-1', type: 'interactive', title: 'Welcome Menu', message: 'Hello {{customer_name}}, welcome to our store! 👋 \n\nWe\'re here to provide you with a premium shopping experience. How can we assist you today? Please select an option below:', options: [{ id: 'opt0', label: '📦 Order Status' }, { id: 'opt1', label: '👗 Shop Collection' }, { id: 'opt2', label: '❓ Help & FAQs' }, { id: 'opt3', label: '💬 Talk to Specialist' }], position: { x: 460, y: 440 }, connections: { opt0: 'step-interactive-order', opt1: 'step-interactive-shop', opt2: 'step-interactive-faq', opt3: 'step-msg-sup' } },
      
      { id: 'step-interactive-order', type: 'interactive', title: 'Order Tracking Menu', message: 'I can certainly help track your package! 📦 How would you like to proceed?', options: [{ id: 'opt0', label: '🔍 Check Latest Order' }, { id: 'opt1', label: '🔢 Enter Order ID' }], position: { x: 860, y: 160 }, connections: { opt0: 'step-msg-latest-order', opt1: 'step-msg-search-order' } },
      
      { id: 'step-msg-latest-order', type: 'message', title: 'Live Order Details', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: '📦 *Live Order Details*\n\n📋 *Order:* #{{order_number}}\n💰 *Total:* {{currency}} {{order_total}}\n🚚 *Status:* {{financial_status}}\n\nWe will notify you with live courier tracking as soon as it ships! 🚀\n\n✨ *Tip:* To check another order, reply with your **#OrderNumber** anytime!', position: { x: 1260, y: 80 }, connections: { main: '' } },
      { id: 'step-msg-search-order', type: 'message', title: 'Search by Order ID', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: '🔍 *Search Specific Order*\n\nPlease reply with your **Order ID** (e.g. #1042 or 1042), and our live system will look up the status immediately! ✨', position: { x: 1260, y: 220 }, connections: { main: '' } },
      
      { id: 'step-msg-sup', type: 'message', title: 'Support Transfer', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Absolutely. I\'m connecting you with a member of our specialist team right now. 👨‍💻 \n\nPlease stay tuned—they usually respond within a few minutes.', position: { x: 860, y: 920 }, connections: { main: '' } },
      
      { id: 'step-interactive-shop', type: 'interactive', title: 'Shop Categories', message: 'Great! Are you looking for men\'s, women\'s, or accessories today?', options: [{ id: 'opt0', label: '👚 Women\'s' }, { id: 'opt1', label: '👔 Men\'s' }, { id: 'opt2', label: '🎒 Accessories' }], position: { x: 860, y: 380 }, connections: { opt0: 'step-msg-womens', opt1: 'step-msg-mens', opt2: 'step-msg-acc' } },
      
      { id: 'step-interactive-faq', type: 'interactive', title: 'FAQ Menu', message: 'Sure! What do you need help with?', options: [{ id: 'opt0', label: '🔄 Returns Policy' }, { id: 'opt1', label: '🚚 Shipping Times' }, { id: 'opt2', label: '📍 Store Location' }], position: { x: 860, y: 640 }, connections: { opt0: 'step-msg-returns', opt1: 'step-msg-shipping', opt2: 'step-msg-loc' } },
      
      { id: 'step-msg-womens', type: 'message', title: 'Women\'s Collection', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Here is our latest women\'s collection: https://example.com/womens\n\nLet me know if you need help styling!', position: { x: 1260, y: 360 }, connections: { main: '' } },
      { id: 'step-msg-mens', type: 'message', title: 'Men\'s Collection', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Check out our newest men\'s arrivals here: https://example.com/mens\n\nAny specific items you\'re looking for?', position: { x: 1260, y: 480 }, connections: { main: '' } },
      { id: 'step-msg-acc', type: 'message', title: 'Accessories', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Browse our premium accessories selection here: https://example.com/accessories', position: { x: 1260, y: 600 }, connections: { main: '' } },
      
      { id: 'step-msg-returns', type: 'message', title: 'Returns Policy', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'We offer a hassle-free 30-day return policy on all unworn items with original tags attached! Let us know if you need a return label.', position: { x: 1260, y: 720 }, connections: { main: '' } },
      { id: 'step-msg-shipping', type: 'message', title: 'Shipping info', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Standard shipping takes 3-5 business days. Express shipping is delivered in 1-2 business days!', position: { x: 1260, y: 840 }, connections: { main: '' } },
      { id: 'step-msg-loc', type: 'message', title: 'Store Location', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Our flagship store is located at 123 Fashion Ave. We\'re open Monday-Saturday, 10 AM to 8 PM. Hope to see you there!', position: { x: 1260, y: 960 }, connections: { main: '' } }
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
      { id: 'step-message-woo-1', type: 'message', title: 'Send confirmation', channel: 'whatsapp', recipientMode: 'customer', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Hello {{customer_name}}, thank you for your order #{{order_number}}! ✨ \n\nYour total is **{{currency}}{{order_total}}**. We\'ve received your order and will notify you as soon as it ships. 📦', position: { x: 820, y: 260 }, connections: { main: '' } }
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
        channel: 'whatsapp', recipientMode: 'customer',
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
        channel: 'whatsapp', recipientMode: 'customer',
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
      { id: 'step-message-cart-shopify-1', type: 'message', title: 'Reminder 1', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Hi {{customer_name}}, we noticed you left something special in your cart! ✨ \n\nYour **{{cart_first_product}}** is waiting for you. You can complete your checkout here: {{checkout_url}}', position: { x: 820, y: 180 }, connections: { main: 'step-delay-cart-shopify-1' } },
      { id: 'step-delay-cart-shopify-1', type: 'delay', title: 'Wait 12 hours', delayValue: '12', delayUnit: 'hours', description: 'Pause before second reminder', position: { x: 1160, y: 180 }, connections: { main: 'step-condition-cart-shopify-2' } },
      { id: 'step-condition-cart-shopify-2', type: 'condition', title: 'Still abandoned', rule: 'status = abandoned', description: 'Skip if checkout already recovered', position: { x: 1500, y: 180 }, connections: { main: 'step-message-cart-shopify-2' } },
      { id: 'step-message-cart-shopify-2', type: 'message', title: 'Reminder 2', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Is your cart still calling your name, {{customer_name}}? 🤔 \n\nWe\'ve saved your **{{cart_item_count}} item(s)** for you. Resume your order now to ensure you don\'t miss out: {{checkout_url}}', position: { x: 1840, y: 120 }, connections: { main: 'step-delay-cart-shopify-2' } },
      { id: 'step-delay-cart-shopify-2', type: 'delay', title: 'Wait 24 hours', delayValue: '24', delayUnit: 'hours', description: 'Pause before final reminder', position: { x: 2180, y: 120 }, connections: { main: 'step-condition-cart-shopify-3' } },
      { id: 'step-condition-cart-shopify-3', type: 'condition', title: 'Still not recovered', rule: 'status = abandoned', description: 'Send final message only when cart remains abandoned', position: { x: 2520, y: 120 }, connections: { main: 'step-shopify-discount-cart' } },
      {
        id: 'step-shopify-discount-cart',
        type: 'shopify_discount',
        title: 'Mint single-use 15% coupon',
        config: { valueType: 'percentage', value: 15, usageLimit: 1, prefix: 'COMEBACK', ttlDays: 7 },
        position: { x: 2860, y: 120 },
        connections: { main: 'step-message-cart-shopify-3' }
      },
      { id: 'step-message-cart-shopify-3', type: 'message', title: 'Final reminder', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Final call, {{customer_name}}! 🕒 \n\nYour cart is about to expire. Use code **{{discount_code}}** at checkout for an exclusive 15% reward: {{checkout_url}}', position: { x: 3200, y: 80 }, connections: { main: '' } }
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
      { id: 'step-message-cart-woo-1', type: 'message', title: 'Reminder 1', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Hello {{customer_name}}, we\'ve saved your cart for you! ✨ \n\nYou can resume your checkout and complete your purchase here: {{checkout_url}} \n\nLet us know if you have any questions!', position: { x: 820, y: 180 }, connections: { main: 'step-delay-cart-woo-1' } },
      { id: 'step-delay-cart-woo-1', type: 'delay', title: 'Wait 8 hours', delayValue: '8', delayUnit: 'hours', description: 'Pause before second reminder', position: { x: 1160, y: 180 }, connections: { main: 'step-condition-cart-woo-2' } },
      { id: 'step-condition-cart-woo-2', type: 'condition', title: 'Still abandoned', rule: 'status = abandoned', description: 'Skip follow-up if recovered', position: { x: 1500, y: 180 }, connections: { main: 'step-message-cart-woo-2' } },
      { id: 'step-message-cart-woo-2', type: 'message', title: 'Reminder 2', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Is your cart still waiting, {{customer_name}}? 🤔 \n\nYou still have **{{cart_item_count}} item(s)** ready for checkout. Complete your order now: {{checkout_url}}', position: { x: 1840, y: 120 }, connections: { main: '' } }
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
      { id: 'step-message-custom-1', type: 'message', title: 'Send notification', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Hello {{customer_name}}, thank you! ✨ Your order #{{order_number}} has been successfully confirmed for **{{currency}}{{order_total}}**. We appreciate your business!', position: { x: 820, y: 260 }, connections: { main: '' } }
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
      { id: 'step-message-zoho-status-1', type: 'message', title: 'Notify lead on WhatsApp', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Hi {{customer_name}}, your lead status in Zoho has been updated to: **{{zoho_status}}**. \n\nWe wanted to keep you in the loop! How can we help you further today?', position: { x: 820, y: 260 }, connections: { main: 'step-interactive-zoho-1' } },
      { id: 'step-interactive-zoho-1', type: 'interactive', title: 'Lead Options', message: 'Please select an option below to proceed:', options: [{ id: 'opt0', label: '📞 Request Call' }, { id: 'opt1', label: '📄 View Brochure' }, { id: 'opt2', label: '💬 Chat with Us' }], position: { x: 1180, y: 260 }, connections: { opt0: 'step-zoho-update-call', opt1: 'step-zoho-note-docs', opt2: 'step-zoho-note-chat' } },
      
      // Request Call Branch
      { id: 'step-zoho-update-call', type: 'zoho_action', title: 'Update Zoho: Contacted', action: 'update_status', status: 'Contacted', position: { x: 1540, y: 80 }, connections: { main: 'step-zoho-note-call' } },
      { id: 'step-zoho-note-call', type: 'zoho_action', title: 'Log Call Request', action: 'add_note', content: 'Customer requested a call via WhatsApp button interaction.', position: { x: 1900, y: 80 }, connections: { main: 'step-msg-zoho-call' } },
      { id: 'step-msg-zoho-call', type: 'message', title: 'Call Request Confirmed', channel: 'whatsapp', recipientMode: 'customer', message: 'Understood! 📞 One of our account managers will give you a call on {{customer_phone}} shortly. Talk soon!', position: { x: 2260, y: 80 }, connections: { main: '' } },

      // View Brochure Branch
      { id: 'step-zoho-note-docs', type: 'zoho_action', title: 'Log Brochure View', action: 'add_note', content: 'Customer requested the brochure link via WhatsApp.', position: { x: 1540, y: 260 }, connections: { main: 'step-msg-zoho-docs' } },
      { id: 'step-msg-zoho-docs', type: 'message', title: 'Brochure Link', channel: 'whatsapp', recipientMode: 'customer', message: 'Of course! 📄 You can view our latest service brochure here: https://example.com/brochure. Let us know if you have questions!', position: { x: 1900, y: 260 }, connections: { main: '' } },

      // Chat Branch
      { id: 'step-zoho-note-chat', type: 'zoho_action', title: 'Log Chat Handoff', action: 'add_note', content: 'Customer clicked "Chat with Us" in WhatsApp. Transferred to specialist.', position: { x: 1540, y: 440 }, connections: { main: 'step-msg-zoho-chat' } },
      { id: 'step-msg-zoho-chat', type: 'message', title: 'Chat Handoff', channel: 'whatsapp', recipientMode: 'customer', message: 'Connecting you to our support team... 💬 A specialist will be with you in a moment!', position: { x: 1900, y: 440 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-ai-assistant',
    name: 'AI Smart Assistant (Multimodal)',
    status: false,
    source: 'WhatsApp',
    summary: 'A high-end AI assistant that uses your Knowledge Base to answer text/image/voice questions, with a built-in safety fallback.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      {
        id: 'step-trigger-ai-1',
        type: 'trigger',
        title: 'WhatsApp message received',
        event: 'whatsapp.message_received',
        description: 'A customer sends a WhatsApp message (text, image, or voice)',
        position: { x: 120, y: 340 },
        connections: { main: 'step-ai-reply-1' }
      },
      {
        id: 'step-ai-reply-1',
        type: 'ai_reply',
        title: 'AI Smart Reply (vision + voice)',
        description: 'Generates a response using Gemini. Auto-detects images and voice notes.',
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
        channel: 'whatsapp', recipientMode: 'customer', 
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
      
      { id: 'step-ev-msg-confirm', type: 'message', title: 'Registration Success', channel: 'whatsapp', recipientMode: 'customer', message: 'Hello {{customer_name}}! 🎉 You are officially registered for **{{event_name}}**. \n\nWe\'ll send you reminders as we get closer to the date. Stay tuned!', position: { x: 460, y: 260 }, connections: { main: 'step-ev-delay-2d' } },
      
      { id: 'step-ev-delay-2d', type: 'delay', title: 'Wait for T-2 Days', delayValue: '2', delayUnit: 'days', description: 'Schedule 2-day reminder', position: { x: 820, y: 260 }, connections: { main: 'step-ev-msg-2d' } },
      { id: 'step-ev-msg-2d', type: 'message', title: '2-Day Reminder', channel: 'whatsapp', recipientMode: 'customer', message: 'Hi {{customer_name}}! 📅 **{{event_name}}** is just 2 days away. \n\nGet ready for an amazing session! Do you have any questions before we start?', position: { x: 1180, y: 260 }, connections: { main: 'step-ev-delay-1d' } },
      
      { id: 'step-ev-delay-1d', type: 'delay', title: 'Wait for T-1 Day', delayValue: '1', delayUnit: 'days', description: 'Schedule 1-day reminder', position: { x: 1540, y: 260 }, connections: { main: 'step-ev-msg-1d' } },
      { id: 'step-ev-msg-1d', type: 'message', title: '1-Day Reminder', channel: 'whatsapp', recipientMode: 'customer', message: 'Only 24 hours to go, {{customer_name}}! 🕒 We can\'t wait to see you at **{{event_name}}**. \n\nMake sure to add it to your calendar!', position: { x: 1900, y: 260 }, connections: { main: 'step-ev-delay-1h' } },
      
      { id: 'step-ev-delay-1h', type: 'delay', title: 'Wait for T-1 Hour', delayValue: '23', delayUnit: 'hours', description: 'Schedule 1-hour reminder', position: { x: 2260, y: 260 }, connections: { main: 'step-ev-msg-1h' } },
      { id: 'step-ev-msg-1h', type: 'message', title: '1-Hour Reminder', channel: 'whatsapp', recipientMode: 'customer', message: 'Starting soon! 🚀 **{{event_name}}** begins in just 1 hour. \n\nGrab your coffee and get ready! Here is your access link: {{event_url}}', position: { x: 2620, y: 260 }, connections: { main: 'step-ev-delay-5m' } },
      
      { id: 'step-ev-delay-5m', type: 'delay', title: 'Wait for T-5 Min', delayValue: '55', delayUnit: 'minutes', description: 'Schedule 5-min reminder', position: { x: 2980, y: 260 }, connections: { main: 'step-ev-msg-5m' } },
      { id: 'step-ev-msg-5m', type: 'message', title: '5-Minute Reminder', channel: 'whatsapp', recipientMode: 'customer', message: 'We\'re going live in 5 minutes! 🔔 Hop on now to catch the introduction: {{event_url}}', position: { x: 3340, y: 260 }, connections: { main: 'step-ev-delay-live' } },
      
      { id: 'step-ev-delay-live', type: 'delay', title: 'Wait for Start', delayValue: '5', delayUnit: 'minutes', description: 'Go live!', position: { x: 3700, y: 260 }, connections: { main: 'step-ev-msg-live' } },
      { id: 'step-ev-msg-live', type: 'message', title: 'Event is LIVE', channel: 'whatsapp', recipientMode: 'customer', message: 'We are LIVE! 🔴 Join **{{event_name}}** right now: {{event_url}} \n\nDon\'t miss the opening!', position: { x: 4060, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-instagram-comment-growth',
    name: 'Instagram Comment-to-DM Growth Hack',
    status: false,
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
    name: 'Instagram Story Mention Sync to Zoho CRM',
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
  },
  {
    id: 'default-shopify-reorder-reminder',
    name: 'Shopify Reorder Reminder',
    status: false,
    source: 'Shopify',
    summary: 'When a consumable product hits its reorder window, ping the customer on WhatsApp with a one-tap reorder link.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-reorder-1', type: 'trigger', title: 'Reorder due', event: 'shopify.reorder_due', description: 'Triggered by /api/reorder/sweep when a customer is eligible to reorder a tracked consumable', position: { x: 120, y: 260 }, connections: { main: 'step-cond-reorder-1' } },
      { id: 'step-cond-reorder-1', type: 'condition', title: 'Has product', rule: 'product_title != empty', description: 'Skip if product metadata is missing', position: { x: 460, y: 260 }, connections: { main: 'step-discount-reorder-1' } },
      {
        id: 'step-discount-reorder-1',
        type: 'shopify_discount',
        title: 'Mint 10% reorder coupon',
        config: { valueType: 'percentage', value: 10, usageLimit: 1, prefix: 'REORDER', ttlDays: 14 },
        position: { x: 800, y: 260 },
        connections: { main: 'step-msg-reorder-1' }
      },
      { id: 'step-msg-reorder-1', type: 'message', title: 'Reorder Reminder', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Hi {{customer_name}}! 🛒\n\nIt has been about {{reorder_days}} days since your last **{{product_title}}**. Time to restock? ✨\n\nUse code **{{discount_code}}** for 10% off and reorder here: https://example.com/products/{{product_handle}}\n\nReply *STOP* to opt out of reorder reminders.', position: { x: 1140, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-shopify-cart-recovery-pay',
    name: 'Shopify Cart Recovery + WhatsApp Pay',
    status: false,
    source: 'Shopify',
    summary: 'High-converting 3-stage cart recovery that mints a single-use coupon and, when WhatsApp Pay is enabled in the country, attaches a one-tap payment button.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-cart-pay-1', type: 'trigger', title: 'Cart abandoned', event: 'shopify.cart_abandoned', description: 'Checkout has been inactive past the cart recovery threshold', position: { x: 120, y: 260 }, connections: { main: 'step-cond-cart-pay-phone' } },
      { id: 'step-cond-cart-pay-phone', type: 'condition', title: 'Has customer phone', rule: 'customer_phone != empty', description: 'Only send recovery when a phone number exists', position: { x: 460, y: 260 }, connections: { main: 'step-msg-cart-pay-r1' } },
      { id: 'step-msg-cart-pay-r1', type: 'message', title: 'Reminder 1', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Hi {{customer_name}}, you left **{{cart_first_product}}** in your cart! ✨\n\nResume checkout: {{checkout_url}}', position: { x: 820, y: 260 }, connections: { main: 'step-delay-cart-pay-1' } },
      { id: 'step-delay-cart-pay-1', type: 'delay', title: 'Wait 12 hours', delayValue: '12', delayUnit: 'hours', description: 'Pause before second reminder', position: { x: 1180, y: 260 }, connections: { main: 'step-msg-cart-pay-r2' } },
      { id: 'step-msg-cart-pay-r2', type: 'message', title: 'Reminder 2', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Still thinking about it, {{customer_name}}? 🤔\n\nWe saved your **{{cart_item_count}} item(s)**: {{checkout_url}}', position: { x: 1540, y: 260 }, connections: { main: 'step-delay-cart-pay-2' } },
      { id: 'step-delay-cart-pay-2', type: 'delay', title: 'Wait 24 hours', delayValue: '24', delayUnit: 'hours', description: 'Pause before final reminder', position: { x: 1900, y: 260 }, connections: { main: 'step-discount-cart-pay' } },
      {
        id: 'step-discount-cart-pay',
        type: 'shopify_discount',
        title: 'Mint 15% single-use coupon',
        config: { valueType: 'percentage', value: 15, usageLimit: 1, prefix: 'COMEBACK', ttlDays: 7 },
        position: { x: 2260, y: 260 },
        connections: { main: 'step-msg-cart-pay-r3' }
      },
      {
        id: 'step-msg-cart-pay-r3',
        type: 'message',
        title: 'Final reminder with code',
        channel: 'whatsapp',
        recipientMode: 'customer',
        template: '',
        templateLanguage: '',
        message: 'Final call, {{customer_name}}! 🕒\n\nYour cart is about to expire. Use code **{{discount_code}}** for an exclusive 15% reward: {{checkout_url}}\n\n🇮🇳 If you are in India, you can complete payment right here in WhatsApp — just tap *Pay* below!',
        position: { x: 2620, y: 260 },
        connections: { main: '' }
      }
    ]
  },
  {
    id: 'default-whatsapp-shop-menu',
    status: false,
    source: 'WhatsApp',
    summary: 'When a customer asks "menu", "shop" or "products", send a Meta Multi-Product interactive list linking to your live Shopify catalog.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-shop-1', type: 'trigger', title: 'Customer asks for shop', event: 'whatsapp.message_received', config: { keywords: 'menu,shop,products,catalog,browse,collection' }, description: 'Triggered when the customer asks for the menu, shop, products or catalog', position: { x: 120, y: 260 }, connections: { main: 'step-cond-shop-1' } },
      { id: 'step-cond-shop-1', type: 'condition', title: 'Has phone', rule: 'customer_phone != empty', description: 'Skip if we have no way to reply', position: { x: 460, y: 260 }, connections: { main: 'step-product-list-shop-1' } },
      {
        id: 'step-product-list-shop-1',
        type: 'product_list',
        title: 'Send Shop Catalog',
        message: 'Hi {{customer_name}}! ✨ Here is our latest collection. Tap any item to view it on the website.',
        config: {
          headerText: '🛍️ Shop the Collection',
          footerText: 'Reply STOP to opt out',
          sectionTitle: 'Featured',
          limit: 10
        },
        position: { x: 820, y: 260 },
        connections: { main: 'step-msg-shop-followup' }
      },
      { id: 'step-msg-shop-followup', type: 'message', title: 'Catalog Follow-Up', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: '💬 Need help choosing? Reply *STYLE* and our stylist will help you pick the perfect piece!', position: { x: 1180, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-whatsapp-product-carousel',
    name: 'WhatsApp Single Product Carousel',
    status: false,
    source: 'Shopify',
    summary: 'Send a 1-10 card carousel featuring up to 10 products with images and "View" buttons. Requires a Meta Commerce catalog linked in Shopify integration.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-carousel-1', type: 'trigger', title: 'New arrival', event: 'shopify.product_created', description: 'Triggered when a new product is added to Shopify', position: { x: 120, y: 260 }, connections: { main: 'step-product-carousel-1' } },
      {
        id: 'step-product-carousel-1',
        type: 'product_carousel',
        title: 'New Arrivals Carousel',
        message: '🚀 Just dropped! Tap any item to view the full product page.',
        config: {
          headerText: '✨ New Arrivals',
          footerText: 'Fresh in store',
          limit: 10
        },
        position: { x: 460, y: 260 },
        connections: { main: '' }
      }
    ]
  },
  {
    id: 'default-post-delivery-csat',
    name: 'Post-Delivery CSAT Rating',
    status: false,
    source: 'Shopify',
    summary: 'Ask the customer for a 1-5 star rating after delivery and branch into a recovery flow on a negative rating.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-csat-1', type: 'trigger', title: 'Order delivered', event: 'shopify.order_delivered', description: 'Triggered instantly when Shopify confirms delivery', position: { x: 120, y: 260 }, connections: { main: 'step-interactive-csat-1' } },
      { id: 'step-interactive-csat-1', type: 'interactive', title: 'CSAT Rating', message: 'Hi {{customer_name}}! 📦 How was your order #{{order_number}}?\n\nTap a star rating below:', options: [{ id: 'score_5', label: '⭐⭐⭐⭐⭐' }, { id: 'score_4', label: '⭐⭐⭐⭐' }, { id: 'score_3', label: '⭐⭐⭐' }, { id: 'score_2', label: '⭐⭐' }, { id: 'score_1', label: '⭐' }], position: { x: 460, y: 260 }, connections: { score_5: 'step-record-csat-1', score_4: 'step-record-csat-1', score_3: 'step-record-csat-1', score_2: 'step-record-csat-1', score_1: 'step-record-csat-1' } },
      { id: 'step-record-csat-1', type: 'record_feedback', title: 'Save CSAT score', config: { feedbackType: 'csat' }, position: { x: 820, y: 260 }, connections: { main: 'step-cond-csat-positive' } },
      { id: 'step-cond-csat-positive', type: 'condition', title: 'Is rating 4 or 5?', rule: 'feedback_is_positive == true', description: 'Positive ratings skip the recovery flow', position: { x: 1180, y: 260 }, connections: { main: 'step-msg-csat-thanks' } },
      { id: 'step-msg-csat-thanks', type: 'message', title: 'Thanks', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Thank you so much for your feedback! 🙏 We appreciate you being part of our community.', position: { x: 1540, y: 160 }, connections: { main: '' } },
      { id: 'step-msg-csat-recover', type: 'message', title: 'Recovery Reply', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'We are sorry to hear that. 😔 We will personally follow up to make this right. Reply *HELP* and our team will jump in immediately.', position: { x: 1540, y: 360 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-csat-locale-ab',
    name: 'Post-Delivery CSAT (Locale A/B)',
    status: false,
    source: 'Shopify',
    summary: 'Asks for a 1-5 star CSAT. The phrasing of the question is A/B-tested by the customer\'s preferred language (Hindi vs English) using ab_split.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-csat-ab-1', type: 'trigger', title: 'Order delivered', event: 'shopify.order_delivered', description: 'Triggered on delivery confirmation', position: { x: 120, y: 260 }, connections: { main: 'step-locale-1' } },
      { id: 'step-locale-1', type: 'language_detect', title: 'Detect language', config: { fallback: 'en' }, position: { x: 380, y: 260 }, connections: { main: 'step-ab-1' } },
      { id: 'step-ab-1', type: 'ab_split', title: 'Phrase variant', config: { experimentKey: 'csat_locale_v1', variants: ['english_question', 'hindi_question', 'emoji_first'], weights: [1, 1, 1] }, position: { x: 660, y: 260 }, connections: { main: 'step-interactive-csat-ab-1' } },
      { id: 'step-interactive-csat-ab-1', type: 'interactive', title: 'CSAT Rating', message: '{% if _ab_variant == "hindi_question" %}नमस्ते {{customer_name}}! 📦 ऑर्डर #{{order_number}} कैसा रहा?\n\nनीचे स्टार रेटिंग चुनें:{% else if _ab_variant == "emoji_first" %}⭐ How was order #{{order_number}}, {{customer_name}}?\n\nTap a rating:{% else %}Hi {{customer_name}}! 📦 How was your order #{{order_number}}?\n\nTap a star rating below:{% endif %}', options: [{ id: 'score_5', label: '⭐⭐⭐⭐⭐' }, { id: 'score_4', label: '⭐⭐⭐⭐' }, { id: 'score_3', label: '⭐⭐⭐' }, { id: 'score_2', label: '⭐⭐' }, { id: 'score_1', label: '⭐' }], position: { x: 940, y: 260 }, connections: { score_5: 'step-record-csat-ab-1', score_4: 'step-record-csat-ab-1', score_3: 'step-record-csat-ab-1', score_2: 'step-record-csat-ab-1', score_1: 'step-record-csat-ab-1' } },
      { id: 'step-record-csat-ab-1', type: 'record_feedback', title: 'Save CSAT score', config: { feedbackType: 'csat' }, position: { x: 1300, y: 260 }, connections: { main: 'step-msg-csat-thanks-ab' } },
      { id: 'step-msg-csat-thanks-ab', type: 'message', title: 'Thanks', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: '{% if _ab_variant == "hindi_question" %}आपके फीडबैक के लिए धन्यवाद! 🙏{% else %}Thank you so much for your feedback! 🙏{% endif %}', position: { x: 1620, y: 160 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-customer-win-back-60',
    name: 'Win-Back Lapsed Customer (60 days)',
    status: false,
    source: 'Custom',
    summary: 'Re-engage a customer who has not ordered in 60+ days. Triggered by /api/customer/sweep.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-winback-1', type: 'trigger', title: '60+ days lapsed', event: 'customer.win_back', description: 'Fired by /api/customer/sweep when a customer has not ordered in 60 days', position: { x: 120, y: 260 }, connections: { main: 'step-discount-winback-1' } },
      {
        id: 'step-discount-winback-1',
        type: 'shopify_discount',
        title: 'Mint 15% comeback coupon',
        config: { valueType: 'percentage', value: 15, usageLimit: 1, prefix: 'MISSYOU', ttlDays: 21 },
        position: { x: 460, y: 260 },
        connections: { main: 'step-msg-winback-1' }
      },
      { id: 'step-msg-winback-1', type: 'message', title: 'Win-Back Message', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Hi {{customer_name}}! 💜\n\nIt has been a while since your last order ({{customer_total_orders}} so far — thank you!). Here is **{{discount_code}}** for 15% off your next order: https://example.com/shop\n\nReply *STOP* to opt out.', position: { x: 820, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-customer-birthday',
    name: 'Birthday Coupon',
    status: false,
    source: 'Custom',
    summary: 'Send a personal birthday coupon on the customer\'s birthday. Requires DOB in customer_segments.birthday.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-bday-1', type: 'trigger', title: 'Birthday today', event: 'customer.birthday', description: 'Fired by /api/customer/sweep for customers whose birthday is today', position: { x: 120, y: 260 }, connections: { main: 'step-discount-bday-1' } },
      {
        id: 'step-discount-bday-1',
        type: 'shopify_discount',
        title: 'Mint 20% birthday coupon',
        config: { valueType: 'percentage', value: 20, usageLimit: 1, prefix: 'BDAY', ttlDays: 14 },
        position: { x: 460, y: 260 },
        connections: { main: 'step-msg-bday-1' }
      },
      { id: 'step-msg-bday-1', type: 'message', title: 'Happy Birthday', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: '🎂 Happy Birthday, {{customer_name}}!\n\nAs a small gift, here is **{{discount_code}}** for 20% off your next order. Valid for the next 14 days. Enjoy your day! 🎉', position: { x: 820, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-loyalty-tier-upgrade',
    name: 'Loyalty Tier Upgrade Alert',
    status: false,
    source: 'Custom',
    summary: 'Celebrate when a customer\'s lifetime spend crosses a tier threshold (silver/gold/platinum). Fired by /api/customer/sweep.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-tier-1', type: 'trigger', title: 'Tier upgrade', event: 'customer.tier_upgrade', description: 'Fired when lifetime spend crosses a tier threshold', position: { x: 120, y: 260 }, connections: { main: 'step-discount-tier-1' } },
      {
        id: 'step-discount-tier-1',
        type: 'shopify_discount',
        title: 'Mint tier-locked coupon',
        config: { valueType: 'percentage', value: 25, usageLimit: 1, prefix: 'VIP', ttlDays: 30 },
        position: { x: 460, y: 260 },
        connections: { main: 'step-msg-tier-1' }
      },
      { id: 'step-msg-tier-1', type: 'message', title: 'VIP Welcome', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: '🎉 Welcome to the *{{customer_tier}}* club, {{customer_name}}!\n\nAs a thank you for your loyalty, here is **{{discount_code}}** for 25% off your next order. Valid for 30 days.', position: { x: 820, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-ab-order-confirmation',
    name: 'A/B Test Order Confirmation',
    status: false,
    source: 'Shopify',
    summary: 'Splits each new order into 3 sticky variants (control / emoji-heavy / minimal) so you can compare open rates.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-ab-1', type: 'trigger', title: 'New prepaid order', event: 'shopify.order_created', description: 'Triggered on every prepaid Shopify order', position: { x: 120, y: 260 }, connections: { main: 'step-ab-split-1' } },
      {
        id: 'step-ab-split-1',
        type: 'ab_split',
        title: 'Split into 3 variants',
        config: { experimentKey: 'order_confirmation_v1', variants: ['control', 'emoji', 'minimal'], weights: [40, 30, 30] },
        position: { x: 460, y: 260 },
        connections: { control: 'step-msg-ab-control', emoji: 'step-msg-ab-emoji', minimal: 'step-msg-ab-minimal' }
      },
      { id: 'step-msg-ab-control', type: 'message', title: 'Control Variant', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Thanks {{customer_name}}! Your order #{{order_number}} is confirmed for {{currency}} {{order_total}}. We will share tracking soon.', position: { x: 820, y: 80 }, connections: { main: '' } },
      { id: 'step-msg-ab-emoji', type: 'message', title: 'Emoji Variant', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: '🎉✨ Woohoo {{customer_name}}! Order #{{order_number}} ({{currency}} {{order_total}}) is locked in 🚀. Tracking coming soon! 💌', position: { x: 820, y: 200 }, connections: { main: '' } },
      { id: 'step-msg-ab-minimal', type: 'message', title: 'Minimal Variant', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Order received: #{{order_number}}. Total {{currency}} {{order_total}}.', position: { x: 820, y: 320 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-refer-a-friend',
    name: 'Refer-a-Friend Program',
    status: false,
    source: 'WhatsApp',
    summary: 'When a customer asks for "refer" or "invite", mint a unique referral code and share it. Successful referee orders trigger a thank-you coupon for both.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-ref-1', type: 'trigger', title: 'Refer request', event: 'whatsapp.message_received', config: { keywords: 'refer,invite,share,friend' }, description: 'Triggered when the customer asks about referring', position: { x: 120, y: 260 }, connections: { main: 'step-assign-ref-1' } },
      {
        id: 'step-assign-ref-1',
        type: 'assign_referral',
        title: 'Mint referral code',
        config: { prefix: 'VACLAV' },
        position: { x: 460, y: 260 },
        connections: { main: 'step-discount-ref-1' }
      },
      {
        id: 'step-discount-ref-1',
        type: 'shopify_discount',
        title: 'Mint 20% referee coupon',
        config: { valueType: 'percentage', value: 20, usageLimit: 1, prefix: 'FRIEND', ttlDays: 30 },
        position: { x: 820, y: 260 },
        connections: { main: 'step-msg-ref-1' }
      },
      { id: 'step-msg-ref-1', type: 'message', title: 'Referral Invitation', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: '🤝 Love our products? Share them with friends!\n\nYour code: **{{referral_code}}**\nYour friend gets **{{discount_code}}** (20% off).\nYou get a reward every time they buy! 🎁\n\n👉 https://example.com?ref={{referral_code}}', position: { x: 1180, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-referral-reward',
    name: 'Referral Reward Issued',
    status: false,
    source: 'Custom',
    summary: 'Sent to the referrer when one of their friends completes a paying order. Mints a 15% thank-you coupon.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-ref-conversion-1', type: 'trigger', title: 'Referral conversion', event: 'referral.conversion', description: 'Triggered when a referred friend places a paying order', position: { x: 120, y: 260 }, connections: { main: 'step-discount-ref-reward' } },
      {
        id: 'step-discount-ref-reward',
        type: 'shopify_discount',
        title: 'Mint 15% reward coupon',
        config: { valueType: 'percentage', value: 15, usageLimit: 1, prefix: 'THANKS', ttlDays: 30 },
        position: { x: 460, y: 260 },
        connections: { main: 'step-msg-ref-reward' }
      },
      { id: 'step-msg-ref-reward', type: 'message', title: 'Reward Message', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: '🎉 A friend just placed their first order using your code *{{referral_code}}*!\n\nHere is a thank-you: **{{discount_code}}** for 15% off your next order.', position: { x: 820, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-post-delivery-returns',
    name: 'Returns & Exchange Self-Service',
    status: false,
    source: 'Shopify',
    summary: 'Two days after delivery, give the customer a button menu to exchange, take store credit (gift card), or refund in cash.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-return-1', type: 'trigger', title: 'Order delivered', event: 'shopify.order_delivered', description: 'Fired 2 days after delivery (delay step), then offers self-service returns', position: { x: 120, y: 260 }, connections: { main: 'step-delay-return-1' } },
      { id: 'step-delay-return-1', type: 'delay', title: 'Wait 2 days', delayValue: '2', delayUnit: 'days', description: 'Let the customer enjoy the product before offering returns', position: { x: 460, y: 260 }, connections: { main: 'step-interactive-return-1' } },
      { id: 'step-interactive-return-1', type: 'interactive', title: 'Returns Menu', message: 'Hi {{customer_name}}, hope you love order #{{order_number}}! 💜\n\nIf something is not right, tap below:', options: [{ id: 'opt_exchange', label: '🔄 Exchange' }, { id: 'opt_credit', label: '🎁 Store Credit' }, { id: 'opt_refund', label: '💵 Refund' }], position: { x: 820, y: 260 }, connections: { opt_exchange: 'step-msg-return-exchange', opt_credit: 'step-gc-return-credit', opt_refund: 'step-msg-return-refund' } },
      { id: 'step-msg-return-exchange', type: 'message', title: 'Exchange Reply', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Of course! Reply with the item you would like instead (size/color). Our team will confirm availability within 1 business day. 🔄', position: { x: 1180, y: 80 }, connections: { main: '' } },
      {
        id: 'step-gc-return-credit',
        type: 'shopify_gift_card',
        title: 'Issue store credit gift card',
        config: { initialValue: 10, currency: 'INR' },
        position: { x: 1180, y: 260 },
        connections: { main: 'step-msg-return-credit' }
      },
      { id: 'step-msg-return-credit', type: 'message', title: 'Store Credit Issued', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: '🎁 Your store-credit code is *{{gift_card_code}}* (balance {{gift_card_balance}}). It never expires and can be used on any order!', position: { x: 1540, y: 260 }, connections: { main: '' } },
      {
        id: 'step-msg-return-refund',
        type: 'message',
        title: 'Refund Notice',
        channel: 'whatsapp',
        recipientMode: 'customer',
        template: '',
        templateLanguage: '',
        message: 'Understood. Please reply *REFUND* to confirm and our team will process it within 2 business days. The amount will be returned to your original payment method. 💵',
        position: { x: 1180, y: 440 },
        connections: { main: '' }
      }
    ]
  },
  {
    id: 'default-first-order-spin',
    name: 'Spin-the-Wheel First-Order Reward',
    status: false,
    source: 'Shopify',
    summary: 'On the first order, offer a randomized reward tier (60% small, 30% medium, 9% large, 1% jackpot) and mint a single-use coupon.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-spin-1', type: 'trigger', title: 'First order', event: 'shopify.order_created', description: 'Triggered on every order (filter by first-order externally)', position: { x: 120, y: 260 }, connections: { main: 'step-spin-1' } },
      {
        id: 'step-spin-1',
        type: 'spin_wheel',
        title: 'Spin & mint coupon',
        config: {
          tiers: [
            { id: 'small', weight: 60, valueType: 'percentage', value: 5, prefix: 'WHEEL5' },
            { id: 'medium', weight: 30, valueType: 'percentage', value: 10, prefix: 'WHEEL10' },
            { id: 'large', weight: 9, valueType: 'percentage', value: 20, prefix: 'WHEEL20' },
            { id: 'jackpot', weight: 1, valueType: 'fixed_amount', value: 25, prefix: 'JACKPOT' }
          ]
        },
        position: { x: 460, y: 260 },
        connections: { main: 'step-msg-spin-1' }
      },
      { id: 'step-msg-spin-1', type: 'message', title: 'Spin Result', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: '🎰 You spun the wheel and won *{{spin_tier_label}}*!\n\nHere is your reward code: **{{discount_code}}** (valid for 14 days). Thanks for being a new customer! 🎉', position: { x: 820, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-delivery-exception',
    name: 'Delivery Exception Reschedule',
    status: false,
    source: 'Shopify',
    summary: 'Proactively alert the customer and offer to reschedule when a shipment hits an exception (failure/returned/address error).',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-exc-1', type: 'trigger', title: 'Delivery exception', event: 'shopify.delivery_exception', description: 'Fired when a Shopify fulfillment moves to failure / exception / returned / address_error', position: { x: 120, y: 260 }, connections: { main: 'step-msg-exc-1' } },
      { id: 'step-msg-exc-1', type: 'message', title: 'Exception Alert', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: '⚠️ Heads up, {{customer_name}}! We hit a snag delivering order #{{order_number}} ({{delivery_status}}).\n\nWe want to get this to you ASAP. How would you like to proceed?', position: { x: 460, y: 260 }, connections: { main: 'step-interactive-exc-1' } },
      { id: 'step-interactive-exc-1', type: 'interactive', title: 'Reschedule Menu', message: 'Choose an option:', options: [{ id: 'opt_resched', label: '📅 Reschedule' }, { id: 'opt_address', label: '✏️ Update Address' }, { id: 'opt_cancel', label: '❌ Cancel Order' }], position: { x: 820, y: 260 }, connections: { opt_resched: 'step-msg-exc-resched', opt_address: 'step-msg-exc-address', opt_cancel: 'step-msg-exc-cancel' } },
      { id: 'step-msg-exc-resched', type: 'message', title: 'Reschedule Reply', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'No problem! Reply with a preferred delivery date and we will re-attempt dispatch on that day. 📦', position: { x: 1180, y: 80 }, connections: { main: '' } },
      { id: 'step-msg-exc-address', type: 'message', title: 'Address Update', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Please share your full new address (with PIN code) and we will update it within 1 business day. ✏️', position: { x: 1180, y: 260 }, connections: { main: '' } },
      { id: 'step-msg-exc-cancel', type: 'message', title: 'Cancel Reply', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Understood. We will cancel and process a full refund within 2 business days. Reply *CONFIRM* to proceed. ❌', position: { x: 1180, y: 440 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-back-in-stock',
    name: 'Back-in-Stock Notification',
    status: false,
    source: 'Shopify',
    summary: 'When a product a customer subscribed to comes back in stock, ping them with a one-tap purchase link.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-bis-1', type: 'trigger', title: 'Back in stock', event: 'shopify.back_in_stock', description: 'Fired when an inventory_level flips from 0 → > 0 and there is a waiting subscriber', position: { x: 120, y: 260 }, connections: { main: 'step-msg-bis-1' } },
      { id: 'step-msg-bis-1', type: 'message', title: 'Back-in-Stock Alert', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: '🎉 Good news, {{customer_name}}! **{{product_title}}** is back in stock.\n\nGrab it before it sells out: https://example.com/products/{{product_handle}}', position: { x: 460, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-wishlist-add',
    name: 'Wishlist Save-for-Later',
    status: false,
    source: 'WhatsApp',
    summary: 'When a customer asks to "save" a product, persist it to their wishlist and offer restock + discount alerts.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-wl-1', type: 'trigger', title: 'Save request', event: 'whatsapp.message_received', config: { keywords: 'save,wishlist,favorite,bookmark' }, description: 'Triggered when a customer asks to save a product', position: { x: 120, y: 260 }, connections: { main: 'step-wl-add-1' } },
      { id: 'step-wl-add-1', type: 'add_to_wishlist', title: 'Add to wishlist', config: { notifyOnDiscount: true, notifyOnRestock: true }, position: { x: 460, y: 260 }, connections: { main: 'step-msg-wl-1' } },
      { id: 'step-msg-wl-1', type: 'message', title: 'Wishlist Confirmation', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: '✅ Added **{{product_title}}** to your wishlist!\n\nWe will ping you when it is back in stock or goes on sale. Reply *WISHLIST* anytime to see your saved items. 💜', position: { x: 820, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-channel-new-arrival',
    name: 'Channel Post: New Arrival',
    status: false,
    source: 'Shopify',
    summary: 'Publish a new WhatsApp Channel post whenever a product is added to the catalog. Requires WHATSAPP_CHANNEL_ID env or channelId in integration.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-ch-1', type: 'trigger', title: 'New product', event: 'shopify.product_created', description: 'Fired when a new product is added to Shopify', position: { x: 120, y: 260 }, connections: { main: 'step-channel-post-1' } },
      { id: 'step-channel-post-1', type: 'channel_post', title: 'Publish channel post', message: '✨ Just dropped: {{product_title}}\n\nhttps://example.com/products/{{product_handle}}', config: { postType: 'text' }, position: { x: 460, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-after-hours',
    name: 'After-Hours Auto-Reply',
    status: false,
    source: 'WhatsApp',
    summary: 'When a customer messages outside business hours, send a polite auto-reply and queue a follow-up for the next open window.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-ah-1', type: 'trigger', title: 'Inbound message', event: 'whatsapp.message_received', description: 'Any inbound WhatsApp message', position: { x: 120, y: 260 }, connections: { main: 'step-bh-check-1' } },
      { id: 'step-bh-check-1', type: 'business_hours', title: 'Check business hours', config: { timezone: 'Asia/Kolkata', hours: { mon: ['09:00-18:00'], tue: ['09:00-18:00'], wed: ['09:00-18:00'], thu: ['09:00-18:00'], fri: ['09:00-18:00'], sat: ['10:00-14:00'] } }, position: { x: 460, y: 260 }, connections: { main: 'step-msg-ah-skip' } },
      { id: 'step-msg-ah-skip', type: 'message', title: 'Live now', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: '✅ A specialist is online now and will reply shortly. (No action needed for after-hours flow.)', position: { x: 820, y: 100 }, connections: { main: '' } },
      { id: 'step-msg-ah-reply', type: 'message', title: 'After-Hours Reply', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: '🌙 Thanks for messaging! We are currently outside business hours, but we will reply first thing when we are back. For urgent queries please email support@example.com.', position: { x: 820, y: 380 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-vip-tier-upgrade',
    name: 'VIP Tier-Upgrade Reward',
    status: false,
    source: 'Customer Profile',
    summary: 'When a customer crosses the gold/platinum threshold, mint a tier-aware single-use coupon (silver 5%, gold 10% + free shipping, platinum 15% + free shipping + free gift).',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-vip-1', type: 'trigger', title: 'Tier upgrade', event: 'customer.tier_upgrade', description: 'Fired when a customer moves up to silver/gold/platinum', position: { x: 120, y: 260 }, connections: { main: 'step-vip-1' } },
      { id: 'step-vip-1', type: 'vip_perk', title: 'Mint tier perk', config: { durationDays: 30 }, position: { x: 460, y: 260 }, connections: { main: 'step-msg-vip-1' } },
      { id: 'step-msg-vip-1', type: 'message', title: 'VIP Congratulations', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: '💎 You have been promoted to **{{vip_tier}}** status! Your reward code: **{{vip_code}}** (single-use, 30 days).', position: { x: 820, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-inactivity-product-highlight',
    name: 'Inactivity Featured Product',
    status: false,
    source: 'Customer Profile',
    summary: 'After 30 days of silence, recommend a top-selling product the customer has not yet purchased (uses /api/products/top-sellers).',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-inact-1', type: 'trigger', title: 'Customer silent', event: 'customer.silence', config: { days: 30 }, description: 'Fired by /api/customer/silence-sweep', position: { x: 120, y: 260 }, connections: { main: 'step-singleprod-1' } },
      { id: 'step-singleprod-1', type: 'single_product', title: 'Send top product', config: { source: 'top_seller', enablePay: false }, position: { x: 460, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-clv-milestone',
    name: 'AOV / CLV Milestone Alert',
    status: false,
    source: 'Customer Profile',
    summary: 'When monthly spend crosses a threshold (₹10k / $200 etc.), notify the customer and add a loyalty bonus tag.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-clv-1', type: 'trigger', title: 'CLV milestone', event: 'customer.clv_milestone', description: 'Fired when a customer crosses a lifetime-spend threshold', position: { x: 120, y: 260 }, connections: { main: 'step-tag-clv-1' } },
      { id: 'step-tag-clv-1', type: 'tag_audience', title: 'Tag as VIP', config: { audience: { name: 'clv-milestone', rules: [{ field: 'lifetimeTier', op: 'in', value: ['gold', 'platinum'] }] } }, position: { x: 460, y: 260 }, connections: { main: 'step-msg-clv-1' } },
      { id: 'step-msg-clv-1', type: 'message', title: 'Milestone Celebration', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: '🎉 Wow, {{customer_name}}! You just crossed ₹10,000 lifetime with us. As a thank-you, a surprise is heading to your inbox next week. 🛍️', position: { x: 820, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-double-optin',
    name: 'Double Opt-In Confirmation',
    status: false,
    source: 'WhatsApp',
    summary: 'When a customer replies YES/START to an opt-in prompt, record the confirmation in customer_segments and route them into the welcome flow.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-optin-1', type: 'trigger', title: 'Opt-in reply', event: 'whatsapp.message_received', config: { keywords: 'yes,start,confirm,subscribe' }, description: 'Triggered when the customer replies with a confirmation keyword', position: { x: 120, y: 260 }, connections: { main: 'step-optin-1' } },
      { id: 'step-optin-1', type: 'opt_in', title: 'Record opt-in', config: { source: 'double_optin_yes_reply' }, position: { x: 460, y: 260 }, connections: { main: 'step-tag-optin-1' } },
      { id: 'step-tag-optin-1', type: 'tag_audience', title: 'Tag as opted-in', config: { audience: { name: 'opted_in', rules: [{ field: 'lifetimeTier', op: 'exists', value: true }] } }, position: { x: 820, y: 260 }, connections: { main: 'step-msg-optin-1' } },
      { id: 'step-msg-optin-1', type: 'message', title: 'Welcome', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: '✅ You are subscribed! Reply *STOP* anytime to opt out. We will only send you the good stuff — order updates, restock alerts, and the occasional exclusive offer. 🛍️', position: { x: 1180, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-reorder-followup',
    name: 'Reorder Nudge (7-day Follow-Up)',
    status: false,
    source: 'Shopify',
    summary: 'Sends a gentle follow-up 7 days after the first reorder reminder if the customer has not yet purchased. Caps at one follow-up per cycle.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-rof-1', type: 'trigger', title: '7d since reorder nudge', event: 'shopify.reorder_due', config: { followUpDays: 7 }, description: 'Triggered on the original shopify.reorder_due event but defers actual send to T+7d via the engine scheduler', position: { x: 120, y: 260 }, connections: { main: 'step-msg-rof-1' } },
      { id: 'step-msg-rof-1', type: 'message', title: 'Gentle Reminder', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Hi {{customer_name}} 👋 Just a gentle nudge — your **{{product_title}}** is running low. Tap to restock: https://example.com/products/{{product_handle}} (no pressure, only when you need it).', position: { x: 460, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-csat-regression-followup',
    name: 'CSAT Follow-Up (Regression Triggered)',
    status: false,
    source: 'Customer Profile',
    summary: 'When the cart-recovery weekly revenue drops >20% WoW, fire this CSAT flow to recent recovered customers to gather qualitative feedback.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-csatr-1', type: 'trigger', title: 'Regression detected', event: 'customer.csat_followup', description: 'Fired by /api/cron/regression-check when cart-recovery revenue drops WoW', position: { x: 120, y: 260 }, connections: { main: 'step-msg-csatr-1' } },
      { id: 'step-msg-csatr-1', type: 'message', title: 'CSAT Ping', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Hi {{customer_name}} 👋 — quick one: how was your last order? Reply with a number 1-5 (5 = loved it). It really helps us improve 🙏', position: { x: 460, y: 260 }, connections: { main: 'step-record-csatr-1' } },
      { id: 'step-record-csatr-1', type: 'record_feedback', title: 'Save CSAT', config: { feedbackType: 'csat_regression' }, position: { x: 820, y: 260 }, connections: { main: '' } }
    ]
  },
  {
    id: 'default-lead-welcome',
    name: 'New-Lead Welcome (Contact Form)',
    status: false,
    source: 'Custom',
    summary: 'Triggered by /api/leads/ingest when a new lead is captured. Sends a welcome WhatsApp + tags the lead for follow-up.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-lead-1', type: 'trigger', title: 'Lead created', event: 'lead.created', description: 'Fired by /api/leads/ingest when a new lead is captured', position: { x: 120, y: 260 }, connections: { main: 'step-optin-lead-1' } },
      { id: 'step-optin-lead-1', type: 'opt_in', title: 'Record opt-in (lead form consent)', config: { source: 'contact_form_consent' }, position: { x: 380, y: 260 }, connections: { main: 'step-msg-lead-1' } },
      { id: 'step-msg-lead-1', type: 'message', title: 'Welcome', channel: 'whatsapp', recipientMode: 'customer', template: '', templateLanguage: '', message: 'Hi {{customer_name}} 👋 Thanks for reaching out! We will be in touch within 1 business day. Reply *STOP* anytime to opt out.', position: { x: 660, y: 260 }, connections: { main: 'step-tag-lead-1' } },
      { id: 'step-tag-lead-1', type: 'tag_audience', title: 'Tag as new-lead', config: { audience: { name: 'new_lead', rules: [{ field: 'lifetimeTier', op: 'exists', value: true }] } }, position: { x: 940, y: 260 }, connections: { main: '' } }
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

/**
 * Template-vault: stable hash of the defaults that ships with this build.
 * Bump `VERSION` manually when you intentionally want clients to refresh.
 */
export const DEFAULTS_VERSION = '2026.09.05-r1'

export function getDefaultsVersion() {
  return DEFAULTS_VERSION
}

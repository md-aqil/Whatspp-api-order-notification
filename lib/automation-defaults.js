export const defaultAutomations = [
  {
    id: 'default-order-confirmation',
    name: 'Order Received',
    status: true,
    source: 'Shopify',
    summary: 'Send a friendly confirmation as soon as an order lands in Shopify.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-1', type: 'trigger', title: 'Order received', event: 'shopify.order_created', description: 'A new order is created in Shopify', position: { x: 120, y: 260 } },
      { id: 'step-condition-1', type: 'condition', title: 'Filter orders', rule: 'financial_status != refunded', description: 'Skip refunded or test orders', position: { x: 460, y: 260 } },
      { id: 'step-message-1', type: 'message', title: 'Send confirmation', channel: 'whatsapp', template: 'hello_world', templateLanguage: 'en_US', message: 'Hi {{customer_name}}, thanks for your order #{{order_number}}. We received it and will share tracking as soon as it ships.', position: { x: 820, y: 260 } }
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
      { id: 'step-trigger-2', type: 'trigger', title: 'Tracking ID available', event: 'shopify.fulfillment_created', description: 'A tracking number is attached to an order', position: { x: 120, y: 260 } },
      { id: 'step-message-2', type: 'message', title: 'Share tracking link', channel: 'whatsapp', template: 'hello_world', templateLanguage: 'en_US', message: 'Your order #{{order_number}} is on the way. Tracking ID: {{tracking_number}}. Track here: {{tracking_url}}', position: { x: 500, y: 260 } }
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
      { id: 'step-trigger-3', type: 'trigger', title: 'Order delivered', event: 'shopify.order_delivered', description: 'Delivery confirmation comes from Shopify or courier sync', position: { x: 120, y: 260 } },
      { id: 'step-delay-3', type: 'delay', title: 'Wait before follow-up', delayValue: '3', delayUnit: 'days', description: 'Give the customer time to use the product', position: { x: 460, y: 260 } },
      { id: 'step-message-3', type: 'message', title: 'Ask for feedback', channel: 'whatsapp', template: 'hello_world', templateLanguage: 'en_US', message: 'Hi {{customer_name}}, your order should be with you now. How was it? Reply with feedback or review here: {{review_link}}', position: { x: 820, y: 260 } }
    ]
  },
  {
    id: 'default-whatsapp-reply',
    name: 'WhatsApp Auto Reply',
    status: false,
    source: 'WhatsApp',
    summary: 'Start with a welcome message, share quick options, then branch into the right WhatsApp reply.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-4', type: 'trigger', title: 'WhatsApp message received', event: 'whatsapp.message_received', description: 'A customer sends a WhatsApp message', position: { x: 120, y: 340 }, connections: { main: 'step-message-4' } },
      { id: 'step-message-4', type: 'message', title: 'Welcome the customer', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Hi {{customer_name}}, welcome to Vaclav Fashion. Thank you for messaging us on WhatsApp.', position: { x: 460, y: 220 }, connections: { main: 'step-message-6' } },
      { id: 'step-message-6', type: 'message', title: 'Share quick options', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Reply with one of these options and we will help you faster:\n1. Catalog\n2. New arrivals\n3. Order status\n4. Size guide\n5. Support', position: { x: 820, y: 220 }, connections: { main: 'step-condition-4' } },
      { id: 'step-condition-4', type: 'condition', title: 'Catalog request', rule: 'customer_message contains catalog', description: 'Customer is asking for the catalog', position: { x: 1180, y: 220 }, connections: { main: 'step-message-7', fallback: 'step-condition-5' } },
      { id: 'step-condition-5', type: 'condition', title: 'New arrivals request', rule: 'customer_message contains new', description: 'Customer wants new arrivals', position: { x: 1180, y: 340 }, connections: { main: 'step-message-8', fallback: 'step-condition-6' } },
      { id: 'step-condition-6', type: 'condition', title: 'Order status request', rule: 'customer_message contains order', description: 'Customer wants an order update', position: { x: 1180, y: 460 }, connections: { main: 'step-message-9', fallback: 'step-condition-7' } },
      { id: 'step-condition-7', type: 'condition', title: 'Size guide request', rule: 'customer_message contains size', description: 'Customer needs sizing help', position: { x: 1180, y: 580 }, connections: { main: 'step-message-10', fallback: 'step-condition-8' } },
      { id: 'step-condition-8', type: 'condition', title: 'Support request', rule: 'customer_message contains support', description: 'Customer needs support', position: { x: 1180, y: 700 }, connections: { main: 'step-message-11', fallback: 'step-message-5' } },
      { id: 'step-message-7', type: 'message', title: 'Reply with catalog help', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Absolutely. We can help you with our catalog and collections. Tell us the category or style you want, and our team will guide you to the right picks.', position: { x: 1540, y: 100 } },
      { id: 'step-message-8', type: 'message', title: 'Reply with new arrivals help', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Great choice. We can help you explore our new arrivals. Tell us what you are looking for, and we will point you to the latest styles.', position: { x: 1540, y: 220 } },
      { id: 'step-message-9', type: 'message', title: 'Reply with order help', channel: 'whatsapp', template: '', templateLanguage: '', message: 'We can help with your order status. Please share your order number, and we will guide you with the latest update.', position: { x: 1540, y: 340 } },
      { id: 'step-message-10', type: 'message', title: 'Reply with size guide help', channel: 'whatsapp', template: '', templateLanguage: '', message: 'We can help with sizing. Tell us the product or fit you want, and we will guide you with the right size information.', position: { x: 1540, y: 460 } },
      { id: 'step-message-11', type: 'message', title: 'Reply with support help', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Our support team can help you. Please tell us your issue in one message, and we will guide you on the next step.', position: { x: 1540, y: 580 } },
      { id: 'step-message-5', type: 'message', title: 'Share brand information', channel: 'whatsapp', template: '', templateLanguage: '', message: 'We are a premium fashion brand and we can help with collections, new arrivals, sizing guidance, order updates, and styling support.', position: { x: 1540, y: 760 }, connections: { main: '' } }
    ]
  }
]

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
    summary: 'Check the customer message first, send the right reply, and only show the menu when no intent matches.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-4', type: 'trigger', title: 'WhatsApp message received', event: 'whatsapp.message_received', description: 'A customer sends a WhatsApp message', position: { x: 120, y: 340 }, connections: { main: 'step-condition-4' } },
      { id: 'step-condition-4', type: 'condition', title: 'Catalog request', rule: 'customer_message contains_any catalog|1', description: 'Customer is asking for the catalog', position: { x: 460, y: 120 }, connections: { main: 'step-message-7', fallback: 'step-condition-5' } },
      { id: 'step-condition-5', type: 'condition', title: 'New arrivals request', rule: 'customer_message contains_any new|arrival|2', description: 'Customer wants new arrivals', position: { x: 460, y: 260 }, connections: { main: 'step-message-8', fallback: 'step-condition-6' } },
      { id: 'step-condition-6', type: 'condition', title: 'Order status request', rule: 'customer_message contains_any order|tracking|track|3', description: 'Customer wants an order update', position: { x: 460, y: 400 }, connections: { main: 'step-message-9', fallback: 'step-condition-7' } },
      { id: 'step-condition-7', type: 'condition', title: 'Size guide request', rule: 'customer_message contains_any size|fit|4', description: 'Customer needs sizing help', position: { x: 460, y: 540 }, connections: { main: 'step-message-10', fallback: 'step-condition-8' } },
      { id: 'step-condition-8', type: 'condition', title: 'Support request', rule: 'customer_message contains_any support|help|agent|5', description: 'Customer needs support', position: { x: 460, y: 680 }, connections: { main: 'step-message-11', fallback: 'step-message-4' } },
      { id: 'step-message-4', type: 'message', title: 'Welcome and show options', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Hi {{customer_name}}, thanks for messaging Vaclav Fashion.\n\nReply with one of these options so we can help faster:\n1. Catalog\n2. New arrivals\n3. Order status\n4. Size guide\n5. Support', position: { x: 860, y: 680 }, connections: { main: '' } },
      { id: 'step-message-6', type: 'message', title: 'Ask for clarification', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Tell us if you need catalog, new arrivals, order status, size guide, or support, and our team will help next.', description: 'Fallback when no quick option matches', position: { x: 1220, y: 680 }, connections: { main: '' } },
      { id: 'step-message-7', type: 'message', title: 'Reply with catalog help', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Absolutely. We can help you with our catalog and collections. Tell us the category or style you want, and our team will guide you to the right picks.', position: { x: 1540, y: 100 } },
      { id: 'step-message-8', type: 'message', title: 'Reply with new arrivals help', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Great choice. We can help you explore our new arrivals. Tell us what you are looking for, and we will point you to the latest styles.', position: { x: 1540, y: 220 } },
      { id: 'step-message-9', type: 'message', title: 'Reply with order help', channel: 'whatsapp', template: '', templateLanguage: '', message: 'We can help with your order status. Please share your order number, and we will guide you with the latest update.', position: { x: 1540, y: 340 } },
      { id: 'step-message-10', type: 'message', title: 'Reply with size guide help', channel: 'whatsapp', template: '', templateLanguage: '', message: 'We can help with sizing. Tell us the product or fit you want, and we will guide you with the right size information.', position: { x: 1540, y: 460 } },
      { id: 'step-message-11', type: 'message', title: 'Reply with support help', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Our support team can help you. Please tell us your issue in one message, and we will guide you on the next step.', position: { x: 1540, y: 580 } },
      { id: 'step-message-5', type: 'message', title: 'Escalate to team', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Our team will review the customer message and follow up manually if needed.', description: 'Reserved for future manual escalation', position: { x: 1540, y: 760 }, connections: { main: '' } }
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

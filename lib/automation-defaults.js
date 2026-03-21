export const defaultAutomations = [
  {
    id: 'default-order-confirmation',
    name: 'Order Received',
    status: true,
    source: 'Shopify',
    summary: 'Send a friendly confirmation as soon as an order lands in Shopify.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-1', type: 'trigger', title: 'Order received', event: 'shopify.order_created', description: 'A new order is created in Shopify' },
      { id: 'step-condition-1', type: 'condition', title: 'Filter orders', rule: 'financial_status != refunded', description: 'Skip refunded or test orders' },
      { id: 'step-message-1', type: 'message', title: 'Send confirmation', channel: 'whatsapp', template: '', message: 'Hi {{customer_name}}, thanks for your order #{{order_number}}. We received it and will share tracking as soon as it ships.' }
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
      { id: 'step-trigger-2', type: 'trigger', title: 'Tracking ID available', event: 'shopify.fulfillment_created', description: 'A tracking number is attached to an order' },
      { id: 'step-message-2', type: 'message', title: 'Share tracking link', channel: 'whatsapp', template: '', message: 'Your order #{{order_number}} is on the way. Tracking ID: {{tracking_number}}. Track here: {{tracking_url}}' }
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
      { id: 'step-trigger-3', type: 'trigger', title: 'Order delivered', event: 'shopify.order_delivered', description: 'Delivery confirmation comes from Shopify or courier sync' },
      { id: 'step-delay-3', type: 'delay', title: 'Wait before follow-up', delayValue: '3', delayUnit: 'days', description: 'Give the customer time to use the product' },
      { id: 'step-message-3', type: 'message', title: 'Ask for feedback', channel: 'whatsapp', template: '', message: 'Hi {{customer_name}}, your order should be with you now. How was it? Reply with feedback or review here: {{review_link}}' }
    ]
  }
]

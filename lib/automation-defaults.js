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
    summary: 'Send an interactive menu of options when a customer messages you, and reply based on their choice.',
    metrics: { sent: 0, openRate: 0, conversions: 0 },
    steps: [
      { id: 'step-trigger-4', type: 'trigger', title: 'WhatsApp message received', event: 'whatsapp.message_received', description: 'A customer sends a WhatsApp message', position: { x: 120, y: 340 }, connections: { main: 'step-interactive-1' } },
      
      { id: 'step-interactive-1', type: 'interactive', title: 'Welcome Menu', message: 'Hi {{customer_name}}, welcome to our store! 👋\n\nHow can I help you today? Please choose an option below:', options: [{ id: 'opt0', label: '📦 Order Status' }, { id: 'opt1', label: '👗 Shop Collection' }, { id: 'opt2', label: '❓ Help & FAQs' }, { id: 'opt3', label: '💬 Talk to Human' }], position: { x: 460, y: 340 }, connections: { opt0: 'step-msg-ord', opt1: 'step-interactive-shop', opt2: 'step-interactive-faq', opt3: 'step-msg-sup' } },
      
      { id: 'step-msg-ord', type: 'message', title: 'Order Status Reply', channel: 'whatsapp', template: '', templateLanguage: '', message: 'I can help with that! Please reply with your 5-digit Order ID (e.g., #12345), and I\'ll check it right away.', position: { x: 860, y: 160 }, connections: { main: '' } },
      { id: 'step-msg-sup', type: 'message', title: 'Support Transfer', channel: 'whatsapp', template: '', templateLanguage: '', message: 'No problem! I\'m transferring you to a human agent now. Hang tight—they usually reply within 5 minutes. 🕒', position: { x: 860, y: 720 }, connections: { main: '' } },
      
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
      { id: 'step-trigger-woo-1', type: 'trigger', title: 'WooCommerce Order', event: 'woocommerce.order_created', description: 'A new order is created in WooCommerce', position: { x: 120, y: 260 } },
      { id: 'step-condition-woo-1', type: 'condition', title: 'Filter orders', rule: 'financial_status != refunded', description: 'Skip refunded or test orders', position: { x: 460, y: 260 } },
      { id: 'step-message-woo-1', type: 'message', title: 'Send confirmation', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Hi {{customer_name}}, thanks for your order #{{order_number}}! Your order total is {{currency}}{{order_total}}. We will notify you once it ships.', position: { x: 820, y: 260 } }
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
      { id: 'step-trigger-cart-shopify-1', type: 'trigger', title: 'Cart abandoned', event: 'shopify.cart_abandoned', description: 'Checkout has been inactive past the cart recovery threshold', position: { x: 120, y: 260 } },
      { id: 'step-condition-cart-shopify-1', type: 'condition', title: 'Has customer phone', rule: 'customer_phone != empty', description: 'Only send recovery when a phone number exists', position: { x: 460, y: 260 } },
      { id: 'step-message-cart-shopify-1', type: 'message', title: 'Reminder 1', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Hi {{customer_name}}, you left {{cart_first_product}} in your cart. Complete your checkout here: {{checkout_url}}', position: { x: 820, y: 180 } },
      { id: 'step-delay-cart-shopify-1', type: 'delay', title: 'Wait 12 hours', delayValue: '12', delayUnit: 'hours', description: 'Pause before second reminder', position: { x: 1160, y: 180 } },
      { id: 'step-condition-cart-shopify-2', type: 'condition', title: 'Still abandoned', rule: 'status = abandoned', description: 'Skip if checkout already recovered', position: { x: 1500, y: 180 } },
      { id: 'step-message-cart-shopify-2', type: 'message', title: 'Reminder 2', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Your cart is still waiting with {{cart_item_count}} item(s). Complete now: {{checkout_url}}', position: { x: 1840, y: 120 } },
      { id: 'step-delay-cart-shopify-2', type: 'delay', title: 'Wait 24 hours', delayValue: '24', delayUnit: 'hours', description: 'Pause before final reminder', position: { x: 2180, y: 120 } },
      { id: 'step-condition-cart-shopify-3', type: 'condition', title: 'Still not recovered', rule: 'status = abandoned', description: 'Send final message only when cart remains abandoned', position: { x: 2520, y: 120 } },
      { id: 'step-message-cart-shopify-3', type: 'message', title: 'Final reminder', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Final reminder: use {{discount_code}} and complete checkout here {{checkout_url}}.', position: { x: 2860, y: 80 } }
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
      { id: 'step-trigger-cart-woo-1', type: 'trigger', title: 'Cart abandoned', event: 'woocommerce.cart_abandoned', description: 'WooCommerce cart stayed inactive and moved to abandoned state', position: { x: 120, y: 260 } },
      { id: 'step-condition-cart-woo-1', type: 'condition', title: 'Has customer phone', rule: 'customer_phone != empty', description: 'Only send recovery when a phone number exists', position: { x: 460, y: 260 } },
      { id: 'step-message-cart-woo-1', type: 'message', title: 'Reminder 1', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Hi {{customer_name}}, your cart is saved. Resume checkout here: {{checkout_url}}', position: { x: 820, y: 180 } },
      { id: 'step-delay-cart-woo-1', type: 'delay', title: 'Wait 8 hours', delayValue: '8', delayUnit: 'hours', description: 'Pause before second reminder', position: { x: 1160, y: 180 } },
      { id: 'step-condition-cart-woo-2', type: 'condition', title: 'Still abandoned', rule: 'status = abandoned', description: 'Skip follow-up if recovered', position: { x: 1500, y: 180 } },
      { id: 'step-message-cart-woo-2', type: 'message', title: 'Reminder 2', channel: 'whatsapp', template: '', templateLanguage: '', message: 'You still have {{cart_item_count}} item(s) in cart. Complete checkout: {{checkout_url}}', position: { x: 1840, y: 120 } }
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
      { id: 'step-trigger-custom-1', type: 'trigger', title: 'Custom Webhook', event: 'custom.webhook', description: 'Receives data from any webhook source', position: { x: 120, y: 260 } },
      { id: 'step-condition-custom-1', type: 'condition', title: 'Has phone number', rule: 'customer_phone != empty', description: 'Check if customer phone is available', position: { x: 460, y: 260 } },
      { id: 'step-message-custom-1', type: 'message', title: 'Send notification', channel: 'whatsapp', template: '', templateLanguage: '', message: 'Hi {{customer_name}}, thank you! Your order #{{order_number}} is confirmed for {{currency}}{{order_total}}.', position: { x: 820, y: 260 } }
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

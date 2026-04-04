function getContextValueByPath(context, path) {
  if (!context || !path) return undefined

  return String(path)
    .split('.')
    .filter(Boolean)
    .reduce((current, segment) => {
      if (current === undefined || current === null) return undefined
      return current[segment]
    }, context)
}

function interpolateAutomationText(template, context) {
  if (!template) return ''
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
    const value = getContextValueByPath(context, key)
    return value === undefined || value === null ? '' : String(value)
  })
}

const CART_TRIGGER_EVENTS = [
  'shopify.cart_created',
  'shopify.cart_updated',
  'shopify.cart_abandoned',
  'shopify.cart_recovered',
  'woocommerce.cart_created',
  'woocommerce.cart_updated',
  'woocommerce.cart_abandoned',
  'woocommerce.cart_recovered'
]

const VARIABLE_DEFINITIONS = [
  { value: '{{customer_name}}', label: 'Customer name', triggers: ['*'] },
  { value: '{{customer_phone}}', label: 'Customer phone', triggers: ['*'] },
  { value: '{{customer_email}}', label: 'Customer email', triggers: ['*'] },
  { value: '{{customer_message}}', label: 'Customer message', triggers: ['whatsapp.message_received'] },
  { value: '{{order_number}}', label: 'Order number', triggers: ['shopify.order_created', 'shopify.fulfillment_created', 'shopify.order_delivered', 'woocommerce.order_created', 'woocommerce.order_updated', 'custom.webhook', 'custom.order_created', 'custom.payment_received'] },
  { value: '{{order_product_name}}', label: 'Ordered product name', triggers: ['shopify.order_created', 'shopify.fulfillment_created', 'shopify.order_delivered', 'woocommerce.order_created', 'woocommerce.order_updated', 'custom.webhook', 'custom.order_created', ...CART_TRIGGER_EVENTS] },
  { value: '{{order_product_names}}', label: 'Ordered product names', triggers: ['shopify.order_created', 'shopify.fulfillment_created', 'shopify.order_delivered', 'woocommerce.order_created', 'woocommerce.order_updated', 'custom.webhook', 'custom.order_created', ...CART_TRIGGER_EVENTS] },
  { value: '{{tracking_number}}', label: 'Tracking number', triggers: ['shopify.fulfillment_created', 'shopify.order_delivered'] },
  { value: '{{tracking_url}}', label: 'Tracking URL', triggers: ['shopify.fulfillment_created', 'shopify.order_delivered'] },
  { value: '{{review_link}}', label: 'Review link', triggers: ['shopify.order_created', 'shopify.fulfillment_created', 'shopify.order_delivered', 'woocommerce.order_created', 'woocommerce.order_updated', 'whatsapp.message_received', 'custom.webhook', 'custom.order_created'] },
  { value: '{{order_total}}', label: 'Order total', triggers: ['shopify.order_created', 'shopify.fulfillment_created', 'shopify.order_delivered', 'woocommerce.order_created', 'woocommerce.order_updated', 'custom.webhook', 'custom.order_created', 'custom.payment_received'] },
  { value: '{{currency}}', label: 'Currency', triggers: ['shopify.order_created', 'shopify.fulfillment_created', 'shopify.order_delivered', 'woocommerce.order_created', 'woocommerce.order_updated', 'custom.webhook', 'custom.order_created', 'custom.payment_received'] },
  { value: '{{cart_id}}', label: 'Cart ID', triggers: CART_TRIGGER_EVENTS },
  { value: '{{checkout_url}}', label: 'Checkout URL', triggers: CART_TRIGGER_EVENTS },
  { value: '{{cart_total}}', label: 'Cart total', triggers: CART_TRIGGER_EVENTS },
  { value: '{{cart_item_count}}', label: 'Cart item count', triggers: CART_TRIGGER_EVENTS },
  { value: '{{cart_first_product}}', label: 'First cart product', triggers: CART_TRIGGER_EVENTS },
  { value: '{{cart_product_names}}', label: 'Cart product names', triggers: CART_TRIGGER_EVENTS },
  { value: '{{discount_code}}', label: 'Discount code', triggers: CART_TRIGGER_EVENTS },
  { value: '{{discount_amount}}', label: 'Discount amount', triggers: CART_TRIGGER_EVENTS },
  { value: '{{recovery_deadline}}', label: 'Recovery deadline', triggers: CART_TRIGGER_EVENTS },
  { value: '{{store_name}}', label: 'Store name', triggers: CART_TRIGGER_EVENTS },
  { value: '{{status}}', label: 'Cart status', triggers: CART_TRIGGER_EVENTS },
  { value: '{{financial_status}}', label: 'Financial status', triggers: ['shopify.order_created', 'shopify.fulfillment_created', 'shopify.order_delivered', 'woocommerce.order_created', 'woocommerce.order_updated'] },
  { value: '{{shopify.customer.first_name}}', label: 'Customer first name (legacy)', triggers: ['*'] },
  { value: '{{shopify.total_price}}', label: 'Order total (legacy)', triggers: ['shopify.order_created', 'shopify.fulfillment_created', 'shopify.order_delivered', 'woocommerce.order_created'] },
  { value: 'text', label: 'Custom text', triggers: ['*'] }
]

function isSupportedForTrigger(definition, triggerEvent) {
  return definition.triggers.includes('*') || definition.triggers.includes(triggerEvent)
}

export function getAutomationVariableOptions(triggerEvent = '') {
  if (!triggerEvent || triggerEvent === 'custom.webhook') {
    return VARIABLE_DEFINITIONS
  }

  return VARIABLE_DEFINITIONS.filter((definition) => isSupportedForTrigger(definition, triggerEvent))
}

export function getAutomationVariableLabel(value = '') {
  return VARIABLE_DEFINITIONS.find((definition) => definition.value === value)?.label || value
}

function getTemplateSlotExamples(component, groupKey) {
  const examples = component?.example?.[groupKey]
  if (Array.isArray(examples) && Array.isArray(examples[0])) return examples[0]
  return []
}

export function getAutomationTemplateParameterSlots(template = null) {
  const components = Array.isArray(template?.components) ? template.components : []
  const slots = []

  components.forEach((component) => {
    if (component?.type === 'HEADER') {
      if (component.format === 'TEXT') {
        const matches = component.text?.match(/\{\{\d+\}\}/g) || []
        const examples = getTemplateSlotExamples(component, 'header_text')
        matches.forEach((placeholder, index) => {
          slots.push({
            label: `Header ${placeholder}`,
            componentType: 'HEADER',
            parameterType: 'text',
            placeholder,
            templateText: component.text || '',
            example: examples[index] || ''
          })
        })
      }

      if (component.format === 'IMAGE' || component.format === 'VIDEO') {
        slots.push({
          label: `Header ${component.format.toLowerCase()} URL`,
          componentType: 'HEADER',
          parameterType: 'media',
          mediaType: component.format.toLowerCase(),
          placeholder: '',
          templateText: `${component.format} header media`,
          example: ''
        })
      }
    }

    if (component?.type === 'BODY') {
      const matches = component.text?.match(/\{\{\d+\}\}/g) || []
      const examples = getTemplateSlotExamples(component, 'body_text')
      matches.forEach((placeholder, index) => {
        slots.push({
          label: `Body ${placeholder}`,
          componentType: 'BODY',
          parameterType: 'text',
          placeholder,
          templateText: component.text || '',
          example: examples[index] || ''
        })
      })
    }

    if (component?.type === 'BUTTONS' && Array.isArray(component.buttons)) {
      component.buttons.forEach((button, buttonIndex) => {
        const buttonType = String(button?.type || '').toUpperCase()
        const matches = button?.url?.match(/\{\{\d+\}\}/g) || []
        matches.forEach((placeholder, index) => {
          slots.push({
            label: `${buttonType || 'Button'} ${placeholder}`,
            componentType: 'BUTTON',
            parameterType: 'text',
            buttonType,
            buttonIndex,
            placeholder,
            templateText: button?.url || button?.text || '',
            example: button?.example?.[index] || ''
          })
        })
      })
    }
  })

  return slots
}

export function getAutomationTemplateBodyText(template = null) {
  return template?.components?.find((component) => component?.type === 'BODY')?.text || ''
}

export function resolveAutomationVariable(value, context) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return ''

  const directMap = {
    '{{customer_name}}': context.customer_name || context.customerName || '',
    '{{customer_phone}}': context.customer_phone || context.customerPhone || context.phone || '',
    '{{customer_email}}': context.customer_email || context.customerEmail || context.email || '',
    '{{customer_message}}': context.customer_message || '',
    '{{order_number}}': context.order_number || context.orderNumber || context.order_id || context.orderId || '',
    '{{order_product_name}}': context.order_product_name || context.orderProductName || '',
    '{{order_product_names}}': context.order_product_names || context.orderProductNames || '',
    '{{tracking_number}}': context.tracking_number || '',
    '{{tracking_url}}': context.tracking_url || '',
    '{{review_link}}': context.review_link || context.reviewLink || '',
    '{{order_total}}': context.order_total || context.orderTotal || context.total || '',
    '{{currency}}': context.currency || 'USD',
    '{{cart_id}}': context.cart_id || context.external_cart_id || '',
    '{{checkout_url}}': context.checkout_url || context.checkoutUrl || '',
    '{{cart_total}}': context.cart_total || context.cartTotal || context.order_total || context.total || '',
    '{{cart_item_count}}': context.cart_item_count || context.cartItemCount || '',
    '{{cart_first_product}}': context.cart_first_product || context.cartFirstProduct || context.order_product_name || '',
    '{{cart_product_names}}': context.cart_product_names || context.cartProductNames || context.order_product_names || '',
    '{{discount_code}}': context.discount_code || context.discountCode || '',
    '{{discount_amount}}': context.discount_amount || context.discountAmount || '',
    '{{recovery_deadline}}': context.recovery_deadline || context.recoveryDeadline || '',
    '{{store_name}}': context.store_name || context.storeName || '',
    '{{status}}': context.status || '',
    '{{financial_status}}': context.financial_status || '',
    '{{shopify.customer.first_name}}': context.customer_name || '',
    '{{shopify.total_price}}': context.order_total || ''
  }

  const normalized = trimmed.toLowerCase()
  const normalizedMap = Object.fromEntries(Object.entries(directMap).map(([key, currentValue]) => [key.toLowerCase(), currentValue]))
  if (normalizedMap[normalized] !== undefined) {
    return normalizedMap[normalized]
  }

  const tokenMatch = trimmed.match(/^\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}$/)
  if (tokenMatch) {
    const dynamicValue = getContextValueByPath(context, tokenMatch[1])
    if (dynamicValue !== undefined && dynamicValue !== null) {
      return dynamicValue
    }
  }

  return interpolateAutomationText(trimmed, context)
}

function inferVariableFromExample(exampleText, triggerEvent = '', index = 0) {
  const sample = String(exampleText || '').trim().toLowerCase()

  if (sample.includes('customer') && sample.includes('name')) return '{{customer_name}}'
  if (sample.includes('customer') && sample.includes('phone')) return '{{customer_phone}}'
  if (sample.includes('message')) return '{{customer_message}}'
  if (sample.includes('order') && sample.includes('number')) return '{{order_number}}'
  if (sample.includes('tracking') && sample.includes('number')) return '{{tracking_number}}'
  if (sample.includes('tracking') && (sample.includes('url') || sample.includes('link'))) return '{{tracking_url}}'
  if (sample.includes('review')) return '{{review_link}}'
  if (sample.includes('checkout') && sample.includes('url')) return '{{checkout_url}}'
  if (sample.includes('cart') && sample.includes('total')) return '{{cart_total}}'
  if (sample.includes('cart') && sample.includes('item')) return '{{cart_item_count}}'
  if (sample.includes('discount') && sample.includes('code')) return '{{discount_code}}'
  if (sample.includes('discount') && (sample.includes('amount') || sample.includes('value'))) return '{{discount_amount}}'
  if (sample.includes('store') && sample.includes('name')) return '{{store_name}}'
  if ((sample.includes('amount') || sample.includes('total') || sample.includes('price')) && !sample.includes('product')) return '{{order_total}}'
  if (sample.includes('currency')) return '{{currency}}'
  if (sample.includes('status')) return '{{financial_status}}'
  if (sample.includes('product') && sample.includes('name')) return '{{order_product_name}}'
  if (sample.includes('products')) return '{{order_product_names}}'

  if (triggerEvent === 'whatsapp.message_received') {
    return ['{{customer_name}}', '{{customer_message}}', '{{customer_phone}}'][index] || 'text'
  }

  if (triggerEvent === 'shopify.fulfillment_created' || triggerEvent === 'shopify.order_delivered') {
    return ['{{customer_name}}', '{{order_number}}', '{{tracking_number}}', '{{tracking_url}}', '{{order_product_name}}', '{{order_total}}'][index] || 'text'
  }

  if (CART_TRIGGER_EVENTS.includes(triggerEvent)) {
    return ['{{customer_name}}', '{{cart_first_product}}', '{{cart_total}}', '{{checkout_url}}', '{{discount_code}}', '{{cart_item_count}}'][index] || 'text'
  }

  return ['{{customer_name}}', '{{order_number}}', '{{order_product_name}}', '{{order_total}}', '{{currency}}', '{{financial_status}}'][index] || 'text'
}

function normalizeExistingMapping(mapping, slot, triggerEvent, index) {
  if (!mapping || typeof mapping.value !== 'string') return null

  const mode = mapping.mode === 'text' ? 'text' : (mapping.value === 'text' ? 'text' : 'token')
  return {
    ...mapping,
    label: slot.label,
    parameterType: slot.parameterType,
    componentType: slot.componentType,
    buttonType: slot.buttonType || '',
    mediaType: slot.mediaType || '',
    templateText: slot.templateText || '',
    mode,
    value: mode === 'text'
      ? mapping.value
      : (mapping.value || inferVariableFromExample(slot.example, triggerEvent, index))
  }
}

export function buildAutomationTemplateMappings(template, currentMappings = [], triggerEvent = '') {
  return getAutomationTemplateParameterSlots(template).map((slot, index) => {
    const existing = normalizeExistingMapping(currentMappings[index], slot, triggerEvent, index)
    if (existing) return existing

    const inferredValue = slot.parameterType === 'media'
      ? ''
      : inferVariableFromExample(slot.example, triggerEvent, index)

    return {
      label: slot.label,
      parameterType: slot.parameterType,
      componentType: slot.componentType,
      buttonType: slot.buttonType || '',
      mediaType: slot.mediaType || '',
      templateText: slot.templateText || '',
      mode: slot.parameterType === 'media' || inferredValue === 'text' ? 'text' : 'token',
      value: slot.parameterType === 'media' || inferredValue === 'text' ? '' : inferredValue
    }
  })
}

export function renderAutomationTemplateBodyPreview(template = null, variableMappings = []) {
  const bodyText = getAutomationTemplateBodyText(template)
  if (!bodyText) return ''

  const slots = getAutomationTemplateParameterSlots(template).filter((slot) => (
    slot.componentType === 'BODY' && slot.parameterType === 'text'
  ))

  let cursor = 0
  return bodyText.replace(/\{\{\d+\}\}/g, () => {
    const mapping = variableMappings[cursor]
    const slot = slots[cursor]
    cursor += 1

    if (!mapping) return '[unmapped]'
    if (mapping.mode === 'text') return mapping.value?.trim() || '[custom text]'
    return `[${getAutomationVariableLabel(mapping.value || slot?.label || 'value')}]`
  })
}

function resolveMappingValue(mapping, context) {
  if (!mapping) return ''
  if (mapping.mode === 'text') return String(mapping.value || '').trim()
  return String(resolveAutomationVariable(mapping.value || '', context) || '')
}

function mapButtonSubType(buttonType = '') {
  const normalized = String(buttonType || '').trim().toLowerCase()
  if (!normalized) return 'url'
  if (normalized === 'phone_number') return 'phone_number'
  if (normalized === 'quick_reply') return 'quick_reply'
  if (normalized === 'copy_code') return 'copy_code'
  return normalized
}

export function buildAutomationTemplateComponents(templateComponents = [], variableMappings = [], context = {}) {
  const components = []
  let cursor = 0

  for (const component of templateComponents) {
    if (component?.type === 'HEADER') {
      if (component.format === 'TEXT') {
        const matches = component.text?.match(/\{\{\d+\}\}/g) || []
        if (matches.length > 0) {
          components.push({
            type: 'header',
            parameters: matches.map(() => {
              const text = resolveMappingValue(variableMappings[cursor], context)
              cursor += 1
              return { type: 'text', text }
            })
          })
        }
      }

      if (component.format === 'IMAGE' || component.format === 'VIDEO') {
        const mediaUrl = resolveMappingValue(variableMappings[cursor], context)
        cursor += 1

        if (!mediaUrl) {
          throw new Error(`Template requires a ${component.format.toLowerCase()} header URL.`)
        }

        components.push({
          type: 'header',
          parameters: [
            component.format === 'IMAGE'
              ? { type: 'image', image: { link: mediaUrl } }
              : { type: 'video', video: { link: mediaUrl } }
          ]
        })
      }
    }

    if (component?.type === 'BODY') {
      const matches = component.text?.match(/\{\{\d+\}\}/g) || []
      if (matches.length > 0) {
        components.push({
          type: 'body',
          parameters: matches.map(() => {
            const text = resolveMappingValue(variableMappings[cursor], context)
            cursor += 1
            return { type: 'text', text }
          })
        })
      }
    }

    if (component?.type === 'BUTTONS' && Array.isArray(component.buttons)) {
      component.buttons.forEach((button, buttonIndex) => {
        const matches = button?.url?.match(/\{\{\d+\}\}/g) || []
        if (matches.length === 0) return

        components.push({
          type: 'button',
          sub_type: mapButtonSubType(button.type),
          index: String(buttonIndex),
          parameters: matches.map(() => {
            const text = resolveMappingValue(variableMappings[cursor], context)
            cursor += 1
            return { type: 'text', text }
          })
        })
      })
    }
  }

  return components.length > 0 ? components : undefined
}

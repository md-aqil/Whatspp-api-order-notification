import { NextResponse } from 'next/server'

// GET /api/whatsapp-templates - Get approved WhatsApp templates
export async function GET() {
  try {
    // In a real implementation, you would fetch templates from the WhatsApp Business API
    // This requires:
    // 1. Access token from integration settings
    // 2. Business account ID
    // 3. API call to Facebook Graph API
    
    // Mock data for demonstration
    const templates = [
      {
        id: '1',
        name: 'summer_sale_2025',
        category: 'MARKETING',
        language: 'en_US',
        status: 'APPROVED',
        components: [
          {
            type: 'BODY',
            text: '🌟 Summer Sale Alert! Get {discount}% off all products. Shop now at {shop_url}'
          }
        ]
      },
      {
        id: '2',
        name: 'product_launch',
        category: 'MARKETING',
        language: 'en_US',
        status: 'APPROVED',
        components: [
          {
            type: 'BODY',
            text: '🚀 Exciting news! Our new {product_line} is now available. Check it out at {shop_url}'
          }
        ]
      },
      {
        id: '3',
        name: 'feedback_request',
        category: 'UTILITY',
        language: 'en_US',
        status: 'APPROVED',
        components: [
          {
            type: 'BODY',
            text: 'We value your opinion! Please share your feedback on your recent purchase by clicking {feedback_link}'
          }
        ]
      },
      {
        id: '4',
        name: 'order_confirmation',
        category: 'UTILITY',
        language: 'en_US',
        status: 'APPROVED',
        components: [
          {
            type: 'BODY',
            text: 'Thank you for your order #{order_number}! Your order is confirmed and will be shipped soon.'
          }
        ]
      }
    ]
    
    return NextResponse.json(templates)
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch templates',
        guidance: 'Please check your WhatsApp Business integration settings and ensure your access token is valid.'
      },
      { status: 500 }
    )
  }
}
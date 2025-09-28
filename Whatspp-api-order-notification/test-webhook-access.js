// Script to test if the webhook endpoint is accessible
require('dotenv').config();

async function testWebhookAccess() {
  try {
    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/whatsapp`;
    console.log('Testing webhook access...');
    console.log('Webhook URL:', webhookUrl);
    
    // Test GET request (verification)
    console.log('\nTesting GET request (verification)...');
    const getUrl = `${webhookUrl}?hub.verify_token=9f8a3c74d12e4c9c8a6f42d7a3c7e9d2&hub.challenge=challenge_test`;
    
    const getResponse = await fetch(getUrl);
    console.log('GET Response status:', getResponse.status);
    const getText = await getResponse.text();
    console.log('GET Response text:', getText);
    
    // Test POST request (with sample payload)
    console.log('\nTesting POST request (with sample payload)...');
    const samplePayload = {
      "object": "whatsapp_business_account",
      "entry": [
        {
          "id": "832073532824981",
          "changes": [
            {
              "value": {
                "messaging_product": "whatsapp",
                "metadata": {
                  "display_phone_number": "15551823471",
                  "phone_number_id": "818391834688215"
                },
                "contacts": [
                  {
                    "profile": {
                      "name": "John Doe"
                    },
                    "wa_id": "917210562014"
                  }
                ],
                "messages": [
                  {
                    "from": "917210562014",
                    "id": "wamid.HBgMOTE3MjEwNTYyMDE0FQIAERgSM0Q0NzA3MzZFQkY0MjNBQjMAAA==",
                    "timestamp": "1758795138",
                    "text": {
                      "body": "Hello, this is a test message"
                    },
                    "type": "text"
                  }
                ]
              },
              "field": "messages"
            }
          ]
        }
      ]
    };
    
    const postResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(samplePayload)
    });
    
    console.log('POST Response status:', postResponse.status);
    const postText = await postResponse.text();
    console.log('POST Response text:', postText);
    
  } catch (error) {
    console.error('Error testing webhook access:', error);
  }
}

testWebhookAccess();
// Script to test webhook payload structure
const testPayload = {
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

console.log('Test payload:', JSON.stringify(testPayload, null, 2));

// Simulate how the webhook handler would process this
function processTestPayload(payload) {
  console.log('\nProcessing test payload...');
  
  if (payload.entry && Array.isArray(payload.entry)) {
    for (const entry of payload.entry) {
      if (entry.changes && Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          console.log('Change field:', change.field);
          console.log('Change value:', JSON.stringify(change.value, null, 2));
          
          // Handle incoming messages
          if (change.field === 'messages' && change.value?.messages) {
            console.log('Found messages array with', change.value.messages.length, 'messages');
            for (const message of change.value.messages) {
              console.log('Message from:', message.from);
              console.log('Message type:', message.type);
              console.log('Message text:', message.text?.body);
              console.log('Message timestamp:', message.timestamp);
            }
          }
        }
      }
    }
  }
}

processTestPayload(testPayload);

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function ZohoWebhookGuide({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Zoho CRM Webhook Setup Guide</DialogTitle>
          <DialogDescription>
            Follow these steps to connect your Zoho CRM to Chatflow.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-bold">Step 1: Go to Zoho CRM Setup</h3>
            <p>Navigate to <b>Setup &gt; Automation &gt; Actions &gt; Webhooks</b> in your Zoho CRM account.</p>
          </div>
          <div>
            <h3 className="font-bold">Step 2: Create a New Webhook</h3>
            <p>Click on the <b>New Webhook</b> button.</p>
          </div>
          <div>
            <h3 className="font-bold">Step 3: Configure the Webhook</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><b>Name:</b> Give your webhook a name (e.g., "Chatflow Integration").</li>
              <li><b>URL to Notify:</b> Paste the following URL: <code className="bg-gray-100 p-1 rounded">{`${process.env.NEXT_PUBLIC_BASE_URL || 'https://chatflow.vibeship.in'}/api/webhook/zoho`}</code></li>
              <li><b>Method:</b> Select <b>POST</b>.</li>
              <li><b>Module:</b> Select the module you want to trigger the webhook from (e.g., Leads).</li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold">Step 4: Save the Webhook</h3>
            <p>Click the <b>Save</b> button.</p>
          </div>
          <div>
            <h3 className="font-bold">Step 5: Associate the Webhook with a Workflow Rule</h3>
            <p>Go to <b>Setup &gt; Automation &gt; Workflow Rules</b> and create a new rule or edit an existing one. In the <b>Instant Actions</b> section, select <b>Webhook</b> and choose the webhook you just created.</p>
          </div>
        </div>
        <div className="flex justify-end pt-4">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

# Campaigns Feature Documentation

## Overview
This document describes the new Campaigns feature that has been added to the WhatsApp Commerce Hub. The feature provides a dedicated page for managing marketing campaigns using WhatsApp Business templates.

## Feature Components

### 1. Campaigns Page
Located at `/dashboard/campaigns`, this page provides:
- List view of all campaigns with filtering and search capabilities
- Campaign creation workflow with template selection
- Campaign status tracking (draft, scheduled, sent, failed)
- Actions to send or delete campaigns

### 2. Campaign Creation Workflow
The campaign creation process includes:
- Campaign name and description
- Template selection from approved Meta templates
- Template preview with variable placeholders
- Audience selection (all customers, recent buyers, custom)
- Scheduling option for future delivery

### 3. Template Management
- Integration with Meta's WhatsApp Business API
- Display of approved templates with status indicators
- Template preview showing message structure
- Support for template variables

### 4. API Endpoints
- `GET /api/campaigns` - Retrieve all campaigns
- `POST /api/campaigns` - Create a new campaign
- `POST /api/campaigns/[id]/send` - Send a campaign
- `DELETE /api/campaigns/[id]` - Delete a campaign
- `GET /api/whatsapp-templates` - Retrieve approved templates

## Implementation Details

### Frontend Components
- `app/dashboard/campaigns/page.js` - Main campaigns page
- `app/dashboard/campaigns/loading.js` - Loading state component
- Updated `components/dashboard/Sidebar.jsx` - Added campaigns navigation link

### Backend API Routes
- `app/api/campaigns/route.js` - Campaigns collection endpoint
- `app/api/campaigns/[id]/route.js` - Individual campaign endpoint
- `app/api/campaigns/[id]/send/route.js` - Campaign sending endpoint
- `app/api/whatsapp-templates/route.js` - Template retrieval endpoint

## Usage Instructions

### Accessing Campaigns
1. Navigate to the Dashboard
2. Click on "Campaigns" in the left sidebar navigation
3. View existing campaigns or create a new one

### Creating a Campaign
1. Click the "Create Campaign" button
2. Enter a campaign name
3. Select an approved template from the dropdown
4. Review the template preview
5. Choose your audience
6. Optionally schedule the campaign for future delivery
7. Click "Create Campaign"

### Managing Campaigns
- **Send**: Click the "Send" button on draft campaigns
- **Delete**: Click the "Delete" button to remove campaigns
- **Filter**: Use the status and template filters to narrow down the list
- **Search**: Use the search bar to find campaigns by name or template

## Future Enhancements
- Campaign analytics and performance tracking
- A/B testing capabilities
- Multi-template campaign sequences
- Advanced audience segmentation
- Campaign scheduling calendar view
# Railway Deployment Guide

This project is now ready for deployment on [Railway](https://railway.app/).

## Prerequisites
1. A Railway account.
2. The project's source code in a GitHub repository.

## Step-by-Step Instructions

### 1. Create a New Project on Railway
- Log in to your Railway dashboard.
- Click **"New Project"**.
- Select **"Deploy from GitHub repo"**.
- Choose your project's repository.

### 2. Add a PostgreSQL Database
- Once the service is created, click **"Add Service"** in the project view.
- Select **"Database"** -> **"Add PostgreSQL"**.
- Railway will automatically provide a `DATABASE_URL` environment variable to your Next.js service.

### 3. Configure Environment Variables
Go to your **Next.js Service** -> **Variables** and add the following:

| Variable | Recommended Value |
| :--- | :--- |
| `NEXT_PUBLIC_BASE_URL` | Your Railway app URL (e.g., `https://your-app-production.up.railway.app`) |
| `WHATSAPP_VERIFY_TOKEN` | Any random string (used for Meta Webhook verification) |
| `WORDPRESS_URL` | Your WordPress site URL (e.g., `https://yourwordpresssite.com`) |
| `NEXT_PUBLIC_WORDPRESS_URL` | Same as `WORDPRESS_URL` |
| `CORS_ORIGINS` | `*` |

*Note: `DATABASE_URL` is already handled by Railway.*

### 4. Build and Deployment
- Railway will see the `railway.json` file and automatically:
    - Build the Next.js app using `yarn build`.
    - Before starting, it will run `node setup-postgres-tables.js` to ensure your database schema is up to date.
    - Start the app with `yarn start`.

## What's Included?
- **Automatic Database Setup**: The `setup-postgres-tables.js` script runs automatically on every deployment to create or update tables.
- **Standalone Build**: Configured for maximum performance and minimum memory footprint on Railway.
- **Railway Configuration**: `railway.json` and `Procfile` are included for seamless deployment.

---
**Deployment Success Check:**
Once deployed, verify that the `/api/health` or `/api/webhook/custom?action=schema` endpoints are reachable to ensure the backend is working correctly.

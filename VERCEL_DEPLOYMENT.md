# Vercel Deployment Guide

This guide will help you deploy your NestJS microservices monorepo to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com) if you don't have one
2. **Vercel CLI**: Install globally (optional, for CLI deployment)
   ```bash
   npm install -g vercel
   ```
3. **Git Repository**: Your project should be in a Git repository (GitHub, GitLab, or Bitbucket)

## Deployment Methods

### Method 1: Deploy via Vercel Dashboard (Recommended)

1. **Connect Your Repository**
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your Git repository
   - Vercel will automatically detect your project

2. **Configure Project Settings**
   - **Framework Preset**: Select "Other" (since we're using custom configuration)
   - **Root Directory**: Leave as `.` (root)
   - **Build Command**: `npm run build` (already configured in vercel.json)
   - **Output Directory**: Leave empty (not needed for serverless functions)
   - **Install Command**: `npm install`

3. **Set Environment Variables**
   Go to Project Settings → Environment Variables and add all required variables:
   
   **Database Configuration:**
   - `DATABASE_HOST`
   - `DATABASE_PORT`
   - `DATABASE_NAME`
   - `DATABASE_USER`
   - `DATABASE_PASSWORD`
   - `DATABASE_URL` (if using connection string)
   
   **Service Ports** (optional for Vercel, but keep for compatibility):
   - `APP_PORT`
   - `ADMIN_PORT`
   - `FINANCE_HTTP_PORT`
   - `GAME_HTTP_PORT`
   - `CRONJOBS_PORT`
   - `PAYMENT_BOT_PORT`
   
   **Other Environment Variables:**
   - Add all other environment variables your services need
   - Make sure to set them for **Production**, **Preview**, and **Development** environments as needed

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy your project
   - You'll get URLs for each deployment

### Method 2: Deploy via Vercel CLI

1. **Login to Vercel**
   ```bash
   vercel login
   ```

2. **Link Your Project** (first time only)
   ```bash
   vercel link
   ```
   - Follow the prompts to link your project
   - Select your Vercel account and project

3. **Set Environment Variables** (if not using dashboard)
   ```bash
   vercel env add DATABASE_HOST
   vercel env add DATABASE_PORT
   # ... add all other environment variables
   ```

4. **Deploy**
   ```bash
   # Deploy to preview
   vercel
   
   # Deploy to production
   vercel --prod
   ```

## Important Notes

### 1. Database Connection
- Ensure your database is accessible from Vercel's serverless functions
- Use connection pooling for better performance
- Consider using Vercel's serverless-friendly database solutions

### 2. TCP Microservices
- **File Service**: TCP-only, cannot be deployed to Vercel
- **Finance Service & Game Service**: Have both HTTP and TCP
  - Only the HTTP endpoints will work on Vercel
  - TCP microservices won't function (they require persistent connections)
  - Consider deploying TCP services separately or using a different platform

### 3. Cronjobs Service
- Vercel supports cron jobs via [Vercel Cron](https://vercel.com/docs/cron-jobs)
- You may need to configure cron triggers in `vercel.json` if you want scheduled tasks
- Alternatively, use Vercel's Cron Jobs feature in the dashboard

### 4. Build Process
- Vercel will run `npm run build` which builds all services
- The build output goes to `dist/apps/`
- Each service's `main.js` is used as a serverless function entry point

### 5. Function Timeouts
- Default timeout is 10 seconds (Hobby plan)
- Pro plan allows up to 60 seconds (configured in vercel.json)
- For longer operations, consider using background jobs or external services

### 6. Cold Starts
- Serverless functions have cold start latency
- First request after inactivity may be slower
- Consider using Vercel's Edge Functions for better performance

## Post-Deployment

### Access Your Services

After deployment, your services will be available at:
- `https://your-project.vercel.app/api/*` - API Service
- `https://your-project.vercel.app/admin/*` - Admin Service
- `https://your-project.vercel.app/finance/*` - Finance Service
- `https://your-project.vercel.app/games/*` - Game Service
- `https://your-project.vercel.app/cronjobs/*` - Cronjobs Service
- `https://your-project.vercel.app/payment-bot/*` - Payment Bot Service

### Monitoring

- Check deployment logs in Vercel Dashboard
- Monitor function execution in the Functions tab
- Set up error tracking (Sentry, etc.) for production

### Custom Domain

1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS as instructed by Vercel

## Troubleshooting

### Build Failures
- Check build logs in Vercel Dashboard
- Ensure all dependencies are in `package.json`
- Verify TypeScript compilation succeeds locally

### Runtime Errors
- Check function logs in Vercel Dashboard
- Verify environment variables are set correctly
- Ensure database connections are accessible from Vercel

### Timeout Issues
- Increase `maxDuration` in `vercel.json` (requires Pro plan)
- Optimize slow operations
- Consider breaking long operations into smaller chunks

## Example Environment Variables Setup

```bash
# Database
DATABASE_HOST=your-db-host
DATABASE_PORT=5432
DATABASE_NAME=your-db-name
DATABASE_USER=your-db-user
DATABASE_PASSWORD=your-db-password

# Service Ports (optional for Vercel)
APP_PORT=3000
ADMIN_PORT=3001
FINANCE_HTTP_PORT=3010
GAME_HTTP_PORT=3010
CRONJOBS_PORT=3002
PAYMENT_BOT_PORT=3004

# Add all other required environment variables
```

## Next Steps

1. Deploy to preview environment first
2. Test all endpoints
3. Verify database connections
4. Deploy to production
5. Set up monitoring and alerts


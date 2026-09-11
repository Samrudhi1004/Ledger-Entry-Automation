# Railway.app Deployment Guide for Ledger Entry Automation

## Overview
This guide walks you through deploying your Django backend + React frontend on Railway.app (free tier).

## Architecture
```
Railway Services:
├── Backend (Django + Daphne)
├── PostgreSQL (Railway managed)
└── Redis (Railway managed)

Vercel (Free):
└── Frontend (React Dashboard)
```

## Prerequisites
- GitHub account
- Railway.app account (sign up with GitHub)
- Vercel account (optional, for frontend)

---

## Part 1: Deploy Backend on Railway

### Step 1: Create Railway Project

1. Go to **https://railway.app**
2. Click **"Start a New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository: `Samrudhi1004/Ledger-Entry-Automation`
5. Railway will detect it's a Python project

### Step 2: Add PostgreSQL Database

1. In your Railway project dashboard, click **"+ New"**
2. Select **"Database"**
3. Choose **"Add PostgreSQL"**
4. Railway will automatically create a PostgreSQL instance
5. Note: Railway will automatically set `DATABASE_URL` environment variable

### Step 3: Add Redis

1. Click **"+ New"** again
2. Select **"Database"**
3. Choose **"Add Redis"**
4. Railway will set `REDIS_URL` automatically

### Step 4: Configure Backend Service

1. Click on your backend service
2. Go to **"Settings"** tab
3. Set **"Root Directory"** to: `backend`
4. Set **"Start Command"** to:
   ```bash
   python manage.py migrate --noinput && python manage.py collectstatic --noinput && daphne -b 0.0.0.0 -p $PORT config.asgi:application
   ```

### Step 5: Set Environment Variables

In the **"Variables"** tab, add these:

```bash
# Django Settings
SECRET_KEY=<generate-a-strong-random-key>
DEBUG=False
ALLOWED_HOSTS=.railway.app
DJANGO_SETTINGS_MODULE=config.settings

# Database (Railway sets this automatically)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis (Railway sets this automatically)
REDIS_URL=${{Redis.REDIS_URL}}
USE_REDIS=true

# CORS
CORS_ALLOWED_ORIGINS=https://your-dashboard.vercel.app,http://localhost:3000

# JWT
JWT_ACCESS_TOKEN_LIFETIME=60
JWT_REFRESH_TOKEN_LIFETIME=90

# Email (Optional - use your SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password

# Cloudinary (for media files)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Whisper
WHISPER_MODEL=tiny
WHISPER_BACKEND=local

# Frontend URL
FRONTEND_URL=https://your-dashboard.vercel.app
```

### Step 6: Deploy Backend

1. Click **"Deploy"** or push to your GitHub branch
2. Railway will automatically:
   - Install dependencies from `requirements.txt`
   - Run migrations
   - Collect static files
   - Start Daphne server
3. Wait for deployment to complete (3-5 minutes)
4. Copy your backend URL: `https://your-app.railway.app`

---

## Part 2: Deploy Frontend on Vercel (Recommended)

### Option A: Vercel (BEST - Free, Unlimited)

1. Go to **https://vercel.com**
2. Sign in with GitHub
3. Click **"Add New Project"**
4. Select your repository
5. Configure:
   - **Root Directory**: `dashboard`
   - **Framework Preset**: React / Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Add environment variable:
   ```bash
   VITE_API_URL=https://your-backend.railway.app
   ```
7. Click **"Deploy"**
8. Your frontend will be live at: `https://your-dashboard.vercel.app`

### Option B: Railway (uses your free credits)

1. In Railway, click **"+ New"**
2. Select **"GitHub Repo"**
3. Choose the same repository
4. Set **"Root Directory"** to: `dashboard`
5. Railway will auto-detect it's a Node.js app
6. No environment variables needed for static site
7. Deploy

---

## Part 3: Update CORS Settings

After deploying frontend, update backend environment variables on Railway:

```bash
ALLOWED_HOSTS=.railway.app
CORS_ALLOWED_ORIGINS=https://your-dashboard.vercel.app
```

Redeploy the backend service.

---

## Part 4: Database Initialization

### Create Superuser

1. Go to Railway dashboard
2. Click on your backend service
3. Go to **"Deployments"** tab
4. Click on the latest deployment
5. Open **"View Logs"**
6. At the bottom, there's a **"Terminal"** button - click it
7. Run:
   ```bash
   python manage.py createsuperuser
   ```
8. Follow the prompts to create your admin user

### Load Initial Data (Optional)

If you have fixtures or seed data:
```bash
python manage.py loaddata your_fixture.json
```

---

## Part 5: Monitoring & Logs

### View Logs
1. Go to your service in Railway
2. Click **"Deployments"**
3. Click on the active deployment
4. View real-time logs

### Restart Service
1. Go to service settings
2. Click **"Restart Service"**

---

## Cost Estimate (Free Tier)

Railway Free Tier:
- **$5 credit/month**
- Your setup will use approximately **$3-4/month**:
  - Backend: ~$2/month
  - PostgreSQL: ~$1/month
  - Redis: ~$0.50/month

Vercel (Frontend):
- **Free, unlimited** for personal projects
- Global CDN included
- Automatic SSL

---

## Troubleshooting

### Issue: Migration Errors
**Solution**: Clear the migration conflict first:
1. Delete problematic migrations locally
2. Run `python manage.py makemigrations`
3. Commit and push
4. Railway will redeploy automatically

### Issue: Static Files Not Loading
**Solution**: Check `STATIC_ROOT` and ensure:
```python
# settings.py
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
```

### Issue: WebSocket Connection Failed
**Solution**: Railway supports WebSockets by default. Ensure:
```python
# In ALLOWED_HOSTS
ALLOWED_HOSTS = ['.railway.app']

# In CORS settings
CORS_ALLOW_CREDENTIALS = True
```

### Issue: Database Connection Timeout
**Solution**: Railway PostgreSQL has connection limits. Use connection pooling:
```python
DATABASES = {
    'default': {
        ...
        'CONN_MAX_AGE': 600,  # 10 minutes
        'OPTIONS': {
            'connect_timeout': 10,
        }
    }
}
```

---

## Comparison: Render vs Railway

| Feature | Render Free | Railway Free |
|---------|-------------|--------------|
| Monthly Limit | 750 hours total | $5 credit (~750 hours per service) |
| Cold Starts | Yes (15 min idle) | No auto-sleep |
| Persistent Storage | No | Yes (with volumes) |
| Build Minutes | Limited | Generous |
| WebSocket Support | Limited on free | Full support |
| Database | Limited free tier | Included in $5 credit |
| Logs Retention | 7 days | 7 days |
| Custom Domains | Yes | Yes |

**Winner**: Railway for this project (better WebSocket support, no cold starts)

---

## Next Steps

1. ✅ Deploy backend to Railway
2. ✅ Add PostgreSQL and Redis
3. ✅ Set environment variables
4. ✅ Deploy frontend to Vercel
5. ✅ Update CORS settings
6. ✅ Create superuser
7. ✅ Test the application

---

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Vercel Docs: https://vercel.com/docs

---

## Migration from Render to Railway

### Export Data from Render
```bash
# Connect to Render PostgreSQL
pg_dump $DATABASE_URL > backup.sql

# Import to Railway PostgreSQL
psql $RAILWAY_POSTGRES_URL < backup.sql
```

### Switch DNS/URLs
1. Update frontend API URL to Railway backend
2. Update any external webhooks
3. Test thoroughly before removing Render services

---

**Created**: 2026-09-10
**Author**: Deployment Guide for Ledger Entry Automation

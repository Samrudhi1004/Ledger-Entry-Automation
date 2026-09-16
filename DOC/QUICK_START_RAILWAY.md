# Quick Start: Deploy to Railway

Follow these steps to deploy your project to Railway in under 10 minutes.

## 📋 Prerequisites Checklist

- [ ] GitHub account
- [ ] Railway.app account (sign up at https://railway.app with GitHub)
- [ ] Your repository pushed to GitHub
- [ ] (Optional) Vercel account for frontend

---

## 🚀 Step-by-Step Deployment

### **Step 1: Sign Up for Railway** (2 minutes)

1. Go to **https://railway.app**
2. Click **"Login with GitHub"**
3. Authorize Railway to access your repositories
4. You'll get **$5 free credit per month**

---

### **Step 2: Create New Project** (1 minute)

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose: `Samrudhi1004/Ledger-Entry-Automation`
4. Railway will create your first service (Backend)

---

### **Step 3: Configure Backend Service** (3 minutes)

1. Click on the newly created service
2. Go to **"Settings"** tab
3. Under **"Service Settings"**:
   - Set **Root Directory**: `backend`
   - Leave other settings as default
4. Go to **"Variables"** tab and add:

```env
SECRET_KEY=your-secret-key-here-generate-strong-one
DEBUG=False
ALLOWED_HOSTS=.railway.app
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
USE_REDIS=true
CORS_ALLOWED_ORIGINS=http://localhost:3000
WHISPER_MODEL=tiny
WHISPER_BACKEND=local
```

5. Click **"Deploy"** (Railway will auto-deploy on changes)

---

### **Step 4: Add PostgreSQL** (1 minute)

1. In the project view, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will automatically:
   - Create a PostgreSQL instance
   - Set `DATABASE_URL` variable in your backend service
   - Link the services together

---

### **Step 5: Add Redis** (1 minute)

1. Click **"+ New"** again
2. Select **"Database"** → **"Add Redis"**
3. Railway will automatically set `REDIS_URL`

---

### **Step 6: Wait for Deployment** (3-5 minutes)

1. Go back to your backend service
2. Click **"Deployments"** tab
3. Watch the build logs
4. Once deployed, you'll see a green ✅ status
5. Click **"Settings"** → **"Networking"** → **"Generate Domain"**
6. Copy your backend URL (e.g., `https://your-app.railway.app`)

---

### **Step 7: Create Superuser** (1 minute)

1. Go to your backend service
2. Click **"Deployments"** → Latest deployment
3. Scroll down and click **"Terminal"** button (📟 icon)
4. Run:
```bash
python manage.py createsuperuser
```
5. Enter username, email, and password

---

### **Step 8: Deploy Frontend** (2 minutes)

#### Option A: Deploy on Vercel (Recommended - Free & Fast)

1. Go to **https://vercel.com**
2. Sign in with GitHub
3. Click **"Add New..."** → **"Project"**
4. Import your repository: `Samrudhi1004/Ledger-Entry-Automation`
5. Configure:
   - **Root Directory**: `dashboard`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Add Environment Variable:
   ```
   VITE_API_URL=https://your-backend.railway.app
   ```
7. Click **"Deploy"**
8. Wait 2-3 minutes
9. Your dashboard will be live at `https://your-dashboard.vercel.app`

#### Option B: Deploy on Railway (Uses your $5 credit)

1. In Railway project, click **"+ New"** → **"GitHub Repo"**
2. Select the same repository
3. Set **"Root Directory"**: `dashboard`
4. Railway auto-detects it's a Node.js app
5. Deploy automatically starts

---

### **Step 9: Update CORS** (1 minute)

1. Go back to your **backend service** on Railway
2. Go to **"Variables"** tab
3. Update `CORS_ALLOWED_ORIGINS`:
```env
CORS_ALLOWED_ORIGINS=https://your-dashboard.vercel.app,http://localhost:3000
```
4. Update `ALLOWED_HOSTS`:
```env
ALLOWED_HOSTS=.railway.app,.vercel.app
```
5. Service will auto-redeploy

---

### **Step 10: Test Your Application** (2 minutes)

1. Open your frontend URL: `https://your-dashboard.vercel.app`
2. Try logging in with the superuser you created
3. Test API calls
4. Check WebSocket connection (if using real-time features)

---

## ✅ You're Done!

Your project is now live:
- **Backend**: https://your-backend.railway.app
- **Frontend**: https://your-dashboard.vercel.app
- **Admin Panel**: https://your-backend.railway.app/admin

---

## 🔧 Common Issues & Fixes

### Issue: Backend deployment fails with migration error

**Fix**:
1. Go to Railway backend terminal
2. Run: `python manage.py migrate --fake-initial`
3. Redeploy

### Issue: Frontend can't connect to backend

**Fix**:
1. Check CORS settings in backend
2. Ensure `VITE_API_URL` is set correctly in Vercel
3. Check Network tab in browser DevTools

### Issue: Static files not loading

**Fix**:
1. Ensure `whitenoise` is in `requirements.txt`
2. Check `STATIC_ROOT` in settings.py
3. Redeploy backend

---

## 📊 Monitoring

### Check Logs
- Railway: Service → Deployments → Click deployment → View logs
- Vercel: Project → Deployments → Click deployment → View logs

### Database Access
- Railway: Click PostgreSQL service → "Data" tab → Browse tables

### Usage & Billing
- Railway: Account → Usage → See credit usage
- Vercel: Account → Usage → See bandwidth/builds

---

## 🆘 Need Help?

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Railway Status: https://status.railway.app

---

## 💰 Cost Breakdown

**Railway Free Tier**: $5/month credit
- Backend: ~$2/month (always-on)
- PostgreSQL: ~$1/month
- Redis: ~$0.50/month
- **Total**: ~$3.50/month (fits in free tier!)

**Vercel**: FREE forever for personal projects
- Unlimited bandwidth
- Unlimited deployments
- Global CDN

---

**Total Cost: $0/month** (within free tiers) 🎉

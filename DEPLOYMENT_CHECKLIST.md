# 🚀 Railway Deployment Checklist

Complete guide to deploy the entire BA-hack project on Railway.

## Overview

This project consists of:

1. **ClickHouse Database** - Stores indexed blockchain events
2. **SQD Indexer** - Monitors blockchain and indexes events
3. **Next.js Web App** - Frontend UI displaying events

## Deployment Steps

### ✅ Step 1: Deploy ClickHouse

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Click "Deploy ClickHouse" (from templates)
4. Wait for deployment to complete (~2-3 minutes)
5. **Save these credentials:**
   - Click on ClickHouse service → "Variables" tab
   - Note down:
     ```
     CLICKHOUSE_URL=https://clickhouse-production-xxxx.up.railway.app
     CLICKHOUSE_USER=default
     CLICKHOUSE_PASSWORD=<generated-password>
     ```

**Cost:** ~$5-10/month

---

### ✅ Step 2: Deploy SQD Indexer

#### Option A: From GitHub (Recommended)

1. **Push code to GitHub**

   ```bash
   cd /path/to/BA-hack
   git add .
   git commit -m "Ready for Railway deployment"
   git push origin main
   ```

2. **Create Railway Service**

   - In Railway Dashboard → Your Project
   - Click "New" → "GitHub Repo"
   - Select your repository
   - Railway will detect the code

3. **Configure Service**

   - Click on the new service → "Settings"
   - **Service Name:** `sqd-indexer`
   - **Root Directory:** `sqd`
   - **Start Command:** `npm start` (auto-detected from package.json)

4. **Add Environment Variables**

   - Click "Variables" tab
   - Add these:

   ```env
   CONTRACT_ADDRESS=0x5b0b1cbF40C910f58B8Ff1d48A629f257a556B99
   FROM_BLOCK=9680000
   PORTAL_URL=https://portal.sqd.dev/datasets/ethereum-sepolia
   CLICKHOUSE_URL=${{ClickHouse.CLICKHOUSE_URL}}
   CLICKHOUSE_USER=${{ClickHouse.CLICKHOUSE_USER}}
   CLICKHOUSE_PASSWORD=${{ClickHouse.CLICKHOUSE_PASSWORD}}
   ```

   💡 **Pro Tip:** Use `${{ServiceName.VARIABLE}}` to reference variables from other services

5. **Deploy**
   - Click "Deploy" or push to GitHub (auto-deploys)
   - Check logs: Should see "Table bahack_events created/verified"

**Cost:** ~$5/month

---

### ✅ Step 3: Deploy Next.js Web App

#### Option A: Deploy on Railway

1. **In Railway Dashboard**

   - Click "New" → "GitHub Repo"
   - Select your repository

2. **Configure Service**

   - **Service Name:** `web-app`
   - **Root Directory:** `web`
   - Railway auto-detects Next.js

3. **Add Environment Variables**

   ```env
   CLICKHOUSE_URL=${{ClickHouse.CLICKHOUSE_URL}}
   CLICKHOUSE_USER=${{ClickHouse.CLICKHOUSE_USER}}
   CLICKHOUSE_PASSWORD=${{ClickHouse.CLICKHOUSE_PASSWORD}}
   ```

4. **Enable Public URL**
   - Settings → Networking → Generate Domain
   - Your app will be available at: `https://your-app.railway.app`

**Cost:** ~$5-10/month

#### Option B: Deploy on Vercel (Recommended for Next.js)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project" → Import Git Repository
3. Select your repository
4. **Root Directory:** `web`
5. Add environment variables:
   ```env
   CLICKHOUSE_URL=https://your-railway-clickhouse.railway.app
   CLICKHOUSE_USER=default
   CLICKHOUSE_PASSWORD=your_password
   ```
6. Deploy

**Cost:** Free tier available

---

## Verification

### ✅ Check Indexer is Running

**Railway Dashboard:**

- SQD Indexer service → Deployments → View Logs
- Should see: `Inserted X events`

**Query ClickHouse:**

```bash
curl -X POST "https://your-clickhouse.railway.app" \
  --user "default:your_password" \
  -d "SELECT COUNT(*) FROM bahack_events FORMAT JSONEachRow"
```

Expected: `{"count()":"5"}`

### ✅ Check Web App

1. Visit your deployed URL
2. Scroll down to "Recent Dataset Uploads" section
3. Should see indexed events from blockchain

---

## Cost Summary

| Service         | Hosting | Estimated Cost |
| --------------- | ------- | -------------- |
| ClickHouse      | Railway | $5-10/month    |
| SQD Indexer     | Railway | $5/month       |
| Next.js Web App | Railway | $5-10/month    |
| Next.js Web App | Vercel  | **Free**       |

**Total (Railway only):** ~$15-25/month  
**Total (Railway + Vercel):** ~$10-15/month

---

## Environment Variables Cheat Sheet

### SQD Indexer (`sqd/`)

```env
CONTRACT_ADDRESS=0x5b0b1cbF40C910f58B8Ff1d48A629f257a556B99
FROM_BLOCK=9680000
PORTAL_URL=https://portal.sqd.dev/datasets/ethereum-sepolia
CLICKHOUSE_URL=https://clickhouse-production-xxxx.railway.app
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=<from-railway>
```

### Web App (`web/`)

```env
CLICKHOUSE_URL=https://clickhouse-production-xxxx.railway.app
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=<from-railway>
```

---

## Troubleshooting

### ❌ Indexer: "Cannot connect to ClickHouse"

**Fix:**

1. Check ClickHouse service is running
2. Verify environment variables are correct
3. Check Railway service logs for details

### ❌ Web App: "Failed to fetch events" (500 error)

**Fix:**

1. Check ClickHouse credentials in environment variables
2. Test ClickHouse connection:
   ```bash
   curl "https://your-clickhouse.railway.app/ping"
   ```
3. Verify indexer has inserted events

### ❌ No Events Showing

**Possible causes:**

1. **No transactions yet** → Upload a test dataset to smart contract
2. **Wrong FROM_BLOCK** → Set to block before first transaction
3. **Indexer not running** → Check Railway logs

**Fix:**

```bash
# Upload test dataset
cast send 0x5b0b1cbF40C910f58B8Ff1d48A629f257a556B99 \
  "upload(string,string,uint256,string)" \
  "test-$(date +%s)" \
  "Test dataset" \
  1000000 \
  "0xYourAddress" \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

---

## Monitoring

### Railway Metrics

Each service shows:

- CPU usage
- Memory usage
- Network traffic
- Deployment history

### Check Indexing Progress

```bash
curl -X POST "https://your-clickhouse.railway.app" \
  --user "default:your_password" \
  -d "SELECT MAX(block_number) as latest_block FROM bahack_events FORMAT JSONEachRow"
```

### View Latest Events

```bash
curl -X POST "https://your-clickhouse.railway.app" \
  --user "default:your_password" \
  -d "SELECT text_id, description, price_usdc FROM bahack_events ORDER BY block_number DESC LIMIT 5 FORMAT JSONEachRow"
```

---

## Updates & Redeployment

### Auto-Deploy on Git Push

Railway auto-deploys when you push to GitHub:

```bash
git add .
git commit -m "Update features"
git push origin main
```

### Manual Redeploy

Railway Dashboard → Service → Deployments → "Redeploy"

---

## Next Steps

Once deployed:

1. ✅ Test uploading a dataset via smart contract
2. ✅ Verify event appears in UI within 30 seconds
3. ✅ Set up monitoring/alerts
4. ✅ Configure custom domain (optional)
5. ✅ Enable Railway health checks

---

## Support

- **Railway Docs:** https://docs.railway.app
- **SQD Docs:** https://docs.subsquid.io
- **Next.js Docs:** https://nextjs.org/docs
- **Railway Discord:** https://discord.gg/railway

---

## 🎉 Success!

Your blockchain indexer and web app are now live on Railway!

**Architecture:**

```
Sepolia Testnet
      ↓
SQD Indexer (Railway)
      ↓
ClickHouse (Railway)
      ↓
Next.js Web App (Railway/Vercel)
      ↓
Users see real-time blockchain events! 🚀
```

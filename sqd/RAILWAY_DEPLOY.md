# 🚂 Deploy SQD Indexer to Railway

This guide explains how to deploy the SQD blockchain indexer to Railway.

## Prerequisites

1. **Railway Account** - Sign up at [railway.app](https://railway.app)
2. **GitHub Repository** - Your code should be in a Git repository
3. **ClickHouse Database** - Already deployed on Railway

## Step 1: Deploy ClickHouse on Railway

If you haven't already deployed ClickHouse:

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project" → "Deploy ClickHouse"
3. Wait for deployment to complete
4. Click on ClickHouse service → "Variables" tab
5. Note down these values:
   - `CLICKHOUSE_URL` (e.g., `https://clickhouse-production-xxxx.up.railway.app`)
   - `CLICKHOUSE_PASSWORD`
   - `CLICKHOUSE_USER` (usually `default`)

## Step 2: Deploy SQD Indexer

### Option A: Deploy from GitHub (Recommended)

1. **Push your code to GitHub**

   ```bash
   cd /path/to/BA-hack
   git add .
   git commit -m "Add SQD indexer"
   git push origin main
   ```

2. **Create New Service on Railway**

   - Go to Railway Dashboard
   - Click on your project (or create new)
   - Click "New" → "GitHub Repo"
   - Select your repository
   - Railway will auto-detect the `sqd/` folder

3. **Configure Root Directory**

   - Click on the service → "Settings"
   - Under "Build", set **Root Directory** to: `sqd`
   - Click "Deploy"

4. **Add Environment Variables**

   - Click on service → "Variables" tab
   - Add these variables:

   ```env
   CONTRACT_ADDRESS=0x5b0b1cbF40C910f58B8Ff1d48A629f257a556B99
   FROM_BLOCK=9680000
   PORTAL_URL=https://portal.sqd.dev/datasets/ethereum-sepolia
   CLICKHOUSE_URL=${{ClickHouse.CLICKHOUSE_URL}}
   CLICKHOUSE_USER=${{ClickHouse.CLICKHOUSE_USER}}
   CLICKHOUSE_PASSWORD=${{ClickHouse.CLICKHOUSE_PASSWORD}}
   ```

   **Note:** Railway allows referencing variables from other services using `${{ServiceName.VARIABLE}}`

5. **Deploy**
   - Railway will automatically deploy
   - Check logs to verify it's working

### Option B: Deploy from Railway CLI

1. **Install Railway CLI**

   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**

   ```bash
   railway login
   ```

3. **Initialize Project**

   ```bash
   cd sqd
   railway init
   ```

4. **Link to existing project** (if you have one)

   ```bash
   railway link
   ```

5. **Set Environment Variables**

   ```bash
   railway variables set CONTRACT_ADDRESS=0x5b0b1cbF40C910f58B8Ff1d48A629f257a556B99
   railway variables set FROM_BLOCK=9680000
   railway variables set PORTAL_URL=https://portal.sqd.dev/datasets/ethereum-sepolia
   railway variables set CLICKHOUSE_URL=your_clickhouse_url
   railway variables set CLICKHOUSE_USER=default
   railway variables set CLICKHOUSE_PASSWORD=your_password
   ```

6. **Deploy**
   ```bash
   railway up
   ```

## Step 3: Verify Deployment

### Check Logs

**In Railway Dashboard:**

- Click on your indexer service
- Click "Deployments" → Latest deployment
- Click "View Logs"

You should see:

```
DataUploaded event signature: 0x...
Table bahack_events created/verified
Inserted X events
```

### Query ClickHouse

Test if events are being indexed:

```bash
curl -X POST "https://your-clickhouse-instance.railway.app" \
  --user "default:your_password" \
  -d "SELECT COUNT(*) FROM bahack_events"
```

### Check from Web App

Your web app at `http://localhost:3000` should now show events once you:

1. Update web app's `.env.local` with Railway ClickHouse credentials
2. Restart the web dev server

## Environment Variables Reference

| Variable              | Description                    | Example                                            |
| --------------------- | ------------------------------ | -------------------------------------------------- |
| `CONTRACT_ADDRESS`    | BAHack smart contract address  | `0x5b0b...91B9`                                    |
| `FROM_BLOCK`          | Start indexing from this block | `9680000`                                          |
| `PORTAL_URL`          | SQD data portal URL            | `https://portal.sqd.dev/datasets/ethereum-sepolia` |
| `CLICKHOUSE_URL`      | Railway ClickHouse URL         | `https://clickhouse-production-xxxx.railway.app`   |
| `CLICKHOUSE_USER`     | ClickHouse username            | `default`                                          |
| `CLICKHOUSE_PASSWORD` | ClickHouse password            | From Railway dashboard                             |

## Monitoring

### View Indexer Status

Railway Dashboard → Service → Metrics:

- CPU usage
- Memory usage
- Network traffic

### Check Indexing Progress

Query the latest indexed block:

```bash
curl -X POST "https://your-clickhouse-instance.railway.app" \
  --user "default:your_password" \
  -d "SELECT MAX(block_number) as latest_block FROM bahack_events"
```

## Troubleshooting

### Deployment Fails

**Error:** "Module not found"

- **Fix:** Make sure `ts-node` and `typescript` are in `dependencies` (not `devDependencies`)

**Error:** "Cannot connect to ClickHouse"

- **Fix:** Verify ClickHouse service is running and environment variables are correct

### No Events Being Indexed

**Problem:** Logs show "Inserted 0 events"

- **Possible causes:**
  1. No new transactions on the smart contract
  2. Wrong `CONTRACT_ADDRESS`
  3. Wrong `FROM_BLOCK` (set it to a block before first transaction)

**Solution:**

```bash
# Update FROM_BLOCK to an earlier block
railway variables set FROM_BLOCK=9680000
# Redeploy
railway up
```

### Indexer Keeps Restarting

**Problem:** Service restarts frequently

- **Fix:** Check logs for errors. Common issues:
  - Invalid ClickHouse credentials
  - Network timeout (increase timeout in code)
  - Out of memory (upgrade Railway plan)

## Cost Optimization

Railway pricing tips:

1. **Starter Plan:** $5/month per service
2. **ClickHouse:** ~$5-10/month for small datasets
3. **Indexer:** ~$5/month (minimal CPU/memory usage)

**Total estimated cost:** ~$15-20/month for both services

### Reduce Costs

- Use Railway's free trial ($5 credit)
- Deploy only ClickHouse on Railway, run indexer locally
- Use Railway's sleep feature for non-production environments

## Updates & Redeployment

### Update Code

```bash
# Make changes locally
git add .
git commit -m "Update indexer"
git push origin main

# Railway auto-deploys on git push
```

### Manual Redeploy

Railway Dashboard → Service → Deployments → "Redeploy"

Or via CLI:

```bash
railway up
```

## Advanced Configuration

### Health Check Endpoint

Add a health check to ensure service is running:

```typescript
// Add to pipe-bahack.ts
import http from "http";

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200);
    res.end("OK");
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Health check server running on port ${PORT}`);
});
```

Then in Railway → Settings → Health Check:

- Path: `/health`
- Interval: 60 seconds

### Custom Domain

Railway → Service → Settings → Domains → Add Custom Domain

### Secrets Management

For sensitive values, use Railway's secrets:

```bash
railway variables set PRIVATE_KEY=your_secret_key --secret
```

## Next Steps

1. ✅ Deploy ClickHouse
2. ✅ Deploy SQD Indexer
3. ✅ Update Web App to use Railway ClickHouse
4. ✅ Test end-to-end flow

Your blockchain events are now being indexed on Railway! 🎉

## Support

- Railway Docs: https://docs.railway.app
- SQD Docs: https://docs.subsquid.io
- Railway Discord: https://discord.gg/railway

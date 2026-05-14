# Deploying JuicedTrade to AWS Lightsail

Target: `juicedtrade.com` on AWS Lightsail (Ubuntu) with Nginx + Let's Encrypt SSL + PM2 + system cron.
End-to-end time: ~30 minutes after the instance is up.

---

## 1. Spin up the Lightsail instance

1. AWS Console → **Lightsail** → **Create instance**
2. Region: pick one close to you (Mumbai `ap-south-1` if you're in India, or `us-east-1` for global default)
3. Platform: **Linux/Unix**
4. Blueprint: **OS Only → Ubuntu 22.04 LTS**
5. Instance plan: **$10/month (2 GB RAM, 2 vCPU, 60 GB SSD)** — the 1 GB plan ($5) will OOM during `npm run build`
6. Name: `juicedtrade`
7. Click **Create instance** — wait ~1 min for it to boot

## 2. Static IP + open ports

1. Lightsail → your instance → **Networking** tab
2. Click **Attach static IP** → name it `juicedtrade-ip`, attach
3. Under **IPv4 Firewall**, add rules:
   - **HTTP** (TCP 80) — already there by default
   - **HTTPS** (TCP 443) — add this
   - SSH (TCP 22) is already there
4. Copy the **Static IP** somewhere — you'll need it for DNS

## 3. Point Namecheap DNS at the instance

1. Namecheap dashboard → **Domain List** → click **Manage** next to `juicedtrade.com`
2. Open the **Advanced DNS** tab
3. Delete the parking page records (URL Redirect, CNAME for `www`) if present
4. Add two **A records**:
   | Type | Host | Value | TTL |
   |------|------|-------|-----|
   | A Record | `@` | `<Lightsail static IP>` | Automatic |
   | A Record | `www` | `<Lightsail static IP>` | Automatic |
5. Save. Propagation usually takes 5–30 minutes. Check with `dig juicedtrade.com +short` — should return your Lightsail IP.

## 4. SSH in and install the runtime

From the Lightsail instance page, click **Connect using SSH** (browser shell) or use your own SSH client with the downloaded key.

```bash
# Update OS
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx

# PM2 for process management
sudo npm install -g pm2

# Verify versions
node -v && npm -v && nginx -v && pm2 -v
```

## 5. Clone, install, build, run

```bash
# Clone into home directory
cd ~
git clone https://github.com/HarshitSingh-PM/Stock-screener.git juicedtrade
cd juicedtrade

# Install dependencies and build for production
npm ci
npm run build

# Make sure the bot state directory exists and is writable
mkdir -p data

# Start with PM2
pm2 start npm --name juicedtrade -- start
pm2 save

# Make PM2 launch on reboot (run the command it prints)
pm2 startup systemd
# It will print a sudo command — copy-paste and run it
```

Verify locally on the box:
```bash
curl -s http://127.0.0.1:3000 | grep -o '<title>.*</title>'
# Should print: <title>JuicedTrade Stock Screener — 100 Strategies for NSE & S&P 500</title>
```

## 6. Nginx reverse proxy

```bash
sudo tee /etc/nginx/sites-available/juicedtrade > /dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name juicedtrade.com www.juicedtrade.com;

    # Increase timeouts for slow Yahoo Finance scans (bot run can take ~2-3 min)
    proxy_read_timeout 360s;
    proxy_connect_timeout 60s;
    proxy_send_timeout 360s;
    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/juicedtrade /etc/nginx/sites-enabled/juicedtrade
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t           # should say "syntax is ok"
sudo systemctl reload nginx
```

Now visit `http://juicedtrade.com` — it should load (over plain HTTP).

## 7. HTTPS with Let's Encrypt

```bash
# Install certbot
sudo snap install core && sudo snap refresh core
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot

# Request and install cert (auto-edits the Nginx config)
sudo certbot --nginx -d juicedtrade.com -d www.juicedtrade.com \
  --non-interactive --agree-tos -m you@yourdomain.com --redirect

# Verify auto-renew is scheduled
sudo systemctl status snap.certbot.renew.timer
```

Visit `https://juicedtrade.com` — green padlock should show.

## 8. Daily bot cron

The bot must run once a day after both markets have closed. 23:00 UTC = after US close (Mon–Fri).

```bash
crontab -e
```

Add this line (and save):
```
0 23 * * 1-5 curl -s "http://127.0.0.1:3000/api/bot/run?both=1" > /var/log/juicedtrade-bot.log 2>&1
```

Verify the schedule:
```bash
crontab -l
```

Trigger a one-off test:
```bash
curl -s "http://127.0.0.1:3000/api/bot/run?both=1" | head -c 500
```

## 9. Pushing updates from your laptop

After you push to GitHub, redeploy on the server:

```bash
cd ~/juicedtrade
git pull
npm ci             # only needed if package.json/lock changed
npm run build
pm2 restart juicedtrade
```

Optional: wrap into a one-liner alias in `~/.bashrc`:
```bash
alias jt-deploy='cd ~/juicedtrade && git pull && npm ci && npm run build && pm2 restart juicedtrade'
```

## 10. Routine ops

| Task | Command |
|------|---------|
| Logs (app) | `pm2 logs juicedtrade` |
| Logs (Nginx) | `sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log` |
| Bot last run | `tail -50 /var/log/juicedtrade-bot.log` |
| Bot state files | `ls -la ~/juicedtrade/data/` |
| Restart app | `pm2 restart juicedtrade` |
| Restart Nginx | `sudo systemctl reload nginx` |
| Disk usage | `df -h && du -sh ~/juicedtrade` |
| Memory | `free -h` |

## 11. Backups (optional but recommended)

Lightsail supports automatic snapshots — Lightsail console → Snapshots → enable **Automatic snapshots** ($1/mo extra). Keeps 7 daily snapshots. One-click restore.

The bot state files (`data/bot-state-*.json`) are the only mutable data outside git. If you want offsite backups, cron an upload to S3:
```bash
# Once a day, sync bot state to S3
0 1 * * * aws s3 sync ~/juicedtrade/data s3://your-bucket/juicedtrade/ --quiet
```

## 12. Cost estimate

| Item | Cost |
|------|------|
| Lightsail 2 GB instance | $10 / mo |
| Static IP (attached) | Free |
| Outbound transfer (3 TB included) | $0 |
| Optional snapshots | $1 / mo |
| Namecheap domain (annual) | ~$10–13 / yr |
| **Total** | **~$11/mo + domain** |

## 13. Troubleshooting

- **`npm run build` killed / OOM** → 1 GB plan is too small; upgrade to 2 GB.
- **502 Bad Gateway from Nginx** → app crashed. `pm2 logs juicedtrade` → check the error → `pm2 restart juicedtrade`.
- **Yahoo Finance rate-limit errors** → spread bot scans, lower batch size in `src/lib/botTrader.ts` (`SCAN_BATCH`).
- **Cert renewal failed** → `sudo certbot renew --dry-run`. Usually a DNS issue.
- **`pm2 startup` not persisting** → re-run the command + run the printed `sudo env PATH=... pm2 startup ...` exactly.

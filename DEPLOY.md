# Rara Live — Deployment Guide
# Domain: raralive.in
# Subdomains: api.raralive.in | admin.raralive.in | agency.raralive.in
# VPS: Ubuntu 22.04, existing PostgreSQL already running

---

## PART 1 — DNS RECORDS

In your domain registrar, add these A records pointing to your VPS IP:

    A    api       <YOUR_VPS_IP>
    A    admin     <YOUR_VPS_IP>
    A    agency    <YOUR_VPS_IP>

Wait 5–30 min for propagation.

---

## PART 2 — ONE-TIME SERVER SETUP (run once on VPS)

```bash
ssh root@<YOUR_VPS_IP>

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install Nginx + Certbot
apt install -y nginx certbot python3-certbot-nginx

# Install PM2
npm install -g pm2
```

---

## PART 3 — DATABASE (uses your existing PostgreSQL)

```bash
# Connect as postgres superuser
su - postgres

# Create DB and user for Rara Live
psql << 'EOF'
CREATE DATABASE raralive;
CREATE USER raralive_user WITH PASSWORD 'RaraLive#123';
GRANT ALL PRIVILEGES ON DATABASE raralive TO raralive_user;
ALTER DATABASE raralive OWNER TO raralive_user;
EOF

exit
```

---

## PART 4 — UPLOAD CODE TO VPS

Run these on your LOCAL machine (Windows):

```bash
# Create folders on VPS first
ssh root@<VPS_IP> "mkdir -p /var/www/raralive/backend /var/www/raralive/admin /var/www/raralive/agency"

# Upload backend
scp -r "c:/Users/sivak/Desktop/sowsi/projects/RaraLive/backend" root@<VPS_IP>:/var/www/raralive/

# Build & upload admin panel
cd "c:/Users/sivak/Desktop/sowsi/projects/RaraLive/admin"
echo VITE_API_URL=https://api.raralive.in > .env.production
npm install
npm run build
scp -r dist/. root@<VPS_IP>:/var/www/raralive/admin/

# Build & upload agency panel
cd "c:/Users/sivak/Desktop/sowsi/projects/RaraLive/agencies"
echo VITE_API_URL=https://api.raralive.in > .env.production
npm install
npm run build
scp -r dist/. root@<VPS_IP>:/var/www/raralive/agency/
```

---

## PART 5 — BACKEND SETUP ON VPS

```bash
ssh root@<VPS_IP>

cd /var/www/raralive/backend
npm install --production

# Create production .env
cat > .env << 'EOF'
NODE_ENV=production
PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_USER=raralive_user
DB_PASSWORD=CHANGE_THIS_PASSWORD
DB_NAME=raralive

JWT_SECRET=REPLACE_WITH_64_CHAR_RANDOM_STRING
JWT_EXPIRES_IN=7d

ADMIN_SECRET=REPLACE_WITH_YOUR_ADMIN_SECRET
EOF

# Generate a strong JWT_SECRET (copy the output into .env above)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Run DB migrations (creates all tables)
npm run db:init

# Start with PM2
pm2 start server.js --name raralive-api
pm2 save
pm2 startup
# Run the command that pm2 startup prints
```

---

## PART 6 — NGINX CONFIG

```bash
cat > /etc/nginx/sites-available/raralive << 'EOF'

# ── api.raralive.in ───────────────────────────────────────────────────────────
server {
    listen 80;
    server_name api.raralive.in;
    client_max_body_size 15M;

    location /uploads/ {
        alias /var/www/raralive/backend/uploads/;
    }

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}

# ── admin.raralive.in ─────────────────────────────────────────────────────────
server {
    listen 80;
    server_name admin.raralive.in;

    root /var/www/raralive/admin;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# ── agency.raralive.in ────────────────────────────────────────────────────────
server {
    listen 80;
    server_name agency.raralive.in;

    root /var/www/raralive/agency;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Enable the site
ln -s /etc/nginx/sites-available/raralive /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## PART 7 — SSL CERTIFICATES

```bash
certbot --nginx -d api.raralive.in -d admin.raralive.in -d agency.raralive.in
# Choose option 2: Redirect HTTP to HTTPS
```

Certbot auto-renews. Test renewal with:
```bash
certbot renew --dry-run
```

---

## PART 8 — UPDATE CORS IN BACKEND

Edit the server.js on the VPS to restrict CORS:

```bash
nano /var/www/raralive/backend/server.js
```

Change this line:
```js
app.use(cors());
```

To this:
```js
app.use(cors({
  origin: [
    'https://admin.raralive.in',
    'https://agency.raralive.in',
  ],
  credentials: true,
}));
```

Then restart:
```bash
pm2 restart raralive-api
```

---

## PART 9 — VERIFY EVERYTHING

```bash
# API health check
curl https://api.raralive.in/api/health

# Check backend logs
pm2 logs raralive-api

# Check nginx errors
tail -50 /var/log/nginx/error.log

# Check PM2 status
pm2 status
```

Open in browser:
- https://admin.raralive.in   → Admin panel login
- https://agency.raralive.in  → Agency panel login
- https://api.raralive.in/api/health → Should return {"success":true}

---

## PART 10 — REDEPLOY AFTER CODE CHANGES

Backend change:
```bash
# Upload new backend files
scp -r "c:/Users/sivak/Desktop/sowsi/projects/RaraLive/backend" root@<VPS_IP>:/var/www/raralive/

# On VPS
cd /var/www/raralive/backend
npm install --production
pm2 restart raralive-api
```

Admin/Agency panel change:
```bash
# Build locally then upload
cd "c:/Users/sivak/Desktop/sowsi/projects/RaraLive/admin"
npm run build
scp -r dist/. root@<VPS_IP>:/var/www/raralive/admin/

cd "c:/Users/sivak/Desktop/sowsi/projects/RaraLive/agencies"
npm run build
scp -r dist/. root@<VPS_IP>:/var/www/raralive/agency/
# No nginx restart needed — static files are served directly
```

---

## CHECKLIST

- [ ] DNS A records added for api, admin, agency
- [ ] Node 20 installed on VPS
- [ ] Nginx + Certbot installed
- [ ] PM2 installed globally
- [ ] PostgreSQL DB "raralive" created with user "raralive_user"
- [ ] Backend uploaded to /var/www/raralive/backend
- [ ] .env created with production values (strong JWT_SECRET)
- [ ] npm run db:init ran successfully
- [ ] PM2 started: pm2 start + pm2 save + pm2 startup
- [ ] Admin panel built with VITE_API_URL and uploaded
- [ ] Agency panel built with VITE_API_URL and uploaded
- [ ] Nginx config created and enabled
- [ ] nginx -t passed, nginx reloaded
- [ ] SSL cert issued via certbot for all 3 subdomains
- [ ] CORS updated in server.js to allow only raralive.in subdomains
- [ ] https://api.raralive.in/api/health returns success
- [ ] https://admin.raralive.in loads
- [ ] https://agency.raralive.in loads

---

## NOTES

- Uploads folder (/var/www/raralive/backend/uploads/) persists across deployments
  — do NOT delete it when redeploying backend
- The .env file on VPS is NOT uploaded from your machine — it stays on server only
- After SSL is set up, the React Native app's api.ts must also be updated:
  Change BASE_URL from 192.168.x.x:5000 to https://api.raralive.in/api

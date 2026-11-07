# PropGuard 🛡️
> **B2B Discord Risk & Support Bot for Retail Futures Prop Trading Firms**

PropGuard is a production-ready, modular Discord bot engineered specifically for futures prop trading firms (e.g., Tradeify, Lucid Trading, Apex Trader Funding, Bulenox). It eliminates repetitive support tickets and community disputes by providing exact mathematical calculations for drawdown thresholds, session halt timers, and breach explainers.

---

## 🚀 Key Features

### 1. `/drawdown` — Mathematical Verification Engine
Computes trailing drawdown thresholds, liquidation floors, and usable buffers with mathematical precision.
* **Intraday (High-Water Mark)**: Dynamically tracks live unrealized peak equity tick-by-tick.
* **End of Day (EOD)**: Calculates the floor strictly off the settled session balance at 5:00 PM EST, while evaluating liquidation in real time against live equity.
* **Funded Account Floor Lock**: Automatically caps the liquidation floor at `Starting Balance + $100` once the trailing threshold touches or exceeds the lock barrier on funded/PA accounts.
* **Health Diagnosis**:
  * 🟢 **HEALTHY** (`#57F287`): Usable buffer $\ge \$500.00$.
  * 🟡 **CRITICAL** (`#FEE75C`): Usable buffer $< \$500.00$.
  * 🔴 **BREACHED** (`#ED4245`): Current equity $\le$ Liquidation Floor.

### 2. `/cutoff` — CME Session Halt & Liquidation Warning
Live monitor for Chicago Mercantile Exchange (CME) Equity Index Futures (ES, NQ, YM, RTY).
* **Dynamic Localized Discord Timestamps**: Generates `<t:TIMESTAMP:R>` (relative countdown) and `<t:TIMESTAMP:F>` (full date/time) so every user sees deadlines in their own local device time.
* **Maintenance Halt Tracking**: Accurately tracks Monday–Thursday 4:59 PM to 6:00 PM EST maintenance halts and Friday 4:59 PM EST weekend closes.
* **Pre-Halt Auto-Liquidation Warning**: Issues urgent warnings for the **4:55 PM – 4:58 PM EST broker-side auto-liquidation window** to prevent mandatory position flattening penalties on intraday accounts.

### 3. `/dispute-check` — Pre-Ticket Deflector
Delivers immediate, ephemeral explanations for the most common prop firm support disputes:
* `green_blowup`: Explains why an account blew up even though the trader closed their trade green (how open profit peaks ratchet the trailing floor higher).
* `cme_halt`: Details platform auto-liquidation rules before the 5:00 PM EST maintenance window.
* `daily_vs_trailing`: Differentiates between soft breach (Daily Loss Limit locking trading until 6:00 PM EST) and hard breach (Trailing Drawdown terminating the account).

---

## 📂 Architecture & File Structure

```text
src/
├── index.ts                  # Bot initialization, event listeners, slash command dispatcher
├── config/
│   ├── env.ts                # Validated environment variables (DISCORD_TOKEN, CLIENT_ID, GUILD_ID)
│   ├── tenants.ts            # Centralized Multi-Tenant Registry & Account Tiers
│   └── firmRules.ts          # Configurable presets for target prop firms (Tradeify, Lucid, Apex, Generic)
├── commands/
│   ├── index.ts              # Command aggregator & type mappings
│   ├── drawdown.ts           # Slash command: /drawdown
│   ├── cutoff.ts             # Slash command: /cutoff
│   └── disputeCheck.ts       # Slash command: /dispute-check
├── services/
│   ├── drawdownCalculator.ts # Pure business logic for Trailing & EOD thresholds (100% decoupled)
│   └── sessionService.ts     # CME session math, timezone conversions, halt countdowns
├── utils/
│   └── embedBuilder.ts       # Discord Embed formatting with consistent colors and badges
└── scripts/
    └── deployCommands.ts     # REST API Slash command registration (guild-specific or global)
tests/
├── tenants.test.ts            # Multi-tenant registry, guild resolution, and tier matching tests
├── drawdownCalculator.test.ts # 19 unit tests covering trailing, locks, boundaries, & EOD
├── sessionService.test.ts     # 11 unit tests covering pure UTC halts, cutoffs, and weekends
├── embedBuilder.test.ts       # Whitelabel embed branding and layout tests
└── commands.test.ts           # Command option validation and mock interaction tests
```

---

## 🛠️ Tech Stack & Environment

* **Runtime**: Node.js (v20+) with TypeScript (strict mode enabled)
* **Discord Library**: discord.js v14 (REST API v10 for slash command registration)
* **Time Handling**: `date-fns-tz` for timezone handling (`America/New_York` & `America/Chicago`)
* **Testing**: Vitest for lightning-fast unit tests
* **Tooling**: `ts-node` for development, `tsc` for building to `/dist`

---

## ⚙️ Installation & Setup

### 1. Clone & Install Dependencies
```bash
git clone <repository_url>
cd propguard-bot
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your bot credentials:
```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id_here

# Optional: Set a specific GUILD_ID for instant slash command updates during dev.
# If omitted or left blank, commands register globally.
GUILD_ID=123456789012345678

DEFAULT_FIRM_PRESET=generic
NODE_ENV=development
```

### 3. Deploy Slash Commands
Register the `/drawdown`, `/cutoff`, and `/dispute-check` slash commands with Discord:
```bash
npm run deploy:commands
```

### 4. Build & Start the Bot
```bash
# Build TypeScript to /dist
npm run build

# Start production bot
npm start

# Or run in development mode with ts-node
npm run dev
```

---

## 🧪 Testing & Verification

PropGuard comes with a full test suite with 43 automated tests:

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run full verification (tests + TypeScript compile)
npm run verify
```

### Edge Cases Covered in Tests:
* ✅ Dynamic trailing floor updates on intraday unrealized profit surges.
* ✅ End-of-Day (EOD) floor remaining fixed during intraday swings until settlement.
* ✅ Drawdown lock at `Starting Balance + $100` for funded/PA accounts.
* ✅ Exact boundary tests (`current_equity === floor` triggering `BREACHED`).
* ✅ CME daily maintenance halt transitions (4:59 PM – 6:00 PM EST).
* ✅ Broker auto-liquidation windows (4:55 PM – 4:58 PM EST).
* ✅ Weekend transition from Friday 4:59 PM EST close through Sunday 6:00 PM EST open.
* ✅ Ephemeral dispute checks for all common support friction points.

---

## 🚢 Fly.io Deployment

PropGuard is containerized as an unrouted worker daemon (outbound WebSocket to Discord Gateway, no inbound HTTP port required).

### 1. Fly CLI Installation & Login
If not already authenticated:
```bash
# Log in to your Fly.io account
fly auth login
```

### 2. Launch or Register Application
Launch the app using the pre-configured [fly.toml](file:///d:/programming/discord_bots/propfirms/propguard-bot/fly.toml):
```bash
fly launch --no-deploy --copy-config
```

### 3. Configure Secrets
Set production environment secrets in Fly.io (these will not be exposed in your image or repository):
```bash
fly secrets set \
  DISCORD_TOKEN="your_bot_token_here" \
  CLIENT_ID="your_application_client_id_here" \
  GUILD_ID="your_optional_guild_id" \
  ALERT_CHANNEL_ID="your_alert_channel_id"
```

### 4. Deploy Application
Deploy to Fly.io using the remote builder:
```bash
fly deploy
```

> [!IMPORTANT]
> **Single Instance Constraint**: Discord bots must run as a single instance to prevent duplicate command responses and duplicate scheduled 16:45 ET cutoff alerts. Verify your machine count:
> ```bash
> fly scale count 1
> ```

### 5. Monitor & Manage
```bash
# Stream live logs
fly logs

# Check machine status
fly status

# Restart the bot
fly apps restart
```

---

## 🌐 Render.com Deployment (100% Free Tier, No Credit Card)

PropGuard includes a built-in lightweight HTTP healthcheck endpoint (`/health`) on `process.env.PORT` so it can run as a **Free Web Service** on Render.

### 1. Push Code to GitHub
Push your latest commits to your GitHub repository:
```bash
git add .
git commit -m "Add Render support with keep-alive healthcheck"
git push origin main
```

### 2. Create Web Service on Render
1. Go to **[render.com](https://dashboard.render.com/)** and log in with GitHub (no credit card required).
2. Click **New +** $\rightarrow$ **Web Service**.
3. Select your `propguard-bot` repository.
4. Fill in the service settings (or let Render detect [render.yaml](file:///d:/programming/discord_bots/propfirms/propguard-bot/render.yaml)):
   * **Name**: `propguard-bot`
   * **Runtime**: `Node`
   * **Build Command**: `npm install && npm run build`
   * **Start Command**: `npm start`
   * **Instance Type**: `Free` (512MB RAM, 0.1 CPU)

### 3. Add Environment Variables in Render Dashboard
Under the **Environment Variables** section, add:
* `DISCORD_TOKEN`: Your Discord bot token
* `CLIENT_ID`: Your Discord application client ID
* `ALERT_CHANNEL_ID`: Channel ID for the 16:45 ET cutoff alerts
* `GUILD_ID`: Optional guild ID for instant slash command registration
* `NODE_ENV`: `production`

Click **Deploy Web Service**.

### 4. Keep Bot 24/7 Awake with Free Uptime Monitoring
Render spins down free Web Services after 15 minutes if no HTTP requests arrive. To keep PropGuard running 24/7:
1. Go to **[cron-job.org](https://cron-job.org)** or **[uptimerobot.com](https://uptimerobot.com)** (100% free, no credit card).
2. Add a new monitor / cron job:
   * **URL**: `https://<your-render-subdomain>.onrender.com/health`
   * **Interval**: Every **10 minutes**
3. With an HTTP ping every 10 minutes, Render will **never** put the bot to sleep!

---

## 📄 License
MIT


<div align="center">

<img src="public/logo.png" alt="Coolify Deployments" width="110" />

# Coolify Deployments

### The missing VS Code extension for [Coolify](https://coolify.io) — deploy, monitor and manage your self-hosted infrastructure without leaving your editor

[![GitHub Release](https://img.shields.io/github/v/release/magnetoid/Coolify-Deployments?style=for-the-badge&logo=github&label=Latest&color=238636)](https://github.com/magnetoid/Coolify-Deployments/releases)
[![VS Code Marketplace](https://img.shields.io/badge/Marketplace-Coming%20Soon-555?style=for-the-badge&logo=visual-studio-code)](https://github.com/magnetoid/Coolify-Deployments)
[![Open VSX](https://img.shields.io/badge/Open%20VSX-Coming%20Soon-555?style=for-the-badge)](https://github.com/magnetoid/Coolify-Deployments)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

**Works in** &nbsp;
![VS Code](https://img.shields.io/badge/VS%20Code-✓-007ACC?logo=visual-studio-code&logoColor=white)
![Cursor](https://img.shields.io/badge/Cursor-✓-black)
![Windsurf](https://img.shields.io/badge/Windsurf-✓-5C5CFF)
![Trae](https://img.shields.io/badge/Trae-✓-FF6B35)
![VSCodium](https://img.shields.io/badge/VSCodium-✓-2F80ED)
![Antigravity](https://img.shields.io/badge/Antigravity-✓-6C3BFF)

</div>

---

## What is this?

[Coolify](https://coolify.io) is an open-source, self-hosted alternative to Heroku / Netlify / Vercel. It lets you run apps, databases, and services on your own servers with full control.

**Coolify Deployments** brings the full Coolify experience into your editor's sidebar. Instead of switching browser tabs every time you want to deploy, check a log, or restart a service — you do it all from within VS Code (or any compatible editor) with a click or a keyboard shortcut.

**No browser switching. No copy-pasting UUIDs. No context loss.**

---

## What it does

### 🌳 Live Sidebar — Your infrastructure at a glance

A native TreeView in the sidebar displays your entire Coolify workspace in real time, auto-refreshing every few seconds:

```
COOLIFY DEPLOYMENTS
│
├── 📦 Applications
│   ├── 🟢 coolify-api        running     [🚀 ↺ 📋]
│   ├── 🔴 marketing-site     stopped     [▶ 📋]
│   └── 🟡 analytics-worker   deploying…  [✖]
│
├── 🖥️  Servers
│   ├── hetzner-prod-01   192.168.1.10   online
│   └── hetzner-backup    192.168.2.14   online
│
└── 🗄️  Databases
    ├── pg-production   PostgreSQL 15   [💾]
    └── redis-cache     Redis 7         [💾]
```

Status icons update automatically — green for running, red for stopped, yellow for in-progress. No manual refresh needed.

---

### ⚡ One-click & keyboard actions

Right-click any item in the tree for a context menu. Inline action buttons appear next to each app. Everything is also available from the Command Palette (`Cmd/Ctrl+Shift+P → Coolify:`).

| Action | Keyboard (Mac / PC) | Where |
|---|---|---|
| 🚀 Deploy application | `⌘⇧D` / `Ctrl+Shift+D` | Tree button, palette, QuickPick |
| 📋 View live logs | `⌘⇧L` / `Ctrl+Shift+L` | Tree button, palette |
| 🔄 Refresh sidebar | `⌘⇧R` / `Ctrl+Shift+R` | Tree toolbar, palette |
| ✖ Cancel deployment | `⌘⇧X` / `Ctrl+Shift+X` | Context menu, palette |
| ▶ Start application | — | Context menu |
| ⏹ Stop application | — | Context menu |
| ↺ Restart application | — | Context menu |
| 💾 Database backup | — | Context menu (databases) |
| 🌐 Open in browser | — | Context menu |
| 📋 Copy UUID | — | Context menu |

---

### ⚡ Quick Deploy — type-to-search across all apps

Run `Coolify: Quick Deploy` from the palette. A searchable list of all your apps appears with their live status. Select one → deployment starts immediately. After it begins, a **View Logs** button appears inline in the notification.

---

### 📊 Status Bar Monitor — always visible

A persistent status indicator in the editor's bottom bar shows the current state of your pinned app. Click it to open the log stream. Configure which app to pin with `coolify.defaultApplication`.

```
  🟢 coolify-api: Running   🔴 marketing-site: Stopped
```

---

### 📋 Real-time Log Streaming

`Coolify: View Application Logs` opens a dedicated **Coolify Logs** Output Channel and streams live logs from the selected application. No browser needed, no extra tools — just the familiar VS Code output panel.

---

### 🔀 Git Push Advisor

When you push or merge to a branch that matches a Coolify application's configured branch, the extension detects it automatically and asks:

> *"marketing-site is configured to deploy from `main`. Deploy now?"*

Click **Deploy** — done. No switching context, no opening Coolify, no manual trigger.

---

### 🔐 Three ways to connect to Coolify

**Method 1 — Guided wizard with auto browser-open**
Run `Coolify: Configure`. Enter the server URL. Once the server is verified, the extension automatically opens your Coolify API token page in the browser. Paste the token — you're done.

**Method 2 — VS Code Accounts menu**
Coolify appears in the native **Accounts** panel (⚙ bottom-left → Accounts), alongside GitHub and Microsoft. Sign in from there — it opens the browser to the token page, you paste and confirm.

**Method 3 — Deep link (one-click from anywhere)**
Anyone can open a link like:

```
vscode://ImbaMarketing.vscode-coolify/auth?token=TOKEN&url=https://your-coolify-server.com
```

VS Code intercepts it, validates the token against the server, stores it securely, and opens the sidebar. You can put this link in a Slack message, a wiki, a readme, or a button on a web page.

---

## How it works under the hood

The extension communicates with your Coolify server through its **REST API v1** using your personal API token as a Bearer credential. Here is the data flow:

```
VS Code Extension
       │
       │  HTTPS (Bearer token)
       ▼
Coolify REST API (v1)         ← your server, your data
  /api/v1/applications
  /api/v1/projects
  /api/v1/servers
  /api/v1/databases
  /api/v1/deployments
```

- **No third-party servers.** All calls go directly from your editor to your Coolify instance.
- **No code execution.** The extension never reads, runs, or modifies any files in your workspace.
- **No telemetry.** The extension respects VS Code's telemetry opt-out setting.
- **Polling interval** is configurable (default: every 5 seconds). The sidebar stays current without hammering your server.
- **Timeouts & retries** are built in. If your server is temporarily unreachable, the extension gracefully degrades — no crashes, no error spam.

---

## 🏁 Getting Started

> [!IMPORTANT]
> The extension is **not yet published** to the VS Code Marketplace or Open VSX.
> Install manually via `.vsix` — it takes under 2 minutes.

### Step 1 — Download the `.vsix`

Go to [**Releases**](https://github.com/magnetoid/Coolify-Deployments/releases) and download the latest `vscode-coolify-X.X.X.vsix`.

Or build it yourself from source (requires Node.js 20+):

```bash
git clone https://github.com/magnetoid/Coolify-Deployments.git
cd Coolify-Deployments
pnpm install
pnpm add -g @vscode/vsce
vsce package --no-dependencies
# ↳ generates vscode-coolify-2.2.0.vsix
```

---

### Step 2 — Install the `.vsix`

The process is the same in every supported editor:

```
Cmd/Ctrl+Shift+P  →  Extensions: Install from VSIX…  →  select the file
```

Or use the Extensions sidebar (`Ctrl+Shift+X`) → click the **⋯ menu** → **Install from VSIX…**

**Editor-specific CLI commands:**

<details>
<summary><b>VS Code</b></summary>

```bash
code --install-extension vscode-coolify-2.2.0.vsix
```

</details>

<details>
<summary><b>Cursor</b></summary>

```bash
cursor --install-extension vscode-coolify-2.2.0.vsix
```

</details>

<details>
<summary><b>Windsurf</b></summary>

```bash
windsurf --install-extension vscode-coolify-2.2.0.vsix
```

</details>

<details>
<summary><b>VSCodium</b></summary>

```bash
codium --install-extension vscode-coolify-2.2.0.vsix
```

</details>

<details>
<summary><b>Trae (ByteDance)</b></summary>

Trae does not currently support a CLI `--install-extension` flag. Use the UI method above — all features work fully in Trae.

</details>

<details>
<summary><b>Antigravity</b></summary>

Antigravity is fully VS Code-extension-compatible. Use the Command Palette or Extensions sidebar method above.

</details>

---

### Step 3 — Connect to your Coolify server

```
Cmd/Ctrl+Shift+P  →  Coolify: Configure
```

1. Enter your **server URL** (e.g. `https://coolify.my-server.com` or `http://192.168.1.10:8000`)
2. The extension verifies the connection — you'll see ✅ when it succeeds
3. Click **Open Token Page** — your browser opens `/security/api-tokens` on your Coolify dashboard
4. Create a token, copy it, paste it back into the VS Code prompt
5. The token is verified and stored securely — **you're connected**

Your apps, servers, and databases appear in the Coolify sidebar immediately.

---

### Step 4 — Deploy 🚀

Click the 🚀 button next to any app, or press **`⌘⇧D`** / **`Ctrl+Shift+D`** for the Quick Deploy picker.

---

## 👥 Team Setup

Commit a shared server URL so every teammate is pre-connected — they only need to enter their own API token once:

```json
// .vscode/settings.json  (safe to commit)
{
  "coolify.serverUrl": "https://coolify.my-company.internal"
}
```

The server URL is synced via VS Code Settings Sync. API tokens are **never synced** — they stay encrypted in each developer's OS keychain.

---

## ⚙️ Settings Reference

| Setting | Type | Default | Description |
|---|---|---|---|
| `coolify.serverUrl` | `string` | `""` | Coolify server URL — can also be set in `.vscode/settings.json` |
| `coolify.refreshInterval` | `number` | `5000` | Sidebar auto-refresh interval in milliseconds (minimum: 2000) |
| `coolify.defaultApplication` | `string` | `""` | UUID of the app to pin in the Status Bar (leave empty = first app) |
| `coolify.enableNotifications` | `boolean` | `true` | Show toast notifications for deployment success / failure |

---

## 🔒 Security Model

| Data | Where stored | Synced |
|---|---|---|
| Server URL | `globalState` + `settings.json` | ✅ via Settings Sync |
| API Token | VS Code **SecretStorage** (OS keychain) | ❌ Never |

- Editors without SecretStorage (some VSCodium builds) receive a warning and use a plaintext fallback.
- The extension only makes **outbound HTTPS** calls to your Coolify server.
- No workspace files are ever read or executed.
- No calls to any external analytics, telemetry, or tracking services.

---

## 🛠️ Editor Compatibility

| Editor | Install | SecretStorage | Settings Sync | Remote/SSH |
|---|---|---|---|---|
| VS Code | Marketplace *(soon)* | ✅ Full | ✅ | ✅ |
| Cursor | `.vsix` | ✅ Full | ✅ | ✅ |
| Windsurf | `.vsix` | ✅ Full | — | ✅ |
| Trae | `.vsix` | ✅ Full | — | ✅ |
| VSCodium | `.vsix` | ⚠️ Fallback | — | ✅ |
| Antigravity | `.vsix` | ✅ Full | — | ✅ |

> [!NOTE]
> **Remote sessions (SSH / Dev Containers / Codespaces):** The extension runs on the remote host. Your Coolify server must be reachable **from the remote machine**, not just from your local laptop.

---

## 👨‍💻 About the Author

This extension is built and maintained by **[Marko Tiosavljevic](https://imbamarketing.com)**, founder of **[Imba Marketing](https://imbamarketing.com)** — a digital agency focused on growth, automation, and developer tooling.

Marko is a self-hosting enthusiast who uses Coolify to run client infrastructure and needed a proper IDE integration. This extension is the result of that itch.

**Find me:**

- 🌐 [imbamarketing.com](https://imbamarketing.com)
- 💬 [Open an issue or discussion on GitHub](https://github.com/magnetoid/Coolify-Deployments/issues)

---

## ❤️ Support this project

This extension is **free and open-source**. If it saves you time, reduces context-switching, or just makes your day a little smoother — consider supporting its continued development.

Every contribution helps fund:

- New features (browser-based auth, environment variable editor, deployment history viewer)
- Bugfixes and compatibility updates across editors
- Documentation and onboarding improvements

**Ways to support:**

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/magnetoid)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-Support-EA4AAA?style=for-the-badge&logo=github-sponsors)](https://github.com/sponsors/magnetoid)

You can also **star the repo** ⭐ — it helps more people discover the extension.

[![Star on GitHub](https://img.shields.io/github/stars/magnetoid/Coolify-Deployments?style=for-the-badge&logo=github&color=238636)](https://github.com/magnetoid/Coolify-Deployments)

---

## 🤝 Contributing

Bug reports, feature requests, and pull requests are all very welcome.

- 🐛 [Open an issue](https://github.com/magnetoid/Coolify-Deployments/issues/new)
- 💡 [Start a discussion](https://github.com/magnetoid/Coolify-Deployments/discussions)
- 🔀 [Submit a PR](https://github.com/magnetoid/Coolify-Deployments/pulls)

Please check existing issues before opening a new one.

---

<div align="center">

Made with ❤️ by [Marko Tiosavljevic](https://imbamarketing.com) &nbsp;·&nbsp; [Imba Marketing](https://imbamarketing.com) &nbsp;·&nbsp; MIT License

[Coolify.io](https://coolify.io) &nbsp;·&nbsp; [GitHub](https://github.com/magnetoid/Coolify-Deployments) &nbsp;·&nbsp; [Releases](https://github.com/magnetoid/Coolify-Deployments/releases)

</div>

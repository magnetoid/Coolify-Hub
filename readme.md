<div align="center">

<img src="public/logo.png" alt="Coolify Deployments" width="110" />

# Coolify Deployments 2.6.3 🚀

### The fully-intelligent VS Code extension for [Coolify](https://coolify.io) — deploy, monitor and manage your self-hosted infrastructure automatically

[![GitHub Release](https://img.shields.io/github/v/release/magnetoid/Coolify-Deployments?style=for-the-badge&logo=github&label=Latest&color=238636)](https://github.com/magnetoid/Coolify-Deployments/releases)
[![VS Code Marketplace](https://img.shields.io/badge/Marketplace-Coming%20Soon-555?style=for-the-badge&logo=visual-studio-code)](https://github.com/magnetoid/Coolify-Deployments)
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

## ⚡ What makes this extension special?

**Coolify Deployments** is not just an API wrapper—it's an intelligent workspace assistant that completely removes the friction between writing code and deploying it to your [Coolify](https://coolify.io) infrastructure.

### ✨ Zero-Config Workspace Linking

The moment you open a project folder, the extension **reads your local Git remote URL and instantly links the workspace to your Coolify application**.

- **Smart Status Bar:** Shows the real-time status of the *exact app you're working on* right in the bottom bar (`🚀 Coolify: Running`). No pinning required.
- **1-Click Deploy (`Cmd+Shift+Alt+D`):** Instantly deploys the currently active project without ever popping up a menu asking you what app to deploy.

### 🧠 Intelligent Pre-Flight Checks

Never wonder why a deployment failed or didn't show your latest changes again:

1. **Uncommitted Changes Warning:** Before pushing, it explicitly warns you if you have uncommitted files.
2. **Branch Mismatch Protection:** Prevents you from pushing local `main` when Coolify is expecting `production`.

### 🔄 End-to-End Pipeline (No Context Switching)

Click **Deploy Current Project** and watch the magic:

1. Performs `git push origin HEAD` and streams the console output.
2. Waits until Coolify receives and verifies the specific Git Commit SHA.
3. Triggers the deployment.
4. Opens an Output Channel streaming the **live Docker build logs**.
5. Upon success, seamlessly transitions into tailing your **live application runtime logs**.

### 💻 Hybrid CLI Integration

Coolify Deployments works beautifully out-of-the-box, but it becomes even more powerful if you have the official [coolify-cli](https://github.com/coollabsio/coolify-cli) installed on your machine!

- **Zero-Config Authentication:** If you're logged into the CLI, the extension instantly reads your `~/.config/coolify/config.json` file. You won't have to enter a Server URL or API Token at all.
- **Native Log Streaming:** When clicking "View Live App Logs", the extension automatically detects the `coolify` binary and spawns a native terminal tab. This offloads streaming to the CLI, giving you interactive colorization and real-time Socket power.

### 🤖 Zero-Config AI Workflows

This extension natively supports AI-driven workflows by exposing Headless API Commands designed specifically for agents like **Cursor**, **Windsurf**, **Trae**, and **GitHub Copilot**.

You can simply tell your AI Agent: *"Please check coolify logs"* or *"push and deploy my application."* The agent can execute these commands in the background to automatically detect your workspace's app via git remotes and seamlessly interact with your Coolify server without touching any UI menus:

- `coolify.api.getWorkspaceApp` - Auto-detects app UUID based on git remote
- `coolify.api.getWorkspaceLogs` - Pulls live running logs for the workspace app
- `coolify.api.getLatestDeploymentLogs` - Pulls build logs for the workspace app
- `coolify.api.deployApplication` (requires UUID)
- `coolify.api.getApplications`

### 🛡️ Pro-Tier Capabilities (v2.6.3)

- **Strict GitHub Sync Verification:** Prevents race conditions by verifying that your remote Coolify server has fully synced with GitHub's latest commit webhook before initiating a build.
- **Clickable FQDNs:** Upon successful deployment, the application's Fully Qualified Domain Name becomes immediately clickable in the UI.
- **Native VS Code Git Authentication:** `git push` logic bypasses raw shells and securely hooks directly into the core `vscode.git` API—flawlessly dealing with complex SSH passphrases, tokens, or credential managers.
- **Immediate Force Deployment:** Stuck Docker cache layer? Simply right-click any application in the sidebar and choose **"Force Deploy (No Cache)"** to bypass the standard queue and force a clean rebuild!
- **Advanced Server Badges:** Running a multi-node cluster? The dashboard intelligently cross-references API data to auto-inject graphical "☁️ Server Name" tags directly on your applications so you never have to remember where your containers live.

---

## 🎛️ Control Center & UI

### 🌳 Live Sidebar

Browse your complete Coolify hierarchy (Projects ➡️ Environments ➡️ Applications, Servers, Databases) in a native TreeView that auto-refreshes in the background.

### 🎨 Sidebar Webview Dashboard

A rich, Vercel-inspired dashboard view showing live health badges, deployment history, and quick-action buttons (Start, Stop, Deploy, Logs).

---

## ⌨️ Keyboard Shortcuts

| Action | Keyboard (Mac / PC) | Where |
|---|---|---|
| 🚀 Deploy Current Project | `⌘⇧⌥D` / `Ctrl+Shift+Alt+D` | Global (when working in linked project) |
| 🚀 Deploy Any | `⌘⇧D` / `Ctrl+Shift+D` | Command Palette, Sidebar |
| 📋 View Live Logs | `⌘⇧L` / `Ctrl+Shift+L` | Command Palette, Sidebar |
| ✖ Cancel Deployment | `⌘⇧X` / `Ctrl+Shift+X` | Command Palette |

---

## 🏁 Getting Started

### Step 1 — Download the `.vsix`

Go to [**Releases**](https://github.com/magnetoid/Coolify-Deployments/releases) and download the latest `.vsix` file.

### Step 2 — Install

In your editor, open the Command Palette (`Cmd/Ctrl+Shift+P`) and type **Extensions: Install from VSIX…**, then select the file you just downloaded.

### Step 3 — Connect

1. Click the ⚙ gear icon (bottom-left) → **Accounts** → **Coolify**.
2. Follow the prompt to enter your server URL (e.g. `https://coolify.my-domain.com`).
3. Create an API token in the browser window that opens, and paste it back into the editor!

---

## ⚙️ Settings Reference

| Setting | Type | Default | Description |
|---|---|---|---|
| `coolify.serverUrl` | `string` | `""` | Coolify server URL. Can be set in `.vscode/settings.json` to share with teammates. |
| `coolify.refreshInterval` | `number` | `5000` | Sidebar auto-refresh interval (ms) |

---

## 🔒 Security Model

- **API Tokens** are stored in your OS keychain via the encrypted VS Code SecretStorage API. **They are never synced.**
- **Local Git repo parsing** happens strictly offline inside the editor.
- **Zero Telemetry.** This extension performs no outside analytics and respects your privacy.

---

## 👨‍💻 Author & Support

Built by **[Marko Tiosavljevic](https://imbamarketing.com)**, founder of **[Imba Marketing](https://imbamarketing.com)**.

If this extension saves you context-switching time, please consider:

- ⭐ **Starring the repo**
- [![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/magnetoid)

<div align="center">
Made with ❤️ by [Marko Tiosavljevic](https://imbamarketing.com) &nbsp;·&nbsp; [Imba Marketing](https://imbamarketing.com) &nbsp;·&nbsp; MIT License
</div>

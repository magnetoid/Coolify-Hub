<div align="center">

<img src="public/logo.png" alt="Coolify Deployments" width="110" />

# Coolify Deployments 2.5 🚀

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

---

## 🎛️ Control Center & UI

### 🌳 Live Sidebar

Browse your complete Coolify hierarchy (Projects ➡️ Environments ➡️ Applications, Servers, Databases) in a native TreeView that auto-refreshes in the background.

### 🎨 Sidebar Webview Dashboard

A rich, Vercel-inspired dashboard view showing live health badges, deployment history, and quick-action buttons (Start, Stop, Deploy, Logs).

### 🔀 Git Push Advisor

Pushing code manually from the terminal? The extension intercepts it: if you push a branch that matches a linked Coolify application, a non-intrusive popup simply asks: *"marketing-site is configured to deploy from `main`. Deploy now?"*

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

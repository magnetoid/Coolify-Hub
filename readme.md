<div align="center">

<img src="public/logo.png" alt="Coolify Logo" width="100" />

# Coolify Deployments

### Deploy, manage & monitor your [Coolify](https://coolify.io) infrastructure — without leaving your editor

> Built by [Marko Tiosavljevic](https://imbamarketing.com) @ [Imba Marketing](https://imbamarketing.com)

<br/>

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code%20Marketplace-Coming%20Soon-grey?style=for-the-badge&logo=visual-studio-code&color=555)](https://github.com/magnetoid/Coolify-Deployments)
[![Open VSX](https://img.shields.io/badge/Open%20VSX-Coming%20Soon-grey?style=for-the-badge&color=555)](https://github.com/magnetoid/Coolify-Deployments)
[![GitHub Release](https://img.shields.io/github/v/release/itsnitinr/coolify-vscode-extension?style=for-the-badge&logo=github&label=Latest%20Release&color=238636)](https://github.com/magnetoid/Coolify-Deployments/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

<br/>

**Works in** &nbsp;
![VS Code](https://img.shields.io/badge/VS%20Code-✓-007ACC?logo=visual-studio-code&logoColor=white)
![Cursor](https://img.shields.io/badge/Cursor-✓-black?logo=cursor&logoColor=white)
![Windsurf](https://img.shields.io/badge/Windsurf-✓-5C5CFF)
![Trae](https://img.shields.io/badge/Trae-✓-FF6B35)
![VSCodium](https://img.shields.io/badge/VSCodium-✓-2F80ED)
![Antigravity](https://img.shields.io/badge/Antigravity-✓-6C3BFF)

</div>

---

## 🚀 What You Can Do

<table>
<tr>
<td width="50%">

**🌳 Native Sidebar Tree**
See all your apps, servers, and databases in a live, auto-refreshing tree — with color-coded status icons.

```
COOLIFY
├── 📦 Applications
│   ├── 🟢 coolify-api      running  [🚀 ↺ 📋]
│   ├── 🔴 marketing-site   stopped  [🚀 ↺ 📋]
│   └── 🟡 analytics        deploy…  [✖]
├── 🖥️  Servers
│   └── hetzner-prod-01  192.168.1.1
└── 🗄️  Databases
    └── pg-primary       PostgreSQL  [💾]
```

</td>
<td width="50%">

**⚡ Keyboard-First Workflow**

| Action | Mac | PC |
|---|---|---|
| 🚀 Deploy | `⌘⇧D` | `Ctrl+Shift+D` |
| 📋 View Logs | `⌘⇧L` | `Ctrl+Shift+L` |
| 🔄 Refresh | `⌘⇧R` | `Ctrl+Shift+R` |
| ✖ Cancel Deploy | `⌘⇧X` | `Ctrl+Shift+X` |

Right-click any tree item for **Start / Stop / Restart / Deploy / Backup** — instantly.

</td>
</tr>
</table>

---

## ✨ Feature Highlights

| | Feature | Description |
|---|---|---|
| 🌳 | **Native TreeView** | Live sidebar with collapsible Projects → Apps → Servers → Databases |
| 📊 | **Status Bar Monitor** | Pinned `🟢 my-app: Running` indicator, always visible |
| 📋 | **Log Streaming** | Real-time app logs in a dedicated Output Channel |
| ⚙️ | **Deployment Control** | Start, Stop, Restart, Deploy, or Cancel — from keyboard or mouse |
| 🗄️ | **Database Backups** | Trigger a backup with one click from the sidebar |
| 🔔 | **Smart Notifications** | Toast alerts on deployment success or failure |
| 🔑 | **Secure Token Storage** | API keys stored in the OS keychain via SecretStorage |
| 👥 | **Team Config Sharing** | Share server URL via `.vscode/settings.json` |

---

## 🏁 Getting Started

> [!IMPORTANT]
> **The extension is not yet published to the VS Code Marketplace or Open VSX.** Install it manually using one of the methods below — takes under 2 minutes.

### Method 1 — Build from source (recommended)

Requires [Node.js 20+](https://nodejs.org) and [pnpm](https://pnpm.io).

```bash
# 1. Clone the repo
git clone https://github.com/magnetoid/Coolify-Deployments.git
cd coolify-vscode-extension

# 2. Install dependencies
pnpm install

# 3. Package into a .vsix file
pnpm add -g @vscode/vsce
vsce package --no-dependencies
# → creates  vscode-coolify-2.0.0.vsix
```

Then install the generated `.vsix` file using **Method 2** below.

---

### Method 2 — Install a `.vsix` file

Once you have a `.vsix` file (built above or downloaded from [GitHub Releases](https://github.com/magnetoid/Coolify-Deployments/releases)):

<details open>
<summary><b>VS Code</b></summary>

**Option A — Command Palette** (easiest):

```
Cmd/Ctrl+Shift+P  →  Extensions: Install from VSIX…  →  select the file
```

**Option B — CLI**:

```bash
code --install-extension vscode-coolify-2.0.0.vsix
```

</details>

<details>
<summary><b>Cursor</b></summary>

```
Cmd/Ctrl+Shift+P  →  Extensions: Install from VSIX…  →  select the file
```

Or from the CLI:

```bash
cursor --install-extension vscode-coolify-2.0.0.vsix
```

</details>

<details>
<summary><b>Windsurf</b></summary>

```
Cmd/Ctrl+Shift+P  →  Extensions: Install from VSIX…  →  select the file
```

Or from the CLI:

```bash
windsurf --install-extension vscode-coolify-2.0.0.vsix
```

</details>

<details>
<summary><b>Trae</b></summary>

```
Cmd/Ctrl+Shift+P  →  Extensions: Install from VSIX…  →  select the file
```

Or from the CLI:

```bash
trae --install-extension vscode-coolify-2.0.0.vsix
```

</details>

<details>
<summary><b>VSCodium</b></summary>

VSCodium supports Open VSX. Once the extension is published there, search in Extensions panel. For now, use the VSIX method:

```
Cmd/Ctrl+Shift+P  →  Extensions: Install from VSIX…  →  select the file
```

Or CLI:

```bash
codium --install-extension vscode-coolify-2.0.0.vsix
```

</details>

<details>
<summary><b>Antigravity</b></summary>

Antigravity is fully VS Code extension-compatible. Use the VSIX method:

```
Cmd/Ctrl+Shift+P  →  Extensions: Install from VSIX…  →  select the file
```

Or CLI:

```bash
antigravity --install-extension vscode-coolify-2.0.0.vsix
```

</details>

---

### Step 2 · Configure

```
Cmd/Ctrl+Shift+P  →  Coolify: Configure
```

Enter your **Coolify server URL** (e.g. `https://coolify.my-server.com`) and your **API token** from Coolify → Profile → API Keys.

### Step 3 · Deploy 🎉

Your apps appear instantly. Hit `Cmd+Shift+D` or click the 🚀 button next to any app.

---

## 👥 Team Setup

Drop this into your repo's `.vscode/settings.json` so every teammate connects automatically — they only need to enter their personal token once:

```json
{
  "coolify.serverUrl": "https://coolify.my-company.internal"
}
```

The server URL syncs via Settings Sync. The token is **never synced** — it stays encrypted on each machine.

---

## ⚙️ All Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `coolify.serverUrl` | `string` | `""` | Server URL (also set via `.vscode/settings.json`) |
| `coolify.refreshInterval` | `number` | `5000` | Sidebar auto-refresh interval in ms (min 2000) |
| `coolify.defaultApplication` | `string` | `""` | UUID to pin to the Status Bar |
| `coolify.enableNotifications` | `boolean` | `true` | Toast on deployment complete / failed |

---

## 🔒 Security

- API tokens are stored using **VS Code SecretStorage** (encrypted system keychain)
- Editors without SecretStorage support receive a warning; a plaintext fallback is used
- The token is **never included** in Settings Sync or `.vscode/settings.json`
- The extension only makes **outbound HTTPS calls** to your server — no code from your workspace is ever executed

---

## 🛠️ Editor Compatibility Matrix

| Editor | Install Method | SecretStorage | Settings Sync | Remote/SSH |
|---|---|---|---|---|
| VS Code | Marketplace | ✅ Full | ✅ | ✅ |
| Cursor | Open VSX / `.vsix` | ✅ Full | ✅ | ✅ |
| Windsurf | Open VSX / `.vsix` | ✅ Full | — | ✅ |
| Trae | Open VSX / `.vsix` | ✅ Full | — | ✅ |
| VSCodium | Open VSX / `.vsix` | ⚠️ Fallback | — | ✅ |
| Antigravity | `.vsix` | ✅ Full | — | ✅ |

> ⚠️ **Remote sessions**: When running in an SSH / Dev Container / Codespaces session, the extension runs on the **remote host**. Your Coolify server must be reachable from that host, not just from your laptop.

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or PR on [GitHub](https://github.com/magnetoid/Coolify-Deployments).

---

<div align="center">

Made with ❤️ by [Marko Tiosavljevic](https://imbamarketing.com) &nbsp;·&nbsp; [Imba Marketing](https://imbamarketing.com) &nbsp;·&nbsp; MIT License &nbsp;·&nbsp; [Coolify](https://coolify.io)

</div>

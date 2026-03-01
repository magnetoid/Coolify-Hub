import * as vscode from 'vscode';
import { ConfigurationManager } from '../managers/ConfigurationManager';
import { CoolifyService } from '../services/CoolifyService';
import { Application, Server, Database } from '../types';

export class CoolifyDashboardPanel {
    public static currentPanel: CoolifyDashboardPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _refreshInterval: NodeJS.Timeout | undefined;

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        private configManager: ConfigurationManager
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Update the content based on view changes
        this._panel.onDidChangeViewState(
            e => {
                if (this._panel.visible) {
                    this.startAutoRefresh();
                } else {
                    this.stopAutoRefresh();
                }
            },
            null,
            this._disposables
        );

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.type) {
                    case 'refresh':
                        this.updatePanelData();
                        break;
                    case 'openLogs':
                        vscode.commands.executeCommand('coolify.viewApplicationLogs', message.uuid, message.name);
                        break;
                    case 'openLiveLogs':
                        vscode.commands.executeCommand('coolify.viewApplicationLogsLive', message.uuid, message.name);
                        break;
                    case 'deployApp':
                        vscode.commands.executeCommand('coolify.startDeployment', message.uuid);
                        break;
                }
            },
            null,
            this._disposables
        );

        this.startAutoRefresh();
    }

    public static createOrShow(
        extensionUri: vscode.Uri,
        configManager: ConfigurationManager
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (CoolifyDashboardPanel.currentPanel) {
            CoolifyDashboardPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            'coolifyDashboard',
            'Coolify Dashboard',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'public')]
            }
        );

        CoolifyDashboardPanel.currentPanel = new CoolifyDashboardPanel(panel, extensionUri, configManager);
    }

    private startAutoRefresh() {
        this.stopAutoRefresh();
        this.updatePanelData();
        const interval = vscode.workspace.getConfiguration('coolify').get<number>('refreshInterval', 5000);
        this._refreshInterval = setInterval(() => this.updatePanelData(), interval);
    }

    private stopAutoRefresh() {
        if (this._refreshInterval) {
            clearInterval(this._refreshInterval);
            this._refreshInterval = undefined;
        }
    }

    private async updatePanelData() {
        if (!this._panel.visible) { return; }

        try {
            const serverUrl = await this.configManager.getServerUrl();
            const token = await this.configManager.getToken();

            if (!serverUrl || !token) {
                this._panel.webview.html = this.getNotConfiguredHtml();
                return;
            }

            const svc = new CoolifyService(serverUrl, token);
            const [servers, apps, dbs] = await Promise.all([
                svc.getServers(),
                svc.getApplications(),
                svc.getDatabases()
            ]);

            this._panel.webview.html = this.getDashboardHtml(servers, apps, dbs, serverUrl);
        } catch (error) {
            console.error('Coolify Dashboard error:', error);
            this._panel.webview.html = `<h1>Error Loading Dashboard</h1><p>${error instanceof Error ? error.message : 'Unknown error'}</p>`;
        }
    }

    private getNotConfiguredHtml(): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; }
                    .container { text-align: center; }
                    button { padding: 10px 20px; font-size: 16px; cursor: pointer; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; }
                    button:hover { background: var(--vscode-button-hoverBackground); }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Welcome to Coolify Deployments</h1>
                    <p>Connect your Coolify server to view your dashboard.</p>
                </div>
            </body>
            </html>
        `;
    }

    private getDashboardHtml(servers: Server[], apps: Application[], dbs: Database[], serverUrl: string): string {
        const logoUri = this._panel.webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'public', 'logo.svg'));

        const serverCards = servers.map(s => `
            <div class="card">
                <div class="card-header">
                    <h3>🖥️ ${s.name}</h3>
                    <span class="badge ${s.settings?.is_reachable ? 'badge-success' : 'badge-danger'}">
                        ${s.settings?.is_reachable ? 'Online' : 'Unreachable'}
                    </span>
                </div>
                <div class="card-body">
                    <p>IP: <code>${s.ip}</code></p>
                    <p>User: <code>${s.user}</code></p>
                </div>
            </div>
        `).join('');

        const statusColors: Record<string, string> = {
            'running': 'badge-success',
            'deploying': 'badge-warning',
            'starting': 'badge-warning',
            'stopped': 'badge-dark',
            'exited': 'badge-dark',
            'error': 'badge-danger',
            'failed': 'badge-danger'
        };

        const appCards = apps.map(a => {
            const badgeClass = statusColors[a.status?.toLowerCase()] || 'badge-dark';
            const safeName = a.name.length > 20 ? a.name.substring(0, 20) + '...' : a.name;
            const linkHtml = a.fqdn ? `<a href="${a.fqdn}">${a.fqdn.replace('https://', '').replace('http://', '')}</a>` : 'No URL';
            const gitHtml = a.git_repository ? `${a.git_repository}@${a.git_branch}` : 'N/A';
            const uuid = a.uuid || a.id;

            return `
            <div class="card">
                <div class="card-header">
                    <h3 title="${a.name}">${safeName}</h3>
                    <span class="badge ${badgeClass}">${a.status || 'unknown'}</span>
                </div>
                <div class="card-body">
                    <p class="truncate" title="${a.fqdn || 'No URL'}">🌐 ${linkHtml}</p>
                    <p class="truncate" title="${a.git_repository}@${a.git_branch}">📦 ${gitHtml}</p>
                </div>
                <div class="card-footer">
                    <button class="icon-btn" onclick="openLogs('${uuid}', '${a.name}')" title="One-shot Logs">📋 Logs</button>
                    <button class="icon-btn" onclick="openLiveLogs('${uuid}', '${a.name}')" title="Live Tail Logs">📡 Live Logs</button>
                    <button class="icon-btn deploy-btn" onclick="deployApp('${uuid}')" title="Deploy">🚀 Deploy</button>
                </div>
            </div>
        `;
        }).join('');

        const dbCards = dbs.map(d => {
            const statusKey = d.status?.toLowerCase() || 'unknown';
            const badgeClass = statusColors[statusKey] || 'badge-dark';
            return `
            <div class="card">
                <div class="card-header">
                    <h3>🗄️ ${d.name}</h3>
                    <span class="badge ${badgeClass}">${d.status || 'unknown'}</span>
                </div>
                <div class="card-body">
                    <p>Type: <code>${d.type}</code></p>
                </div>
            </div>
        `;
        }).join('');

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Coolify Dashboard</title>
                <style>
                    :root {
                        --bg: var(--vscode-editor-background);
                        --fg: var(--vscode-editor-foreground);
                        --card-bg: var(--vscode-editorWidget-background);
                        --card-border: var(--vscode-widget-border);
                        --btn-bg: var(--vscode-button-background);
                        --btn-fg: var(--vscode-button-foreground);
                        --btn-hover: var(--vscode-button-hoverBackground);
                        --link: var(--vscode-textLink-foreground);
                    }
                    body {
                        font-family: var(--vscode-font-family), sans-serif;
                        padding: 30px;
                        background-color: var(--bg);
                        color: var(--fg);
                        overflow-y: auto;
                    }
                    header {
                        display: flex;
                        align-items: center;
                        border-bottom: 1px solid var(--card-border);
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    header img { width: 48px; height: 48px; margin-right: 15px; }
                    header h1 { margin: 0; font-weight: 600; font-size: 24px; }
                    header .server-url { margin-left: auto; opacity: 0.6; font-family: monospace; }
                    
                    section { margin-bottom: 40px; }
                    section h2 { margin-bottom: 20px; font-size: 18px; font-weight: 500; border-bottom: 1px dashed var(--card-border); padding-bottom: 8px; display: inline-block; }
                    
                    .grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                        gap: 20px;
                    }
                    
                    .card {
                        background-color: var(--card-bg);
                        border: 1px solid var(--card-border);
                        border-radius: 8px;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                        display: flex;
                        flex-direction: column;
                        transition: transform 0.1s ease, box-shadow 0.1s ease;
                    }
                    .card:hover { transform: translateY(-2px); box-shadow: 0 6px 12px rgba(0,0,0,0.15); }
                    
                    .card-header {
                        padding: 15px;
                        border-bottom: 1px solid var(--card-border);
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .card-header h3 { margin: 0; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
                    
                    .card-body { padding: 15px; flex-grow: 1; }
                    .card-body p { margin: 8px 0; font-size: 13px; opacity: 0.8; }
                    .truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                    
                    .card-footer {
                        padding: 10px 15px;
                        background-color: rgba(0,0,0,0.1);
                        border-top: 1px solid var(--card-border);
                        display: flex;
                        gap: 10px;
                        justify-content: flex-end;
                    }
                    
                    .badge {
                        padding: 4px 8px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: bold;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .badge-success { background: #10B981; color: white; }
                    .badge-danger { background: #EF4444; color: white; }
                    .badge-warning { background: #F59E0B; color: white; }
                    .badge-dark { background: #6B7280; color: white; }
                    
                    code {
                        background: rgba(128,128,128,0.2);
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-family: var(--vscode-editor-font-family);
                    }
                    a { color: var(--link); text-decoration: none; }
                    a:hover { text-decoration: underline; }
                    
                    button.icon-btn {
                        background: var(--btn-bg);
                        color: var(--btn-fg);
                        border: none;
                        padding: 6px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    }
                    button.icon-btn:hover { background: var(--btn-hover); }
                    button.deploy-btn { background: #3B82F6; }
                    button.deploy-btn:hover { background: #2563EB; }
                </style>
            </head>
            <body>
                <header>
                    <img src="${logoUri}" alt="Coolify" />
                    <h1>Coolify Infrastructure</h1>
                    <div class="server-url">${serverUrl}</div>
                </header>
                
                <section>
                    <h2>🖥️ Servers (${servers.length})</h2>
                    <div class="grid">${serverCards || '<p>No servers found.</p>'}</div>
                </section>
                
                <section>
                    <h2>📦 Applications (${apps.length})</h2>
                    <div class="grid">${appCards || '<p>No applications found.</p>'}</div>
                </section>
                
                <section>
                    <h2>🗄️ Databases (${dbs.length})</h2>
                    <div class="grid">${dbCards || '<p>No databases found.</p>'}</div>
                </section>

                <script>
                    const vscode = acquireVsCodeApi();
                    function openLogs(uuid, name) { vscode.postMessage({ type: 'openLogs', uuid, name }); }
                    function openLiveLogs(uuid, name) { vscode.postMessage({ type: 'openLiveLogs', uuid, name }); }
                    function deployApp(uuid) { vscode.postMessage({ type: 'deployApp', uuid }); }
                </script>
            </body>
            </html>
        `;
    }

    public dispose() {
        CoolifyDashboardPanel.currentPanel = undefined;
        this._panel.dispose();
        this.stopAutoRefresh();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) { x.dispose(); }
        }
    }
}

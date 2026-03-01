import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as util from 'util';
import { ConfigurationManager } from '../managers/ConfigurationManager';
import { CoolifyService } from '../services/CoolifyService';
import { Application } from '../types';

const exec = util.promisify(cp.exec);

function normalizeGitUrl(url: string | undefined): string | null {
    if (!url) return null;
    let cleanUrl = url.trim().replace(/\.git$/, '');
    const match = cleanUrl.match(/[:/]([^/]+\/[^/]+)$/);
    if (match && match[1]) {
        return match[1].toLowerCase();
    }
    return cleanUrl.toLowerCase();
}

export class StatusBarManager {
    private items: Map<string, vscode.StatusBarItem> = new Map();
    private pollInterval?: NodeJS.Timeout;
    private isDisposed = false;
    private isRefreshing = false;
    private cachedRemotes: Set<string> | null = null;
    private matchedApps: Application[] = [];

    public getMatchedApps(): Application[] {
        return this.matchedApps;
    }

    constructor(private configManager: ConfigurationManager) { }

    private async getWorkspaceGitRemotes(): Promise<Set<string>> {
        if (this.cachedRemotes) { return this.cachedRemotes; }

        const remotes = new Set<string>();
        const folders = vscode.workspace.workspaceFolders;
        if (!folders) return remotes;

        for (const folder of folders) {
            try {
                const { stdout } = await exec('git config --get remote.origin.url', { cwd: folder.uri.fsPath });
                const norm = normalizeGitUrl(stdout);
                if (norm) remotes.add(norm);
            } catch (e) { /* ignore */ }
        }

        this.cachedRemotes = remotes;
        return remotes;
    }

    public async initialize(): Promise<void> {
        await this.refreshStatusBar();
        this.startPolling();
    }

    private startPolling(): void {
        if (this.pollInterval) {
            return; // Already polling
        }

        const intervalMs = vscode.workspace
            .getConfiguration('coolify')
            .get<number>('refreshInterval', 5000);

        this.pollInterval = setInterval(async () => {
            if (!this.isDisposed) {
                await this.refreshStatusBar();
            }
        }, intervalMs);
    }

    public async refreshStatusBar(): Promise<void> {
        if (this.isDisposed || this.isRefreshing) { return; }

        this.isRefreshing = true;

        try {
            const isConfigured = await this.configManager.isConfigured();

            if (!isConfigured) {
                this.clearItems();
                return;
            }

            const serverUrl = await this.configManager.getServerUrl();
            const token = await this.configManager.getToken();

            if (!serverUrl || !token) { return; }

            const service = new CoolifyService(serverUrl, token);
            const applications = await service.getApplications();

            const pinnedAppId = vscode.workspace
                .getConfiguration('coolify')
                .get<string>('defaultApplication');

            let appsToShow: Application[] = [];

            if (pinnedAppId) {
                appsToShow = applications.filter((a: Application) => a.id === pinnedAppId || a.uuid === pinnedAppId);
            } else {
                const remotes = await this.getWorkspaceGitRemotes();
                if (remotes.size > 0) {
                    appsToShow = applications.filter((a: Application) => {
                        const appRepo = normalizeGitUrl(a.git_repository);
                        return appRepo && remotes.has(appRepo);
                    });
                }
            }

            this.matchedApps = appsToShow;

            // Only show apps that have a known, displayable status
            const validApps = appsToShow.filter((a: Application) => a.status && a.status.toLowerCase() !== 'unknown');

            const seenIds = new Set<string>();

            for (const app of validApps) {
                const appId = app.id || app.uuid;
                if (!appId) continue;
                seenIds.add(appId);

                let item = this.items.get(appId);
                if (!item) {
                    item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
                    this.items.set(appId, item);
                }

                item.name = `Coolify — ${app.name}`;

                const statusIcon = this.getStatusIcon(app.status);
                item.text = `${statusIcon} ${app.name}: ${this.formatStatus(app.status)}`;
                item.tooltip = new vscode.MarkdownString(
                    `**Coolify App: ${app.name}**\n\nStatus: \`${app.status}\`\n\nClick to view logs`
                );
                item.command = {
                    title: 'View Logs',
                    command: 'coolify.viewApplicationLogs',
                    arguments: [{ id: appId, name: app.name }],
                };

                this.applyStatusBackground(item, app.status);
                item.show();
            }

            // Cleanup removed apps
            for (const [id, item] of this.items.entries()) {
                if (!seenIds.has(id)) {
                    item.dispose();
                    this.items.delete(id);
                }
            }
        } catch (error) {
            console.error('StatusBarManager: Failed to refresh:', error);
        } finally {
            this.isRefreshing = false;
        }
    }

    private getStatusIcon(status: string): string {
        const s = status?.toLowerCase() || '';
        if (s.includes('running')) return '$(vm-running)';
        if (s.includes('stopped') || s.includes('exited')) return '$(vm-outline)';
        if (s.includes('deploying') || s.includes('starting')) return '$(loading~spin)';
        if (s.includes('error') || s.includes('failed')) return '$(error)';
        return '$(circle-outline)';
    }

    private formatStatus(status: string): string {
        const s = status?.toLowerCase() || '';
        if (!s || s === 'unknown') return 'Unknown';
        if (s.includes('running')) return 'Running';
        if (s.includes('stopped') || s.includes('exited')) return 'Stopped';
        if (s.includes('deploying') || s.includes('starting')) return 'Deploying';
        if (s.includes('error') || s.includes('failed')) return 'Error';
        return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
    }

    private applyStatusBackground(item: vscode.StatusBarItem, status: string): void {
        const s = status?.toLowerCase() || '';
        if (s.includes('error') || s.includes('failed')) {
            item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        } else if (s.includes('deploying') || s.includes('starting')) {
            item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else {
            item.backgroundColor = undefined;
        }
    }

    private clearItems(): void {
        for (const item of this.items.values()) {
            item.dispose();
        }
        this.items.clear();
    }

    public dispose(): void {
        this.isDisposed = true;
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        this.clearItems();
    }
}

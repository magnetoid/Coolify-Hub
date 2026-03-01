import * as vscode from 'vscode';
import { ConfigurationManager } from '../managers/ConfigurationManager';
import { CoolifyService } from '../services/CoolifyService';
import { Application } from '../types';

export class StatusBarManager {
    private items: Map<string, vscode.StatusBarItem> = new Map();
    private pollInterval?: NodeJS.Timeout;
    private isDisposed = false;

    constructor(private configManager: ConfigurationManager) { }

    public async initialize(): Promise<void> {
        await this.refreshStatusBar();
        this.startPolling();
    }

    private startPolling(): void {
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
        if (this.isDisposed) { return; }

        const isConfigured = await this.configManager.isConfigured();
        // remove `this.clearItems();` from the beginning of the function since it's now handled below.

        if (!isConfigured) {
            this.clearItems();
            return;
        }

        try {
            const serverUrl = await this.configManager.getServerUrl();
            const token = await this.configManager.getToken();

            if (!serverUrl || !token) { return; }

            const service = new CoolifyService(serverUrl, token);
            const applications = await service.getApplications();

            const pinnedAppId = vscode.workspace
                .getConfiguration('coolify')
                .get<string>('defaultApplication');

            const appsToShow = pinnedAppId
                ? applications.filter((a: Application) => a.id === pinnedAppId || a.uuid === pinnedAppId)
                : applications.slice(0, 2);

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
        if (!status) { return 'Unknown'; }
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

import * as vscode from 'vscode';
import { Application, Project, Environment, Server, Database } from '../types';
import { CoolifyService } from '../services/CoolifyService';
import { ConfigurationManager } from '../managers/ConfigurationManager';

// ─── Tree Item Types ──────────────────────────────────────────────────────────

export type CoolifyTreeItemKind =
    | 'project'
    | 'environment'
    | 'application'
    | 'server'
    | 'database'
    | 'category'
    | 'loading'
    | 'empty';

export class CoolifyTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly kind: CoolifyTreeItemKind,
        public readonly rawData?: Application | Project | Environment | Server | Database,
        public readonly parentId?: string
    ) {
        super(label, collapsibleState);
        this.applyKindConfig();
    }

    private applyKindConfig(): void {
        switch (this.kind) {
            case 'project':
                this.iconPath = new vscode.ThemeIcon('folder');
                this.contextValue = 'coolifyProject';
                break;

            case 'environment':
                this.iconPath = new vscode.ThemeIcon('layers');
                this.contextValue = 'coolifyEnvironment';
                break;

            case 'application': {
                const app = this.rawData as Application | undefined;
                this.iconPath = this.getAppIcon(app?.status);
                this.contextValue = `coolifyApp_${app?.status?.toLowerCase() ?? 'unknown'}`;
                if (app?.fqdn) {
                    this.description = app.fqdn.replace(/^https?:\/\//, '');
                }
                this.tooltip = this.buildAppTooltip(app);
                break;
            }

            case 'server': {
                const srv = this.rawData as Server | undefined;
                const reachable = srv?.settings?.is_reachable;
                this.iconPath = new vscode.ThemeIcon(reachable ? 'server-process' : 'server-environment');
                this.contextValue = 'coolifyServer';
                this.description = srv?.ip;
                break;
            }

            case 'database': {
                const db = this.rawData as Database | undefined;
                this.iconPath = new vscode.ThemeIcon('database');
                this.contextValue = `coolifyDatabase_${db?.status?.toLowerCase() ?? 'unknown'}`;
                this.description = db?.type;
                break;
            }

            case 'category':
                this.iconPath = new vscode.ThemeIcon('list-unordered');
                this.contextValue = 'coolifyCategory';
                break;

            case 'loading':
                this.iconPath = new vscode.ThemeIcon('loading~spin');
                this.contextValue = 'coolifyLoading';
                break;

            case 'empty':
                this.iconPath = new vscode.ThemeIcon('info');
                this.contextValue = 'coolifyEmpty';
                break;
        }
    }

    private getAppIcon(status: string | undefined): vscode.ThemeIcon {
        switch (status?.toLowerCase()) {
            case 'running': return new vscode.ThemeIcon('vm-running', new vscode.ThemeColor('charts.green'));
            case 'stopped': case 'exited': return new vscode.ThemeIcon('vm-outline', new vscode.ThemeColor('charts.gray'));
            case 'deploying': case 'starting': return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.yellow'));
            case 'error': case 'failed': return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
            default: return new vscode.ThemeIcon('circle-outline');
        }
    }

    private buildAppTooltip(app: Application | undefined): vscode.MarkdownString {
        if (!app) { return new vscode.MarkdownString('No application data'); }
        const lines = [
            `**${app.name}**`,
            ``,
            `Status: \`${app.status ?? 'unknown'}\``,
        ];
        if (app.git_repository) { lines.push(`Repo: \`${app.git_repository}\``); }
        if (app.git_branch) { lines.push(`Branch: \`${app.git_branch}\``); }
        if (app.fqdn) { lines.push(`URL: [${app.fqdn}](${app.fqdn})`); }
        return new vscode.MarkdownString(lines.join('\n'));
    }
}

// ─── Tree Data Provider ───────────────────────────────────────────────────────

export class CoolifyTreeDataProvider implements vscode.TreeDataProvider<CoolifyTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<CoolifyTreeItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private refreshInterval?: NodeJS.Timeout;
    private isDisposed = false;
    private service?: CoolifyService;

    // Cached data
    private cachedProjects: Project[] = [];
    private cachedApplications: Application[] = [];
    private cachedServers: Server[] = [];
    private cachedDatabases: Database[] = [];
    private isConfigured = false;

    constructor(private configManager: ConfigurationManager) { }

    public async initialize(): Promise<void> {
        await this.loadData();
        this.startAutoRefresh();
    }

    private startAutoRefresh(): void {
        const intervalMs = vscode.workspace
            .getConfiguration('coolify')
            .get<number>('refreshInterval', 5000);

        this.refreshInterval = setInterval(() => {
            if (!this.isDisposed) {
                this.loadData().catch(console.error);
            }
        }, intervalMs);
    }

    private async getService(): Promise<CoolifyService | null> {
        const serverUrl = await this.configManager.getServerUrl();
        const token = await this.configManager.getToken();
        if (!serverUrl || !token) { return null; }
        this.service = new CoolifyService(serverUrl, token);
        return this.service;
    }

    public async loadData(): Promise<void> {
        this.isConfigured = await this.configManager.isConfigured();
        if (!this.isConfigured) {
            this.refresh();
            return;
        }

        try {
            const svc = await this.getService();
            if (!svc) { return; }

            const [projects, applications, servers, databases] = await Promise.allSettled([
                svc.getProjects(),
                svc.getApplications(),
                svc.getServers(),
                svc.getDatabases(),
            ]);

            this.cachedProjects = projects.status === 'fulfilled' ? projects.value : [];
            this.cachedApplications = applications.status === 'fulfilled' ? applications.value : [];
            this.cachedServers = servers.status === 'fulfilled' ? servers.value : [];
            this.cachedDatabases = databases.status === 'fulfilled' ? databases.value : [];

            this.refresh();
        } catch (error) {
            console.error('CoolifyTreeDataProvider: Failed to load data:', error);
        }
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    // ─── vscode.TreeDataProvider implementation ────────────────────────────────

    getTreeItem(element: CoolifyTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: CoolifyTreeItem): Promise<CoolifyTreeItem[]> {
        if (!this.isConfigured) {
            return [
                new CoolifyTreeItem(
                    'Not configured — run Coolify: Configure',
                    vscode.TreeItemCollapsibleState.None,
                    'empty'
                ),
            ];
        }

        // Root level
        if (!element) {
            return [
                new CoolifyTreeItem('Projects', vscode.TreeItemCollapsibleState.Expanded, 'category'),
                new CoolifyTreeItem('Applications', vscode.TreeItemCollapsibleState.Collapsed, 'category'),
                new CoolifyTreeItem('Servers', vscode.TreeItemCollapsibleState.Collapsed, 'category'),
                new CoolifyTreeItem('Databases', vscode.TreeItemCollapsibleState.Collapsed, 'category'),
            ];
        }

        // Category children
        if (element.kind === 'category') {
            return this.getCategoryChildren(element.label as string);
        }

        // Project children — show environments
        if (element.kind === 'project') {
            const project = element.rawData as Project;
            if (!project.environments || project.environments.length === 0) {
                return [new CoolifyTreeItem('No environments', vscode.TreeItemCollapsibleState.None, 'empty')];
            }
            return project.environments.map(env =>
                new CoolifyTreeItem(
                    env.name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'environment',
                    env,
                    String(project.uuid)
                )
            );
        }

        // Environment children — show applications
        if (element.kind === 'environment') {
            const env = element.rawData as Environment;
            const apps = this.cachedApplications.filter(a =>
                // best-effort: match by environment id if available
                env.applications ? env.applications.some(ea => ea.id === a.id) : true
            );
            if (apps.length === 0) {
                return [new CoolifyTreeItem('No applications', vscode.TreeItemCollapsibleState.None, 'empty')];
            }
            return apps.map(app =>
                new CoolifyTreeItem(
                    app.name,
                    vscode.TreeItemCollapsibleState.None,
                    'application',
                    app
                )
            );
        }

        return [];
    }

    private getCategoryChildren(label: string): CoolifyTreeItem[] {
        switch (label) {
            case 'Projects':
                if (this.cachedProjects.length === 0) {
                    return [new CoolifyTreeItem('No projects found', vscode.TreeItemCollapsibleState.None, 'empty')];
                }
                return this.cachedProjects.map(proj =>
                    new CoolifyTreeItem(
                        proj.name,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'project',
                        proj
                    )
                );

            case 'Applications':
                if (this.cachedApplications.length === 0) {
                    return [new CoolifyTreeItem('No applications found', vscode.TreeItemCollapsibleState.None, 'empty')];
                }
                return this.cachedApplications.map(app =>
                    new CoolifyTreeItem(
                        app.name,
                        vscode.TreeItemCollapsibleState.None,
                        'application',
                        app
                    )
                );

            case 'Servers':
                if (this.cachedServers.length === 0) {
                    return [new CoolifyTreeItem('No servers found', vscode.TreeItemCollapsibleState.None, 'empty')];
                }
                return this.cachedServers.map(srv =>
                    new CoolifyTreeItem(
                        srv.name,
                        vscode.TreeItemCollapsibleState.None,
                        'server',
                        srv
                    )
                );

            case 'Databases':
                if (this.cachedDatabases.length === 0) {
                    return [new CoolifyTreeItem('No databases found', vscode.TreeItemCollapsibleState.None, 'empty')];
                }
                return this.cachedDatabases.map(db =>
                    new CoolifyTreeItem(
                        db.name,
                        vscode.TreeItemCollapsibleState.None,
                        'database',
                        db
                    )
                );

            default:
                return [];
        }
    }

    public getService_(): CoolifyService | undefined {
        return this.service;
    }

    public getCachedApplications(): Application[] {
        return this.cachedApplications;
    }

    public getCachedDatabases(): Database[] {
        return this.cachedDatabases;
    }

    public dispose(): void {
        this.isDisposed = true;
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        this._onDidChangeTreeData.dispose();
    }
}

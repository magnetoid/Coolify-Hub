import * as vscode from 'vscode';
import { ConfigurationManager } from '../managers/ConfigurationManager';
import { CoolifyTreeDataProvider, CoolifyTreeItem } from '../providers/CoolifyTreeDataProvider';
import { CoolifyService } from '../services/CoolifyService';
import { Application } from '../types';
import { StatusBarManager } from '../managers/StatusBarManager';
import { startDeploymentCommand, cancelDeploymentCommand, runDeploymentFlow, deployCurrentProjectCommand } from './deploy';
import { startApplicationCommand, stopApplicationCommand, restartApplicationCommand } from './applicationActions';
import { startDatabaseCommand, stopDatabaseCommand } from './databaseActions';
import { viewApplicationLogsCommand, viewApplicationLogsLiveCommand, createDatabaseBackupCommand } from './logs';
import { openInBrowserCommand, copyUuidCommand, quickDeployCommand, testConnectionCommand } from './browser';
import { registerGitPushAdvisor } from './gitAdvisor';
import { CoolifyDashboardPanel } from '../panels/CoolifyDashboardPanel';

export function registerCommands(
    context: vscode.ExtensionContext,
    configManager: ConfigurationManager,
    treeDataProvider: CoolifyTreeDataProvider,
    updateConfigurationState: () => Promise<void>,
    statusBarManager: StatusBarManager
) {
    const register = (id: string, fn: (...args: any[]) => any) =>
        context.subscriptions.push(vscode.commands.registerCommand(id, fn));

    // ─── Authentication ──────────────────────────────────────────────────────────
    register('coolify.login', async () => {
        try {
            await vscode.authentication.getSession('coolify', ['coolify'], { createIfNone: true });
            await updateConfigurationState();
            vscode.window.showInformationMessage('🎉 Signed in to Coolify!');
        } catch (error) {
            vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Login failed');
        }
    });

    register('coolify.logout', async () => {
        const session = await vscode.authentication.getSession('coolify', ['coolify']);
        if (session) {
            // The AuthProvider handles clearing configs when removeSession is called
            // We just ask VS Code to forget the session.
            // Note: vscode.authentication API lacks a direct `removeSession`, 
            // so we do it via the Auth Provider under the hood or config manager.
            await configManager.clearConfiguration();
            await updateConfigurationState();
            vscode.window.showInformationMessage('Signed out of Coolify');
        }
    });

    // ─── Tree Refresh & Dashboard ───────────────────────────────────────────────
    register('coolify.refreshApplications', async () => {
        await treeDataProvider.loadData();
        vscode.window.showInformationMessage('Coolify: Refreshed');
    });

    register('coolify.openDashboard', () => {
        CoolifyDashboardPanel.createOrShow(context.extensionUri, configManager);
    });

    // ─── Application Actions (Command Palette + TreeView context + AI/API) ───

    // AI Agent Callable API structure: vscode.commands.executeCommand('coolify.action', 'target-uuid', 'target-name')

    register('coolify.startDeployment', (itemOrUuid?: CoolifyTreeItem | string, name?: string) => {
        if (typeof itemOrUuid === 'string') {
            // Invoked by AI / API
            return runDeploymentFlow(configManager, itemOrUuid, name);
        } else if (itemOrUuid?.kind === 'application' && itemOrUuid.rawData) {
            // Invoked via TreeView menu
            const app = itemOrUuid.rawData as Application;
            return runDeploymentFlow(configManager, app.id || app.uuid || '', app.name);
        }
        // Invoked via Command Palette
        return startDeploymentCommandWrapper(configManager, treeDataProvider);
    });

    register('coolify.deployCurrentProject', () => deployCurrentProjectCommand(configManager, statusBarManager));

    register('coolify.cancelDeployment', () => cancelDeploymentCommand(configManager));

    register('coolify.startApplication', (itemOrUuid?: CoolifyTreeItem | string, name?: string) => {
        if (typeof itemOrUuid === 'string') {
            return _appAction(configManager, itemOrUuid, name || 'Application', 'start');
        } else if (itemOrUuid?.kind === 'application' && itemOrUuid.rawData) {
            const app = itemOrUuid.rawData as Application;
            return _appAction(configManager, app.id || app.uuid || '', app.name, 'start');
        }
        return startApplicationCommand(undefined, configManager);
    });

    register('coolify.stopApplication', (itemOrUuid?: CoolifyTreeItem | string, name?: string) => {
        if (typeof itemOrUuid === 'string') {
            return _appAction(configManager, itemOrUuid, name || 'Application', 'stop');
        } else if (itemOrUuid?.kind === 'application' && itemOrUuid.rawData) {
            const app = itemOrUuid.rawData as Application;
            return _appAction(configManager, app.id || app.uuid || '', app.name, 'stop');
        }
        return stopApplicationCommand(undefined, configManager);
    });

    register('coolify.restartApplication', (itemOrUuid?: CoolifyTreeItem | string, name?: string) => {
        if (typeof itemOrUuid === 'string') {
            return _appAction(configManager, itemOrUuid, name || 'Application', 'restart');
        } else if (itemOrUuid?.kind === 'application' && itemOrUuid.rawData) {
            const app = itemOrUuid.rawData as Application;
            return _appAction(configManager, app.id || app.uuid || '', app.name, 'restart');
        }
        return restartApplicationCommand(undefined, configManager);
    });

    // ─── Logs ───────────────────────────────────────────────────────────────────
    register('coolify.viewApplicationLogs', (itemOrUuid?: CoolifyTreeItem | { id: string; name: string } | string, name?: string) => {
        if (typeof itemOrUuid === 'string') {
            return viewApplicationLogsCommand(configManager, { id: itemOrUuid, name: name || 'Application' });
        } else if (itemOrUuid && 'kind' in itemOrUuid && itemOrUuid.kind === 'application' && itemOrUuid.rawData) {
            const app = itemOrUuid.rawData as Application;
            return viewApplicationLogsCommand(configManager, { id: app.id || app.uuid || '', name: app.name });
        } else if (itemOrUuid && typeof itemOrUuid === 'object' && 'id' in itemOrUuid) {
            return viewApplicationLogsCommand(configManager, itemOrUuid as { id: string; name: string });
        }
        return viewApplicationLogsCommand(configManager);
    });

    register('coolify.viewApplicationLogsLive', (itemOrUuid?: CoolifyTreeItem | { id: string; name: string } | string, name?: string) => {
        if (typeof itemOrUuid === 'string') {
            return viewApplicationLogsLiveCommand(configManager, { id: itemOrUuid, name: name || 'Application' });
        } else if (itemOrUuid && 'kind' in itemOrUuid && itemOrUuid.kind === 'application' && itemOrUuid.rawData) {
            const app = itemOrUuid.rawData as Application;
            return viewApplicationLogsLiveCommand(configManager, { id: app.id || app.uuid || '', name: app.name });
        } else if (itemOrUuid && typeof itemOrUuid === 'object' && 'id' in itemOrUuid) {
            return viewApplicationLogsLiveCommand(configManager, itemOrUuid as { id: string; name: string });
        }
        return viewApplicationLogsLiveCommand(configManager);
    });

    // ─── Databases ──────────────────────────────────────────────────────────────
    register('coolify.startDatabase', (itemOrUuid?: CoolifyTreeItem | string, name?: string) => {
        if (typeof itemOrUuid === 'string') {
            return startDatabaseCommand(undefined, configManager, itemOrUuid, name);
        } else if (itemOrUuid?.kind === 'database' && itemOrUuid.rawData) {
            const db = itemOrUuid.rawData as import('../types').Database;
            return startDatabaseCommand(undefined, configManager, db.uuid, db.name);
        }
        return startDatabaseCommand(undefined, configManager);
    });

    register('coolify.stopDatabase', (itemOrUuid?: CoolifyTreeItem | string, name?: string) => {
        if (typeof itemOrUuid === 'string') {
            return stopDatabaseCommand(undefined, configManager, itemOrUuid, name);
        } else if (itemOrUuid?.kind === 'database' && itemOrUuid.rawData) {
            const db = itemOrUuid.rawData as import('../types').Database;
            return stopDatabaseCommand(undefined, configManager, db.uuid, db.name);
        }
        return stopDatabaseCommand(undefined, configManager);
    });

    register('coolify.createDatabaseBackup', (itemOrUuid?: CoolifyTreeItem | string, name?: string) => {
        if (typeof itemOrUuid === 'string') {
            return createDatabaseBackupCommand(configManager, { id: itemOrUuid, name: name || 'Database' });
        } else if (itemOrUuid?.kind === 'database' && itemOrUuid.rawData) {
            const db = itemOrUuid.rawData as import('../types').Database;
            return createDatabaseBackupCommand(configManager, { id: db.uuid, name: db.name });
        }
        return createDatabaseBackupCommand(configManager);
    });

    // ─── Browser / Utility ──────────────────────────────────────────────────────
    register('coolify.openInBrowser', (item?: CoolifyTreeItem) =>
        openInBrowserCommand(configManager, treeDataProvider, item)
    );

    register('coolify.copyUuid', (item?: CoolifyTreeItem) =>
        copyUuidCommand(treeDataProvider, item)
    );

    register('coolify.quickDeploy', () =>
        quickDeployCommand(configManager, treeDataProvider)
    );

    register('coolify.testConnection', () =>
        testConnectionCommand(configManager)
    );

    // ─── Git Advisor ─────────────────────────────────────────────────────────────
    registerGitPushAdvisor(context, configManager, treeDataProvider);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function startDeploymentCommandWrapper(
    configManager: ConfigurationManager,
    treeDataProvider: CoolifyTreeDataProvider
) {
    const apps = treeDataProvider.getCachedApplications();
    if (!apps || apps.length === 0) {
        vscode.window.showInformationMessage('No applications found');
        return;
    }

    const selected = await vscode.window.showQuickPick(
        apps.map(app => ({
            label: app.name,
            description: app.status,
            detail: app.fqdn,
            id: app.id || app.uuid || '',
        })),
        { placeHolder: 'Select an application to deploy', title: 'Start Deployment' }
    );

    if (selected) {
        await runDeploymentFlow(configManager, selected.id, selected.label);
    }
}

async function _appAction(
    configManager: ConfigurationManager,
    uuid: string,
    name: string,
    action: 'start' | 'stop' | 'restart'
) {
    const serverUrl = await configManager.getServerUrl();
    const token = await configManager.getToken();
    if (!serverUrl || !token) { throw new Error('Not configured'); }

    const service = new CoolifyService(serverUrl, token);
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `${action}ing ${name}...`, cancellable: false },
        async () => {
            if (action === 'start') { await service.startApplication(uuid); }
            else if (action === 'stop') { await service.stopApplication(uuid); }
            else { await service.restartApplication(uuid); }

            const enableNotifications = vscode.workspace.getConfiguration('coolify').get<boolean>('enableNotifications', true);
            if (enableNotifications) {
                vscode.window.showInformationMessage(`✅ ${name} ${action}ed`);
            }
        }
    );
}

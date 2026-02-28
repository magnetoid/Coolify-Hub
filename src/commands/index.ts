import * as vscode from 'vscode';
import { ConfigurationManager } from '../managers/ConfigurationManager';
import { CoolifyTreeDataProvider, CoolifyTreeItem } from '../providers/CoolifyTreeDataProvider';
import { CoolifyService } from '../services/CoolifyService';
import { Application } from '../types';
import { configureCommand, reconfigureCommand } from './configure';
import { startDeploymentCommand, cancelDeploymentCommand } from './deploy';
import { startApplicationCommand, stopApplicationCommand, restartApplicationCommand } from './applicationActions';
import { startDatabaseCommand, stopDatabaseCommand } from './databaseActions';
import { viewApplicationLogsCommand, createDatabaseBackupCommand } from './logs';
import { openInBrowserCommand, copyUuidCommand, quickDeployCommand, testConnectionCommand } from './browser';
import { registerGitPushAdvisor } from './gitAdvisor';

export function registerCommands(
    context: vscode.ExtensionContext,
    configManager: ConfigurationManager,
    treeDataProvider: CoolifyTreeDataProvider,
    updateConfigurationState: () => Promise<void>
) {
    const register = (id: string, fn: (...args: any[]) => any) =>
        context.subscriptions.push(vscode.commands.registerCommand(id, fn));

    // ─── Configuration ──────────────────────────────────────────────────────────
    register('coolify.configure', () => configureCommand(configManager, updateConfigurationState));
    register('coolify.reconfigure', () => reconfigureCommand(configManager, updateConfigurationState));

    // ─── Tree Refresh ───────────────────────────────────────────────────────────
    register('coolify.refreshApplications', async () => {
        await treeDataProvider.loadData();
        vscode.window.showInformationMessage('Coolify: Refreshed');
    });

    // ─── Application Actions (Command Palette + TreeView context + AI/API) ───

    // AI Agent Callable API structure: vscode.commands.executeCommand('coolify.action', 'target-uuid', 'target-name')

    register('coolify.startDeployment', (itemOrUuid?: CoolifyTreeItem | string, name?: string) => {
        if (typeof itemOrUuid === 'string') {
            // Invoked by AI / API
            return _deployAppById(configManager, itemOrUuid);
        } else if (itemOrUuid?.kind === 'application' && itemOrUuid.rawData) {
            // Invoked via TreeView menu
            const app = itemOrUuid.rawData as Application;
            return _deployAppById(configManager, app.id || app.uuid || '');
        }
        // Invoked via Command Palette
        return startDeploymentCommandWrapper(configManager, treeDataProvider);
    });

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
            // Invoked by AI / API
            return viewApplicationLogsCommand(configManager, { id: itemOrUuid, name: name || 'Application' });
        } else if (itemOrUuid && 'kind' in itemOrUuid && itemOrUuid.kind === 'application' && itemOrUuid.rawData) {
            const app = itemOrUuid.rawData as Application;
            return viewApplicationLogsCommand(configManager, { id: app.id || app.uuid || '', name: app.name });
        } else if (itemOrUuid && typeof itemOrUuid === 'object' && 'id' in itemOrUuid) {
            return viewApplicationLogsCommand(configManager, itemOrUuid as { id: string; name: string });
        }
        return viewApplicationLogsCommand(configManager);
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
        await _deployAppById(configManager, selected.id);
    }
}

async function _deployAppById(configManager: ConfigurationManager, uuid: string) {
    const serverUrl = await configManager.getServerUrl();
    const token = await configManager.getToken();
    if (!serverUrl || !token) { throw new Error('Not configured'); }

    const service = new CoolifyService(serverUrl, token);
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Starting deployment...', cancellable: false },
        async () => {
            await service.startDeployment(uuid);
            vscode.window.showInformationMessage('🚀 Deployment started!');
        }
    );
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

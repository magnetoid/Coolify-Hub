import * as vscode from 'vscode';
import { ConfigurationManager } from '../managers/ConfigurationManager';
import { CoolifyTreeDataProvider, CoolifyTreeItem } from '../providers/CoolifyTreeDataProvider';
import { CoolifyService } from '../services/CoolifyService';
import { Application, Database } from '../types';

/**
 * Open an application's URL in the system browser.
 * Works from tree context click (item arg) or Command Palette (QuickPick).
 */
export async function openInBrowserCommand(
    configManager: ConfigurationManager,
    treeDataProvider: CoolifyTreeDataProvider,
    item?: CoolifyTreeItem
): Promise<void> {
    let fqdn: string | undefined;
    let appName = '';

    if (item?.kind === 'application' && item.rawData) {
        const app = item.rawData as Application;
        fqdn = app.fqdn;
        appName = app.name;
    } else {
        // QuickPick: show only apps that have a FQDN
        const appsWithUrl = treeDataProvider.getCachedApplications().filter(a => !!a.fqdn);
        if (appsWithUrl.length === 0) {
            vscode.window.showInformationMessage('No applications have a public URL configured in Coolify.');
            return;
        }
        const selected = await vscode.window.showQuickPick(
            appsWithUrl.map(app => ({
                label: app.name,
                description: app.fqdn!.replace(/^https?:\/\//, ''),
                detail: `Status: ${app.status ?? 'unknown'}`,
                fqdn: app.fqdn!,
            })),
            { placeHolder: 'Select an application to open', title: 'Open in Browser' }
        );
        if (!selected) { return; }
        fqdn = selected.fqdn;
        appName = selected.label;
    }

    if (!fqdn) {
        vscode.window.showWarningMessage(`${appName} has no public URL configured in Coolify.`);
        return;
    }

    const url = vscode.Uri.parse(fqdn.startsWith('http') ? fqdn : `https://${fqdn}`);
    await vscode.env.openExternal(url);
}

/**
 * Copy an application's or database's UUID to the clipboard.
 */
export async function copyUuidCommand(
    treeDataProvider: CoolifyTreeDataProvider,
    item?: CoolifyTreeItem
): Promise<void> {
    let uuid: string | undefined;
    let label = '';

    if (item?.rawData) {
        const data = item.rawData as Application | Database;
        uuid = (data as Application).uuid ?? (data as Database).uuid;
        label = (data as Application).name ?? (data as Database).name;
    } else {
        // QuickPick fallback
        const apps = treeDataProvider.getCachedApplications();
        const dbs = treeDataProvider.getCachedDatabases();
        const items = [
            ...apps.map(a => ({ label: a.name, description: `App · ${a.uuid}`, uuid: a.uuid })),
            ...dbs.map(d => ({ label: d.name, description: `DB · ${d.uuid}`, uuid: d.uuid })),
        ];
        if (items.length === 0) {
            vscode.window.showInformationMessage('No resources found to copy UUID from.');
            return;
        }
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a resource to copy its UUID',
            title: 'Copy UUID',
        });
        if (!selected) { return; }
        uuid = selected.uuid;
        label = selected.label;
    }

    if (!uuid) {
        vscode.window.showWarningMessage('UUID not available for this resource.');
        return;
    }

    await vscode.env.clipboard.writeText(uuid);
    vscode.window.showInformationMessage(`✅ UUID for "${label}" copied to clipboard!`);
}

/**
 * Quick Deploy — type-to-search across ALL apps with status shown prominently.
 * Uses vscode.window.showQuickPick with a rich item list.
 */
export async function quickDeployCommand(
    configManager: ConfigurationManager,
    treeDataProvider: CoolifyTreeDataProvider
): Promise<void> {
    const apps = treeDataProvider.getCachedApplications();
    if (apps.length === 0) {
        vscode.window.showInformationMessage('No applications found. Try refreshing.');
        return;
    }

    const statusIcon = (status: string | undefined) => {
        switch (status?.toLowerCase()) {
            case 'running': return '🟢';
            case 'stopped': case 'exited': return '🔴';
            case 'deploying': case 'starting': return '🟡';
            case 'error': case 'failed': return '❌';
            default: return '⚪';
        }
    };

    const selected = await vscode.window.showQuickPick(
        apps.map(app => ({
            label: `${statusIcon(app.status)} ${app.name}`,
            description: app.fqdn?.replace(/^https?:\/\//, '') ?? '',
            detail: `Status: ${app.status ?? 'unknown'} · ${app.git_branch ? `Branch: ${app.git_branch}` : ''}`,
            uuid: app.uuid ?? app.id ?? '',
            name: app.name,
        })),
        {
            placeHolder: 'Type to filter, select to deploy immediately',
            title: '⚡ Quick Deploy',
            matchOnDescription: true,
            matchOnDetail: true,
        }
    );

    if (!selected) { return; }

    const serverUrl = await configManager.getServerUrl();
    const token = await configManager.getToken();
    if (!serverUrl || !token) {
        vscode.window.showErrorMessage('Coolify is not configured. Run Coolify: Configure first.');
        return;
    }

    const service = new CoolifyService(serverUrl, token);
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `🚀 Deploying ${selected.name}…`,
            cancellable: false,
        },
        async () => {
            try {
                await service.startDeployment(selected.uuid);
                vscode.window.showInformationMessage(
                    `🚀 ${selected.name} deployment started!`,
                    'View Logs'
                ).then(action => {
                    if (action === 'View Logs') {
                        vscode.commands.executeCommand('coolify.viewApplicationLogs',
                            { id: selected.uuid, name: selected.name }
                        );
                    }
                });
            } catch (err) {
                vscode.window.showErrorMessage(
                    `Deploy failed: ${err instanceof Error ? err.message : String(err)}`
                );
            }
        }
    );
}

/**
 * Test Connection — checks if the Coolify server is reachable and shows version.
 */
export async function testConnectionCommand(configManager: ConfigurationManager): Promise<void> {
    const serverUrl = await configManager.getServerUrl();
    const token = await configManager.getToken();

    if (!serverUrl || !token) {
        vscode.window.showErrorMessage('Coolify is not configured. Run Coolify: Configure first.');
        return;
    }

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Testing Coolify connection…', cancellable: false },
        async () => {
            try {
                const service = new CoolifyService(serverUrl, token);
                const version = await service.getVersion();
                vscode.window.showInformationMessage(
                    `✅ Connected to Coolify v${version} at ${serverUrl.replace(/^https?:\/\//, '')}`
                );
            } catch (err) {
                vscode.window.showErrorMessage(
                    `❌ Connection failed: ${err instanceof Error ? err.message : String(err)}`
                );
            }
        }
    );
}

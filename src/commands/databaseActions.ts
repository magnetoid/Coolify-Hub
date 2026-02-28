import * as vscode from 'vscode';
import { ConfigurationManager } from '../managers/ConfigurationManager';
import { CoolifyService } from '../services/CoolifyService';
import { Database } from '../types';

async function performDatabaseAction(
    configManager: ConfigurationManager,
    action: 'start' | 'stop',
    actionLabel: string,
    providedUuid?: string,
    providedName?: string
) {
    let targetUuid = providedUuid;
    let targetName = providedName || 'Database';

    // If UUID isn't provided (e.g., invoked from Command Palette instead of TreeView/AI),
    // we need to fetch all databases and prompt the user.
    if (!targetUuid) {
        const serverUrl = await configManager.getServerUrl();
        const token = await configManager.getToken();
        if (!serverUrl || !token) {
            vscode.window.showErrorMessage('Coolify is not configured. Run Coolify: Configure first.');
            return;
        }

        const service = new CoolifyService(serverUrl, token);
        let databases: Database[] = [];

        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Fetching databases...' },
            async () => {
                databases = await service.getDatabases();
            }
        );

        if (!databases || databases.length === 0) {
            vscode.window.showInformationMessage('No databases found.');
            return;
        }

        // Filter databases based on action if possible. 
        // Note: Databases have a 'status' field, but it might not perfectly match 'started'/'stopped'. 
        // For now, we'll just show all of them.
        const selected = await vscode.window.showQuickPick(
            databases.map(db => ({
                label: db.name,
                description: db.status,
                detail: db.type,
                id: db.uuid,
            })),
            { placeHolder: `Select a database to ${action}`, title: actionLabel }
        );

        if (!selected) {
            return; // User cancelled
        }

        targetUuid = selected.id;
        targetName = selected.label;
    }

    if (!targetUuid) {
        return;
    }

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
            title: `${actionLabel} for ${targetName}...`,
            cancellable: false,
        },
        async () => {
            try {
                if (action === 'start') {
                    await service.startDatabase(targetUuid);
                } else if (action === 'stop') {
                    await service.stopDatabase(targetUuid);
                }

                // Add respect for notifications setting
                const enableNotifications = vscode.workspace.getConfiguration('coolify').get<boolean>('enableNotifications', true);
                if (enableNotifications) {
                    vscode.window.showInformationMessage(`✅ ${targetName} ${action} command sent successfully`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to ${action} ${targetName}`);
                console.error(`Error in database action (${action}):`, error);
            }
        }
    );
}

export async function startDatabaseCommand(
    _unused: undefined,
    configManager: ConfigurationManager,
    uuid?: string,
    name?: string
) {
    await performDatabaseAction(configManager, 'start', 'Start Database', uuid, name);
}

export async function stopDatabaseCommand(
    _unused: undefined,
    configManager: ConfigurationManager,
    uuid?: string,
    name?: string
) {
    await performDatabaseAction(configManager, 'stop', 'Stop Database', uuid, name);
}

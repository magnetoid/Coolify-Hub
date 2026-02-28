import * as vscode from 'vscode';
import { CoolifyService } from '../services/CoolifyService';
import { ConfigurationManager } from '../managers/ConfigurationManager';
import { Application } from '../types';

async function performApplicationAction(
    configManager: ConfigurationManager,
    action: 'start' | 'stop' | 'restart',
    title: string,
    preselectedId?: string,
    preselectedName?: string
) {
    try {
        const serverUrl = await configManager.getServerUrl();
        const token = await configManager.getToken();

        if (!serverUrl || !token) {
            throw new Error('Extension not configured properly');
        }

        const service = new CoolifyService(serverUrl, token);

        let targetId = preselectedId;
        let targetName = preselectedName;

        // Fall back to QuickPick if no pre-selected app
        if (!targetId) {
            const applications = await service.getApplications();
            if (!applications || applications.length === 0) {
                vscode.window.showInformationMessage('No applications found');
                return;
            }

            const selected = await vscode.window.showQuickPick(
                applications.map((app: Application) => ({
                    label: app.name,
                    description: app.status,
                    detail: `Status: ${app.status}`,
                    id: app.id || app.uuid || '',
                })),
                { placeHolder: `Select an application to ${action}`, title }
            );

            if (!selected) { return; }
            targetId = selected.id;
            targetName = selected.label;
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `${action}ing ${targetName}...`,
                cancellable: false,
            },
            async () => {
                if (action === 'start') { await service.startApplication(targetId!); }
                else if (action === 'stop') { await service.stopApplication(targetId!); }
                else { await service.restartApplication(targetId!); }

                const enableNotifications = vscode.workspace.getConfiguration('coolify').get<boolean>('enableNotifications', true);
                if (enableNotifications) {
                    vscode.window.showInformationMessage(`✅ Successfully ${action}ed ${targetName}`);
                }
            }
        );
    } catch (error) {
        vscode.window.showErrorMessage(
            error instanceof Error ? error.message : `Failed to ${action} application`
        );
    }
}

export async function startApplicationCommand(
    _unused: undefined,
    configManager: ConfigurationManager,
    id?: string,
    name?: string
) {
    await performApplicationAction(configManager, 'start', 'Start Application', id, name);
}

export async function stopApplicationCommand(
    _unused: undefined,
    configManager: ConfigurationManager,
    id?: string,
    name?: string
) {
    await performApplicationAction(configManager, 'stop', 'Stop Application', id, name);
}

export async function restartApplicationCommand(
    _unused: undefined,
    configManager: ConfigurationManager,
    id?: string,
    name?: string
) {
    await performApplicationAction(configManager, 'restart', 'Restart Application', id, name);
}

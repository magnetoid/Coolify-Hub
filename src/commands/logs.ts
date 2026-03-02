import * as vscode from 'vscode';
import { ConfigurationManager } from '../managers/ConfigurationManager';
import { CoolifyService } from '../services/CoolifyService';
import { Application, Database } from '../types';
import { isCoolifyCliInstalled, runCliCommandInTerminal, installCoolifyCli } from '../utils/cliBridge';

let logsOutputChannel: vscode.OutputChannel | undefined;

function getLogsChannel(): vscode.OutputChannel {
    if (!logsOutputChannel) {
        logsOutputChannel = vscode.window.createOutputChannel('Coolify Logs');
    }
    return logsOutputChannel;
}

export async function viewApplicationLogsCommand(
    configManager: ConfigurationManager,
    app?: { id: string; name: string }
) {
    try {
        const serverUrl = await configManager.getServerUrl();
        const token = await configManager.getToken();

        if (!serverUrl || !token) {
            throw new Error('Extension not configured properly');
        }

        const service = new CoolifyService(serverUrl, token);

        // If no app passed in (e.g. from command palette), show a QuickPick
        let targetId = app?.id;
        let targetName = app?.name;

        if (!targetId) {
            const applications = await service.getApplications();
            if (!applications || applications.length === 0) {
                vscode.window.showInformationMessage('No applications found');
                return;
            }

            const selected = await vscode.window.showQuickPick(
                applications.map((a: Application) => ({
                    label: a.name,
                    description: a.status,
                    detail: a.fqdn,
                    id: a.uuid || a.id || '',
                })),
                { placeHolder: 'Select an application to view logs', title: 'Coolify: View Logs' }
            );

            if (!selected) { return; }
            targetId = selected.id;
            targetName = selected.label;
        }

        const channel = getLogsChannel();
        channel.clear();
        channel.show(true);
        channel.appendLine(`── Coolify Logs — ${targetName} ──`);
        channel.appendLine(`Fetching logs from ${serverUrl}...`);
        channel.appendLine('');

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Fetching logs for ${targetName}...`,
                cancellable: false,
            },
            async () => {
                const logs = await service.getApplicationLogs(targetId!);
                channel.appendLine(logs || '(No log output)');
            }
        );
    } catch (error) {
        vscode.window.showErrorMessage(
            error instanceof Error ? error.message : 'Failed to fetch logs'
        );
    }
}

export async function viewApplicationLogsLiveCommand(
    configManager: ConfigurationManager,
    app?: { id: string; name: string }
) {
    try {
        const serverUrl = await configManager.getServerUrl();
        const token = await configManager.getToken();
        if (!serverUrl || !token) { throw new Error('Extension not configured properly'); }

        const service = new CoolifyService(serverUrl, token);

        let targetId = app?.id;
        let targetName = app?.name;

        if (!targetId) {
            const applications = await service.getApplications();
            if (!applications || applications.length === 0) {
                vscode.window.showInformationMessage('No applications found');
                return;
            }

            const selected = await vscode.window.showQuickPick(
                applications.map((a: Application) => ({
                    label: a.name,
                    description: a.status,
                    detail: a.fqdn,
                    id: a.uuid || a.id || '',
                })),
                { placeHolder: 'Select an application to tail logs', title: 'Coolify: Live App Logs' }
            );

            if (!selected) { return; }
            targetId = selected.id;
            targetName = selected.label;
        }

        const targetUuid = targetId!;

        // ── Hybrid CLI Handoff ──
        if (await isCoolifyCliInstalled()) {
            vscode.window.showInformationMessage(`Opening live logs for ${targetName} via Coolify CLI...`);
            await runCliCommandInTerminal(`logs tail ${targetUuid}`, `Logs: ${targetName}`);
            return;
        }

        // ── CLI Installation Prompt ──
        const installChoice = await vscode.window.showInformationMessage(
            'The Coolify CLI is not installed. Installing it enables native terminal log streaming (with syntax highlighting and interactive sockets).',
            'Install CLI',
            'Use Fallback Viewer'
        );

        if (installChoice === 'Install CLI') {
            installCoolifyCli();
            return; // Give them time to install, they can run the command again later
        }

        // ── Fallback: HTTP Polling ──
        const channel = getLogsChannel();
        channel.clear();
        channel.show(true);
        channel.appendLine(`── Coolify Live Logs — ${targetName} ──`);
        channel.appendLine(`Tailing logs… (cancel the progress notification to stop)`);
        channel.appendLine('');

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `[Coolify] Live logs: ${targetName}`,
                cancellable: true,
            },
            async (_progress, cancellationToken) => {
                let lastLength = 0;
                while (!cancellationToken.isCancellationRequested) {
                    try {
                        const logs = await service.getApplicationLogs(targetId!);
                        if (logs && logs.length > lastLength) {
                            channel.append(logs.substring(lastLength));
                            lastLength = logs.length;
                        }
                    } catch (e) {
                        channel.appendLine(`(fetch error: ${e instanceof Error ? e.message : String(e)})`);
                    }
                    await new Promise(r => setTimeout(r, 3000));
                }
                channel.appendLine(`\n🛑 Live log tail stopped.`);
            }
        );
    } catch (error) {
        vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Failed to tail logs');
    }
}

export async function createDatabaseBackupCommand(
    configManager: ConfigurationManager,
    db?: { id: string; name: string }
) {
    try {
        const serverUrl = await configManager.getServerUrl();
        const token = await configManager.getToken();
        if (!serverUrl || !token) { throw new Error('Extension not configured properly'); }

        const service = new CoolifyService(serverUrl, token);

        let targetId = db?.id;
        let targetName = db?.name;

        if (!targetId) {
            const databases = await service.getDatabases();
            if (!databases || databases.length === 0) {
                vscode.window.showInformationMessage('No databases found');
                return;
            }

            const selected = await vscode.window.showQuickPick(
                databases.map((d: Database) => ({
                    label: d.name,
                    description: d.type,
                    detail: d.status,
                    id: d.uuid,
                })),
                { placeHolder: 'Select a database to back up', title: 'Coolify: Create Database Backup' }
            );

            if (!selected) { return; }
            targetId = selected.id;
            targetName = selected.label;
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Creating backup for ${targetName}...`,
                cancellable: false,
            },
            async () => {
                await service.createDatabaseBackup(targetId!);
                vscode.window.showInformationMessage(`✅ Backup created for ${targetName}`);
            }
        );
    } catch (error) {
        vscode.window.showErrorMessage(
            error instanceof Error ? error.message : 'Failed to create backup'
        );
    }
}

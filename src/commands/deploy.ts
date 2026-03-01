import * as vscode from 'vscode';
import { CoolifyWebViewProvider } from '../providers/CoolifyWebViewProvider';
import { ConfigurationManager } from '../managers/ConfigurationManager';
import { CoolifyService } from '../services/CoolifyService';

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let deployLogsOutputChannel: vscode.OutputChannel | undefined;
function getDeployLogsChannel(): vscode.OutputChannel {
    if (!deployLogsOutputChannel) {
        deployLogsOutputChannel = vscode.window.createOutputChannel('Coolify Build Logs');
    }
    return deployLogsOutputChannel;
}

export async function runDeploymentFlow(configManager: ConfigurationManager, appUuid: string, appName: string = 'Application') {
    try {
        const serverUrl = await configManager.getServerUrl();
        const token = await configManager.getToken();
        if (!serverUrl || !token) { throw new Error('Not configured'); }

        const service = new CoolifyService(serverUrl, token);

        // 1. Try Git Push
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Pushing local changes for ${appName}...`,
                    cancellable: false
                }, async () => {
                    await execAsync('git push origin HEAD', { cwd: workspaceRoot });
                });
                vscode.window.showInformationMessage(`✅ Git push successful for ${appName}`);
            } catch (error) {
                // Ignore or log if no changes or upstream not set
                console.log("Git push skipped or failed:", error);
            }
        }

        // 2. Start Deployment
        const channel = getDeployLogsChannel();
        channel.clear();
        channel.show(true);
        channel.appendLine(`── Coolify Deployment Logs: ${appName} ──`);
        channel.appendLine(`Starting deployment...`);

        let deployUuid: string | undefined;
        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: `Deploying ${appName}...`, cancellable: false },
            async (progress) => {
                try {
                    deployUuid = await service.startDeployment(appUuid);

                    if (!deployUuid) {
                        channel.appendLine("Deployment started, but no UUID returned to track logs.");
                        vscode.window.showInformationMessage(`🚀 Deployment started for ${appName}`);
                        return;
                    }

                    channel.appendLine(`Deployment UUID: ${deployUuid}`);
                    channel.appendLine(`Polling for live logs...`);

                    // 3. Poll for Logs & Status
                    let isFinished = false;
                    let lastLogLength = 0;

                    while (!isFinished) {
                        await new Promise(resolve => setTimeout(resolve, 3000));

                        try {
                            const deployInfo = await service.getDeployment(deployUuid);
                            if (!deployInfo) continue;

                            progress.report({ message: `Status: ${deployInfo.status}` });

                            const anyInfo = deployInfo as any;
                            if (anyInfo.logs && typeof anyInfo.logs === 'string') {
                                const currentLogs = anyInfo.logs;
                                if (currentLogs.length > lastLogLength) {
                                    const newLogs = currentLogs.substring(lastLogLength);
                                    channel.append(newLogs);
                                    lastLogLength = currentLogs.length;
                                }
                            }

                            if (deployInfo.status === 'finished' || deployInfo.status === 'failed' || deployInfo.status === 'error') {
                                isFinished = true;
                                if (deployInfo.status === 'finished') {
                                    vscode.window.showInformationMessage(`✅ Deployment successful: ${appName}`);
                                    channel.appendLine(`\n[SUCCESS] Deployment finished successfully!`);
                                } else {
                                    vscode.window.showErrorMessage(`❌ Deployment failed: ${appName}`);
                                    channel.appendLine(`\n[ERROR] Deployment failed with status: ${deployInfo.status}`);
                                }
                            }
                        } catch (pollErr) {
                            console.error('Polling error:', pollErr);
                        }
                    }
                } catch (err) {
                    vscode.window.showErrorMessage(`❌ Deployment failed to start: ${err instanceof Error ? err.message : 'Unknown'}`);
                    channel.appendLine(`\n[ERROR] Failed to start: ${err instanceof Error ? err.message : 'Unknown'}`);
                }
            }
        );
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to deploy: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
}

export async function startDeploymentCommand(
    configManager: ConfigurationManager,
    webviewProvider: CoolifyWebViewProvider | undefined
) {
    try {
        if (!webviewProvider) {
            vscode.window.showErrorMessage('Coolify provider not initialized');
            return;
        }
        const applications = await webviewProvider.getApplications();

        if (!applications || applications.length === 0) {
            vscode.window.showInformationMessage('No applications found');
            return;
        }

        const selected = await vscode.window.showQuickPick(
            applications.map((app) => ({
                label: app.name,
                description: app.status,
                detail: `Status: ${app.status}`,
                id: app.id,
            })),
            {
                placeHolder: 'Select an application to deploy',
                title: 'Start Deployment',
            }
        );

        if (selected) {
            await runDeploymentFlow(configManager, selected.id, selected.label);
            webviewProvider.refreshData();
        }
    } catch (error) {
        vscode.window.showErrorMessage(
            error instanceof Error ? error.message : 'Failed to start deployment'
        );
    }
}

export async function cancelDeploymentCommand(
    configManager: ConfigurationManager
) {
    try {
        const serverUrl = await configManager.getServerUrl();
        const token = await configManager.getToken();

        if (!serverUrl || !token) {
            throw new Error('Extension not configured properly');
        }

        const service = new CoolifyService(serverUrl, token);
        const deployments = await service.getDeployments();
        const inProgress = deployments.filter(d => d.status === 'in_progress' || d.status === 'queued');

        if (!inProgress || inProgress.length === 0) {
            vscode.window.showInformationMessage('No active deployments found');
            return;
        }

        const selected = await vscode.window.showQuickPick(
            inProgress.map((d) => ({
                label: `Cancel: ${d.application_name || 'Deployment'}`,
                description: d.status,
                detail: d.commit_message || `Deployment ID: ${d.id}`,
                id: d.id,
            })),
            {
                placeHolder: 'Select a deployment to cancel',
                title: 'Cancel Deployment',
            }
        );

        if (selected) {
            vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Canceling ${selected.label}...`,
                    cancellable: false,
                },
                async () => {
                    await service.cancelDeployment(selected.id);
                    vscode.window.showInformationMessage(`Successfully canceled deployment.`);
                }
            );
        }
    } catch (error) {
        vscode.window.showErrorMessage(
            error instanceof Error ? error.message : 'Failed to cancel deployment'
        );
    }
}

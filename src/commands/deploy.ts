import * as vscode from 'vscode';
import { ConfigurationManager } from '../managers/ConfigurationManager';
import { CoolifyService } from '../services/CoolifyService';
import { Application } from '../types';

import { spawn } from 'child_process';
import { execSync } from 'child_process';

// ─── Shared Output Channel ────────────────────────────────────────────────────

let pipelineChannel: vscode.OutputChannel | undefined;

function getPipelineChannel(): vscode.OutputChannel {
    if (!pipelineChannel) {
        pipelineChannel = vscode.window.createOutputChannel('Coolify: Deploy Pipeline');
    }
    return pipelineChannel;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function banner(channel: vscode.OutputChannel, stage: string) {
    channel.appendLine('');
    channel.appendLine(`${'─'.repeat(60)}`);
    channel.appendLine(`  ${stage}`);
    channel.appendLine(`${'─'.repeat(60)}`);
}

function timestamp(): string {
    return new Date().toLocaleTimeString();
}

// ─── Stage 1: Git Push (live streaming) ──────────────────────────────────────

function gitPushLive(workspaceRoot: string, channel: vscode.OutputChannel): Promise<boolean> {
    return new Promise((resolve) => {
        banner(channel, '🔀  STAGE 1 — Git Push');
        channel.appendLine(`[${timestamp()}] Running: git push origin HEAD`);

        const proc = spawn('git', ['push', 'origin', 'HEAD'], { cwd: workspaceRoot });

        proc.stdout.on('data', (data: Buffer) => {
            channel.append(data.toString());
        });
        proc.stderr.on('data', (data: Buffer) => {
            // Git sends most output (including progress) to stderr
            channel.append(data.toString());
        });
        proc.on('close', (code) => {
            if (code === 0) {
                channel.appendLine(`[${timestamp()}] ✅ Git push succeeded.`);
                resolve(true);
            } else {
                channel.appendLine(`[${timestamp()}] ❌ Git push exited with code ${code}.`);
                resolve(false);
            }
        });
        proc.on('error', (err) => {
            channel.appendLine(`[${timestamp()}] ❌ Git push error: ${err.message}`);
            resolve(false);
        });
    });
}

// ─── Stage 2: Commit SHA Verification ────────────────────────────────────────

async function waitForCommitOnCoolify(
    service: CoolifyService,
    appUuid: string,
    localSha: string,
    channel: vscode.OutputChannel
): Promise<void> {
    banner(channel, '✅  STAGE 2 — Commit Verification');
    channel.appendLine(`[${timestamp()}] Waiting for Coolify to detect commit: ${localSha.slice(0, 8)}`);

    const maxAttempts = 20;   // 20 × 3s = 60s max
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const app = await service.getApplication(appUuid);
            const coolifysha = (app as any).git_commit_sha as string | undefined;
            channel.appendLine(`[${timestamp()}] Attempt ${i + 1}/${maxAttempts} — Coolify SHA: ${coolifysha?.slice(0, 8) ?? 'unknown'}`);
            if (coolifysha && localSha.startsWith(coolifysha) || (coolifysha && coolifysha.startsWith(localSha.slice(0, 8)))) {
                channel.appendLine(`[${timestamp()}] ✅ Commit verified on Coolify!`);
                return;
            }
        } catch (e) {
            channel.appendLine(`[${timestamp()}] (poll error: ${e instanceof Error ? e.message : String(e)})`);
        }
        await new Promise(r => setTimeout(r, 3000));
    }
    channel.appendLine(`[${timestamp()}] ⚠️  Commit not yet visible on Coolify — continuing anyway (webhook may handle it).`);
}

// ─── Stage 3 + 4: Deploy & Live Build Logs ───────────────────────────────────

async function deployAndStreamLogs(
    service: CoolifyService,
    appUuid: string,
    appName: string,
    channel: vscode.OutputChannel,
    token: vscode.CancellationToken
): Promise<boolean> {
    banner(channel, '🚀  STAGE 3 — Triggering Deployment');

    let deployUuid: string | undefined;
    try {
        deployUuid = await service.startDeployment(appUuid);
    } catch (err) {
        channel.appendLine(`[${timestamp()}] ❌ Failed to start deployment: ${err instanceof Error ? err.message : String(err)}`);
        return false;
    }

    if (!deployUuid) {
        channel.appendLine(`[${timestamp()}] ⚠️  Deployment started but no UUID returned — cannot stream logs.`);
        vscode.window.showInformationMessage(`🚀 Deployment started for ${appName}`);
        return true;
    }

    channel.appendLine(`[${timestamp()}] Deploy UUID: ${deployUuid}`);

    banner(channel, '📋  STAGE 4 — Live Deploy Logs');
    channel.appendLine(`[${timestamp()}] Polling for build logs...`);

    let lastLogLength = 0;
    let isFinished = false;
    let success = false;

    while (!isFinished && !token.isCancellationRequested) {
        await new Promise(r => setTimeout(r, 3000));
        try {
            const deployInfo = await service.getDeployment(deployUuid);
            if (!deployInfo) { continue; }

            const anyInfo = deployInfo as any;
            if (anyInfo.logs && typeof anyInfo.logs === 'string') {
                const currentLogs: string = anyInfo.logs;
                if (currentLogs.length > lastLogLength) {
                    channel.append(currentLogs.substring(lastLogLength));
                    lastLogLength = currentLogs.length;
                }
            }

            const status: string = deployInfo.status ?? '';
            if (status === 'finished' || status === 'failed' || status === 'error') {
                isFinished = true;
                success = status === 'finished';
                const icon = success ? '✅' : '❌';
                channel.appendLine(`\n[${timestamp()}] ${icon} Deployment ${status.toUpperCase()}.`);
                if (success) {
                    vscode.window.showInformationMessage(`✅ Deployment successful: ${appName}`);
                } else {
                    vscode.window.showErrorMessage(`❌ Deployment failed: ${appName} (${status})`);
                }
            }
        } catch (pollErr) {
            channel.appendLine(`[${timestamp()}] (log poll error: ${pollErr instanceof Error ? pollErr.message : String(pollErr)})`);
        }
    }

    return success;
}

// ─── Stage 5: Live App Logs (continuous tail) ─────────────────────────────────

export async function streamAppLogsLive(
    service: CoolifyService,
    appUuid: string,
    appName: string,
    channel: vscode.OutputChannel,
    token: vscode.CancellationToken
): Promise<void> {
    banner(channel, '📡  STAGE 5 — Live App Logs');
    channel.appendLine(`[${timestamp()}] Tailing app logs for ${appName}… (cancel the progress notification to stop)`);

    let lastLength = 0;

    while (!token.isCancellationRequested) {
        try {
            const logs = await service.getApplicationLogs(appUuid);
            if (logs && logs.length > lastLength) {
                channel.append(logs.substring(lastLength));
                lastLength = logs.length;
            }
        } catch (e) {
            channel.appendLine(`[${timestamp()}] (app log fetch error: ${e instanceof Error ? e.message : String(e)})`);
        }
        await new Promise(r => setTimeout(r, 3000));
    }

    channel.appendLine(`\n[${timestamp()}] 🛑 App log tailing stopped.`);
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function runDeploymentFlow(
    configManager: ConfigurationManager,
    appUuid: string,
    appName: string = 'Application'
) {
    try {
        const serverUrl = await configManager.getServerUrl();
        const token = await configManager.getToken();
        if (!serverUrl || !token) { throw new Error('Coolify is not configured. Please sign in.'); }

        const service = new CoolifyService(serverUrl, token);
        const channel = getPipelineChannel();
        channel.clear();
        channel.show(true);

        channel.appendLine(`╔${'═'.repeat(58)}╗`);
        channel.appendLine(`║  Coolify Deploy Pipeline — ${appName.padEnd(28)} ║`);
        channel.appendLine(`║  Started: ${timestamp().padEnd(46)} ║`);
        channel.appendLine(`╚${'═'.repeat(58)}╝`);

        // ── Stage 1: Git Push ─────────────────────────────────────────────────

        let localSha: string | undefined;
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceRoot = workspaceFolders[0].uri.fsPath;

            // ── Pre-flight Checks ─────────────────────────────────────────────

            // 1. Uncommitted changes check
            try {
                const statusOutput = execSync('git status --porcelain', { cwd: workspaceRoot }).toString().trim();
                if (statusOutput.length > 0) {
                    const proceed = await vscode.window.showWarningMessage(
                        `You have uncommitted changes. Only committed files will be pushed to Coolify. Proceed anyway?`,
                        'Proceed', 'Cancel'
                    );
                    if (proceed !== 'Proceed') {
                        channel.appendLine(`[${timestamp()}] 🛑 Deployment cancelled by user (uncommitted changes).`);
                        return;
                    }
                }
            } catch (e) {
                channel.appendLine(`[${timestamp()}] ⚠️ Could not check git status.`);
            }

            // 2. Branch matching check
            try {
                const localBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: workspaceRoot }).toString().trim();
                const appDetails = await service.getApplication(appUuid);
                const remoteBranch = appDetails?.git_branch;

                if (remoteBranch && localBranch !== remoteBranch) {
                    const proceed = await vscode.window.showWarningMessage(
                        `Coolify expects branch '${remoteBranch}', but your local branch is '${localBranch}'. Your push might not trigger the correct deployment. Proceed anyway?`,
                        'Proceed', 'Cancel'
                    );
                    if (proceed !== 'Proceed') {
                        channel.appendLine(`[${timestamp()}] 🛑 Deployment cancelled by user (branch mismatch).`);
                        return;
                    }
                }
            } catch (e) {
                channel.appendLine(`[${timestamp()}] ⚠️ Could not verify git branch match: ${e instanceof Error ? e.message : String(e)}`);
            }

            // Get local HEAD SHA before pushing
            try {
                localSha = execSync('git rev-parse HEAD', { cwd: workspaceRoot }).toString().trim();
            } catch {
                channel.appendLine(`[${timestamp()}] ⚠️  Could not read local git SHA.`);
            }

            const pushOk = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: `[Coolify] ${appName}: Pushing to GitHub…`, cancellable: false },
                () => gitPushLive(workspaceRoot, channel)
            );

            if (!pushOk) {
                vscode.window.showErrorMessage(`❌ Git push failed for ${appName}. Check the Coolify Deploy Pipeline output for details.`);
                channel.show(true); // Ensure output is visible on failure
                return;
            }

            // ── Stage 2: Commit Verification ─────────────────────────────────

            if (localSha) {
                await vscode.window.withProgress(
                    { location: vscode.ProgressLocation.Notification, title: `[Coolify] ${appName}: Verifying commit on Coolify…`, cancellable: false },
                    () => waitForCommitOnCoolify(service, appUuid, localSha!, channel)
                );
            }
        } else {
            banner(channel, '🔀  STAGE 1 — Git Push');
            channel.appendLine(`[${timestamp()}] ⏭  No workspace open — skipping git push.`);
            banner(channel, '✅  STAGE 2 — Commit Verification');
            channel.appendLine(`[${timestamp()}] ⏭  Skipped (no workspace).`);
        }

        // ── Stages 3 + 4 + 5 ─────────────────────────────────────────────────

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `[Coolify] ${appName}: Deploying…`,
                cancellable: true
            },
            async (_progress, cancellationToken) => {
                const deploySuccess = await deployAndStreamLogs(service, appUuid, appName, channel, cancellationToken);

                if (deploySuccess) {
                    await streamAppLogsLive(service, appUuid, appName, channel, cancellationToken);
                }
            }
        );

    } catch (error) {
        vscode.window.showErrorMessage(`Deploy pipeline error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// ─── Command Palette Wrapper ──────────────────────────────────────────────────

export async function startDeploymentCommand(
    configManager: ConfigurationManager,
    webviewProvider?: any
) {
    try {
        const serverUrl = await configManager.getServerUrl();
        const token = await configManager.getToken();
        if (!serverUrl || !token) { throw new Error('Not configured'); }

        const service = new CoolifyService(serverUrl, token);
        const applications = await service.getApplications();

        if (!applications || applications.length === 0) {
            vscode.window.showInformationMessage('No applications found');
            return;
        }

        const selected = await vscode.window.showQuickPick(
            applications.map((app: Application) => ({
                label: app.name,
                description: app.status,
                detail: app.fqdn ? `🌐 ${app.fqdn}` : undefined,
                id: app.id || app.uuid || '',
            })),
            { placeHolder: 'Select an application to deploy', title: 'Coolify: Start Deploy Pipeline' }
        );

        if (selected) {
            await runDeploymentFlow(configManager, selected.id, selected.label);
        }
    } catch (error) {
        vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Failed to start deployment');
    }
}

export async function cancelDeploymentCommand(
    configManager: ConfigurationManager
) {
    try {
        const serverUrl = await configManager.getServerUrl();
        const token = await configManager.getToken();
        if (!serverUrl || !token) { throw new Error('Extension not configured properly'); }

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
            { placeHolder: 'Select a deployment to cancel', title: 'Cancel Deployment' }
        );

        if (selected) {
            vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: `Canceling ${selected.label}…`, cancellable: false },
                async () => {
                    await service.cancelDeployment(selected.id);
                    vscode.window.showInformationMessage('✅ Deployment canceled.');
                }
            );
        }
    } catch (error) {
        vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Failed to cancel deployment');
    }
}

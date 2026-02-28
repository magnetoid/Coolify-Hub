import * as vscode from 'vscode';
import { ConfigurationManager } from '../managers/ConfigurationManager';
import { CoolifyTreeDataProvider } from '../providers/CoolifyTreeDataProvider';
import { CoolifyService } from '../services/CoolifyService';

/**
 * Git push advisor — listens for commits/pushes via the built-in git extension.
 * When a push is detected on a branch that matches a Coolify app's git_branch,
 * it offers to deploy that app immediately.
 */
export function registerGitPushAdvisor(
    context: vscode.ExtensionContext,
    configManager: ConfigurationManager,
    treeDataProvider: CoolifyTreeDataProvider
): void {
    // Access the built-in VS Code git extension
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (!gitExtension) { return; }

    const git = gitExtension.isActive ? gitExtension.exports : null;
    if (!git) { return; }

    const api = git.getAPI(1);
    if (!api?.repositories?.length) { return; }

    for (const repo of api.repositories) {
        // Listen for HEAD changes (covers pushes and merges)
        context.subscriptions.push(
            repo.state.onDidChange(async () => {
                const currentBranch = repo.state.HEAD?.name;
                if (!currentBranch) { return; }

                // Only prompt when configured
                if (!(await configManager.isConfigured())) { return; }

                const apps = treeDataProvider.getCachedApplications();
                const matchedApps = apps.filter(
                    a => a.git_branch === currentBranch && a.status !== 'deploying'
                );

                if (matchedApps.length === 0) { return; }

                // Debounce: don't show more than once per 30s per branch
                const cooldownKey = `coolify.gitAdvisor.${currentBranch}`;
                const lastShown = context.globalState.get<number>(cooldownKey) ?? 0;
                if (Date.now() - lastShown < 30_000) { return; }
                await context.globalState.update(cooldownKey, Date.now());

                if (matchedApps.length === 1) {
                    const app = matchedApps[0];
                    const action = await vscode.window.showInformationMessage(
                        `Coolify: "${app.name}" is configured to deploy from \`${currentBranch}\`. Deploy now?`,
                        'Deploy', 'Dismiss'
                    );
                    if (action === 'Deploy') {
                        vscode.commands.executeCommand('coolify.startDeployment',
                            { kind: 'application', rawData: app }
                        );
                    }
                } else {
                    // Multiple apps on same branch
                    const serverUrl = await configManager.getServerUrl();
                    const token = await configManager.getToken();
                    if (!serverUrl || !token) { return; }

                    const selected = await vscode.window.showQuickPick(
                        matchedApps.map(a => ({
                            label: a.name,
                            description: a.fqdn ?? '',
                            detail: `Branch: ${a.git_branch}`,
                            uuid: a.uuid ?? a.id ?? '',
                        })),
                        {
                            title: `Deploy from ${currentBranch}?`,
                            placeHolder: 'Select an app to deploy (Escape to skip)',
                        }
                    );

                    if (selected) {
                        const service = new CoolifyService(serverUrl, token);
                        await vscode.window.withProgress(
                            { location: vscode.ProgressLocation.Notification, title: `🚀 Deploying ${selected.label}…`, cancellable: false },
                            async () => {
                                await service.startDeployment(selected.uuid);
                                vscode.window.showInformationMessage(`🚀 ${selected.label} deployment started!`);
                            }
                        );
                    }
                }
            })
        );
    }
}

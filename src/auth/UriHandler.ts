import * as vscode from 'vscode';
import { CoolifyAuthProvider } from './CoolifyAuthProvider';
import { ConfigurationManager } from '../managers/ConfigurationManager';
import { CoolifyService } from '../services/CoolifyService';

/**
 * Option 3: VS Code URI Handler
 * 
 * Handles deep links of the form:
 *   vscode://ImbaMarketing.vscode-coolify/auth?token=sk-xxx&url=https%3A%2F%2Fcoolify.example.com
 * 
 * Usage on a Coolify-connected web page (or a custom Coolify plugin):
 *   <a href="vscode://ImbaMarketing.vscode-coolify/auth?token=TOKEN&url=SERVER_URL">
 *     Open in VS Code
 *   </a>
 * 
 * To test manually in browser address bar:
 *   vscode://ImbaMarketing.vscode-coolify/auth?token=your-token&url=https://your-coolify-server.com
 */
export class CoolifyUriHandler implements vscode.UriHandler {
    constructor(
        private readonly authProvider: CoolifyAuthProvider,
        private readonly configManager: ConfigurationManager,
        private readonly onAuthenticated: () => Promise<void>
    ) { }

    async handleUri(uri: vscode.Uri): Promise<void> {
        const params = new URLSearchParams(uri.query);
        const token = params.get('token');
        const serverUrl = params.get('url');
        const path = uri.path;

        if (path === '/auth' || path === '/callback') {
            if (!token || !serverUrl) {
                vscode.window.showErrorMessage(
                    'Coolify: Invalid auth link — missing token or server URL.'
                );
                return;
            }

            const decodedUrl = decodeURIComponent(serverUrl).replace(/\/$/, '');
            const decodedToken = decodeURIComponent(token);

            // Validate before saving (using static import at top of file)
            const svc = new CoolifyService(decodedUrl, decodedToken);

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `🔐 Authenticating with Coolify at ${decodedUrl.replace(/^https?:\/\//, '')}…`,
                    cancellable: false,
                },
                async () => {
                    const valid = await svc.verifyToken();
                    if (!valid) {
                        vscode.window.showErrorMessage(
                            'Coolify: The token from the deep link is invalid or expired.'
                        );
                        return;
                    }

                    // Store via auth provider (persists session + secure storage)
                    await this.authProvider.createSessionFromToken(decodedUrl, decodedToken);
                    await this.onAuthenticated();

                    vscode.window.showInformationMessage(
                        `✅ Authenticated with Coolify at ${decodedUrl.replace(/^https?:\/\//, '')}!`,
                        'Open Sidebar'
                    ).then(action => {
                        if (action === 'Open Sidebar') {
                            vscode.commands.executeCommand('coolify-deployments.focus');
                        }
                    });
                }
            );
        }
    }
}

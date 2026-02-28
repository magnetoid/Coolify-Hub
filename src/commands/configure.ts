import * as vscode from 'vscode';
import { ConfigurationManager } from '../managers/ConfigurationManager';
import { CoolifyService } from '../services/CoolifyService';
import { isValidUrl, normalizeUrl } from '../utils/urlValidator';

export async function configureCommand(
  configManager: ConfigurationManager,
  updateConfigurationState: () => Promise<void>
) {
  try {
    // ── Step 1: Server URL ───────────────────────────────────────────────────
    const serverUrl = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      title: 'Coolify — Step 1 of 2',
      prompt: 'Enter your Coolify server URL',
      placeHolder: 'e.g., https://coolify.my-server.com or http://127.0.0.1:8000',
      validateInput: (value) => {
        if (!value) { return 'Server URL is required'; }
        if (!isValidUrl(value)) { return 'Invalid URL format'; }
        return null;
      },
    });

    if (!serverUrl) { return; }

    const normalizedUrl = normalizeUrl(serverUrl);

    // Test server reachability
    const testService = new CoolifyService(normalizedUrl, '');
    const isReachable = await testService.testConnection();
    if (!isReachable) {
      throw new Error('Could not reach the Coolify server. Check the URL and try again.');
    }

    // ── Option 1: Auto-open browser to the API token creation page ───────────
    const tokenPageUrl = `${normalizedUrl}/security/api-tokens`;
    const openBrowser = await vscode.window.showInformationMessage(
      `✅ Connected to Coolify at ${normalizedUrl.replace(/^https?:\/\//, '')}! Open the API token page in your browser?`,
      { modal: false },
      'Open Token Page', 'I already have a token'
    );

    if (openBrowser === 'Open Token Page') {
      await vscode.env.openExternal(vscode.Uri.parse(tokenPageUrl));
    }

    // ── Step 2: Token input ───────────────────────────────────────────────────
    const token = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      title: 'Coolify — Step 2 of 2',
      prompt: openBrowser === 'Open Token Page'
        ? '🔐 Paste your API token from the browser tab that just opened'
        : 'Enter your Coolify API token',
      password: true,
      placeHolder: 'Paste API token here…',
      validateInput: (value) => value ? null : 'Token is required',
    });

    if (!token) { return; }

    // Verify token
    const service = new CoolifyService(normalizedUrl, token);
    const isValid = await service.verifyToken();
    if (!isValid) {
      throw new Error('Invalid token — please check and try again.');
    }

    // Save
    await configManager.setServerUrl(normalizedUrl);
    await configManager.setToken(token);
    await updateConfigurationState();

    vscode.window.showInformationMessage(
      '🎉 Coolify configured! Your workspace is now connected.',
      'Open Sidebar'
    ).then(action => {
      if (action === 'Open Sidebar') {
        vscode.commands.executeCommand('coolify-deployments.focus');
      }
    });
  } catch (error) {
    vscode.window.showErrorMessage(
      error instanceof Error ? error.message : 'Configuration failed. Please try again.'
    );
  }
}

export async function reconfigureCommand(
  configManager: ConfigurationManager,
  updateConfigurationState: () => Promise<void>
) {
  const result = await vscode.window.showWarningMessage(
    'This will clear your existing Coolify configuration. Continue?',
    'Yes, reconfigure', 'Cancel'
  );

  if (result === 'Yes, reconfigure') {
    await configManager.clearConfiguration();
    await updateConfigurationState();
    await vscode.commands.executeCommand('coolify.configure');
  }
}

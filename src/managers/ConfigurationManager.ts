import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Manages Coolify extension configuration with broad editor compatibility:
 * - Priority chain: workspace settings → globalState (wizard) for server URL
 * - SecretStorage with graceful plaintext fallback for editors that don't support it
 * - setKeysForSync so server URL travels with the user's Settings Sync profile
 */
export class ConfigurationManager {
  private static readonly SERVER_URL_KEY = 'coolify.serverUrl';
  private static readonly TOKEN_KEY = 'coolify.token';
  private static readonly TOKEN_FALLBACK_KEY = 'coolify.token.fallback';
  private static readonly SECRETS_SUPPORTED_KEY = 'coolify.secretsSupported';

  /** Whether SecretStorage is available in this editor. Detected on first use. */
  private secretsAvailable: boolean | undefined;

  constructor(private context: vscode.ExtensionContext) {
    // Enable Settings Sync for the server URL (never sync the token — it's per-machine)
    context.globalState.setKeysForSync([ConfigurationManager.SERVER_URL_KEY]);
  }

  // ─── CLI Config Bridge ───────────────────────────────────────────────────────

  /**
   * Attempts to securely read the coolify-cli config.json to perform "Zero-Config" setup.
   * Returns { url, token } if successful, otherwise undefined.
   */
  private async getCliConfig(): Promise<{ url: string; token: string } | undefined> {
    try {
      // CLI Config path depending on OS
      const isWindows = os.platform() === 'win32';
      const configPath = isWindows
        ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'coolify', 'config.json')
        : path.join(os.homedir(), '.config', 'coolify', 'config.json');

      if (fs.existsSync(configPath)) {
        const fileContent = await fs.promises.readFile(configPath, 'utf-8');
        const json = JSON.parse(fileContent);

        // Return default context (or whatever the active context is styled as)
        // Assume context 'default' based on CLI structure reports
        const contextConfig = json.contexts?.default || json;

        if (contextConfig && contextConfig.token && contextConfig.host) {
          return {
            url: contextConfig.host.replace(/\/$/, ''),
            token: contextConfig.token
          };
        }
      }
    } catch (e) {
      console.warn('[Coolify] Failed to parse coolify-cli config.json:', e);
    }
    return undefined;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async isConfigured(): Promise<boolean> {
    const url = await this.getServerUrl();
    const token = await this.getToken();
    return !!url && !!token;
  }

  /**
   * Gets the Coolify server URL.
   * Priority: workspace settings (team .vscode/settings.json) → globalState (wizard setup)
   */
  async getServerUrl(): Promise<string | undefined> {
    // 0. Auto-detect shared CLI Config
    const cliConfig = await this.getCliConfig();
    if (cliConfig?.url) {
      return cliConfig.url;
    }

    // 1. Workspace / user settings (supports team sharing via .vscode/settings.json)
    const wsUrl = vscode.workspace.getConfiguration('coolify').get<string>('serverUrl');
    if (wsUrl && wsUrl.trim() !== '') {
      return wsUrl.trim();
    }

    // 2. Wizard-configured global state
    return this.context.globalState.get<string>(ConfigurationManager.SERVER_URL_KEY);
  }

  /** Gets the stored API token, from SecretStorage or fallback. */
  async getToken(): Promise<string | undefined> {
    // 0. Auto-detect shared CLI config
    const cliConfig = await this.getCliConfig();
    if (cliConfig?.token) {
      return cliConfig.token;
    }

    if (await this.hasSecretsSupport()) {
      return this.context.secrets.get(ConfigurationManager.TOKEN_KEY);
    }
    return this.context.globalState.get<string>(ConfigurationManager.TOKEN_FALLBACK_KEY);
  }

  /**
   * Saves the server URL to globalState so the wizard-configured value
   * is persisted independently of the workspace settings file.
   */
  async setServerUrl(url: string): Promise<void> {
    await this.context.globalState.update(ConfigurationManager.SERVER_URL_KEY, url);
  }

  /**
   * Saves the API token. Uses SecretStorage when available,
   * falls back to globalState with a warning for editors without SecretStorage
   * (e.g., some builds of VSCodium or older Trae versions).
   */
  async setToken(token: string): Promise<void> {
    if (await this.hasSecretsSupport()) {
      await this.context.secrets.store(ConfigurationManager.TOKEN_KEY, token);
    } else {
      await this.context.globalState.update(ConfigurationManager.TOKEN_FALLBACK_KEY, token);
      vscode.window.showWarningMessage(
        'Coolify: Your editor does not support secure secret storage. ' +
        'Your API token has been stored without encryption. ' +
        'Consider upgrading your editor or using a `.env` file.'
      );
    }
  }

  /** Clears all stored configuration. Called on reconfigure. */
  async clearConfiguration(): Promise<void> {
    await this.context.globalState.update(ConfigurationManager.SERVER_URL_KEY, undefined);

    if (await this.hasSecretsSupport()) {
      await this.context.secrets.delete(ConfigurationManager.TOKEN_KEY);
    } else {
      await this.context.globalState.update(ConfigurationManager.TOKEN_FALLBACK_KEY, undefined);
    }
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  /**
   * Detects if context.secrets is supported in this editor.
   * VSCodium and some forks may throw on first use — we detect this once and cache.
   */
  private async hasSecretsSupport(): Promise<boolean> {
    if (this.secretsAvailable !== undefined) {
      return this.secretsAvailable;
    }

    try {
      // Try a no-op get; if it throws, secrets aren't supported
      await this.context.secrets.get('__coolify_probe__');
      this.secretsAvailable = true;
    } catch {
      this.secretsAvailable = false;
      console.warn('[Coolify] SecretStorage not available in this editor — using plaintext fallback.');
    }

    return this.secretsAvailable;
  }
}

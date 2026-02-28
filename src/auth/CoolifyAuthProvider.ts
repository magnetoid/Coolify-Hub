import * as vscode from 'vscode';
import { ConfigurationManager } from '../managers/ConfigurationManager';
import { CoolifyService } from '../services/CoolifyService';

/**
 * Option 2: VS Code native Authentication Provider.
 *
 * Registers "Coolify" in the VS Code Accounts menu (⚙ bottom-left → Accounts).
 * Works identically to how GitHub / Microsoft sessions are managed.
 *
 * Auth flow:
 *   createSession() → URL input (if missing) → open browser to /security/api-tokens → paste token → stored
 *
 * URI callback (Option 3) also writes sessions through createSessionFromToken().
 */

const PROVIDER_ID = 'coolify';
const PROVIDER_LABEL = 'Coolify';
const SESSION_STORAGE_KEY = 'coolify.auth.sessions';

interface StoredSession {
    id: string;
    accessToken: string;
    account: { id: string; label: string };
    scopes: string[];
    serverUrl: string;
}

export class CoolifyAuthProvider implements vscode.AuthenticationProvider, vscode.Disposable {
    private _sessions: vscode.AuthenticationSession[] = [];
    private readonly _storedSessions = new Map<string, StoredSession>();

    private readonly _onDidChangeSessions =
        new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
    readonly onDidChangeSessions = this._onDidChangeSessions.event;

    private _reg: vscode.Disposable;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly configManager: ConfigurationManager
    ) {
        this._reg = vscode.authentication.registerAuthenticationProvider(
            PROVIDER_ID,
            PROVIDER_LABEL,
            this,
            { supportsMultipleAccounts: false }
        );
    }

    // ─── AuthenticationProvider interface ─────────────────────────────────────

    async getSessions(scopes?: string[]): Promise<vscode.AuthenticationSession[]> {
        await this._load();
        if (!scopes || scopes.length === 0) { return this._sessions; }
        return this._sessions.filter(s => scopes.every(sc => s.scopes.includes(sc)));
    }

    async createSession(scopes: readonly string[]): Promise<vscode.AuthenticationSession> {
        // Get or ask for server URL
        let serverUrl = await this.configManager.getServerUrl();
        if (!serverUrl) {
            const input = await vscode.window.showInputBox({
                ignoreFocusOut: true,
                title: 'Connect to Coolify',
                prompt: 'Enter your Coolify server URL',
                placeHolder: 'https://coolify.my-server.com',
                validateInput: v => v ? null : 'URL is required',
            });
            if (!input) { throw new Error('Cancelled'); }
            serverUrl = input.replace(/\/$/, '');
            await this.configManager.setServerUrl(serverUrl);
        }

        // Option 1 behavior — open browser to token page
        await vscode.env.openExternal(vscode.Uri.parse(`${serverUrl}/security/api-tokens`));

        const token = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            title: 'Coolify — Paste API Token',
            prompt: '🔐 Paste your API token from the browser tab that just opened',
            password: true,
            placeHolder: 'Paste token here…',
            validateInput: v => v ? null : 'Token is required',
        });
        if (!token) { throw new Error('Cancelled'); }

        const svc = new CoolifyService(serverUrl, token);
        if (!(await svc.verifyToken())) {
            throw new Error('Invalid token — please check and try again.');
        }

        await this.configManager.setToken(token);
        return this._storeSession(serverUrl, token, [...scopes]);
    }

    async removeSession(sessionId: string): Promise<void> {
        const removed = this._sessions.find(s => s.id === sessionId);
        this._sessions = this._sessions.filter(s => s.id !== sessionId);
        this._storedSessions.delete(sessionId);
        await this._save();
        await this.configManager.clearConfiguration();
        if (removed) {
            this._onDidChangeSessions.fire({ added: [], removed: [removed], changed: [] });
        }
    }

    // ─── Called by URI deep-link handler (Option 3) ────────────────────────────

    async createSessionFromToken(serverUrl: string, token: string): Promise<void> {
        await this.configManager.setServerUrl(serverUrl);
        await this.configManager.setToken(token);
        this._storeSession(serverUrl, token, ['coolify']);
    }

    // ─── Internals ─────────────────────────────────────────────────────────────

    private _storeSession(serverUrl: string, token: string, scopes: readonly string[]): vscode.AuthenticationSession {
        const id = `coolify-${Date.now()}`;
        const mutableScopes = Array.from(scopes);
        const session: vscode.AuthenticationSession = {
            id,
            accessToken: token,
            account: { id: serverUrl, label: serverUrl.replace(/^https?:\/\//, '') },
            scopes: mutableScopes,
        };
        this._sessions = [session];
        this._storedSessions.set(id, { ...session, scopes: mutableScopes, serverUrl });
        this._save();
        this._onDidChangeSessions.fire({ added: [session], removed: [], changed: [] });
        return session;
    }

    private async _load(): Promise<void> {
        const raw = this.context.globalState.get<StoredSession[]>(SESSION_STORAGE_KEY, []);
        this._sessions = raw.map(s => ({ id: s.id, accessToken: s.accessToken, account: s.account, scopes: s.scopes }));
        raw.forEach(s => this._storedSessions.set(s.id, s));
    }

    private async _save(): Promise<void> {
        await this.context.globalState.update(SESSION_STORAGE_KEY, [...this._storedSessions.values()]);
    }

    dispose(): void {
        this._reg.dispose();
        this._onDidChangeSessions.dispose();
    }
}

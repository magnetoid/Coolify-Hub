import * as vscode from 'vscode';
import { ConfigurationManager } from '../managers/ConfigurationManager';
import { CoolifyService } from '../services/CoolifyService';
import { getWebViewHtml, getWelcomeHtml } from '../utils/templateHelper';
import { withRetry } from '../utils/retry';
import { Application, Deployment, WebViewMessage, WebViewOutgoingMessage } from '../types';

const REFRESH_INTERVAL = 5000;

export class CoolifyWebViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private refreshInterval?: NodeJS.Timeout;
  private messageHandler?: vscode.Disposable;
  private retryCount = 0;
  private isDisposed = false;
  private deployingApplications = new Set<string>();
  private pendingRefresh?: NodeJS.Timeout;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private configManager: ConfigurationManager
  ) {
    this.initializeConfigurationListener();
  }

  // Initialization Methods
  private initializeConfigurationListener(): void {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('coolify')) {
          await this.handleConfigurationChange();
        }
      })
    );
  }

  private async handleConfigurationChange(): Promise<void> {
    const isConfigured = await this.configManager.isConfigured();
    if (!isConfigured) {
      this.stopRefreshInterval();
    }
    await this.updateView();
  }

  private isViewValid(): boolean {
    return !!this._view && !this.isDisposed;
  }

  public async updateView(): Promise<void> {
    if (this.pendingRefresh) clearTimeout(this.pendingRefresh);

    this.pendingRefresh = setTimeout(async () => {
      if (!this.isViewValid()) return;

      try {
        this._view!.webview.html = '';
        await this.resolveWebviewView(
          this._view!,
          { state: undefined },
          new vscode.CancellationTokenSource().token
        );
      } catch (error) {
        this.handleError('Failed to update view', error);
      }
    }, 100);
  }

  private stopRefreshInterval(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
    }
  }

  private startRefreshInterval(): void {
    this.stopRefreshInterval();
    this.retryCount = 0;

    this.refreshInterval = setInterval(async () => {
      try {
        await this.refreshData();
        this.retryCount = 0;
      } catch (error) {
        this.retryCount++;
        console.error('Refresh failed:', error);

        if (this.retryCount >= 3) {
          this.stopRefreshInterval();
          if (this.isViewValid()) {
            vscode.window.showErrorMessage(
              'Auto-refresh stopped due to repeated errors. Click refresh to try again.'
            );
          }
        }
      }
    }, REFRESH_INTERVAL);
  }

  public async refreshData(): Promise<void> {
    if (!this.isViewValid()) return;

    try {
      await withRetry(async () => {
        const serverUrl = await this.configManager.getServerUrl();
        const token = await this.configManager.getToken();

        if (!serverUrl || !token) {
          await this.handleUnconfiguredState();
          return;
        }

        const service = new CoolifyService(serverUrl, token);
        const [applications, deployments] = await Promise.all([
          service.getApplications(),
          service.getDeployments(),
        ]);

        await this.updateWebViewState(applications, deployments);
      });
    } catch (error) {
      await this.handleRefreshError(error);
    }
  }

  private async handleUnconfiguredState(): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'coolify.isConfigured', false);
  }

  private async updateWebViewState(applications: any[], deployments: any[]): Promise<void> {
    if (!this.isViewValid()) return;

    const uiApplications = this.mapApplicationsToUI(applications);
    const uiDeployments = this.mapDeploymentsToUI(deployments);

    this._view!.webview.postMessage({
      type: 'refresh-data',
      applications: uiApplications,
      deployments: uiDeployments,
    } as WebViewOutgoingMessage);
  }

  private mapApplicationsToUI(applications: any[]): Application[] {
    return applications.map((app) => ({
      id: app.uuid,
      name: app.name,
      status: app.status,
      fqdn: app.fqdn,
      git_repository: app.git_repository,
      git_branch: app.git_branch,
      updated_at: app.updated_at,
    } as Application));
  }

  private mapDeploymentsToUI(deployments: any[]): Deployment[] {
    return deployments.map((d) => ({
      id: d.id,
      applicationId: d.application_id,
      applicationName: d.application_name,
      status: d.status,
      commit: d.commit_message || `Deploying ${d.commit?.slice(0, 7) || 'latest'} commit`,
      startedAt: new Date(d.created_at).toLocaleString(),
    } as Deployment));
  }

  public async deployApplication(applicationId: string): Promise<void> {
    if (this.deployingApplications.has(applicationId)) {
      vscode.window.showInformationMessage('Deployment already in progress');
      return;
    }

    this.deployingApplications.add(applicationId);

    try {
      await withRetry(async () => {
        const serverUrl = await this.configManager.getServerUrl();
        const token = await this.configManager.getToken();

        if (!serverUrl || !token) {
          throw new Error('Extension not configured properly');
        }

        const service = new CoolifyService(serverUrl, token);
        await service.startDeployment(applicationId);
      });

      await this.refreshData();

      if (this.isViewValid()) {
        vscode.window.showInformationMessage('Deployment started successfully');
      }
    } catch (error) {
      this.handleError('Failed to start deployment', error);
    } finally {
      this.deployingApplications.delete(applicationId);
    }
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this.cleanupExistingView();
    this.isDisposed = false;
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
      enableCommandUris: false,
    };

    try {
      this.setupMessageHandler(webviewView);
      this.setupVisibilityHandler(webviewView);
      this.setupDisposalHandler(webviewView);

      const isConfigured = await this.configManager.isConfigured();
      if (!isConfigured) {
        this.stopRefreshInterval();
        webviewView.webview.html = await getWelcomeHtml(this._extensionUri, webviewView.webview);
        return;
      }

      webviewView.webview.html = await getWebViewHtml(this._extensionUri);
      if (webviewView.visible) {
        this.startRefreshInterval();
      }
      await this.refreshData();
    } catch (error) {
      this.handleError('Error initializing webview', error);
    }
  }

  private cleanupExistingView(): void {
    if (this.messageHandler) {
      this.messageHandler.dispose();
      this.messageHandler = undefined;
    }
  }

  private setupMessageHandler(webviewView: vscode.WebviewView): void {
    this.messageHandler = webviewView.webview.onDidReceiveMessage(
      async (data: WebViewMessage) => {
        if (!this.isViewValid()) return;

        try {
          switch (data.type) {
            case 'refresh':
              await this.refreshData();
              break;
            case 'deploy':
              if (data.applicationId) {
                await this.deployApplication(data.applicationId);
              }
              break;
            case 'configure':
              await vscode.commands.executeCommand('coolify.login');
              break;
            case 'reconfigure':
              await vscode.commands.executeCommand('coolify.logout');
              break;
          }
        } catch (error) {
          console.error('Error handling webview message:', error);
        }
      }
    );
  }

  private setupVisibilityHandler(webviewView: vscode.WebviewView): void {
    this.disposables.push(
      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) {
          this.refreshData().catch(console.error);
          this.startRefreshInterval();
        } else {
          this.stopRefreshInterval();
        }
      })
    );
  }

  private setupDisposalHandler(webviewView: vscode.WebviewView): void {
    this.disposables.push(
      webviewView.onDidDispose(() => {
        this.dispose();
      })
    );
  }

  private handleError(message: string, error: unknown): void {
    console.error(`${message}:`, error);
    if (!this.isViewValid()) return;

    if (error instanceof Error && error.message.includes('401')) {
      this.handleAuthenticationError();
    } else {
      vscode.window.showErrorMessage(`${message}. Please try again.`);
    }
  }

  private async handleAuthenticationError(): Promise<void> {
    await this.configManager.clearConfiguration();
    await vscode.commands.executeCommand('setContext', 'coolify.isConfigured', false);
    if (this.isViewValid()) {
      vscode.window.showErrorMessage('Authentication failed. Please reconfigure the extension.');
    }
  }

  private async handleRefreshError(error: unknown): Promise<void> {
    if (error instanceof Error && error.message.includes('401')) {
      await this.handleAuthenticationError();
    } else if (this.isViewValid()) {
      vscode.window.showErrorMessage('Failed to refresh data. Please try again.');
    }
    throw error;
  }

  public async getApplications() {
    try {
      const serverUrl = await this.configManager.getServerUrl();
      const token = await this.configManager.getToken();

      if (!serverUrl || !token) {
        throw new Error('Extension not configured properly');
      }

      const service = new CoolifyService(serverUrl, token);
      const applications = await service.getApplications();

      return applications.map((app: any) => ({
        id: app.uuid,
        name: app.name,
        status: app.status,
        label: `${app.name} (${app.git_repository}:${app.git_branch})`,
      }));
    } catch (error) {
      console.error('Failed to get applications:', error);
      throw error;
    }
  }

  public dispose(): void {
    this.isDisposed = true;
    this.stopRefreshInterval();

    if (this.pendingRefresh) {
      clearTimeout(this.pendingRefresh);
      this.pendingRefresh = undefined;
    }

    if (this.messageHandler) {
      this.messageHandler.dispose();
      this.messageHandler = undefined;
    }

    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];

    this._view = undefined;
    this.deployingApplications.clear();
  }
}

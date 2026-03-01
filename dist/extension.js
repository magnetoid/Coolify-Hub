"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode14 = __toESM(require("vscode"));

// src/managers/ConfigurationManager.ts
var vscode = __toESM(require("vscode"));
var ConfigurationManager = class _ConfigurationManager {
  constructor(context) {
    this.context = context;
    context.globalState.setKeysForSync([_ConfigurationManager.SERVER_URL_KEY]);
  }
  static SERVER_URL_KEY = "coolify.serverUrl";
  static TOKEN_KEY = "coolify.token";
  static TOKEN_FALLBACK_KEY = "coolify.token.fallback";
  static SECRETS_SUPPORTED_KEY = "coolify.secretsSupported";
  /** Whether SecretStorage is available in this editor. Detected on first use. */
  secretsAvailable;
  // ─── Public API ────────────────────────────────────────────────────────────
  async isConfigured() {
    const url = await this.getServerUrl();
    const token = await this.getToken();
    return !!url && !!token;
  }
  /**
   * Gets the Coolify server URL.
   * Priority: workspace settings (team .vscode/settings.json) → globalState (wizard setup)
   */
  async getServerUrl() {
    const wsUrl = vscode.workspace.getConfiguration("coolify").get("serverUrl");
    if (wsUrl && wsUrl.trim() !== "") {
      return wsUrl.trim();
    }
    return this.context.globalState.get(_ConfigurationManager.SERVER_URL_KEY);
  }
  /** Gets the stored API token, from SecretStorage or fallback. */
  async getToken() {
    if (await this.hasSecretsSupport()) {
      return this.context.secrets.get(_ConfigurationManager.TOKEN_KEY);
    }
    return this.context.globalState.get(_ConfigurationManager.TOKEN_FALLBACK_KEY);
  }
  /**
   * Saves the server URL to globalState so the wizard-configured value
   * is persisted independently of the workspace settings file.
   */
  async setServerUrl(url) {
    await this.context.globalState.update(_ConfigurationManager.SERVER_URL_KEY, url);
  }
  /**
   * Saves the API token. Uses SecretStorage when available,
   * falls back to globalState with a warning for editors without SecretStorage
   * (e.g., some builds of VSCodium or older Trae versions).
   */
  async setToken(token) {
    if (await this.hasSecretsSupport()) {
      await this.context.secrets.store(_ConfigurationManager.TOKEN_KEY, token);
    } else {
      await this.context.globalState.update(_ConfigurationManager.TOKEN_FALLBACK_KEY, token);
      vscode.window.showWarningMessage(
        "Coolify: Your editor does not support secure secret storage. Your API token has been stored without encryption. Consider upgrading your editor or using a `.env` file."
      );
    }
  }
  /** Clears all stored configuration. Called on reconfigure. */
  async clearConfiguration() {
    await this.context.globalState.update(_ConfigurationManager.SERVER_URL_KEY, void 0);
    if (await this.hasSecretsSupport()) {
      await this.context.secrets.delete(_ConfigurationManager.TOKEN_KEY);
    } else {
      await this.context.globalState.update(_ConfigurationManager.TOKEN_FALLBACK_KEY, void 0);
    }
  }
  // ─── Internal ──────────────────────────────────────────────────────────────
  /**
   * Detects if context.secrets is supported in this editor.
   * VSCodium and some forks may throw on first use — we detect this once and cache.
   */
  async hasSecretsSupport() {
    if (this.secretsAvailable !== void 0) {
      return this.secretsAvailable;
    }
    try {
      await this.context.secrets.get("__coolify_probe__");
      this.secretsAvailable = true;
    } catch {
      this.secretsAvailable = false;
      console.warn("[Coolify] SecretStorage not available in this editor \u2014 using plaintext fallback.");
    }
    return this.secretsAvailable;
  }
};

// src/managers/StatusBarManager.ts
var vscode2 = __toESM(require("vscode"));
var cp = __toESM(require("child_process"));
var util = __toESM(require("util"));

// src/services/CoolifyService.ts
var CoolifyService = class {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }
  // ─── Core Request Helper ─────────────────────────────────────────────────────
  async fetchWithAuth(endpoint, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15e3);
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          ...options?.headers || {}
        },
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`API request failed (${response.status}): ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }
  async fetchVoid(endpoint, method = "GET") {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15e3);
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: { Authorization: `Bearer ${this.token}` },
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status}): ${response.statusText}`);
      }
      return true;
    } finally {
      clearTimeout(timeout);
    }
  }
  // ─── Applications ─────────────────────────────────────────────────────────────
  async getApplications() {
    return this.fetchWithAuth("/api/v1/applications");
  }
  async getApplicationsByEnvironment(projectUuid, environmentName) {
    const envData = await this.fetchWithAuth(
      `/api/v1/projects/${projectUuid}/environment/${environmentName}`
    );
    return envData.applications ?? [];
  }
  async getApplicationLogs(uuid) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15e3);
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/applications/${uuid}/logs`, {
        headers: { Authorization: `Bearer ${this.token}` },
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }
      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }
  async getApplication(uuid) {
    return this.fetchWithAuth(`/api/v1/applications/${uuid}`);
  }
  async startApplication(uuid) {
    return this.fetchVoid(`/api/v1/applications/${uuid}/start`);
  }
  async stopApplication(uuid) {
    return this.fetchVoid(`/api/v1/applications/${uuid}/stop`);
  }
  async restartApplication(uuid) {
    return this.fetchVoid(`/api/v1/applications/${uuid}/restart`);
  }
  // ─── Deployments ──────────────────────────────────────────────────────────────
  async getDeployments() {
    return this.fetchWithAuth("/api/v1/deployments");
  }
  async getApplicationDeployments(appUuid) {
    return this.fetchWithAuth(`/api/v1/applications/${appUuid}/deployments`);
  }
  async startDeployment(uuid) {
    const data = await this.fetchWithAuth(`/api/v1/deploy?uuid=${uuid}`);
    return data.deploy_uuid;
  }
  async getDeployment(deployUuid) {
    return this.fetchWithAuth(`/api/v1/deployments/${deployUuid}`);
  }
  async cancelDeployment(uuid) {
    return this.fetchVoid(`/api/v1/deployments/${uuid}/cancel`, "POST");
  }
  // ─── Projects ─────────────────────────────────────────────────────────────────
  async getProjects() {
    return this.fetchWithAuth("/api/v1/projects");
  }
  async getProjectEnvironments(projectUuid) {
    const project = await this.fetchWithAuth(
      `/api/v1/projects/${projectUuid}`
    );
    return project.environments ?? [];
  }
  // ─── Servers ──────────────────────────────────────────────────────────────────
  async getServers() {
    return this.fetchWithAuth("/api/v1/servers");
  }
  // ─── Databases ────────────────────────────────────────────────────────────────
  async getDatabases() {
    return this.fetchWithAuth("/api/v1/databases");
  }
  async startDatabase(uuid) {
    return this.fetchVoid(`/api/v1/databases/${uuid}/start`);
  }
  async stopDatabase(uuid) {
    return this.fetchVoid(`/api/v1/databases/${uuid}/stop`);
  }
  async createDatabaseBackup(uuid) {
    return this.fetchVoid(`/api/v1/databases/${uuid}/backup`, "POST");
  }
  // ─── Auth & Health ────────────────────────────────────────────────────────────
  async verifyToken() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5e3);
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/version`, {
        headers: { Authorization: `Bearer ${this.token}` },
        signal: controller.signal
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
  async testConnection() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5e3);
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        signal: controller.signal
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
  async getVersion() {
    const data = await this.fetchWithAuth("/api/v1/version");
    if (typeof data === "string") {
      return data;
    }
    return data.version ?? "unknown";
  }
};

// src/managers/StatusBarManager.ts
var exec2 = util.promisify(cp.exec);
function normalizeGitUrl(url) {
  if (!url) {
    return null;
  }
  let cleanUrl = url.trim().replace(/\.git$/, "");
  const match = cleanUrl.match(/[:/]([^/]+\/[^/]+)$/);
  if (match && match[1]) {
    return match[1].toLowerCase();
  }
  return cleanUrl.toLowerCase();
}
var StatusBarManager = class {
  constructor(configManager) {
    this.configManager = configManager;
  }
  items = /* @__PURE__ */ new Map();
  pollInterval;
  isDisposed = false;
  isRefreshing = false;
  cachedRemotes = null;
  matchedApps = [];
  getMatchedApps() {
    return this.matchedApps;
  }
  async getWorkspaceGitRemotes() {
    if (this.cachedRemotes) {
      return this.cachedRemotes;
    }
    const remotes = /* @__PURE__ */ new Set();
    const folders = vscode2.workspace.workspaceFolders;
    if (!folders) {
      return remotes;
    }
    for (const folder of folders) {
      try {
        const { stdout } = await exec2("git config --get remote.origin.url", { cwd: folder.uri.fsPath });
        const norm = normalizeGitUrl(stdout);
        if (norm) {
          remotes.add(norm);
        }
      } catch (e) {
      }
    }
    this.cachedRemotes = remotes;
    return remotes;
  }
  async initialize() {
    await this.refreshStatusBar();
    this.startPolling();
  }
  startPolling() {
    if (this.pollInterval) {
      return;
    }
    const intervalMs = vscode2.workspace.getConfiguration("coolify").get("refreshInterval", 5e3);
    this.pollInterval = setInterval(async () => {
      if (!this.isDisposed) {
        await this.refreshStatusBar();
      }
    }, intervalMs);
  }
  async refreshStatusBar() {
    if (this.isDisposed || this.isRefreshing) {
      return;
    }
    this.isRefreshing = true;
    try {
      const isConfigured = await this.configManager.isConfigured();
      if (!isConfigured) {
        this.clearItems();
        return;
      }
      const serverUrl = await this.configManager.getServerUrl();
      const token = await this.configManager.getToken();
      if (!serverUrl || !token) {
        return;
      }
      const service = new CoolifyService(serverUrl, token);
      const applications = await service.getApplications();
      const pinnedAppId = vscode2.workspace.getConfiguration("coolify").get("defaultApplication");
      let appsToShow = [];
      if (pinnedAppId) {
        appsToShow = applications.filter((a) => a.id === pinnedAppId || a.uuid === pinnedAppId);
      } else {
        const remotes = await this.getWorkspaceGitRemotes();
        if (remotes.size > 0) {
          appsToShow = applications.filter((a) => {
            const appRepo = normalizeGitUrl(a.git_repository);
            return appRepo && remotes.has(appRepo);
          });
        }
      }
      this.matchedApps = appsToShow;
      const validApps = appsToShow.filter((a) => a.status && a.status.toLowerCase() !== "unknown");
      const seenIds = /* @__PURE__ */ new Set();
      for (const app of validApps) {
        const appId = app.uuid || app.id;
        if (!appId) {
          continue;
        }
        seenIds.add(appId);
        let item = this.items.get(appId);
        if (!item) {
          item = vscode2.window.createStatusBarItem(vscode2.StatusBarAlignment.Left, 100);
          this.items.set(appId, item);
        }
        item.name = `Coolify \u2014 ${app.name}`;
        const statusIcon = this.getStatusIcon(app.status);
        item.text = `${statusIcon} ${app.name}: ${this.formatStatus(app.status)}`;
        item.tooltip = new vscode2.MarkdownString(
          `**Coolify App: ${app.name}**

Status: \`${app.status}\`

Click to view logs`
        );
        item.command = {
          title: "View Logs",
          command: "coolify.viewApplicationLogs",
          arguments: [{ id: appId, name: app.name }]
        };
        this.applyStatusBackground(item, app.status);
        item.show();
      }
      for (const [id, item] of this.items.entries()) {
        if (!seenIds.has(id)) {
          item.dispose();
          this.items.delete(id);
        }
      }
    } catch (error) {
      console.error("StatusBarManager: Failed to refresh:", error);
    } finally {
      this.isRefreshing = false;
    }
  }
  getStatusIcon(status) {
    const s = status?.toLowerCase() || "";
    if (s.includes("running")) {
      return "$(vm-running)";
    }
    if (s.includes("stopped") || s.includes("exited")) {
      return "$(vm-outline)";
    }
    if (s.includes("deploying") || s.includes("starting")) {
      return "$(loading~spin)";
    }
    if (s.includes("error") || s.includes("failed")) {
      return "$(error)";
    }
    return "$(circle-outline)";
  }
  formatStatus(status) {
    const s = status?.toLowerCase() || "";
    if (!s || s === "unknown") {
      return "Unknown";
    }
    if (s.includes("running")) {
      return "Running";
    }
    if (s.includes("stopped") || s.includes("exited")) {
      return "Stopped";
    }
    if (s.includes("deploying") || s.includes("starting")) {
      return "Deploying";
    }
    if (s.includes("error") || s.includes("failed")) {
      return "Error";
    }
    return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
  }
  applyStatusBackground(item, status) {
    const s = status?.toLowerCase() || "";
    if (s.includes("error") || s.includes("failed")) {
      item.backgroundColor = new vscode2.ThemeColor("statusBarItem.errorBackground");
    } else if (s.includes("deploying") || s.includes("starting")) {
      item.backgroundColor = new vscode2.ThemeColor("statusBarItem.warningBackground");
    } else {
      item.backgroundColor = void 0;
    }
  }
  clearItems() {
    for (const item of this.items.values()) {
      item.dispose();
    }
    this.items.clear();
  }
  dispose() {
    this.isDisposed = true;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    this.clearItems();
  }
};

// src/providers/CoolifyTreeDataProvider.ts
var vscode3 = __toESM(require("vscode"));
var CoolifyTreeItem = class extends vscode3.TreeItem {
  constructor(label, collapsibleState, kind, rawData, parentId) {
    super(label, collapsibleState);
    this.kind = kind;
    this.rawData = rawData;
    this.parentId = parentId;
    this.applyKindConfig();
  }
  applyKindConfig() {
    switch (this.kind) {
      case "project":
        this.iconPath = new vscode3.ThemeIcon("folder");
        this.contextValue = "coolifyProject";
        break;
      case "environment":
        this.iconPath = new vscode3.ThemeIcon("layers");
        this.contextValue = "coolifyEnvironment";
        break;
      case "application": {
        const app = this.rawData;
        this.iconPath = this.getAppIcon(app?.status);
        this.contextValue = `coolifyApp_${app?.status?.toLowerCase() ?? "unknown"}`;
        if (app?.fqdn) {
          this.description = app.fqdn.replace(/^https?:\/\//, "");
        }
        this.tooltip = this.buildAppTooltip(app);
        break;
      }
      case "server": {
        const srv = this.rawData;
        const reachable = srv?.settings?.is_reachable;
        this.iconPath = new vscode3.ThemeIcon(reachable ? "server-process" : "server-environment");
        this.contextValue = "coolifyServer";
        this.description = srv?.ip;
        break;
      }
      case "database": {
        const db = this.rawData;
        this.iconPath = new vscode3.ThemeIcon("database");
        this.contextValue = `coolifyDatabase_${db?.status?.toLowerCase() ?? "unknown"}`;
        this.description = db?.type;
        break;
      }
      case "category":
        this.iconPath = new vscode3.ThemeIcon("list-unordered");
        this.contextValue = "coolifyCategory";
        break;
      case "loading":
        this.iconPath = new vscode3.ThemeIcon("loading~spin");
        this.contextValue = "coolifyLoading";
        break;
      case "empty":
        this.iconPath = new vscode3.ThemeIcon("info");
        this.contextValue = "coolifyEmpty";
        break;
    }
  }
  getAppIcon(status) {
    switch (status?.toLowerCase()) {
      case "running":
        return new vscode3.ThemeIcon("vm-running", new vscode3.ThemeColor("charts.green"));
      case "stopped":
      case "exited":
        return new vscode3.ThemeIcon("vm-outline", new vscode3.ThemeColor("charts.gray"));
      case "deploying":
      case "starting":
        return new vscode3.ThemeIcon("sync~spin", new vscode3.ThemeColor("charts.yellow"));
      case "error":
      case "failed":
        return new vscode3.ThemeIcon("error", new vscode3.ThemeColor("charts.red"));
      default:
        return new vscode3.ThemeIcon("circle-outline");
    }
  }
  buildAppTooltip(app) {
    if (!app) {
      return new vscode3.MarkdownString("No application data");
    }
    const lines = [
      `**${app.name}**`,
      ``,
      `Status: \`${app.status ?? "unknown"}\``
    ];
    if (app.git_repository) {
      lines.push(`Repo: \`${app.git_repository}\``);
    }
    if (app.git_branch) {
      lines.push(`Branch: \`${app.git_branch}\``);
    }
    if (app.fqdn) {
      lines.push(`URL: [${app.fqdn}](${app.fqdn})`);
    }
    return new vscode3.MarkdownString(lines.join("\n"));
  }
};
var CoolifyTreeDataProvider = class {
  constructor(configManager) {
    this.configManager = configManager;
  }
  _onDidChangeTreeData = new vscode3.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  refreshInterval;
  isDisposed = false;
  service;
  // Cached data
  cachedProjects = [];
  cachedApplications = [];
  cachedServers = [];
  cachedDatabases = [];
  isConfigured = false;
  async initialize() {
    await this.loadData();
    this.startAutoRefresh();
  }
  startAutoRefresh() {
    const intervalMs = vscode3.workspace.getConfiguration("coolify").get("refreshInterval", 5e3);
    this.refreshInterval = setInterval(() => {
      if (!this.isDisposed) {
        this.loadData().catch(console.error);
      }
    }, intervalMs);
  }
  async getService() {
    const serverUrl = await this.configManager.getServerUrl();
    const token = await this.configManager.getToken();
    if (!serverUrl || !token) {
      return null;
    }
    this.service = new CoolifyService(serverUrl, token);
    return this.service;
  }
  async loadData() {
    this.isConfigured = await this.configManager.isConfigured();
    if (!this.isConfigured) {
      this.refresh();
      return;
    }
    try {
      const svc = await this.getService();
      if (!svc) {
        return;
      }
      const [projects, applications, servers, databases] = await Promise.allSettled([
        svc.getProjects(),
        svc.getApplications(),
        svc.getServers(),
        svc.getDatabases()
      ]);
      this.cachedProjects = projects.status === "fulfilled" ? projects.value : [];
      this.cachedApplications = applications.status === "fulfilled" ? applications.value : [];
      this.cachedServers = servers.status === "fulfilled" ? servers.value : [];
      this.cachedDatabases = databases.status === "fulfilled" ? databases.value : [];
      this.refresh();
    } catch (error) {
      console.error("CoolifyTreeDataProvider: Failed to load data:", error);
    }
  }
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  // ─── vscode.TreeDataProvider implementation ────────────────────────────────
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (!this.isConfigured) {
      const loginItem = new CoolifyTreeItem(
        "Not signed in \u2014 click to connect",
        vscode3.TreeItemCollapsibleState.None,
        "empty"
      );
      loginItem.command = {
        command: "coolify.login",
        title: "Sign In"
      };
      return [loginItem];
    }
    if (!element) {
      return [
        new CoolifyTreeItem("Projects", vscode3.TreeItemCollapsibleState.Expanded, "category"),
        new CoolifyTreeItem("Applications", vscode3.TreeItemCollapsibleState.Collapsed, "category"),
        new CoolifyTreeItem("Servers", vscode3.TreeItemCollapsibleState.Collapsed, "category"),
        new CoolifyTreeItem("Databases", vscode3.TreeItemCollapsibleState.Collapsed, "category")
      ];
    }
    if (element.kind === "category") {
      return this.getCategoryChildren(element.label);
    }
    if (element.kind === "project") {
      const project = element.rawData;
      if (!project.environments || project.environments.length === 0) {
        return [new CoolifyTreeItem("No environments", vscode3.TreeItemCollapsibleState.None, "empty")];
      }
      return project.environments.map(
        (env4) => new CoolifyTreeItem(
          env4.name,
          vscode3.TreeItemCollapsibleState.Collapsed,
          "environment",
          env4,
          String(project.uuid)
        )
      );
    }
    if (element.kind === "environment") {
      const env4 = element.rawData;
      const apps = this.cachedApplications.filter(
        (a) => (
          // best-effort: match by environment id if available
          env4.applications ? env4.applications.some((ea) => ea.id === a.id) : true
        )
      );
      if (apps.length === 0) {
        return [new CoolifyTreeItem("No applications", vscode3.TreeItemCollapsibleState.None, "empty")];
      }
      return apps.map(
        (app) => new CoolifyTreeItem(
          app.name,
          vscode3.TreeItemCollapsibleState.None,
          "application",
          app
        )
      );
    }
    return [];
  }
  getCategoryChildren(label) {
    switch (label) {
      case "Projects":
        if (this.cachedProjects.length === 0) {
          return [new CoolifyTreeItem("No projects found", vscode3.TreeItemCollapsibleState.None, "empty")];
        }
        return this.cachedProjects.map(
          (proj) => new CoolifyTreeItem(
            proj.name,
            vscode3.TreeItemCollapsibleState.Collapsed,
            "project",
            proj
          )
        );
      case "Applications":
        if (this.cachedApplications.length === 0) {
          return [new CoolifyTreeItem("No applications found", vscode3.TreeItemCollapsibleState.None, "empty")];
        }
        return this.cachedApplications.map(
          (app) => new CoolifyTreeItem(
            app.name,
            vscode3.TreeItemCollapsibleState.None,
            "application",
            app
          )
        );
      case "Servers":
        if (this.cachedServers.length === 0) {
          return [new CoolifyTreeItem("No servers found", vscode3.TreeItemCollapsibleState.None, "empty")];
        }
        return this.cachedServers.map(
          (srv) => new CoolifyTreeItem(
            srv.name,
            vscode3.TreeItemCollapsibleState.None,
            "server",
            srv
          )
        );
      case "Databases":
        if (this.cachedDatabases.length === 0) {
          return [new CoolifyTreeItem("No databases found", vscode3.TreeItemCollapsibleState.None, "empty")];
        }
        return this.cachedDatabases.map(
          (db) => new CoolifyTreeItem(
            db.name,
            vscode3.TreeItemCollapsibleState.None,
            "database",
            db
          )
        );
      default:
        return [];
    }
  }
  getService_() {
    return this.service;
  }
  getCachedApplications() {
    return this.cachedApplications;
  }
  getCachedDatabases() {
    return this.cachedDatabases;
  }
  dispose() {
    this.isDisposed = true;
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this._onDidChangeTreeData.dispose();
  }
};

// src/commands/index.ts
var vscode11 = __toESM(require("vscode"));

// src/commands/deploy.ts
var vscode4 = __toESM(require("vscode"));
var import_child_process = require("child_process");
var import_child_process2 = require("child_process");
var pipelineChannel;
function getPipelineChannel() {
  if (!pipelineChannel) {
    pipelineChannel = vscode4.window.createOutputChannel("Coolify: Deploy Pipeline");
  }
  return pipelineChannel;
}
function banner(channel, stage) {
  channel.appendLine("");
  channel.appendLine(`${"\u2500".repeat(60)}`);
  channel.appendLine(`  ${stage}`);
  channel.appendLine(`${"\u2500".repeat(60)}`);
}
function timestamp() {
  return (/* @__PURE__ */ new Date()).toLocaleTimeString();
}
function gitPushLive(workspaceRoot, channel) {
  return new Promise((resolve) => {
    banner(channel, "\u{1F500}  STAGE 1 \u2014 Git Push");
    channel.appendLine(`[${timestamp()}] Running: git push origin HEAD`);
    const proc = (0, import_child_process.spawn)("git", ["push", "origin", "HEAD"], { cwd: workspaceRoot });
    proc.stdout.on("data", (data) => {
      channel.append(data.toString());
    });
    proc.stderr.on("data", (data) => {
      channel.append(data.toString());
    });
    proc.on("close", (code) => {
      if (code === 0) {
        channel.appendLine(`[${timestamp()}] \u2705 Git push succeeded.`);
        resolve(true);
      } else {
        channel.appendLine(`[${timestamp()}] \u274C Git push exited with code ${code}.`);
        resolve(false);
      }
    });
    proc.on("error", (err) => {
      channel.appendLine(`[${timestamp()}] \u274C Git push error: ${err.message}`);
      resolve(false);
    });
  });
}
async function waitForCommitOnCoolify(service, appUuid, localSha, channel) {
  banner(channel, "\u2705  STAGE 2 \u2014 Commit Verification");
  channel.appendLine(`[${timestamp()}] Waiting for Coolify to detect commit: ${localSha.slice(0, 8)}`);
  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const app = await service.getApplication(appUuid);
      const coolifysha = app.git_commit_sha;
      channel.appendLine(`[${timestamp()}] Attempt ${i + 1}/${maxAttempts} \u2014 Coolify SHA: ${coolifysha?.slice(0, 8) ?? "unknown"}`);
      if (coolifysha && localSha.startsWith(coolifysha) || coolifysha && coolifysha.startsWith(localSha.slice(0, 8))) {
        channel.appendLine(`[${timestamp()}] \u2705 Commit verified on Coolify!`);
        return;
      }
    } catch (e) {
      channel.appendLine(`[${timestamp()}] (poll error: ${e instanceof Error ? e.message : String(e)})`);
    }
    await new Promise((r) => setTimeout(r, 3e3));
  }
  channel.appendLine(`[${timestamp()}] \u26A0\uFE0F  Commit not yet visible on Coolify \u2014 continuing anyway (webhook may handle it).`);
}
async function deployAndStreamLogs(service, appUuid, appName, channel, token) {
  banner(channel, "\u{1F680}  STAGE 3 \u2014 Triggering Deployment");
  let deployUuid;
  try {
    deployUuid = await service.startDeployment(appUuid);
  } catch (err) {
    channel.appendLine(`[${timestamp()}] \u274C Failed to start deployment: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
  if (!deployUuid) {
    channel.appendLine(`[${timestamp()}] \u26A0\uFE0F  Deployment started but no UUID returned \u2014 cannot stream logs.`);
    vscode4.window.showInformationMessage(`\u{1F680} Deployment started for ${appName}`);
    return true;
  }
  channel.appendLine(`[${timestamp()}] Deploy UUID: ${deployUuid}`);
  banner(channel, "\u{1F4CB}  STAGE 4 \u2014 Live Deploy Logs");
  channel.appendLine(`[${timestamp()}] Polling for build logs...`);
  let lastLogLength = 0;
  let isFinished = false;
  let success = false;
  while (!isFinished && !token.isCancellationRequested) {
    await new Promise((r) => setTimeout(r, 3e3));
    try {
      const deployInfo = await service.getDeployment(deployUuid);
      if (!deployInfo) {
        continue;
      }
      const anyInfo = deployInfo;
      if (anyInfo.logs && typeof anyInfo.logs === "string") {
        const currentLogs = anyInfo.logs;
        if (currentLogs.length > lastLogLength) {
          channel.append(currentLogs.substring(lastLogLength));
          lastLogLength = currentLogs.length;
        }
      }
      const status = deployInfo.status ?? "";
      if (status === "finished" || status === "failed" || status === "error") {
        isFinished = true;
        success = status === "finished";
        const icon = success ? "\u2705" : "\u274C";
        channel.appendLine(`
[${timestamp()}] ${icon} Deployment ${status.toUpperCase()}.`);
        if (success) {
          vscode4.window.showInformationMessage(`\u2705 Deployment successful: ${appName}`);
        } else {
          vscode4.window.showErrorMessage(`\u274C Deployment failed: ${appName} (${status})`);
        }
      }
    } catch (pollErr) {
      channel.appendLine(`[${timestamp()}] (log poll error: ${pollErr instanceof Error ? pollErr.message : String(pollErr)})`);
    }
  }
  return success;
}
async function streamAppLogsLive(service, appUuid, appName, channel, token) {
  banner(channel, "\u{1F4E1}  STAGE 5 \u2014 Live App Logs");
  channel.appendLine(`[${timestamp()}] Tailing app logs for ${appName}\u2026 (cancel the progress notification to stop)`);
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
    await new Promise((r) => setTimeout(r, 3e3));
  }
  channel.appendLine(`
[${timestamp()}] \u{1F6D1} App log tailing stopped.`);
}
async function runDeploymentFlow(configManager, appUuid, appName = "Application") {
  try {
    const serverUrl = await configManager.getServerUrl();
    const token = await configManager.getToken();
    if (!serverUrl || !token) {
      throw new Error("Coolify is not configured. Please sign in.");
    }
    const service = new CoolifyService(serverUrl, token);
    const channel = getPipelineChannel();
    channel.clear();
    channel.show(true);
    channel.appendLine(`\u2554${"\u2550".repeat(58)}\u2557`);
    channel.appendLine(`\u2551  Coolify Deploy Pipeline \u2014 ${appName.padEnd(28)} \u2551`);
    channel.appendLine(`\u2551  Started: ${timestamp().padEnd(46)} \u2551`);
    channel.appendLine(`\u255A${"\u2550".repeat(58)}\u255D`);
    let localSha;
    const workspaceFolders = vscode4.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      try {
        const statusOutput = (0, import_child_process2.execSync)("git status --porcelain", { cwd: workspaceRoot }).toString().trim();
        if (statusOutput.length > 0) {
          const proceed = await vscode4.window.showWarningMessage(
            `You have uncommitted changes. Only committed files will be pushed to Coolify. Proceed anyway?`,
            "Proceed",
            "Cancel"
          );
          if (proceed !== "Proceed") {
            channel.appendLine(`[${timestamp()}] \u{1F6D1} Deployment cancelled by user (uncommitted changes).`);
            return;
          }
        }
      } catch (e) {
        channel.appendLine(`[${timestamp()}] \u26A0\uFE0F Could not check git status.`);
      }
      try {
        const localBranch = (0, import_child_process2.execSync)("git rev-parse --abbrev-ref HEAD", { cwd: workspaceRoot }).toString().trim();
        const appDetails = await service.getApplication(appUuid);
        const remoteBranch = appDetails?.git_branch;
        if (remoteBranch && localBranch !== remoteBranch) {
          const proceed = await vscode4.window.showWarningMessage(
            `Coolify expects branch '${remoteBranch}', but your local branch is '${localBranch}'. Your push might not trigger the correct deployment. Proceed anyway?`,
            "Proceed",
            "Cancel"
          );
          if (proceed !== "Proceed") {
            channel.appendLine(`[${timestamp()}] \u{1F6D1} Deployment cancelled by user (branch mismatch).`);
            return;
          }
        }
      } catch (e) {
        channel.appendLine(`[${timestamp()}] \u26A0\uFE0F Could not verify git branch match: ${e instanceof Error ? e.message : String(e)}`);
      }
      try {
        localSha = (0, import_child_process2.execSync)("git rev-parse HEAD", { cwd: workspaceRoot }).toString().trim();
      } catch {
        channel.appendLine(`[${timestamp()}] \u26A0\uFE0F  Could not read local git SHA.`);
      }
      const pushOk = await vscode4.window.withProgress(
        { location: vscode4.ProgressLocation.Notification, title: `[Coolify] ${appName}: Pushing to GitHub\u2026`, cancellable: false },
        () => gitPushLive(workspaceRoot, channel)
      );
      if (!pushOk) {
        vscode4.window.showErrorMessage(`\u274C Git push failed for ${appName}. Check the Coolify Deploy Pipeline output for details.`);
        channel.show(true);
        return;
      }
      if (localSha) {
        await vscode4.window.withProgress(
          { location: vscode4.ProgressLocation.Notification, title: `[Coolify] ${appName}: Verifying commit on Coolify\u2026`, cancellable: false },
          () => waitForCommitOnCoolify(service, appUuid, localSha, channel)
        );
      }
    } else {
      banner(channel, "\u{1F500}  STAGE 1 \u2014 Git Push");
      channel.appendLine(`[${timestamp()}] \u23ED  No workspace open \u2014 skipping git push.`);
      banner(channel, "\u2705  STAGE 2 \u2014 Commit Verification");
      channel.appendLine(`[${timestamp()}] \u23ED  Skipped (no workspace).`);
    }
    await vscode4.window.withProgress(
      {
        location: vscode4.ProgressLocation.Notification,
        title: `[Coolify] ${appName}: Deploying\u2026`,
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
    vscode4.window.showErrorMessage(`Deploy pipeline error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
async function deployCurrentProjectCommand(configManager, statusBarManager2) {
  try {
    const matchedApps = statusBarManager2.getMatchedApps();
    if (!matchedApps || matchedApps.length === 0) {
      vscode4.window.showInformationMessage("No Coolify apps found matching the current workspace.");
      return;
    }
    if (matchedApps.length === 1) {
      const app = matchedApps[0];
      await runDeploymentFlow(configManager, app.uuid || app.id || "", app.name);
      return;
    }
    const selected = await vscode4.window.showQuickPick(
      matchedApps.map((app) => ({
        label: app.name,
        description: app.status,
        detail: app.fqdn ? `\u{1F310} ${app.fqdn}` : void 0,
        id: app.uuid || app.id || ""
      })),
      { placeHolder: "Select an application to deploy from current workspace", title: "Coolify: Deploy Current Project" }
    );
    if (selected) {
      await runDeploymentFlow(configManager, selected.id, selected.label);
    }
  } catch (error) {
    vscode4.window.showErrorMessage(error instanceof Error ? error.message : "Failed to start deployment");
  }
}
async function cancelDeploymentCommand(configManager) {
  try {
    const serverUrl = await configManager.getServerUrl();
    const token = await configManager.getToken();
    if (!serverUrl || !token) {
      throw new Error("Extension not configured properly");
    }
    const service = new CoolifyService(serverUrl, token);
    const deployments = await service.getDeployments();
    const inProgress = deployments.filter((d) => d.status === "in_progress" || d.status === "queued");
    if (!inProgress || inProgress.length === 0) {
      vscode4.window.showInformationMessage("No active deployments found");
      return;
    }
    const selected = await vscode4.window.showQuickPick(
      inProgress.map((d) => ({
        label: `Cancel: ${d.application_name || "Deployment"}`,
        description: d.status,
        detail: d.commit_message || `Deployment ID: ${d.id}`,
        id: d.id
      })),
      { placeHolder: "Select a deployment to cancel", title: "Cancel Deployment" }
    );
    if (selected) {
      vscode4.window.withProgress(
        { location: vscode4.ProgressLocation.Notification, title: `Canceling ${selected.label}\u2026`, cancellable: false },
        async () => {
          await service.cancelDeployment(selected.id);
          vscode4.window.showInformationMessage("\u2705 Deployment canceled.");
        }
      );
    }
  } catch (error) {
    vscode4.window.showErrorMessage(error instanceof Error ? error.message : "Failed to cancel deployment");
  }
}

// src/commands/applicationActions.ts
var vscode5 = __toESM(require("vscode"));
async function performApplicationAction(configManager, action, title, preselectedId, preselectedName) {
  try {
    const serverUrl = await configManager.getServerUrl();
    const token = await configManager.getToken();
    if (!serverUrl || !token) {
      throw new Error("Extension not configured properly");
    }
    const service = new CoolifyService(serverUrl, token);
    let targetId = preselectedId;
    let targetName = preselectedName;
    if (!targetId) {
      const applications = await service.getApplications();
      if (!applications || applications.length === 0) {
        vscode5.window.showInformationMessage("No applications found");
        return;
      }
      const selected = await vscode5.window.showQuickPick(
        applications.map((app) => ({
          label: app.name,
          description: app.status,
          detail: `Status: ${app.status}`,
          id: app.uuid || app.id || ""
        })),
        { placeHolder: `Select an application to ${action}`, title }
      );
      if (!selected) {
        return;
      }
      targetId = selected.id;
      targetName = selected.label;
    }
    await vscode5.window.withProgress(
      {
        location: vscode5.ProgressLocation.Notification,
        title: `${action}ing ${targetName}...`,
        cancellable: false
      },
      async () => {
        if (action === "start") {
          await service.startApplication(targetId);
        } else if (action === "stop") {
          await service.stopApplication(targetId);
        } else {
          await service.restartApplication(targetId);
        }
        const enableNotifications = vscode5.workspace.getConfiguration("coolify").get("enableNotifications", true);
        if (enableNotifications) {
          vscode5.window.showInformationMessage(`\u2705 Successfully ${action}ed ${targetName}`);
        }
      }
    );
  } catch (error) {
    vscode5.window.showErrorMessage(
      error instanceof Error ? error.message : `Failed to ${action} application`
    );
  }
}
async function startApplicationCommand(_unused, configManager, id, name) {
  await performApplicationAction(configManager, "start", "Start Application", id, name);
}
async function stopApplicationCommand(_unused, configManager, id, name) {
  await performApplicationAction(configManager, "stop", "Stop Application", id, name);
}
async function restartApplicationCommand(_unused, configManager, id, name) {
  await performApplicationAction(configManager, "restart", "Restart Application", id, name);
}

// src/commands/databaseActions.ts
var vscode6 = __toESM(require("vscode"));
async function performDatabaseAction(configManager, action, actionLabel, providedUuid, providedName) {
  let targetUuid = providedUuid;
  let targetName = providedName || "Database";
  if (!targetUuid) {
    const serverUrl2 = await configManager.getServerUrl();
    const token2 = await configManager.getToken();
    if (!serverUrl2 || !token2) {
      vscode6.window.showErrorMessage("Coolify is not configured. Run Coolify: Configure first.");
      return;
    }
    const service2 = new CoolifyService(serverUrl2, token2);
    let databases = [];
    await vscode6.window.withProgress(
      { location: vscode6.ProgressLocation.Notification, title: "Fetching databases..." },
      async () => {
        databases = await service2.getDatabases();
      }
    );
    if (!databases || databases.length === 0) {
      vscode6.window.showInformationMessage("No databases found.");
      return;
    }
    const selected = await vscode6.window.showQuickPick(
      databases.map((db) => ({
        label: db.name,
        description: db.status,
        detail: db.type,
        id: db.uuid
      })),
      { placeHolder: `Select a database to ${action}`, title: actionLabel }
    );
    if (!selected) {
      return;
    }
    targetUuid = selected.id;
    targetName = selected.label;
  }
  if (!targetUuid) {
    return;
  }
  const serverUrl = await configManager.getServerUrl();
  const token = await configManager.getToken();
  if (!serverUrl || !token) {
    vscode6.window.showErrorMessage("Coolify is not configured. Run Coolify: Configure first.");
    return;
  }
  const service = new CoolifyService(serverUrl, token);
  await vscode6.window.withProgress(
    {
      location: vscode6.ProgressLocation.Notification,
      title: `${actionLabel} for ${targetName}...`,
      cancellable: false
    },
    async () => {
      try {
        if (action === "start") {
          await service.startDatabase(targetUuid);
        } else if (action === "stop") {
          await service.stopDatabase(targetUuid);
        }
        const enableNotifications = vscode6.workspace.getConfiguration("coolify").get("enableNotifications", true);
        if (enableNotifications) {
          vscode6.window.showInformationMessage(`\u2705 ${targetName} ${action} command sent successfully`);
        }
      } catch (error) {
        vscode6.window.showErrorMessage(`Failed to ${action} ${targetName}`);
        console.error(`Error in database action (${action}):`, error);
      }
    }
  );
}
async function startDatabaseCommand(_unused, configManager, uuid, name) {
  await performDatabaseAction(configManager, "start", "Start Database", uuid, name);
}
async function stopDatabaseCommand(_unused, configManager, uuid, name) {
  await performDatabaseAction(configManager, "stop", "Stop Database", uuid, name);
}

// src/commands/logs.ts
var vscode7 = __toESM(require("vscode"));
var logsOutputChannel;
function getLogsChannel() {
  if (!logsOutputChannel) {
    logsOutputChannel = vscode7.window.createOutputChannel("Coolify Logs");
  }
  return logsOutputChannel;
}
async function viewApplicationLogsCommand(configManager, app) {
  try {
    const serverUrl = await configManager.getServerUrl();
    const token = await configManager.getToken();
    if (!serverUrl || !token) {
      throw new Error("Extension not configured properly");
    }
    const service = new CoolifyService(serverUrl, token);
    let targetId = app?.id;
    let targetName = app?.name;
    if (!targetId) {
      const applications = await service.getApplications();
      if (!applications || applications.length === 0) {
        vscode7.window.showInformationMessage("No applications found");
        return;
      }
      const selected = await vscode7.window.showQuickPick(
        applications.map((a) => ({
          label: a.name,
          description: a.status,
          detail: a.fqdn,
          id: a.uuid || a.id || ""
        })),
        { placeHolder: "Select an application to view logs", title: "Coolify: View Logs" }
      );
      if (!selected) {
        return;
      }
      targetId = selected.id;
      targetName = selected.label;
    }
    const channel = getLogsChannel();
    channel.clear();
    channel.show(true);
    channel.appendLine(`\u2500\u2500 Coolify Logs \u2014 ${targetName} \u2500\u2500`);
    channel.appendLine(`Fetching logs from ${serverUrl}...`);
    channel.appendLine("");
    await vscode7.window.withProgress(
      {
        location: vscode7.ProgressLocation.Notification,
        title: `Fetching logs for ${targetName}...`,
        cancellable: false
      },
      async () => {
        const logs = await service.getApplicationLogs(targetId);
        channel.appendLine(logs || "(No log output)");
      }
    );
  } catch (error) {
    vscode7.window.showErrorMessage(
      error instanceof Error ? error.message : "Failed to fetch logs"
    );
  }
}
async function viewApplicationLogsLiveCommand(configManager, app) {
  try {
    const serverUrl = await configManager.getServerUrl();
    const token = await configManager.getToken();
    if (!serverUrl || !token) {
      throw new Error("Extension not configured properly");
    }
    const service = new CoolifyService(serverUrl, token);
    let targetId = app?.id;
    let targetName = app?.name;
    if (!targetId) {
      const applications = await service.getApplications();
      if (!applications || applications.length === 0) {
        vscode7.window.showInformationMessage("No applications found");
        return;
      }
      const selected = await vscode7.window.showQuickPick(
        applications.map((a) => ({
          label: a.name,
          description: a.status,
          detail: a.fqdn,
          id: a.uuid || a.id || ""
        })),
        { placeHolder: "Select an application to tail logs", title: "Coolify: Live App Logs" }
      );
      if (!selected) {
        return;
      }
      targetId = selected.id;
      targetName = selected.label;
    }
    const channel = getLogsChannel();
    channel.clear();
    channel.show(true);
    channel.appendLine(`\u2500\u2500 Coolify Live Logs \u2014 ${targetName} \u2500\u2500`);
    channel.appendLine(`Tailing logs\u2026 (cancel the progress notification to stop)`);
    channel.appendLine("");
    await vscode7.window.withProgress(
      {
        location: vscode7.ProgressLocation.Notification,
        title: `[Coolify] Live logs: ${targetName}`,
        cancellable: true
      },
      async (_progress, cancellationToken) => {
        let lastLength = 0;
        while (!cancellationToken.isCancellationRequested) {
          try {
            const logs = await service.getApplicationLogs(targetId);
            if (logs && logs.length > lastLength) {
              channel.append(logs.substring(lastLength));
              lastLength = logs.length;
            }
          } catch (e) {
            channel.appendLine(`(fetch error: ${e instanceof Error ? e.message : String(e)})`);
          }
          await new Promise((r) => setTimeout(r, 3e3));
        }
        channel.appendLine(`
\u{1F6D1} Live log tail stopped.`);
      }
    );
  } catch (error) {
    vscode7.window.showErrorMessage(error instanceof Error ? error.message : "Failed to tail logs");
  }
}
async function createDatabaseBackupCommand(configManager, db) {
  try {
    const serverUrl = await configManager.getServerUrl();
    const token = await configManager.getToken();
    if (!serverUrl || !token) {
      throw new Error("Extension not configured properly");
    }
    const service = new CoolifyService(serverUrl, token);
    let targetId = db?.id;
    let targetName = db?.name;
    if (!targetId) {
      const databases = await service.getDatabases();
      if (!databases || databases.length === 0) {
        vscode7.window.showInformationMessage("No databases found");
        return;
      }
      const selected = await vscode7.window.showQuickPick(
        databases.map((d) => ({
          label: d.name,
          description: d.type,
          detail: d.status,
          id: d.uuid
        })),
        { placeHolder: "Select a database to back up", title: "Coolify: Create Database Backup" }
      );
      if (!selected) {
        return;
      }
      targetId = selected.id;
      targetName = selected.label;
    }
    await vscode7.window.withProgress(
      {
        location: vscode7.ProgressLocation.Notification,
        title: `Creating backup for ${targetName}...`,
        cancellable: false
      },
      async () => {
        await service.createDatabaseBackup(targetId);
        vscode7.window.showInformationMessage(`\u2705 Backup created for ${targetName}`);
      }
    );
  } catch (error) {
    vscode7.window.showErrorMessage(
      error instanceof Error ? error.message : "Failed to create backup"
    );
  }
}

// src/commands/browser.ts
var vscode8 = __toESM(require("vscode"));
async function openInBrowserCommand(configManager, treeDataProvider2, item) {
  let fqdn;
  let appName = "";
  if (item?.kind === "application" && item.rawData) {
    const app = item.rawData;
    fqdn = app.fqdn;
    appName = app.name;
  } else {
    const appsWithUrl = treeDataProvider2.getCachedApplications().filter((a) => !!a.fqdn);
    if (appsWithUrl.length === 0) {
      vscode8.window.showInformationMessage("No applications have a public URL configured in Coolify.");
      return;
    }
    const selected = await vscode8.window.showQuickPick(
      appsWithUrl.map((app) => ({
        label: app.name,
        description: app.fqdn.replace(/^https?:\/\//, ""),
        detail: `Status: ${app.status ?? "unknown"}`,
        fqdn: app.fqdn
      })),
      { placeHolder: "Select an application to open", title: "Open in Browser" }
    );
    if (!selected) {
      return;
    }
    fqdn = selected.fqdn;
    appName = selected.label;
  }
  if (!fqdn) {
    vscode8.window.showWarningMessage(`${appName} has no public URL configured in Coolify.`);
    return;
  }
  const url = vscode8.Uri.parse(fqdn.startsWith("http") ? fqdn : `https://${fqdn}`);
  await vscode8.env.openExternal(url);
}
async function copyUuidCommand(treeDataProvider2, item) {
  let uuid;
  let label = "";
  if (item?.rawData) {
    const data = item.rawData;
    uuid = data.uuid ?? data.uuid;
    label = data.name ?? data.name;
  } else {
    const apps = treeDataProvider2.getCachedApplications();
    const dbs = treeDataProvider2.getCachedDatabases();
    const items = [
      ...apps.map((a) => ({ label: a.name, description: `App \xB7 ${a.uuid}`, uuid: a.uuid })),
      ...dbs.map((d) => ({ label: d.name, description: `DB \xB7 ${d.uuid}`, uuid: d.uuid }))
    ];
    if (items.length === 0) {
      vscode8.window.showInformationMessage("No resources found to copy UUID from.");
      return;
    }
    const selected = await vscode8.window.showQuickPick(items, {
      placeHolder: "Select a resource to copy its UUID",
      title: "Copy UUID"
    });
    if (!selected) {
      return;
    }
    uuid = selected.uuid;
    label = selected.label;
  }
  if (!uuid) {
    vscode8.window.showWarningMessage("UUID not available for this resource.");
    return;
  }
  await vscode8.env.clipboard.writeText(uuid);
  vscode8.window.showInformationMessage(`\u2705 UUID for "${label}" copied to clipboard!`);
}
async function quickDeployCommand(configManager, treeDataProvider2) {
  const apps = treeDataProvider2.getCachedApplications();
  if (apps.length === 0) {
    vscode8.window.showInformationMessage("No applications found. Try refreshing.");
    return;
  }
  const statusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case "running":
        return "\u{1F7E2}";
      case "stopped":
      case "exited":
        return "\u{1F534}";
      case "deploying":
      case "starting":
        return "\u{1F7E1}";
      case "error":
      case "failed":
        return "\u274C";
      default:
        return "\u26AA";
    }
  };
  const selected = await vscode8.window.showQuickPick(
    apps.map((app) => ({
      label: `${statusIcon(app.status)} ${app.name}`,
      description: app.fqdn?.replace(/^https?:\/\//, "") ?? "",
      detail: `Status: ${app.status ?? "unknown"} \xB7 ${app.git_branch ? `Branch: ${app.git_branch}` : ""}`,
      uuid: app.uuid ?? app.id ?? "",
      name: app.name
    })),
    {
      placeHolder: "Type to filter, select to deploy immediately",
      title: "\u26A1 Quick Deploy",
      matchOnDescription: true,
      matchOnDetail: true
    }
  );
  if (!selected) {
    return;
  }
  const serverUrl = await configManager.getServerUrl();
  const token = await configManager.getToken();
  if (!serverUrl || !token) {
    vscode8.window.showErrorMessage("Coolify is not configured. Run Coolify: Configure first.");
    return;
  }
  const service = new CoolifyService(serverUrl, token);
  await vscode8.window.withProgress(
    {
      location: vscode8.ProgressLocation.Notification,
      title: `\u{1F680} Deploying ${selected.name}\u2026`,
      cancellable: false
    },
    async () => {
      try {
        await service.startDeployment(selected.uuid);
        vscode8.window.showInformationMessage(
          `\u{1F680} ${selected.name} deployment started!`,
          "View Logs"
        ).then((action) => {
          if (action === "View Logs") {
            vscode8.commands.executeCommand(
              "coolify.viewApplicationLogs",
              { id: selected.uuid, name: selected.name }
            );
          }
        });
      } catch (err) {
        vscode8.window.showErrorMessage(
          `Deploy failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  );
}
async function testConnectionCommand(configManager) {
  const serverUrl = await configManager.getServerUrl();
  const token = await configManager.getToken();
  if (!serverUrl || !token) {
    vscode8.window.showErrorMessage("Coolify is not configured. Run Coolify: Configure first.");
    return;
  }
  await vscode8.window.withProgress(
    { location: vscode8.ProgressLocation.Notification, title: "Testing Coolify connection\u2026", cancellable: false },
    async () => {
      try {
        const service = new CoolifyService(serverUrl, token);
        const version = await service.getVersion();
        vscode8.window.showInformationMessage(
          `\u2705 Connected to Coolify v${version} at ${serverUrl.replace(/^https?:\/\//, "")}`
        );
      } catch (err) {
        vscode8.window.showErrorMessage(
          `\u274C Connection failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  );
}

// src/commands/gitAdvisor.ts
var vscode9 = __toESM(require("vscode"));
function matchesRepo(remotes, coolifyRepo) {
  if (!coolifyRepo || !remotes) {
    return false;
  }
  const target = coolifyRepo.replace(/\.git$/, "").toLowerCase();
  for (const r of remotes) {
    const fetchUrl = r.fetchUrl ? r.fetchUrl.replace(/\.git$/, "").toLowerCase() : "";
    const pushUrl = r.pushUrl ? r.pushUrl.replace(/\.git$/, "").toLowerCase() : "";
    if (fetchUrl.endsWith(target) || pushUrl.endsWith(target)) {
      return true;
    }
  }
  return false;
}
function registerGitPushAdvisor(context, configManager, treeDataProvider2) {
  const gitExtension = vscode9.extensions.getExtension("vscode.git");
  if (!gitExtension) {
    return;
  }
  const git = gitExtension.isActive ? gitExtension.exports : null;
  if (!git) {
    return;
  }
  const api = git.getAPI(1);
  if (!api?.repositories?.length) {
    return;
  }
  for (const repo of api.repositories) {
    context.subscriptions.push(
      repo.state.onDidChange(async () => {
        const currentBranch = repo.state.HEAD?.name;
        if (!currentBranch) {
          return;
        }
        if (!await configManager.isConfigured()) {
          return;
        }
        const apps = treeDataProvider2.getCachedApplications();
        const matchedApps = apps.filter(
          (a) => a.git_branch === currentBranch && a.status !== "deploying" && matchesRepo(repo.state.remotes, a.git_repository)
        );
        if (matchedApps.length === 0) {
          return;
        }
        const cooldownKey = `coolify.gitAdvisor.${currentBranch}`;
        const lastShown = context.globalState.get(cooldownKey) ?? 0;
        if (Date.now() - lastShown < 3e4) {
          return;
        }
        await context.globalState.update(cooldownKey, Date.now());
        if (matchedApps.length === 1) {
          const app = matchedApps[0];
          const action = await vscode9.window.showInformationMessage(
            `Coolify: "${app.name}" is configured to deploy from \`${currentBranch}\`. Deploy now?`,
            "Deploy",
            "Dismiss"
          );
          if (action === "Deploy") {
            vscode9.commands.executeCommand(
              "coolify.startDeployment",
              { kind: "application", rawData: app }
            );
          }
        } else {
          const serverUrl = await configManager.getServerUrl();
          const token = await configManager.getToken();
          if (!serverUrl || !token) {
            return;
          }
          const selected = await vscode9.window.showQuickPick(
            matchedApps.map((a) => ({
              label: a.name,
              description: a.fqdn ?? "",
              detail: `Branch: ${a.git_branch}`,
              uuid: a.uuid ?? a.id ?? ""
            })),
            {
              title: `Deploy from ${currentBranch}?`,
              placeHolder: "Select an app to deploy (Escape to skip)"
            }
          );
          if (selected) {
            const service = new CoolifyService(serverUrl, token);
            await vscode9.window.withProgress(
              { location: vscode9.ProgressLocation.Notification, title: `\u{1F680} Deploying ${selected.label}\u2026`, cancellable: false },
              async () => {
                await service.startDeployment(selected.uuid);
                vscode9.window.showInformationMessage(`\u{1F680} ${selected.label} deployment started!`);
              }
            );
          }
        }
      })
    );
  }
}

// src/panels/CoolifyDashboardPanel.ts
var vscode10 = __toESM(require("vscode"));
var CoolifyDashboardPanel = class _CoolifyDashboardPanel {
  constructor(panel, extensionUri, configManager) {
    this.configManager = configManager;
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.onDidChangeViewState(
      (e) => {
        if (this._panel.visible) {
          this.startAutoRefresh();
        } else {
          this.stopAutoRefresh();
        }
      },
      null,
      this._disposables
    );
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case "refresh":
            this.updatePanelData();
            break;
          case "openLogs":
            vscode10.commands.executeCommand("coolify.viewApplicationLogs", message.uuid, message.name);
            break;
          case "openLiveLogs":
            vscode10.commands.executeCommand("coolify.viewApplicationLogsLive", message.uuid, message.name);
            break;
          case "deployApp":
            vscode10.commands.executeCommand("coolify.startDeployment", message.uuid);
            break;
        }
      },
      null,
      this._disposables
    );
    this.startAutoRefresh();
  }
  static currentPanel;
  _panel;
  _extensionUri;
  _disposables = [];
  _refreshInterval;
  static createOrShow(extensionUri, configManager) {
    const column = vscode10.window.activeTextEditor ? vscode10.window.activeTextEditor.viewColumn : void 0;
    if (_CoolifyDashboardPanel.currentPanel) {
      _CoolifyDashboardPanel.currentPanel._panel.reveal(column);
      return;
    }
    const panel = vscode10.window.createWebviewPanel(
      "coolifyDashboard",
      "Coolify Dashboard",
      column || vscode10.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode10.Uri.joinPath(extensionUri, "public")]
      }
    );
    _CoolifyDashboardPanel.currentPanel = new _CoolifyDashboardPanel(panel, extensionUri, configManager);
  }
  startAutoRefresh() {
    this.stopAutoRefresh();
    this.updatePanelData();
    const interval = vscode10.workspace.getConfiguration("coolify").get("refreshInterval", 5e3);
    this._refreshInterval = setInterval(() => this.updatePanelData(), interval);
  }
  stopAutoRefresh() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = void 0;
    }
  }
  async updatePanelData() {
    if (!this._panel.visible) {
      return;
    }
    try {
      const serverUrl = await this.configManager.getServerUrl();
      const token = await this.configManager.getToken();
      if (!serverUrl || !token) {
        this._panel.webview.html = this.getNotConfiguredHtml();
        return;
      }
      const svc = new CoolifyService(serverUrl, token);
      const [servers, apps, dbs] = await Promise.all([
        svc.getServers(),
        svc.getApplications(),
        svc.getDatabases()
      ]);
      this._panel.webview.html = this.getDashboardHtml(servers, apps, dbs, serverUrl);
    } catch (error) {
      console.error("Coolify Dashboard error:", error);
      this._panel.webview.html = `<h1>Error Loading Dashboard</h1><p>${error instanceof Error ? error.message : "Unknown error"}</p>`;
    }
  }
  getNotConfiguredHtml() {
    return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; }
                    .container { text-align: center; }
                    button { padding: 10px 20px; font-size: 16px; cursor: pointer; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; }
                    button:hover { background: var(--vscode-button-hoverBackground); }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Welcome to Coolify Deployments</h1>
                    <p>Connect your Coolify server to view your dashboard.</p>
                </div>
            </body>
            </html>
        `;
  }
  getDashboardHtml(servers, apps, dbs, serverUrl) {
    const logoUri = this._panel.webview.asWebviewUri(vscode10.Uri.joinPath(this._extensionUri, "public", "logo.svg"));
    const serverCards = servers.map((s) => `
            <div class="card">
                <div class="card-header">
                    <h3>\u{1F5A5}\uFE0F ${s.name}</h3>
                    <span class="badge ${s.settings?.is_reachable ? "badge-success" : "badge-danger"}">
                        ${s.settings?.is_reachable ? "Online" : "Unreachable"}
                    </span>
                </div>
                <div class="card-body">
                    <p>IP: <code>${s.ip}</code></p>
                    <p>User: <code>${s.user}</code></p>
                </div>
            </div>
        `).join("");
    const statusColors = {
      "running": "badge-success",
      "deploying": "badge-warning",
      "starting": "badge-warning",
      "stopped": "badge-dark",
      "exited": "badge-dark",
      "error": "badge-danger",
      "failed": "badge-danger"
    };
    const appCards = apps.map((a) => {
      const badgeClass = statusColors[a.status?.toLowerCase()] || "badge-dark";
      const safeName = a.name.length > 20 ? a.name.substring(0, 20) + "..." : a.name;
      const linkHtml = a.fqdn ? `<a href="${a.fqdn}">${a.fqdn.replace("https://", "").replace("http://", "")}</a>` : "No URL";
      const gitHtml = a.git_repository ? `${a.git_repository}@${a.git_branch}` : "N/A";
      const uuid = a.uuid || a.id;
      return `
            <div class="card">
                <div class="card-header">
                    <h3 title="${a.name}">${safeName}</h3>
                    <span class="badge ${badgeClass}">${a.status || "unknown"}</span>
                </div>
                <div class="card-body">
                    <p class="truncate" title="${a.fqdn || "No URL"}">\u{1F310} ${linkHtml}</p>
                    <p class="truncate" title="${a.git_repository}@${a.git_branch}">\u{1F4E6} ${gitHtml}</p>
                </div>
                <div class="card-footer">
                    <button class="icon-btn" onclick="openLogs('${uuid}', '${a.name}')" title="One-shot Logs">\u{1F4CB} Logs</button>
                    <button class="icon-btn" onclick="openLiveLogs('${uuid}', '${a.name}')" title="Live Tail Logs">\u{1F4E1} Live Logs</button>
                    <button class="icon-btn deploy-btn" onclick="deployApp('${uuid}')" title="Deploy">\u{1F680} Deploy</button>
                </div>
            </div>
        `;
    }).join("");
    const dbCards = dbs.map((d) => {
      const badgeClass = statusColors[d.status?.toLowerCase()] || "badge-dark";
      return `
            <div class="card">
                <div class="card-header">
                    <h3>\u{1F5C4}\uFE0F ${d.name}</h3>
                    <span class="badge ${badgeClass}">${d.status || "unknown"}</span>
                </div>
                <div class="card-body">
                    <p>Type: <code>${d.type}</code></p>
                </div>
            </div>
        `;
    }).join("");
    return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Coolify Dashboard</title>
                <style>
                    :root {
                        --bg: var(--vscode-editor-background);
                        --fg: var(--vscode-editor-foreground);
                        --card-bg: var(--vscode-editorWidget-background);
                        --card-border: var(--vscode-widget-border);
                        --btn-bg: var(--vscode-button-background);
                        --btn-fg: var(--vscode-button-foreground);
                        --btn-hover: var(--vscode-button-hoverBackground);
                        --link: var(--vscode-textLink-foreground);
                    }
                    body {
                        font-family: var(--vscode-font-family), sans-serif;
                        padding: 30px;
                        background-color: var(--bg);
                        color: var(--fg);
                        overflow-y: auto;
                    }
                    header {
                        display: flex;
                        align-items: center;
                        border-bottom: 1px solid var(--card-border);
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    header img { width: 48px; height: 48px; margin-right: 15px; }
                    header h1 { margin: 0; font-weight: 600; font-size: 24px; }
                    header .server-url { margin-left: auto; opacity: 0.6; font-family: monospace; }
                    
                    section { margin-bottom: 40px; }
                    section h2 { margin-bottom: 20px; font-size: 18px; font-weight: 500; border-bottom: 1px dashed var(--card-border); padding-bottom: 8px; display: inline-block; }
                    
                    .grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                        gap: 20px;
                    }
                    
                    .card {
                        background-color: var(--card-bg);
                        border: 1px solid var(--card-border);
                        border-radius: 8px;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                        display: flex;
                        flex-direction: column;
                        transition: transform 0.1s ease, box-shadow 0.1s ease;
                    }
                    .card:hover { transform: translateY(-2px); box-shadow: 0 6px 12px rgba(0,0,0,0.15); }
                    
                    .card-header {
                        padding: 15px;
                        border-bottom: 1px solid var(--card-border);
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .card-header h3 { margin: 0; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
                    
                    .card-body { padding: 15px; flex-grow: 1; }
                    .card-body p { margin: 8px 0; font-size: 13px; opacity: 0.8; }
                    .truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                    
                    .card-footer {
                        padding: 10px 15px;
                        background-color: rgba(0,0,0,0.1);
                        border-top: 1px solid var(--card-border);
                        display: flex;
                        gap: 10px;
                        justify-content: flex-end;
                    }
                    
                    .badge {
                        padding: 4px 8px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: bold;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .badge-success { background: #10B981; color: white; }
                    .badge-danger { background: #EF4444; color: white; }
                    .badge-warning { background: #F59E0B; color: white; }
                    .badge-dark { background: #6B7280; color: white; }
                    
                    code {
                        background: rgba(128,128,128,0.2);
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-family: var(--vscode-editor-font-family);
                    }
                    a { color: var(--link); text-decoration: none; }
                    a:hover { text-decoration: underline; }
                    
                    button.icon-btn {
                        background: var(--btn-bg);
                        color: var(--btn-fg);
                        border: none;
                        padding: 6px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    }
                    button.icon-btn:hover { background: var(--btn-hover); }
                    button.deploy-btn { background: #3B82F6; }
                    button.deploy-btn:hover { background: #2563EB; }
                </style>
            </head>
            <body>
                <header>
                    <img src="${logoUri}" alt="Coolify" />
                    <h1>Coolify Infrastructure</h1>
                    <div class="server-url">${serverUrl}</div>
                </header>
                
                <section>
                    <h2>\u{1F5A5}\uFE0F Servers (${servers.length})</h2>
                    <div class="grid">${serverCards || "<p>No servers found.</p>"}</div>
                </section>
                
                <section>
                    <h2>\u{1F4E6} Applications (${apps.length})</h2>
                    <div class="grid">${appCards || "<p>No applications found.</p>"}</div>
                </section>
                
                <section>
                    <h2>\u{1F5C4}\uFE0F Databases (${dbs.length})</h2>
                    <div class="grid">${dbCards || "<p>No databases found.</p>"}</div>
                </section>

                <script>
                    const vscode = acquireVsCodeApi();
                    function openLogs(uuid, name) { vscode.postMessage({ type: 'openLogs', uuid, name }); }
                    function openLiveLogs(uuid, name) { vscode.postMessage({ type: 'openLiveLogs', uuid, name }); }
                    function deployApp(uuid) { vscode.postMessage({ type: 'deployApp', uuid }); }
                </script>
            </body>
            </html>
        `;
  }
  dispose() {
    _CoolifyDashboardPanel.currentPanel = void 0;
    this._panel.dispose();
    this.stopAutoRefresh();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
};

// src/commands/index.ts
function registerCommands(context, configManager, treeDataProvider2, updateConfigurationState, statusBarManager2) {
  const register = (id, fn) => context.subscriptions.push(vscode11.commands.registerCommand(id, fn));
  register("coolify.login", async () => {
    try {
      await vscode11.authentication.getSession("coolify", ["coolify"], { createIfNone: true });
      await updateConfigurationState();
      vscode11.window.showInformationMessage("\u{1F389} Signed in to Coolify!");
    } catch (error) {
      vscode11.window.showErrorMessage(error instanceof Error ? error.message : "Login failed");
    }
  });
  register("coolify.logout", async () => {
    const session = await vscode11.authentication.getSession("coolify", ["coolify"]);
    if (session) {
      await configManager.clearConfiguration();
      await updateConfigurationState();
      vscode11.window.showInformationMessage("Signed out of Coolify");
    }
  });
  register("coolify.refreshApplications", async () => {
    await treeDataProvider2.loadData();
    vscode11.window.showInformationMessage("Coolify: Refreshed");
  });
  register("coolify.openDashboard", () => {
    CoolifyDashboardPanel.createOrShow(context.extensionUri, configManager);
  });
  register("coolify.startDeployment", (itemOrUuid, name) => {
    if (typeof itemOrUuid === "string") {
      return runDeploymentFlow(configManager, itemOrUuid, name);
    } else if (itemOrUuid?.kind === "application" && itemOrUuid.rawData) {
      const app = itemOrUuid.rawData;
      return runDeploymentFlow(configManager, app.uuid || app.id || "", app.name);
    }
    return startDeploymentCommandWrapper(configManager, treeDataProvider2);
  });
  register("coolify.deployCurrentProject", () => deployCurrentProjectCommand(configManager, statusBarManager2));
  register("coolify.cancelDeployment", () => cancelDeploymentCommand(configManager));
  register("coolify.startApplication", (itemOrUuid, name) => {
    if (typeof itemOrUuid === "string") {
      return _appAction(configManager, itemOrUuid, name || "Application", "start");
    } else if (itemOrUuid?.kind === "application" && itemOrUuid.rawData) {
      const app = itemOrUuid.rawData;
      return _appAction(configManager, app.uuid || app.id || "", app.name, "start");
    }
    return startApplicationCommand(void 0, configManager);
  });
  register("coolify.stopApplication", (itemOrUuid, name) => {
    if (typeof itemOrUuid === "string") {
      return _appAction(configManager, itemOrUuid, name || "Application", "stop");
    } else if (itemOrUuid?.kind === "application" && itemOrUuid.rawData) {
      const app = itemOrUuid.rawData;
      return _appAction(configManager, app.uuid || app.id || "", app.name, "stop");
    }
    return stopApplicationCommand(void 0, configManager);
  });
  register("coolify.restartApplication", (itemOrUuid, name) => {
    if (typeof itemOrUuid === "string") {
      return _appAction(configManager, itemOrUuid, name || "Application", "restart");
    } else if (itemOrUuid?.kind === "application" && itemOrUuid.rawData) {
      const app = itemOrUuid.rawData;
      return _appAction(configManager, app.uuid || app.id || "", app.name, "restart");
    }
    return restartApplicationCommand(void 0, configManager);
  });
  register("coolify.viewApplicationLogs", (itemOrUuid, name) => {
    if (typeof itemOrUuid === "string") {
      return viewApplicationLogsCommand(configManager, { id: itemOrUuid, name: name || "Application" });
    } else if (itemOrUuid && "kind" in itemOrUuid && itemOrUuid.kind === "application" && itemOrUuid.rawData) {
      const app = itemOrUuid.rawData;
      return viewApplicationLogsCommand(configManager, { id: app.uuid || app.id || "", name: app.name });
    } else if (itemOrUuid && typeof itemOrUuid === "object" && "id" in itemOrUuid) {
      return viewApplicationLogsCommand(configManager, itemOrUuid);
    }
    return viewApplicationLogsCommand(configManager);
  });
  register("coolify.viewApplicationLogsLive", (itemOrUuid, name) => {
    if (typeof itemOrUuid === "string") {
      return viewApplicationLogsLiveCommand(configManager, { id: itemOrUuid, name: name || "Application" });
    } else if (itemOrUuid && "kind" in itemOrUuid && itemOrUuid.kind === "application" && itemOrUuid.rawData) {
      const app = itemOrUuid.rawData;
      return viewApplicationLogsLiveCommand(configManager, { id: app.uuid || app.id || "", name: app.name });
    } else if (itemOrUuid && typeof itemOrUuid === "object" && "id" in itemOrUuid) {
      return viewApplicationLogsLiveCommand(configManager, itemOrUuid);
    }
    return viewApplicationLogsLiveCommand(configManager);
  });
  register("coolify.startDatabase", (itemOrUuid, name) => {
    if (typeof itemOrUuid === "string") {
      return startDatabaseCommand(void 0, configManager, itemOrUuid, name);
    } else if (itemOrUuid?.kind === "database" && itemOrUuid.rawData) {
      const db = itemOrUuid.rawData;
      return startDatabaseCommand(void 0, configManager, db.uuid, db.name);
    }
    return startDatabaseCommand(void 0, configManager);
  });
  register("coolify.stopDatabase", (itemOrUuid, name) => {
    if (typeof itemOrUuid === "string") {
      return stopDatabaseCommand(void 0, configManager, itemOrUuid, name);
    } else if (itemOrUuid?.kind === "database" && itemOrUuid.rawData) {
      const db = itemOrUuid.rawData;
      return stopDatabaseCommand(void 0, configManager, db.uuid, db.name);
    }
    return stopDatabaseCommand(void 0, configManager);
  });
  register("coolify.createDatabaseBackup", (itemOrUuid, name) => {
    if (typeof itemOrUuid === "string") {
      return createDatabaseBackupCommand(configManager, { id: itemOrUuid, name: name || "Database" });
    } else if (itemOrUuid?.kind === "database" && itemOrUuid.rawData) {
      const db = itemOrUuid.rawData;
      return createDatabaseBackupCommand(configManager, { id: db.uuid, name: db.name });
    }
    return createDatabaseBackupCommand(configManager);
  });
  register(
    "coolify.openInBrowser",
    (item) => openInBrowserCommand(configManager, treeDataProvider2, item)
  );
  register(
    "coolify.copyUuid",
    (item) => copyUuidCommand(treeDataProvider2, item)
  );
  register(
    "coolify.quickDeploy",
    () => quickDeployCommand(configManager, treeDataProvider2)
  );
  register(
    "coolify.testConnection",
    () => testConnectionCommand(configManager)
  );
  registerGitPushAdvisor(context, configManager, treeDataProvider2);
}
async function startDeploymentCommandWrapper(configManager, treeDataProvider2) {
  const apps = treeDataProvider2.getCachedApplications();
  if (!apps || apps.length === 0) {
    vscode11.window.showInformationMessage("No applications found");
    return;
  }
  const selected = await vscode11.window.showQuickPick(
    apps.map((app) => ({
      label: app.name,
      description: app.status,
      detail: app.fqdn,
      id: app.id || app.uuid || ""
    })),
    { placeHolder: "Select an application to deploy", title: "Start Deployment" }
  );
  if (selected) {
    await runDeploymentFlow(configManager, selected.id, selected.label);
  }
}
async function _appAction(configManager, uuid, name, action) {
  const serverUrl = await configManager.getServerUrl();
  const token = await configManager.getToken();
  if (!serverUrl || !token) {
    throw new Error("Not configured");
  }
  const service = new CoolifyService(serverUrl, token);
  await vscode11.window.withProgress(
    { location: vscode11.ProgressLocation.Notification, title: `${action}ing ${name}...`, cancellable: false },
    async () => {
      if (action === "start") {
        await service.startApplication(uuid);
      } else if (action === "stop") {
        await service.stopApplication(uuid);
      } else {
        await service.restartApplication(uuid);
      }
      const enableNotifications = vscode11.workspace.getConfiguration("coolify").get("enableNotifications", true);
      if (enableNotifications) {
        vscode11.window.showInformationMessage(`\u2705 ${name} ${action}ed`);
      }
    }
  );
}

// src/auth/CoolifyAuthProvider.ts
var vscode12 = __toESM(require("vscode"));
var PROVIDER_ID = "coolify";
var PROVIDER_LABEL = "Coolify";
var SESSION_STORAGE_KEY = "coolify.auth.sessions";
var CoolifyAuthProvider = class {
  constructor(context, configManager) {
    this.context = context;
    this.configManager = configManager;
    this._reg = vscode12.authentication.registerAuthenticationProvider(
      PROVIDER_ID,
      PROVIDER_LABEL,
      this,
      { supportsMultipleAccounts: false }
    );
  }
  _sessions = [];
  _storedSessions = /* @__PURE__ */ new Map();
  _onDidChangeSessions = new vscode12.EventEmitter();
  onDidChangeSessions = this._onDidChangeSessions.event;
  _reg;
  // ─── AuthenticationProvider interface ─────────────────────────────────────
  async getSessions(scopes) {
    await this._load();
    if (!scopes || scopes.length === 0) {
      return this._sessions;
    }
    return this._sessions.filter((s) => scopes.every((sc) => s.scopes.includes(sc)));
  }
  async createSession(scopes) {
    let serverUrl = await this.configManager.getServerUrl();
    if (!serverUrl) {
      const input = await vscode12.window.showInputBox({
        ignoreFocusOut: true,
        title: "Connect to Coolify",
        prompt: "Enter your Coolify server URL",
        placeHolder: "https://coolify.my-server.com",
        validateInput: (v) => v ? null : "URL is required"
      });
      if (!input) {
        throw new Error("Cancelled");
      }
      serverUrl = input.replace(/\/$/, "");
      await this.configManager.setServerUrl(serverUrl);
    }
    await vscode12.env.openExternal(vscode12.Uri.parse(`${serverUrl}/security/api-tokens`));
    const token = await vscode12.window.showInputBox({
      ignoreFocusOut: true,
      title: "Coolify \u2014 Paste API Token",
      prompt: "\u{1F510} Paste your API token from the browser tab that just opened",
      password: true,
      placeHolder: "Paste token here\u2026",
      validateInput: (v) => v ? null : "Token is required"
    });
    if (!token) {
      throw new Error("Cancelled");
    }
    const svc = new CoolifyService(serverUrl, token);
    if (!await svc.verifyToken()) {
      throw new Error("Invalid token \u2014 please check and try again.");
    }
    await this.configManager.setToken(token);
    return this._storeSession(serverUrl, token, [...scopes]);
  }
  async removeSession(sessionId) {
    const removed = this._sessions.find((s) => s.id === sessionId);
    this._sessions = this._sessions.filter((s) => s.id !== sessionId);
    this._storedSessions.delete(sessionId);
    await this._save();
    await this.configManager.clearConfiguration();
    if (removed) {
      this._onDidChangeSessions.fire({ added: [], removed: [removed], changed: [] });
    }
  }
  // ─── Called by URI deep-link handler (Option 3) ────────────────────────────
  async createSessionFromToken(serverUrl, token) {
    await this.configManager.setServerUrl(serverUrl);
    await this.configManager.setToken(token);
    this._storeSession(serverUrl, token, ["coolify"]);
  }
  // ─── Internals ─────────────────────────────────────────────────────────────
  _storeSession(serverUrl, token, scopes) {
    const id = `coolify-${Date.now()}`;
    const mutableScopes = Array.from(scopes);
    const session = {
      id,
      accessToken: token,
      account: { id: serverUrl, label: serverUrl.replace(/^https?:\/\//, "") },
      scopes: mutableScopes
    };
    this._sessions = [session];
    this._storedSessions.set(id, { ...session, scopes: mutableScopes, serverUrl });
    this._save();
    this._onDidChangeSessions.fire({ added: [session], removed: [], changed: [] });
    return session;
  }
  async _load() {
    const raw = this.context.globalState.get(SESSION_STORAGE_KEY, []);
    this._sessions = raw.map((s) => ({ id: s.id, accessToken: s.accessToken, account: s.account, scopes: s.scopes }));
    raw.forEach((s) => this._storedSessions.set(s.id, s));
  }
  async _save() {
    await this.context.globalState.update(SESSION_STORAGE_KEY, [...this._storedSessions.values()]);
  }
  dispose() {
    this._reg.dispose();
    this._onDidChangeSessions.dispose();
  }
};

// src/auth/UriHandler.ts
var vscode13 = __toESM(require("vscode"));
var CoolifyUriHandler = class {
  constructor(authProvider, configManager, onAuthenticated) {
    this.authProvider = authProvider;
    this.configManager = configManager;
    this.onAuthenticated = onAuthenticated;
  }
  async handleUri(uri) {
    const params = new URLSearchParams(uri.query);
    const token = params.get("token");
    const serverUrl = params.get("url");
    const path = uri.path;
    if (path === "/auth" || path === "/callback") {
      if (!token || !serverUrl) {
        vscode13.window.showErrorMessage(
          "Coolify: Invalid auth link \u2014 missing token or server URL."
        );
        return;
      }
      const decodedUrl = decodeURIComponent(serverUrl).replace(/\/$/, "");
      const decodedToken = decodeURIComponent(token);
      const svc = new CoolifyService(decodedUrl, decodedToken);
      await vscode13.window.withProgress(
        {
          location: vscode13.ProgressLocation.Notification,
          title: `\u{1F510} Authenticating with Coolify at ${decodedUrl.replace(/^https?:\/\//, "")}\u2026`,
          cancellable: false
        },
        async () => {
          const valid = await svc.verifyToken();
          if (!valid) {
            vscode13.window.showErrorMessage(
              "Coolify: The token from the deep link is invalid or expired."
            );
            return;
          }
          await this.authProvider.createSessionFromToken(decodedUrl, decodedToken);
          await this.onAuthenticated();
          vscode13.window.showInformationMessage(
            `\u2705 Authenticated with Coolify at ${decodedUrl.replace(/^https?:\/\//, "")}!`,
            "Open Sidebar"
          ).then((action) => {
            if (action === "Open Sidebar") {
              vscode13.commands.executeCommand("coolify-deployments.focus");
            }
          });
        }
      );
    }
  }
};

// src/extension.ts
function detectEditorName() {
  const appName = vscode14.env.appName ?? "";
  const lower = appName.toLowerCase();
  return {
    name: appName,
    isCursor: lower.includes("cursor"),
    isTrae: lower.includes("trae"),
    isWindsurf: lower.includes("windsurf"),
    isVSCodium: lower.includes("vscodium") || lower.includes("codium"),
    isAntigravity: lower.includes("antigravity")
  };
}
var treeDataProvider;
var statusBarManager;
function activate(context) {
  const editor = detectEditorName();
  console.log(`[Coolify] Running in: ${editor.name}`);
  const isRemote = vscode14.env.remoteName !== void 0 && vscode14.env.remoteName !== "";
  const remoteAdvisoryShown = context.globalState.get("coolify.remoteAdvisoryShown");
  if (isRemote && !remoteAdvisoryShown) {
    vscode14.window.showInformationMessage(
      `Coolify: You are in a remote session (${vscode14.env.remoteName}). Make sure your Coolify server is reachable FROM this remote host.`,
      "Got it"
    ).then(() => {
      context.globalState.update("coolify.remoteAdvisoryShown", true);
    });
  }
  const greetingKey = `coolify.greeted.${editor.name}`;
  if (!context.globalState.get(greetingKey)) {
    const editorLabel = editor.isAntigravity ? "Antigravity" : editor.isCursor ? "Cursor" : editor.isTrae ? "Trae" : editor.isWindsurf ? "Windsurf" : editor.isVSCodium ? "VSCodium" : "VS Code";
    vscode14.window.showInformationMessage(
      `\u{1F44B} Coolify Deployments is ready in ${editorLabel}! Sign in via the Accounts menu to get started.`,
      "Sign In",
      "Dismiss"
    ).then((action) => {
      if (action === "Sign In") {
        vscode14.commands.executeCommand("coolify.login");
      }
    });
    context.globalState.update(greetingKey, true);
  }
  const configManager = new ConfigurationManager(context);
  treeDataProvider = new CoolifyTreeDataProvider(configManager);
  const treeView = vscode14.window.createTreeView("coolify-deployments", {
    treeDataProvider,
    showCollapseAll: true
  });
  statusBarManager = new StatusBarManager(configManager);
  context.subscriptions.push(
    treeView,
    { dispose: () => treeDataProvider?.dispose() },
    { dispose: () => statusBarManager?.dispose() }
  );
  async function updateConfigurationState() {
    const isConfigured = await configManager.isConfigured();
    await vscode14.commands.executeCommand("setContext", "coolify.isConfigured", isConfigured);
    if (isConfigured) {
      await treeDataProvider?.loadData();
      await statusBarManager?.initialize();
    } else {
      treeDataProvider?.refresh();
    }
  }
  updateConfigurationState().then(async () => {
    treeDataProvider?.initialize();
    const isReady = await configManager.isConfigured();
    if (isReady) {
      statusBarManager?.initialize();
    }
  });
  context.subscriptions.push(
    vscode14.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("coolify")) {
        updateConfigurationState();
      }
    })
  );
  registerCommands(context, configManager, treeDataProvider, updateConfigurationState, statusBarManager);
  const authProvider = new CoolifyAuthProvider(context, configManager);
  context.subscriptions.push(authProvider);
  const uriHandler = new CoolifyUriHandler(
    authProvider,
    configManager,
    updateConfigurationState
  );
  context.subscriptions.push(vscode14.window.registerUriHandler(uriHandler));
}
function deactivate() {
  treeDataProvider?.dispose();
  statusBarManager?.dispose();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map

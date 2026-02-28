import { Application, Deployment, Project, Environment, Server, Database } from '../types';

export class CoolifyService {
  constructor(private baseUrl: string, private token: string) { }

  // ─── Core Request Helper ─────────────────────────────────────────────────────

  private async fetchWithAuth<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          ...(options?.headers || {}),
        },
        signal: controller.signal as RequestInit['signal'],
      });

      if (!response.ok) {
        throw new Error(`API request failed (${response.status}): ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchVoid(endpoint: string, method: string = 'GET'): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: { Authorization: `Bearer ${this.token}` },
        signal: controller.signal as RequestInit['signal'],
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

  async getApplications(): Promise<Application[]> {
    return this.fetchWithAuth<Application[]>('/api/v1/applications');
  }

  async getApplicationsByEnvironment(projectUuid: string, environmentName: string): Promise<Application[]> {
    const envData = await this.fetchWithAuth<{ applications?: Application[] }>(
      `/api/v1/projects/${projectUuid}/environment/${environmentName}`
    );
    return envData.applications ?? [];
  }

  async getApplicationLogs(uuid: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/applications/${uuid}/logs`, {
        headers: { Authorization: `Bearer ${this.token}` },
        signal: controller.signal as RequestInit['signal'],
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  async startApplication(uuid: string): Promise<boolean> {
    return this.fetchVoid(`/api/v1/applications/${uuid}/start`);
  }

  async stopApplication(uuid: string): Promise<boolean> {
    return this.fetchVoid(`/api/v1/applications/${uuid}/stop`);
  }

  async restartApplication(uuid: string): Promise<boolean> {
    return this.fetchVoid(`/api/v1/applications/${uuid}/restart`);
  }

  // ─── Deployments ──────────────────────────────────────────────────────────────

  async getDeployments(): Promise<Deployment[]> {
    return this.fetchWithAuth<Deployment[]>('/api/v1/deployments');
  }

  async getApplicationDeployments(appUuid: string): Promise<Deployment[]> {
    return this.fetchWithAuth<Deployment[]>(`/api/v1/applications/${appUuid}/deployments`);
  }

  async startDeployment(uuid: string): Promise<boolean> {
    return this.fetchVoid(`/api/v1/deploy?uuid=${uuid}`);
  }

  async cancelDeployment(uuid: string): Promise<boolean> {
    return this.fetchVoid(`/api/v1/deployments/${uuid}/cancel`, 'POST');
  }

  // ─── Projects ─────────────────────────────────────────────────────────────────

  async getProjects(): Promise<Project[]> {
    return this.fetchWithAuth<Project[]>('/api/v1/projects');
  }

  async getProjectEnvironments(projectUuid: string): Promise<Environment[]> {
    const project = await this.fetchWithAuth<{ environments?: Environment[] }>(
      `/api/v1/projects/${projectUuid}`
    );
    return project.environments ?? [];
  }

  // ─── Servers ──────────────────────────────────────────────────────────────────

  async getServers(): Promise<Server[]> {
    return this.fetchWithAuth<Server[]>('/api/v1/servers');
  }

  // ─── Databases ────────────────────────────────────────────────────────────────

  async getDatabases(): Promise<Database[]> {
    return this.fetchWithAuth<Database[]>('/api/v1/databases');
  }

  async startDatabase(uuid: string): Promise<boolean> {
    return this.fetchVoid(`/api/v1/databases/${uuid}/start`);
  }

  async stopDatabase(uuid: string): Promise<boolean> {
    return this.fetchVoid(`/api/v1/databases/${uuid}/stop`);
  }

  async createDatabaseBackup(uuid: string): Promise<boolean> {
    return this.fetchVoid(`/api/v1/databases/${uuid}/backup`, 'POST');
  }

  // ─── Auth & Health ────────────────────────────────────────────────────────────

  async verifyToken(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/version`, {
        headers: { Authorization: `Bearer ${this.token}` },
        signal: controller.signal as RequestInit['signal'],
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  async testConnection(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        signal: controller.signal as RequestInit['signal'],
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getVersion(): Promise<string> {
    const data = await this.fetchWithAuth<{ version?: string } | string>('/api/v1/version');
    if (typeof data === 'string') { return data; }
    return (data as { version?: string }).version ?? 'unknown';
  }
}


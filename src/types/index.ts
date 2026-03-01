export interface Application {
    id: string;
    uuid?: string;
    name: string;
    status: string;
    fqdn?: string;
    git_repository?: string;
    git_branch?: string;
    updated_at?: string;
    git_commit_sha?: string;
    destination_type?: string;
    description?: string;
    label?: string;
    server_id?: number;
}

export interface Deployment {
    id: string;
    application_id?: string;
    applicationId?: string;
    application_name?: string;
    applicationName?: string;
    status: string;
    commit?: string;
    created_at?: string;
    startedAt?: string;
    deployment_url?: string;
    commit_message?: string;
    logs?: string;
}

export interface Project {
    id: number;
    uuid: string;
    name: string;
    description?: string;
    environments?: Environment[];
}

export interface Environment {
    id: number;
    uuid?: string;
    name: string;
    project_id?: number;
    project_uuid?: string;
    applications?: Application[];
}

export interface Server {
    id: number;
    uuid: string;
    name: string;
    ip: string;
    user?: string;
    port?: number;
    settings?: {
        is_reachable?: boolean;
        is_usable?: boolean;
    };
}

export interface Database {
    id: number;
    uuid: string;
    name: string;
    type?: string;
    status?: string;
    description?: string;
}

export interface WebViewMessage {
    type: 'refresh' | 'deploy' | 'configure' | 'reconfigure';
    applicationId?: string;
}

export interface RefreshDataMessage {
    type: 'refresh-data';
    applications: Application[];
    deployments: Deployment[];
}

export interface DeploymentStatusMessage {
    type: 'deployment-status';
    status: string;
    applicationId: string;
}

export type WebViewOutgoingMessage = RefreshDataMessage | DeploymentStatusMessage;

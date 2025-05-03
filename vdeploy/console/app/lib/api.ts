// API service for communicating with the platform backend
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = 'http://localhost:8000';

export interface Deployment {
  // Core fields from API response
  deployment_id: string;
  name: string;
  namespace: string;
  status: string;
  model: string;
  created_at: string;
  ready: boolean;
  health_status: string;
  
  // Legacy fields for backward compatibility
  id?: string; // Alias for deployment_id
  model_path?: string; // Alias for model
  release_name?: string; // Alias for name
  
  // Optional fields that may not be in all responses
  gpu_type?: string;
  cpu_count?: number;
  memory?: string;
  gpu_count?: number;
  environment?: string;
  image_repo?: string;
  image_tag?: string;
  service_url?: string;
  public_url?: string; // External URL for accessing the deployment
  external_ip?: string; // External IP address from LoadBalancer
  dtype?: string;
  tensor_parallel_size?: number;
  enable_chunked_prefill?: boolean;
}

export interface DeploymentFormData {
  model_path: string;
  release_name: string;
  namespace: string;
  hf_token: string;
  gpu_type: string;
  cpu_count: number;
  memory: string;
  gpu_count: number;
  environment: string;
  image_repo: string;
  image_tag: string;
  dtype: string;
  tensor_parallel_size: number;
  enable_chunked_prefill: boolean;
}

export interface LogEntry {
  pod_name: string;
  log: string;
  timestamp?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Cluster API Types
export interface ClusterListItem {
  cluster_id: string;
  name: string;
  status: string;
  zone: string;
  project_id: string;
  created_at?: string;
}

export interface ClusterCreateRequest {
  project_id: string;
  zone: string;
  cluster_name: string;
  machine_type: string;
  num_nodes: number;
  gpu_machine_type: string;
  gpu_type: string;
  gpu_nodes?: number;
  gpus_per_node?: number;
  min_gpu_nodes?: number;
  max_gpu_nodes?: number;
  debug?: boolean;
}

export interface ClusterResponse {
  success: boolean;
  message: string;
  cluster_id?: string;
  detail?: any;
}

// GCloud Projects API
export interface GCloudProject {
  project_id: string;
  name: string;
  project_number: string;
}

// API functions
const apiClient = {
  // Deployments
  async getDeployments(): Promise<Deployment[]> {
    const response = await fetch(`${API_BASE_URL}/deployments/`);
    if (!response.ok) {
      throw new Error(`Failed to fetch deployments: ${response.statusText}`);
    }
    return response.json();
  },

  async getDeployment(id: string): Promise<Deployment> {
    const response = await fetch(`${API_BASE_URL}/deployments/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch deployment: ${response.statusText}`);
    }
    return response.json();
  },

  async getDeploymentByName(namespace: string, name: string): Promise<Deployment> {
    const response = await fetch(`${API_BASE_URL}/deployments/by-name/${namespace}/${name}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch deployment: ${response.statusText}`);
    }
    return response.json();
  },

  async createDeployment(data: DeploymentFormData): Promise<Deployment> {
    const response = await fetch(`${API_BASE_URL}/deployments/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to create deployment: ${response.statusText}`);
    }
    return response.json();
  },

  async refreshDeploymentStatus(id: string): Promise<Deployment> {
    const response = await fetch(`${API_BASE_URL}/deployments/${id}/refresh`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`Failed to refresh deployment status: ${response.statusText}`);
    }
    return response.json();
  },

  async deleteDeployment(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/deployments/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete deployment: ${response.statusText}`);
    }
  },

  async getDeploymentLogs(id: string, tail: number = 100, podType: string = 'router'): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/deployments/${id}/logs?tail=${tail}&pod_type=${podType}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch deployment logs: ${response.statusText}`);
    }
    return response.json();
  },
  
  async getVLLMPodLogs(id: string, tail: number = 100): Promise<string[]> {
    return this.getDeploymentLogs(id, tail, 'vllm');
  },

  // Clusters
  getClusters(): Promise<ClusterListItem[]> {
    return fetch(`${API_BASE_URL}/clusters`).then(res => res.json());
  },
  getCluster(id: string): Promise<ClusterListItem> {
    return fetch(`${API_BASE_URL}/clusters/${id}`).then(res => {
      if (!res.ok) throw new Error('Cluster not found');
      return res.json();
    });
  },
  createCluster(data: ClusterCreateRequest): Promise<ClusterResponse> {
    return fetch(`${API_BASE_URL}/clusters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => res.json());
  },
  deleteCluster(id: string): Promise<ClusterResponse> {
    return fetch(`${API_BASE_URL}/clusters/${id}`, {
      method: 'DELETE',
    }).then(res => res.json());
  },

  // CLUSTER PROGRESS API ---
  async getClusterProgress(clusterId: string) {
    const res = await fetch(`http://localhost:8000/clusters/${encodeURIComponent(clusterId)}/progress`);
    if (!res.ok) throw new Error("Failed to fetch cluster progress");
    return res.json();
  },

  // GCloud Projects
  async getGCloudProjects(): Promise<GCloudProject[]> {
    const res = await fetch(`${API_BASE_URL}/gcloud/projects`);
    if (!res.ok) throw new Error("Failed to fetch GCloud projects");
    return res.json();
  },

  // WebSocket connection for log streaming
  createLogWebSocket(deploymentId: string): WebSocket {
    return new WebSocket(`ws://localhost:8000/ws/logs/${deploymentId}`);
  },

  // Check if the deployment is ready for chat
  async checkDeploymentReadyForChat(deploymentId: string): Promise<{ready: boolean, serviceUrl: string}> {
    // Check if the deployment is ready
    const deployment = await this.getDeployment(deploymentId);
    if (!deployment.ready) {
      throw new Error('Deployment is not ready yet');
    }
    
    // Make sure we have a service URL
    if (!deployment.service_url) {
      throw new Error('Deployment does not have a service URL');
    }
    
    return {
      ready: deployment.ready,
      serviceUrl: deployment.service_url
    };
  },

  // Send a chat message to the deployed model using the backend proxy
  async sendChatMessage(deploymentId: string, messages: ChatMessage[], options: { max_tokens?: number, temperature?: number } = {}): Promise<ChatResponse> {
    // Check if the deployment exists and is ready
    const deployment = await this.getDeployment(deploymentId);
    
    if (!deployment.ready) {
      throw new Error('Deployment is not ready yet');
    }
    
    // Use our backend proxy endpoint to send the chat request
    const proxyUrl = `${API_BASE_URL}/deployments/${deploymentId}/chat`;
    
    console.log(`Sending chat message via proxy: ${proxyUrl}`);
    
    try {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          max_tokens: options.max_tokens || 1000,
          temperature: options.temperature || 0.7,
          stream: false,
          model: 'deployed-model', // This is typically ignored by vLLM API
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send chat message (${response.status}): ${errorText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('Error sending chat message:', error);
      throw error;
    }
  }
};

// React Query hooks
export function useDeployments() {
  return useQuery({
    queryKey: ['deployments'],
    queryFn: () => apiClient.getDeployments(),
  });
}

export function useDeployment(id: string | undefined) {
  return useQuery({
    queryKey: ['deployment', id],
    queryFn: () => id ? apiClient.getDeployment(id) : Promise.reject('No deployment ID provided'),
    enabled: !!id,
  });
}

export function useDeploymentByName(namespace: string | undefined, name: string | undefined) {
  return useQuery({
    queryKey: ['deployment', namespace, name],
    queryFn: () => namespace && name ? apiClient.getDeploymentByName(namespace, name) : Promise.reject('Missing namespace or name'),
    enabled: !!namespace && !!name,
  });
}

export function useCreateDeployment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: DeploymentFormData) => apiClient.createDeployment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
    },
  });
}

export function useRefreshDeploymentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.refreshDeploymentStatus(id),
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ['deployment', id] });
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
    },
  });
}

export function useDeleteDeployment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteDeployment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
    },
  });
}

export function useDeploymentLogs(id: string | undefined, tail: number = 100, podType: string = 'router') {
  return useQuery({
    queryKey: ['deployment-logs', id, tail, podType],
    queryFn: () => id ? apiClient.getDeploymentLogs(id, tail, podType) : Promise.reject('No deployment ID provided'),
    enabled: !!id,
  });
}

export function useVLLMPodLogs(id: string | undefined, tail: number = 100) {
  return useQuery({
    queryKey: ['vllm-pod-logs', id, tail],
    queryFn: () => id ? apiClient.getVLLMPodLogs(id, tail) : Promise.reject('No deployment ID provided'),
    enabled: !!id,
  });
}

// React Query hook for checking if a deployment is ready for chat
export function useCheckDeploymentReadyForChat() {
  return useMutation({
    mutationFn: (deploymentId: string) => apiClient.checkDeploymentReadyForChat(deploymentId),
  });
}

// React Query hook for sending chat messages
export function useSendChatMessage() {
  return useMutation({
    mutationFn: ({ 
      deploymentId, 
      messages, 
      options = {} 
    }: { 
      deploymentId: string, 
      messages: ChatMessage[], 
      options?: { max_tokens?: number, temperature?: number } 
    }) => apiClient.sendChatMessage(deploymentId, messages, options),
  });
}

// Cluster React Query hooks
export function useClusters() {
  return useQuery<ClusterListItem[]>({
    queryKey: ['clusters'],
    queryFn: apiClient.getClusters,
  });
}

export function useCluster(id: string) {
  return useQuery<ClusterListItem>({
    queryKey: ['cluster', id],
    queryFn: () => apiClient.getCluster(id),
    enabled: !!id,
  });
}

export function useCreateCluster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: apiClient.createCluster,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clusters'] }),
  });
}

export function useDeleteCluster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: apiClient.deleteCluster,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clusters'] }),
  });
}

export function useClusterProgress(clusterId: string | undefined) {
  return useQuery({
    queryKey: ['cluster-progress', clusterId],
    queryFn: () => clusterId ? apiClient.getClusterProgress(clusterId) : Promise.reject('Missing clusterId'),
    enabled: !!clusterId,
    refetchInterval: 3000,
  });
}

export function useGCloudProjects() {
  return useQuery<GCloudProject[]>({
    queryKey: ["gcloud-projects"],
    queryFn: apiClient.getGCloudProjects,
  });
}

// For backward compatibility
export const api = apiClient;

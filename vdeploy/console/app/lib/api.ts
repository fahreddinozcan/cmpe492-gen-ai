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
  // namespace field removed - using release_name as namespace
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
  cluster_id?: string; // Added cluster_id field
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

export interface MetricsResponse {
  success: boolean;
  message: string;
  metrics?: {
    status: string;
    data: {
      resultType: string;
      result: {
        metric: {
          __name__: string;
          pod: string;
          namespace: string;
          [key: string]: string;
        };
        value: [number, string];
      }[];
    };
  };
}

export interface CloudMetricsResponse {
  success: boolean;
  message: string;
  metrics?: {
    [key: string]: {
      value: number;
      timestamp: number;
      labels?: Record<string, string>;
      values?: [number, string][];
      error?: string;
      info?: string;
    };
  };
  timestamp: string;
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
    // Set namespace to the same value as release_name
    const requestData = { ...data, namespace: data.release_name };
    
    const response = await fetch(`${API_BASE_URL}/deployments/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
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

  // WebSocket connection for log streaming
  createLogWebSocket(deploymentId: string): WebSocket {
    return new WebSocket(`ws://localhost:8000/ws/logs/${deploymentId}`);
  },

  // Check if the deployment is ready for chat
  async checkDeploymentReadyForChat(deploymentId: string): Promise<{ ready: boolean, serviceUrl: string }> {
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
    // Check if the deployment is ready first
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
  },
  
  async getDeploymentMetrics(deploymentId: string, metricName?: string): Promise<MetricsResponse> {
    const url = new URL(`${API_BASE_URL}/deployments/${deploymentId}/metrics`);
    
    if (metricName) {
      url.searchParams.append('metric_name', metricName);
    }
    
    console.log(`Fetching metrics from: ${url.toString()}`);
    
    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch metrics (${response.status}): ${errorText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('Error fetching deployment metrics:', error);
      throw error;
    }
  },
  
  async getCloudMetrics(namespace: string, releaseName: string, metricNames: string[] = ['tokens_total'], useRangeQuery: boolean = true, timeRangeMinutes: number = 120): Promise<CloudMetricsResponse> {
    const url = `${API_BASE_URL}/api/deployments/metrics/cloud`;
    
    console.log(`Fetching cloud metrics for ${releaseName} in ${namespace}`);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          namespace,
          release_name: releaseName,
          metric_names: metricNames,
          use_range_query: useRangeQuery,
          time_range_minutes: timeRangeMinutes
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch cloud metrics (${response.status}): ${errorText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('Error fetching cloud metrics:', error);
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

// React Query hook for fetching deployment metrics
export function useDeploymentMetrics(deploymentId: string | undefined, metricName?: string) {
  return useQuery({
    queryKey: ['deployment-metrics', deploymentId, metricName],
    queryFn: () => deploymentId ? apiClient.getDeploymentMetrics(deploymentId, metricName) : Promise.reject('No deployment ID provided'),
    enabled: !!deploymentId,
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}

// React Query hook for fetching cloud metrics
export function useCloudMetrics(deployment: Deployment | undefined, metricNames: string[] = ['tokens_total'], useRangeQuery: boolean = true, timeRangeMinutes: number = 120) {
  return useQuery({
    queryKey: ['cloud-metrics', deployment?.namespace, deployment?.name, metricNames, useRangeQuery, timeRangeMinutes],
    queryFn: () => {
      if (!deployment?.namespace || !deployment?.name) {
        return Promise.reject('No deployment namespace or name provided');
      }
      return apiClient.getCloudMetrics(
        deployment.namespace,
        deployment.name,
        metricNames,
        useRangeQuery,
        timeRangeMinutes
      );
    },
    enabled: !!deployment?.namespace && !!deployment?.name,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// For backward compatibility
export const api = apiClient;

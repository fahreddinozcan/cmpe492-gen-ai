import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// API Base URL - matching the backend API
const API_BASE_URL = 'http://localhost:8000';

// Define cluster interfaces to match the backend
export interface ClusterFormData {
  project_id: string;
  zone: string;
  cluster_name: string;
  network?: string;
  subnetwork?: string;
  machine_type: string;
  num_nodes: number;
  gpu_pool_name: string;
  gpu_machine_type: string;
  gpu_type: string;
  gpu_nodes: number;
  gpus_per_node: number;
  min_gpu_nodes: number;
  max_gpu_nodes: number;
  debug: boolean;
}

export interface ClusterResponse {
  success: boolean;
  message: string;
  cluster_id?: string;
  details?: Record<string, any>;
}

export interface ClusterStatus {
  cluster_id: string;
  project_id: string;
  zone: string;
  cluster_name: string;
  status: string;
  created_at?: string;
  node_count?: number;
  gpu_node_count?: number;
  gpu_type?: string;
  endpoint?: string;
  error_message?: string;
}

export interface LogEntry {
  timestamp?: string;
  level?: string;
  message: string;
}

// API Client for clusters
export const clusterApiClient = {
  // Create a new cluster
  async createCluster(data: ClusterFormData): Promise<ClusterResponse> {
    const response = await fetch(`${API_BASE_URL}/clusters/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to create cluster");
    }

    return response.json();
  },

  // Delete a cluster
  async deleteCluster(data: { 
    project_id: string; 
    zone: string; 
    cluster_name: string; 
    force_delete?: boolean; 
  }): Promise<ClusterResponse> {
    const response = await fetch(`${API_BASE_URL}/clusters/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...data,
        force_delete: data.force_delete !== false, // Default to true if not specified
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to delete cluster");
    }

    return response.json();
  },

  // Get a list of clusters
  async getClusters(projectId?: string): Promise<ClusterStatus[]> {
    const url = projectId 
      ? `${API_BASE_URL}/clusters?project_id=${encodeURIComponent(projectId)}`
      : `${API_BASE_URL}/clusters`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch clusters: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Get a single cluster
  async getCluster(clusterId: string): Promise<ClusterStatus> {
    const response = await fetch(`${API_BASE_URL}/clusters/${clusterId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch cluster: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Check cluster status
  async getClusterStatus(request: { project_id: string; zone: string; cluster_name: string; }): Promise<ClusterStatus> {
    const response = await fetch(`${API_BASE_URL}/clusters/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to check cluster status: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Check if gcloud is authenticated
  async checkGcloudAuth(): Promise<{ authenticated: boolean }> {
    const response = await fetch(`${API_BASE_URL}/gcloud/auth/check`);
    
    if (!response.ok) {
      throw new Error("Failed to check authentication");
    }
    
    return response.json();
  },

  // Check if a project exists
  async checkProject(projectId: string): Promise<{ exists: boolean }> {
    if (!projectId) {
      return { exists: false };
    }
    
    const response = await fetch(`${API_BASE_URL}/gcloud/project/check/${projectId}`);
    
    if (!response.ok) {
      throw new Error("Failed to check project");
    }
    
    return response.json();
  },
  
  // Get a list of available GCP projects
  async getProjects(): Promise<string[]> {
    try {
      // Get actual projects from the backend using 'gcloud projects list'
      const response = await fetch(`${API_BASE_URL}/gcloud/projects`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch GCP projects");
      }
      
      const projects = await response.json();
      
      // Return just the project IDs
      return projects.map((project: { project_id: string; name: string }) => project.project_id);
    } catch (error) {
      console.warn("Could not fetch GCP projects:", error);
      
      // Fallback: try to extract from existing clusters
      try {
        const clusters = await this.getClusters();
        const projectIds = [...new Set(clusters.map(cluster => cluster.project_id))];
        
        if (projectIds.length > 0) {
          return projectIds.filter(Boolean);
        }
      } catch (clusterError) {
        console.warn("Could not get projects from clusters:", clusterError);
      }
      
      // If all else fails, return an empty array
      return [];
    }
  }
};

// React Query hooks

// Create a new cluster
export function useCreateCluster() {
  const queryClient = useQueryClient();
  
  return useMutation<ClusterResponse, Error, ClusterFormData>({
    mutationFn: (data) => clusterApiClient.createCluster(data),
    onSuccess: () => {
      // Invalidate clusters query to refetch the list
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
    },
  });
}

// Delete a cluster
export function useDeleteCluster() {
  const queryClient = useQueryClient();
  
  return useMutation<ClusterResponse, Error, { 
    project_id: string; 
    zone: string; 
    cluster_name: string; 
    force_delete?: boolean; 
  }>({
    mutationFn: (data) => clusterApiClient.deleteCluster(data),
    onSuccess: (_, variables) => {
      // Invalidate clusters query to refetch the list
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      
      // Invalidate specific cluster query if we know the ID
      // This is a bit tricky since we're deleting by name, not ID
      // But if we had the cluster ID, we could do something like this:
      // queryClient.invalidateQueries({ queryKey: ['cluster', clusterId] });
    },
  });
}

// Get a list of clusters
export function useClusters(projectId?: string) {
  return useQuery<ClusterStatus[], Error>({
    queryKey: ['clusters', projectId],
    queryFn: () => clusterApiClient.getClusters(projectId),
    refetchInterval: (data) => {
      // Auto-refresh data if there are active operations
      if (data && Array.isArray(data) && data.some((cluster: ClusterStatus) => 
        ['PENDING', 'CREATING', 'DELETING'].includes(cluster.status)
      )) {
        return 5000; // Refresh every 5 seconds
      }
      return false; // Don't auto-refresh otherwise
    },
  });
}

// Get a single cluster
export function useCluster(clusterId: string | undefined) {
  return useQuery<ClusterStatus, Error>({
    queryKey: ['cluster', clusterId],
    queryFn: () => clusterId ? clusterApiClient.getCluster(clusterId) : Promise.reject('No cluster ID provided'),
    enabled: !!clusterId,
    refetchInterval: (data) => {
      // Auto-refresh data if there are active operations
      if (data && typeof data === 'object' && 'status' in data && 
          ['PENDING', 'CREATING', 'DELETING'].includes(data.status as string)) {
        return 5000; // Refresh every 5 seconds
      }
      return false; // Don't auto-refresh otherwise
    },
  });
}

// Check cluster status 
export function useRefreshClusterStatus() {
  const queryClient = useQueryClient();
  
  return useMutation<ClusterStatus, Error, { project_id: string; zone: string; cluster_name: string; }>({
    mutationFn: (request) => clusterApiClient.getClusterStatus(request),
    onSuccess: (data) => {
      // Invalidate clusters query to refetch the list
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      
      // Update specific cluster data if we have the ID
      if (data.cluster_id) {
        queryClient.invalidateQueries({ queryKey: ['cluster', data.cluster_id] });
      }
    },
  });
}

// Check if gcloud is authenticated
export function useGCloudAuth() {
  return useQuery<{ authenticated: boolean }, Error>({
    queryKey: ['gcloudAuth'],
    queryFn: () => clusterApiClient.checkGcloudAuth(),
    retry: 2,
    staleTime: 10 * 1000, // 10 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

// Check if a project exists
export function useCheckProject(projectId: string) {
  return useQuery<{ exists: boolean }, Error>({
    queryKey: ['projectCheck', projectId],
    queryFn: () => clusterApiClient.checkProject(projectId),
    enabled: !!projectId && projectId.trim() !== '',
  });
}

// Get available GCP projects
export function useGCPProjects() {
  return useQuery<string[], Error>({
    queryKey: ['gcpProjects'],
    queryFn: () => clusterApiClient.getProjects(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// WebSocket hook for cluster logs
export function useClusterLogs(clusterId: string | undefined) {
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const wsRef = React.useRef<WebSocket | null>(null);
  
  const connectWebSocket = React.useCallback(() => {
    if (!clusterId) return;
    
    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    // Clear logs when starting a new connection
    setLogs([]);
    setError(null);
    
    try {
      // Create a new WebSocket connection
      const ws = new WebSocket(`ws://${window.location.host.split(':')[0]}:8000/ws/cluster-logs/${clusterId}`);
      
      ws.onopen = () => {
        console.log('WebSocket connected for cluster logs');
        setIsConnected(true);
        setError(null);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.error) {
            setError(data.error);
            return;
          }
          
          // Add the new log entry to our state
          setLogs(prev => [...prev, {
            timestamp: data.timestamp,
            level: data.level,
            message: data.log || data.message
          }]);
        } catch (e) {
          console.error('Error parsing log message:', e);
          // If not JSON, just add as raw message
          setLogs(prev => [...prev, { message: event.data }]);
        }
      };
      
      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
        setIsConnected(false);
      };
      
      ws.onclose = () => {
        console.log('WebSocket closed for cluster logs');
        setIsConnected(false);
      };
      
      wsRef.current = ws;
    } catch (e) {
      console.error('Error creating WebSocket:', e);
      setError(`Failed to connect to log stream: ${e instanceof Error ? e.message : String(e)}`);
    }
    
    // Clean up function
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
    };
  }, [clusterId]);
  
  // Connect to WebSocket when clusterId changes
  React.useEffect(() => {
    const cleanup = connectWebSocket();
    return cleanup;
  }, [connectWebSocket]);
  
  return { logs, isConnected, error, reconnect: connectWebSocket };
}

// For backward compatibility and convenience
export const clusterApi = clusterApiClient;

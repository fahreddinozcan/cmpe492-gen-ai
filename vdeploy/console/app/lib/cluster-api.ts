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
  progress?: number; // Progress percentage (0-100)
}

export interface LogEntry {
  timestamp?: string;
  level?: string;
  message: string;
}

export interface ClusterLogsResponse {
  logs: LogEntry[];
  total_logs: number;
  status: string;
  progress: number;
  cluster_info: {
    project_id: string;
    zone: string;
    cluster_name: string;
    created_at: string;
    endpoint?: string;
  };
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

  // Get cluster logs
  async getClusterLogs(clusterId: string, limit: number = 100, sinceTimestamp?: string): Promise<ClusterLogsResponse> {
    let url = `${API_BASE_URL}/clusters/${clusterId}/logs?limit=${limit}`;
    if (sinceTimestamp) {
      url += `&since_timestamp=${encodeURIComponent(sinceTimestamp)}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch cluster logs: ${response.statusText}`);
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

// REST API polling hook for cluster logs
export function useClusterLogs(clusterId: string | undefined) {
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [clusterInfo, setClusterInfo] = React.useState<ClusterStatus | null>(null);
  const [lastTimestamp, setLastTimestamp] = React.useState<string | null>(null);
  const pollingIntervalRef = React.useRef<number | null>(null);

  const fetchLogs = React.useCallback(async () => {
    if (!clusterId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch logs using the REST API
      const data = await clusterApiClient.getClusterLogs(clusterId, 100, lastTimestamp || undefined);

      // Update cluster info
      setClusterInfo({
        cluster_id: clusterId,
        project_id: data.cluster_info.project_id,
        zone: data.cluster_info.zone,
        cluster_name: data.cluster_info.cluster_name,
        status: data.status,
        created_at: data.cluster_info.created_at,
        endpoint: data.cluster_info.endpoint,
        progress: data.progress
      });

      if (data.logs && data.logs.length > 0) {
        // Add new logs to our state
        setLogs(prev => {
          const newLogs = [...prev];

          // Add new logs that aren't already in the list
          data.logs.forEach((log: LogEntry) => {
            if (!prev.some(existingLog =>
              existingLog.timestamp === log.timestamp &&
              existingLog.message === log.message
            )) {
              newLogs.push(log);
            }
          });

          // Sort by timestamp
          newLogs.sort((a, b) => {
            if (!a.timestamp) return -1;
            if (!b.timestamp) return 1;
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          });

          return newLogs;
        });

        // Update last timestamp for next poll
        if (data.logs.length > 0) {
          const lastLog = data.logs[data.logs.length - 1];
          if (lastLog.timestamp) {
            setLastTimestamp(lastLog.timestamp);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching cluster logs:', e);
      setError(`Failed to fetch logs: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  }, [clusterId, lastTimestamp]);

  // Start polling when clusterId changes
  React.useEffect(() => {
    if (!clusterId) return;

    // Clear logs when starting a new polling session
    setLogs([]);
    setLastTimestamp(null);
    setError(null);

    // Fetch logs immediately
    fetchLogs();

    // Set up polling interval (every 10 seconds)
    pollingIntervalRef.current = window.setInterval(fetchLogs, 10000);

    // Clean up function
    return () => {
      if (pollingIntervalRef.current !== null) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [clusterId, fetchLogs]);

  // Manually refresh logs
  const refreshLogs = React.useCallback(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    isLoading,
    error,
    refreshLogs,
    clusterInfo,
    progress: clusterInfo?.progress || 0
  };
}

// For backward compatibility and convenience
export const clusterApi = clusterApiClient;

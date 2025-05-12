// Metrics API service for communicating with the platform backend
import { useQuery } from '@tanstack/react-query';
import type { Deployment } from './api';

const API_BASE_URL = 'http://localhost:8000';

// Metrics response interfaces
export interface MetricsResponse {
  success: boolean;
  message: string;
  metrics?: Record<string, any>;
  timestamp?: string;
}

export interface CloudMetricsResponse {
  success: boolean;
  message: string;
  metrics?: Record<string, {
    value?: number;
    formatted_value?: string;
    timestamp?: number;
    values?: Array<[number, string | number]>;
    unit?: string;
  }>;
  timestamp?: string;
}

// API client for metrics
const metricsApiClient = {
  // Get metrics for a specific deployment
  async getDeploymentMetrics(
    deploymentId: string, 
    metricName: string
  ): Promise<MetricsResponse> {
    const response = await fetch(
      `${API_BASE_URL}/deployments/${deploymentId}/metrics/${metricName}`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch metrics: ${response.statusText}`);
    }
    return response.json();
  },

  // Get cloud metrics for a deployment
  async getCloudMetrics(
    deployment: Deployment | undefined,
    metricNames: string[],
    useRangeQuery: boolean = true,
    timeRangeMinutes: number = 120
  ): Promise<CloudMetricsResponse> {
    if (!deployment) {
      throw new Error('No deployment provided');
    }

    const params = new URLSearchParams({
      deployment_id: deployment.deployment_id,
      use_range_query: useRangeQuery.toString(),
      time_range_minutes: timeRangeMinutes.toString(),
    });

    // Add metric names as repeated query parameters
    metricNames.forEach(metric => {
      params.append('metric_names', metric);
    });

    const response = await fetch(
      `${API_BASE_URL}/deployments/metrics/cloud?${params.toString()}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch cloud metrics: ${response.statusText}`);
    }
    
    return response.json();
  }
};

// React Query hooks for metrics
export function useDeploymentMetrics(deploymentId: string | undefined, metricName: string) {
  return useQuery({
    queryKey: ['deployment-metrics', deploymentId, metricName],
    queryFn: () => 
      deploymentId 
        ? metricsApiClient.getDeploymentMetrics(deploymentId, metricName) 
        : Promise.reject('No deployment ID provided'),
    enabled: !!deploymentId,
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}

export function useCloudMetrics(
  deployment: Deployment | undefined,
  metricNames: string[],
  useRangeQuery: boolean = true,
  timeRangeMinutes: number = 120
) {
  return useQuery({
    queryKey: ['cloud-metrics', deployment?.deployment_id, metricNames, useRangeQuery, timeRangeMinutes],
    queryFn: () => metricsApiClient.getCloudMetrics(deployment, metricNames, useRangeQuery, timeRangeMinutes),
    enabled: !!deployment,
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}

export const metricsApi = metricsApiClient;

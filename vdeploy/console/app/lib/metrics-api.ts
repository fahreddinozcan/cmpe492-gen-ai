import { useQuery } from "@tanstack/react-query";

// API URL - make sure this matches your backend URL
const API_URL = "http://localhost:8000/api";

// Types for metrics responses
export type MetricsResponse = {
  value: number;
  formatted_value?: string;
  timestamp?: number;
  labels?: Record<string, string>;
  values?: Array<[number, string]> | Array<{ timestamp: number | string; value: number | string }>;
  unit?: string;
  info?: string;
  error?: string;
};

export type CloudMetricsResponse = {
  success: boolean;
  message: string;
  metrics: Record<string, MetricsResponse>;
  timestamp: string;
};

// Function to fetch metrics via cloud metrics endpoint
async function fetchMetricViaCloud(
  deployment: any,
  metricName: string,
  useRangeQuery: boolean = true,
  timeRangeMinutes: number = 120
): Promise<MetricsResponse> {
  if (!deployment) {
    return {
      value: 0,
      error: "Deployment information is required",
      formatted_value: "N/A"
    };
  }

  // Extract namespace and release_name from deployment
  const namespace = deployment.namespace || deployment.metadata?.namespace;
  const release_name = deployment.release_name || deployment.name;

  if (!namespace || !release_name) {
    return {
      value: 0,
      error: "Namespace and release name are required",
      formatted_value: "N/A"
    };
  }

  try {
    const response = await fetch(`${API_URL}/deployments/metrics/cloud`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        namespace,
        release_name,
        metric_names: [metricName],
        use_range_query: useRangeQuery,
        time_range_minutes: timeRangeMinutes,
      }),
    });

    if (!response.ok) {
      return {
        value: 0,
        error: `Failed to fetch ${metricName} metrics: ${response.statusText}`,
        formatted_value: "N/A"
      };
    }

    const data = await response.json();
    
    if (!data.success) {
      return {
        value: 0,
        error: data.message || `Failed to fetch ${metricName} metrics`,
        formatted_value: "N/A"
      };
    }

    return data.metrics[metricName] || {
      value: 0,
      error: `No data available for ${metricName}`,
      formatted_value: "N/A"
    };
  } catch (error) {
    return {
      value: 0,
      error: `Error fetching ${metricName}: ${error instanceof Error ? error.message : String(error)}`,
      formatted_value: "N/A"
    };
  }
}

// Function to fetch cloud metrics
async function fetchCloudMetrics(
  deployment: any,
  metricNames: string[],
  useRangeQuery: boolean = true,
  timeRangeMinutes: number = 120
): Promise<CloudMetricsResponse> {
  // Handle undefined deployment
  if (!deployment) {
    return {
      success: false,
      message: "Deployment information is required",
      metrics: {},
      timestamp: new Date().toISOString()
    };
  }
  // Extract namespace and release_name from deployment
  const namespace = deployment.namespace || deployment.metadata?.namespace;
  const release_name = deployment.release_name || deployment.name;

  if (!namespace || !release_name) {
    return {
      success: false,
      message: "Namespace and release name are required",
      metrics: {},
      timestamp: new Date().toISOString()
    };
  }

  try {
    const response = await fetch(`${API_URL}/deployments/metrics/cloud`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        namespace,
        release_name,
        metric_names: metricNames,
        use_range_query: useRangeQuery,
        time_range_minutes: timeRangeMinutes,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Failed to fetch cloud metrics: ${response.statusText}`,
        metrics: {},
        timestamp: new Date().toISOString()
      };
    }

    const data = await response.json();
    
    // Handle authentication error
    if (!data.success) {
      console.warn("Cloud metrics error:", data.message);
      return {
        success: false,
        message: data.message || "Failed to fetch cloud metrics",
        metrics: {},
        timestamp: new Date().toISOString()
      };
    }
    
    return data;
  } catch (error) {
    return {
      success: false,
      message: `Error fetching cloud metrics: ${error instanceof Error ? error.message : String(error)}`,
      metrics: {},
      timestamp: new Date().toISOString()
    };
  }
}

// React Query hook for individual metrics via cloud endpoint
export function useDeploymentMetrics(
  deployment: any,
  metricName: string,
  useRangeQuery: boolean = false,
  timeRangeMinutes: number = 10
) {
  // Make sure we have valid inputs
  const validDeployment = deployment && 
    (deployment.namespace || deployment.metadata?.namespace) && 
    (deployment.release_name || deployment.name);
    
  return useQuery<MetricsResponse, Error>({
    queryKey: ["cloudMetric", deployment?.namespace, deployment?.release_name, metricName, useRangeQuery, timeRangeMinutes],
    queryFn: () => fetchMetricViaCloud(deployment, metricName, useRangeQuery, timeRangeMinutes),
    enabled: !!validDeployment,
    refetchInterval: 10000, // Refetch every 10 seconds
    retry: 1,
  });
}

// React Query hook for cloud metrics
export function useCloudMetrics(
  deployment: any,
  metricNames: string[],
  useRangeQuery: boolean = true,
  timeRangeMinutes: number = 120
) {
  // Make sure we have valid inputs
  const validDeployment = deployment && 
    (deployment.namespace || deployment.metadata?.namespace) && 
    (deployment.release_name || deployment.name);
  return useQuery<CloudMetricsResponse, Error>({
    queryKey: [
      "cloudMetrics", 
      deployment?.namespace, 
      deployment?.release_name, 
      metricNames.join(","), 
      useRangeQuery, 
      timeRangeMinutes
    ],
    queryFn: () => fetchCloudMetrics(deployment, metricNames, useRangeQuery, timeRangeMinutes),
    enabled: !!validDeployment,
    refetchInterval: 10000, // Refetch every 10 seconds
    retry: 1,
    // Error handling is done in the component
  });
}

// Helper function to format metric values for display
export function formatMetricValue(value: number | undefined, unit: string = ""): string {
  if (value === undefined || value === null) return "N/A";
  
  if (unit === "ms" || unit === "s") {
    return `${value.toFixed(2)} ${unit}`;
  } else if (unit === "tokens" || unit === "tokens/s") {
    return `${Math.round(value).toLocaleString()} ${unit}`;
  } else if (unit === "%") {
    return `${value.toFixed(1)}${unit}`;
  }
  
  return `${value.toLocaleString()}`;
}

// Helper function to process metric data for charts
export function processMetricDataForChart(
  metricResponse: MetricsResponse | undefined,
  valueKey: string = "value"
): Array<{ time: string; [key: string]: number | string }> {
  // Handle missing or invalid data
  if (!metricResponse) return [];
  
  // Handle error in the metrics response
  if (metricResponse.error) {
    console.warn("Error in metrics data:", metricResponse.error);
    return [];
  }
  if (!metricResponse?.values || !Array.isArray(metricResponse.values)) {
    return [];
  }

  const result: Array<{ time: string; [key: string]: number | string }> = [];
  
  metricResponse.values.forEach((item) => {
    try {
      // Handle array format [timestamp, value]
      if (Array.isArray(item)) {
        const timestamp = Number(item[0]);
        const value = parseFloat(String(item[1]));
        
        if (!isNaN(timestamp) && !isNaN(value)) {
          result.push({
            time: new Date(timestamp * 1000).toLocaleTimeString(),
            [valueKey]: value
          });
        }
      }
      // Handle object format {timestamp, value}
      else if (typeof item === "object" && item !== null) {
        const timestamp = Number((item as any).timestamp);
        const value = parseFloat(String((item as any).value));
        
        if (!isNaN(timestamp) && !isNaN(value)) {
          result.push({
            time: new Date(timestamp * 1000).toLocaleTimeString(),
            [valueKey]: value
          });
        }
      }
    } catch (error) {
      console.error("Error processing metric data point:", error);
    }
  });
  
  return result;
}

import React from "react";
import { Button } from "../components/ui/button";
import { useDeployments, type Deployment } from "~/lib/api";
import { useCloudMetrics, processMetricDataForChart } from "../lib/metrics-api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function Analytics() {
  // State for selected deployment
  const [selectedDeploymentId, setSelectedDeploymentId] =
    React.useState<string>("");
  const [selectedDeployment, setSelectedDeployment] =
    React.useState<Deployment | null>(null);

  // State for time interval selection
  const [timeInterval, setTimeInterval] = React.useState<number>(120);

  // Fetch all deployments for the dropdown
  const { data: deployments = [], isLoading: isLoadingDeployments } =
    useDeployments();

  // Time interval options
  const timeIntervalOptions = [
    { value: 30, label: "30 minutes" },
    { value: 60, label: "1 hour" },
    { value: 120, label: "2 hours" },
    { value: 360, label: "6 hours" },
    { value: 720, label: "12 hours" },
    { value: 1440, label: "24 hours" },
  ];

  // Update selected deployment when dropdown changes
  React.useEffect(() => {
    if (selectedDeploymentId && deployments.length > 0) {
      const deployment = deployments.find(
        (d) =>
          d.deployment_id === selectedDeploymentId ||
          d.id === selectedDeploymentId
      );
      setSelectedDeployment(deployment || null);
    }
  }, [selectedDeploymentId, deployments]);

  // Auto-select first deployment if available
  React.useEffect(() => {
    if (!selectedDeploymentId && deployments.length > 0) {
      const firstDeployment = deployments[0];
      const deploymentId = firstDeployment.deployment_id || firstDeployment.id;
      if (deploymentId) {
        setSelectedDeploymentId(deploymentId);
      }
    }
  }, [deployments, selectedDeploymentId]);

  // Fetch metrics for selected deployment
  const { data: tokenMetrics, isLoading: isLoadingTokenMetrics } =
    useCloudMetrics(
      selectedDeployment,
      ["prompt_tokens", "generation_tokens"],
      selectedDeployment !== null,
      timeInterval
    );

  const {
    data: tokenThroughputMetrics,
    isLoading: isLoadingTokenThroughputMetrics,
  } = useCloudMetrics(
    selectedDeployment,
    ["token_throughput"],
    selectedDeployment !== null,
    timeInterval
  );

  const { data: latencyMetricsCloud, isLoading: isLoadingLatencyMetricsCloud } =
    useCloudMetrics(
      selectedDeployment,
      ["e2e_latency", "e2e_latency_p50", "e2e_latency_p99"],
      selectedDeployment !== null,
      timeInterval
    );

  const {
    data: timeToFirstTokenMetrics,
    isLoading: isLoadingTimeToFirstTokenMetrics,
  } = useCloudMetrics(
    selectedDeployment,
    ["time_to_first_token"],
    selectedDeployment !== null,
    timeInterval
  );
  
  // New metrics - Request metrics
  const {
    data: requestMetrics,
    isLoading: isLoadingRequestMetrics,
  } = useCloudMetrics(
    selectedDeployment,
    ["requests_completed", "requests_per_second", "mean_tokens_per_request"],
    selectedDeployment !== null,
    timeInterval
  );
  
  // New metrics - GPU metrics
  const {
    data: gpuMetrics,
    isLoading: isLoadingGpuMetrics,
  } = useCloudMetrics(
    selectedDeployment,
    ["gpu_utilization", "gpu_cache_usage"],
    selectedDeployment !== null,
    timeInterval
  );

  // Chart data state
  const [tokenChartData, setTokenChartData] = React.useState<
    Array<{ time: string; promptTokens: number; generationTokens: number }>
  >([]);

  const [tokenThroughputChartData, setTokenThroughputChartData] =
    React.useState<Array<{ time: string; throughput: number }>>([]);

  const [latencyChartData, setLatencyChartData] = React.useState<
    Array<{ time: string; p50: number; p95: number; p99: number }>
  >([]);

  const [timeToFirstTokenChartData, setTimeToFirstTokenChartData] =
    React.useState<Array<{ time: string; ttft: number }>>([]);
    
  // New chart data states
  const [requestChartData, setRequestChartData] = React.useState<
    Array<{ time: string; requestsCompleted: number; requestsPerSecond: number; meanTokensPerRequest: number }>
  >([]);
  
  const [gpuChartData, setGpuChartData] = React.useState<
    Array<{ time: string; gpuUtilization: number; gpuCacheUsage: number }>
  >([]);

  // Process token metrics data for the chart
  React.useEffect(() => {
    if (!tokenMetrics?.metrics) {
      setTokenChartData([]);
      return;
    }

    try {
      const timeMap: Record<
        string,
        { time: string; promptTokens: number; generationTokens: number }
      > = {};

      // Process prompt tokens
      const promptData = tokenMetrics.metrics.prompt_tokens;
      if (promptData && !promptData.error && promptData.values) {
        const promptValues = processMetricDataForChart(promptData, "value");

        promptValues.forEach(
          (item: { time: string; [key: string]: number | string }) => {
            if (!timeMap[item.time]) {
              timeMap[item.time] = {
                time: item.time,
                promptTokens: 0,
                generationTokens: 0,
              };
            }
            timeMap[item.time].promptTokens = Number(item.value) || 0;
          }
        );
      }

      // Process generation tokens
      const genData = tokenMetrics.metrics.generation_tokens;
      if (genData && !genData.error && genData.values) {
        const genValues = processMetricDataForChart(genData, "value");

        genValues.forEach(
          (item: { time: string; [key: string]: number | string }) => {
            if (!timeMap[item.time]) {
              timeMap[item.time] = {
                time: item.time,
                promptTokens: 0,
                generationTokens: 0,
              };
            }
            timeMap[item.time].generationTokens = Number(item.value) || 0;
          }
        );
      }

      // Convert to array and sort by time
      const chartData = Object.values(timeMap).sort((a, b) => {
        try {
          return new Date(a.time).getTime() - new Date(b.time).getTime();
        } catch {
          return 0;
        }
      });

      setTokenChartData(chartData);
    } catch (error) {
      console.error("Error processing token metrics:", error);
      setTokenChartData([]);
    }
  }, [tokenMetrics]);

  // Process token throughput metrics data for the chart
  React.useEffect(() => {
    if (!tokenThroughputMetrics?.metrics?.token_throughput) {
      setTokenThroughputChartData([]);
      return;
    }

    try {
      const throughputData = tokenThroughputMetrics.metrics.token_throughput;
      if (throughputData && !throughputData.error && throughputData.values) {
        const processedData = processMetricDataForChart(
          throughputData,
          "value"
        ) as Array<{
          time: string;
          [key: string]: number | string;
        }>;

        const chartData = processedData.map((item) => ({
          time: item.time,
          throughput: Number(item.value) || 0,
        }));

        setTokenThroughputChartData(chartData);
      } else {
        setTokenThroughputChartData([]);
      }
    } catch (error) {
      console.error("Error processing token throughput metrics:", error);
      setTokenThroughputChartData([]);
    }
  }, [tokenThroughputMetrics]);

  // Process latency metrics data for the chart
  React.useEffect(() => {
    if (!latencyMetricsCloud?.metrics) {
      setLatencyChartData([]);
      return;
    }

    try {
      const timeMap: Record<
        string,
        { time: string; p50: number; p95: number; p99: number }
      > = {};

      // Process e2e_latency (p95)
      const p95Data = latencyMetricsCloud.metrics.e2e_latency;
      if (p95Data && !p95Data.error && p95Data.values) {
        const processedData = processMetricDataForChart(p95Data, "value");

        processedData.forEach(
          (item: { time: string; [key: string]: number | string }) => {
            if (!timeMap[item.time]) {
              timeMap[item.time] = {
                time: item.time,
                p50: 0,
                p95: 0,
                p99: 0,
              };
            }
            timeMap[item.time].p95 = (Number(item.value) || 0) * 1000;
          }
        );
      }

      // Process e2e_latency_p50
      const p50Data = latencyMetricsCloud.metrics.e2e_latency_p50;
      if (p50Data && !p50Data.error && p50Data.values) {
        const processedData = processMetricDataForChart(p50Data, "value");

        processedData.forEach(
          (item: { time: string; [key: string]: number | string }) => {
            if (!timeMap[item.time]) {
              timeMap[item.time] = {
                time: item.time,
                p50: 0,
                p95: 0,
                p99: 0,
              };
            }
            timeMap[item.time].p50 = (Number(item.value) || 0) * 1000;
          }
        );
      }

      // Process e2e_latency_p99
      const p99Data = latencyMetricsCloud.metrics.e2e_latency_p99;
      if (p99Data && !p99Data.error && p99Data.values) {
        const processedData = processMetricDataForChart(p99Data, "value");

        processedData.forEach(
          (item: { time: string; [key: string]: number | string }) => {
            if (!timeMap[item.time]) {
              timeMap[item.time] = {
                time: item.time,
                p50: 0,
                p95: 0,
                p99: 0,
              };
            }
            timeMap[item.time].p99 = (Number(item.value) || 0) * 1000;
          }
        );
      }

      // Convert to array and sort by time
      const chartData = Object.values(timeMap).sort((a, b) => {
        try {
          return new Date(a.time).getTime() - new Date(b.time).getTime();
        } catch {
          return 0;
        }
      });

      setLatencyChartData(chartData);
    } catch (error) {
      console.error("Error processing latency metrics:", error);
      setLatencyChartData([]);
    }
  }, [latencyMetricsCloud]);

  // Process time to first token metrics data for the chart
  React.useEffect(() => {
    if (!timeToFirstTokenMetrics?.metrics) {
      setTimeToFirstTokenChartData([]);
      return;
    }

    try {
      const ttftData = timeToFirstTokenMetrics.metrics.time_to_first_token;
      if (ttftData && !ttftData.error && ttftData.values) {
        const processedData = processMetricDataForChart(
          ttftData,
          "value"
        ) as Array<{
          time: string;
          [key: string]: number | string;
        }>;

        const chartData = processedData.map((item) => ({
          time: item.time,
          ttft: (Number(item.value) || 0) * 1000,
        }));

        setTimeToFirstTokenChartData(chartData);
      } else {
        setTimeToFirstTokenChartData([]);
      }
    } catch (error) {
      console.error("Error processing time to first token metrics:", error);
      setTimeToFirstTokenChartData([]);
    }
  }, [timeToFirstTokenMetrics]);
  
  // Process request metrics data for the chart
  React.useEffect(() => {
    if (!requestMetrics?.metrics) {
      setRequestChartData([]);
      return;
    }

    try {
      const timeMap: Record<
        string,
        { time: string; requestsCompleted: number; requestsPerSecond: number; meanTokensPerRequest: number }
      > = {};

      // Process requests_completed data
      const requestsCompletedData = requestMetrics.metrics.requests_completed;
      if (requestsCompletedData && !requestsCompletedData.error && requestsCompletedData.values) {
        const processedData = processMetricDataForChart(
          requestsCompletedData,
          "value"
        ) as Array<{
          time: string;
          [key: string]: number | string;
        }>;

        processedData.forEach(({ time, value }) => {
          if (!timeMap[time]) {
            timeMap[time] = {
              time,
              requestsCompleted: Number(value) || 0,
              requestsPerSecond: 0,
              meanTokensPerRequest: 0,
            };
          } else {
            timeMap[time].requestsCompleted = Number(value) || 0;
          }
        });
      }

      // Process requests_per_second data
      const requestsPerSecondData = requestMetrics.metrics.requests_per_second;
      if (requestsPerSecondData && !requestsPerSecondData.error && requestsPerSecondData.values) {
        const processedData = processMetricDataForChart(
          requestsPerSecondData,
          "value"
        ) as Array<{
          time: string;
          [key: string]: number | string;
        }>;

        processedData.forEach(({ time, value }) => {
          if (!timeMap[time]) {
            timeMap[time] = {
              time,
              requestsCompleted: 0,
              requestsPerSecond: Number(value) || 0,
              meanTokensPerRequest: 0,
            };
          } else {
            timeMap[time].requestsPerSecond = Number(value) || 0;
          }
        });
      }

      // Process mean_tokens_per_request data
      const meanTokensPerRequestData = requestMetrics.metrics.mean_tokens_per_request;
      if (meanTokensPerRequestData && !meanTokensPerRequestData.error && meanTokensPerRequestData.values) {
        const processedData = processMetricDataForChart(
          meanTokensPerRequestData,
          "value"
        ) as Array<{
          time: string;
          [key: string]: number | string;
        }>;

        processedData.forEach(({ time, value }) => {
          if (!timeMap[time]) {
            timeMap[time] = {
              time,
              requestsCompleted: 0,
              requestsPerSecond: 0,
              meanTokensPerRequest: Number(value) || 0,
            };
          } else {
            timeMap[time].meanTokensPerRequest = Number(value) || 0;
          }
        });
      }

      // Convert the timeMap to an array and sort by time
      const chartData = Object.values(timeMap).sort((a, b) =>
        a.time.localeCompare(b.time)
      );

      setRequestChartData(chartData);
    } catch (error) {
      console.error("Error processing request metrics data:", error);
      setRequestChartData([]);
    }
  }, [requestMetrics]);
  
  // Process GPU metrics data for the chart
  React.useEffect(() => {
    if (!gpuMetrics?.metrics) {
      setGpuChartData([]);
      return;
    }

    try {
      const timeMap: Record<
        string,
        { time: string; gpuUtilization: number; gpuCacheUsage: number }
      > = {};

      // Process gpu_utilization data
      const gpuUtilizationData = gpuMetrics.metrics.gpu_utilization;
      if (gpuUtilizationData && !gpuUtilizationData.error && gpuUtilizationData.values) {
        const processedData = processMetricDataForChart(
          gpuUtilizationData,
          "value"
        ) as Array<{
          time: string;
          [key: string]: number | string;
        }>;

        processedData.forEach(({ time, value }) => {
          if (!timeMap[time]) {
            timeMap[time] = {
              time,
              gpuUtilization: Number(value) || 0,
              gpuCacheUsage: 0,
            };
          } else {
            timeMap[time].gpuUtilization = Number(value) || 0;
          }
        });
      }

      // Process gpu_cache_usage data
      const gpuCacheUsageData = gpuMetrics.metrics.gpu_cache_usage;
      if (gpuCacheUsageData && !gpuCacheUsageData.error && gpuCacheUsageData.values) {
        const processedData = processMetricDataForChart(
          gpuCacheUsageData,
          "value"
        ) as Array<{
          time: string;
          [key: string]: number | string;
        }>;

        processedData.forEach(({ time, value }) => {
          if (!timeMap[time]) {
            timeMap[time] = {
              time,
              gpuUtilization: 0,
              gpuCacheUsage: Number(value) || 0,
            };
          } else {
            timeMap[time].gpuCacheUsage = Number(value) || 0;
          }
        });
      }

      // Convert the timeMap to an array and sort by time
      const chartData = Object.values(timeMap).sort((a, b) =>
        a.time.localeCompare(b.time)
      );

      setGpuChartData(chartData);
    } catch (error) {
      console.error("Error processing GPU metrics data:", error);
      setGpuChartData([]);
    }
  }, [gpuMetrics]);

  if (isLoadingDeployments) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-white">Loading deployments...</p>
        </div>
      </div>
    );
  }

  if (deployments.length === 0) {
    return (
      <div className="p-6 max-w-6xl mx-auto text-white min-h-screen">
        <h1 className="text-2xl font-bold text-white mb-6">Analytics</h1>
        <div className="text-center py-12 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-lg font-medium mb-2 text-white">
            No deployments found
          </h3>
          <p className="text-gray-400 mb-6">
            Create a deployment first to view analytics.
          </p>
          <Button onClick={() => (window.location.href = "/deployments/new")}>
            Create Deployment
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto text-white min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>

        {/* Deployment and Time Range Selectors */}
        <div className="flex items-center space-x-4">
          {/* Deployment Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400">Deployment:</span>
            <select
              value={selectedDeploymentId}
              onChange={(e) => setSelectedDeploymentId(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 min-w-48"
            >
              <option value="">Select a deployment</option>
              {deployments.map((deployment) => {
                const deploymentId = deployment.deployment_id || deployment.id;
                return (
                  <option key={deploymentId} value={deploymentId}>
                    {deployment.name} ({deployment.model})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400">Time range:</span>
            <select
              value={timeInterval}
              onChange={(e) => setTimeInterval(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
            >
              {timeIntervalOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!selectedDeployment ? (
        <div className="text-center py-12 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-lg font-medium mb-2 text-white">
            Select a deployment
          </h3>
          <p className="text-gray-400">
            Choose a deployment from the dropdown above to view its analytics.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Token Usage Chart */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
            <h4 className="text-md font-medium mb-2">Token Usage</h4>
            {isLoadingTokenMetrics ? (
              <div className="flex justify-center items-center h-64">
                <p className="text-gray-400">Loading token usage data...</p>
              </div>
            ) : tokenChartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={tokenChartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis
                      dataKey="time"
                      stroke="#888"
                      tick={{ fill: "#888" }}
                      tickFormatter={(value) =>
                        value.split(":")[0] + ":" + value.split(":")[1]
                      }
                    />
                    <YAxis stroke="#888" tick={{ fill: "#888" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#333",
                        borderColor: "#555",
                      }}
                      labelStyle={{ color: "#fff" }}
                      formatter={(value, name) => [
                        Number(value).toLocaleString(),
                        name === "promptTokens"
                          ? "Input Tokens"
                          : "Output Tokens",
                      ]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="promptTokens"
                      stroke="#60a5fa"
                      dot={false}
                      name="Input Tokens"
                    />
                    <Line
                      type="monotone"
                      dataKey="generationTokens"
                      stroke="#f59e0b"
                      dot={false}
                      name="Output Tokens"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex justify-center items-center h-64">
                <p className="text-gray-400">No token usage data available</p>
              </div>
            )}
            <div className="mt-2 text-xs text-gray-500">
              <p>
                Shows input (prompt) and output (generation) tokens processed by
                this deployment over time
              </p>
            </div>
          </div>

          {/* Token Throughput Chart */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
            <h4 className="text-md font-medium mb-2">Token Throughput</h4>
            {isLoadingTokenThroughputMetrics ? (
              <div className="flex justify-center items-center h-64">
                <p className="text-gray-400">
                  Loading token throughput data...
                </p>
              </div>
            ) : tokenThroughputChartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={tokenThroughputChartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis
                      dataKey="time"
                      stroke="#888"
                      tick={{ fill: "#888" }}
                      tickFormatter={(value) =>
                        value.split(":")[0] + ":" + value.split(":")[1]
                      }
                    />
                    <YAxis stroke="#888" tick={{ fill: "#888" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#333",
                        borderColor: "#555",
                      }}
                      labelStyle={{ color: "#fff" }}
                      formatter={(value) => [
                        Number(value).toFixed(2),
                        "Tokens/s",
                      ]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="throughput"
                      stroke="#4ade80"
                      dot={false}
                      name="Token Throughput"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex justify-center items-center h-64">
                <p className="text-gray-400">
                  No token throughput data available
                </p>
              </div>
            )}
            <div className="mt-2 text-xs text-gray-500">
              <p>Shows tokens generated per second by the model over time</p>
            </div>
          </div>

          {/* E2E Latency Chart */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
            <h4 className="text-md font-medium mb-2">End-to-End Latency</h4>
            {isLoadingLatencyMetricsCloud ? (
              <div className="flex justify-center items-center h-64">
                <p className="text-gray-400">Loading latency data...</p>
              </div>
            ) : latencyChartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={latencyChartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis
                      dataKey="time"
                      stroke="#888"
                      tick={{ fill: "#888" }}
                      tickFormatter={(value) =>
                        value.split(":")[0] + ":" + value.split(":")[1]
                      }
                    />
                    <YAxis stroke="#888" tick={{ fill: "#888" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#333",
                        borderColor: "#555",
                      }}
                      labelStyle={{ color: "#fff" }}
                      formatter={(value) => [Number(value).toFixed(2), "ms"]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="p50"
                      stroke="#60a5fa"
                      dot={false}
                      name="p50 Latency"
                    />
                    <Line
                      type="monotone"
                      dataKey="p95"
                      stroke="#f59e0b"
                      dot={false}
                      name="p95 Latency"
                    />
                    <Line
                      type="monotone"
                      dataKey="p99"
                      stroke="#ef4444"
                      dot={false}
                      name="p99 Latency"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex justify-center items-center h-64">
                <p className="text-gray-400">No latency data available</p>
              </div>
            )}
            <div className="mt-2 text-xs text-gray-500">
              <p>
                Shows end-to-end request latency percentiles (p50, p95, p99) in
                milliseconds
              </p>
            </div>
          </div>

          {/* Time to First Token Chart */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
            <h4 className="text-md font-medium mb-2">Time to First Token</h4>
            {isLoadingTimeToFirstTokenMetrics ? (
              <div className="flex justify-center items-center h-64">
                <p className="text-gray-400">
                  Loading time to first token data...
                </p>
              </div>
            ) : timeToFirstTokenChartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={timeToFirstTokenChartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis
                      dataKey="time"
                      stroke="#888"
                      tick={{ fill: "#888" }}
                      tickFormatter={(value) =>
                        value.split(":")[0] + ":" + value.split(":")[1]
                      }
                    />
                    <YAxis stroke="#888" tick={{ fill: "#888" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#333",
                        borderColor: "#555",
                      }}
                      labelStyle={{ color: "#fff" }}
                      formatter={(value) => [Number(value).toFixed(2), "ms"]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="ttft"
                      stroke="#a78bfa"
                      dot={false}
                      name="Time to First Token"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex justify-center items-center h-64">
                <p className="text-gray-400">
                  No time to first token data available
                </p>
              </div>
            )}
            <div className="mt-2 text-xs text-gray-500">
              <p>
                Shows time taken to generate the first token in milliseconds
              </p>
            </div>
          </div>

          {/* Request Metrics Chart */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
            <h4 className="text-md font-medium mb-2">Request Metrics</h4>
            {isLoadingRequestMetrics ? (
              <div className="flex justify-center items-center h-64">
                <p className="text-gray-400">Loading request metrics data...</p>
              </div>
            ) : requestChartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={requestChartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis
                      dataKey="time"
                      stroke="#888"
                      tick={{ fill: "#888" }}
                      tickFormatter={(value) =>
                        value.split(":")[0] + ":" + value.split(":")[1]
                      }
                    />
                    <YAxis stroke="#888" tick={{ fill: "#888" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#333",
                        borderColor: "#555",
                      }}
                      labelStyle={{ color: "#fff" }}
                      formatter={(value, name) => {
                        if (name === "requestsCompleted") {
                          return [Number(value).toLocaleString(), "Completed Requests"];
                        } else if (name === "requestsPerSecond") {
                          return [Number(value).toFixed(2), "Requests/s"];
                        } else {
                          return [Number(value).toFixed(1), "Tokens/Request"];
                        }
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="requestsCompleted"
                      stroke="#60a5fa"
                      dot={false}
                      name="Completed Requests"
                    />
                    <Line
                      type="monotone"
                      dataKey="requestsPerSecond"
                      stroke="#f59e0b"
                      dot={false}
                      name="Requests/s"
                    />
                    <Line
                      type="monotone"
                      dataKey="meanTokensPerRequest"
                      stroke="#a78bfa"
                      dot={false}
                      name="Tokens/Request"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex justify-center items-center h-64">
                <p className="text-gray-400">No request metrics data available</p>
              </div>
            )}
            <div className="mt-2 text-xs text-gray-500">
              <p>
                Shows completed requests, requests per second, and average tokens per request
              </p>
            </div>
          </div>

          {/* GPU Metrics Chart */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
            <h4 className="text-md font-medium mb-2">GPU Metrics</h4>
            {isLoadingGpuMetrics ? (
              <div className="flex justify-center items-center h-64">
                <p className="text-gray-400">Loading GPU metrics data...</p>
              </div>
            ) : gpuChartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={gpuChartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis
                      dataKey="time"
                      stroke="#888"
                      tick={{ fill: "#888" }}
                      tickFormatter={(value) =>
                        value.split(":")[0] + ":" + value.split(":")[1]
                      }
                    />
                    <YAxis stroke="#888" tick={{ fill: "#888" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#333",
                        borderColor: "#555",
                      }}
                      labelStyle={{ color: "#fff" }}
                      formatter={(value, name) => {
                        if (name === "gpuUtilization" || name === "gpuCacheUsage") {
                          return [Number(value).toFixed(1) + "%", name === "gpuUtilization" ? "GPU Utilization" : "GPU Cache Usage"];
                        }
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="gpuUtilization"
                      stroke="#10b981"
                      dot={false}
                      name="GPU Utilization"
                    />
                    <Line
                      type="monotone"
                      dataKey="gpuCacheUsage"
                      stroke="#ec4899"
                      dot={false}
                      name="GPU Cache Usage"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex justify-center items-center h-64">
                <p className="text-gray-400">No GPU metrics data available</p>
              </div>
            )}
            <div className="mt-2 text-xs text-gray-500">
              <p>
                Shows GPU utilization percentage and GPU cache usage percentage
              </p>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-400">
            <p>
              Metrics are provided by Google Cloud Managed Prometheus. Data
              refreshes every 10 seconds.
            </p>
            <p className="mt-2">
              Note: Some metrics may not be available until the deployment has
              processed requests.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

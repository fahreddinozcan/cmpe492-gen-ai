import { useParams, Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
  useDeployment,
  useDeleteDeployment,
  useRefreshDeploymentStatus,
  useVLLMPodLogs,
  useCheckDeploymentReadyForChat,
  useSendChatMessage,
  type ChatMessage,
} from "~/lib/api";
import {
  useDeploymentMetrics,
  useCloudMetrics,
  type MetricsResponse,
  type CloudMetricsResponse,
} from "~/lib/metrics-api";
import React from "react";
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

// Simple icons
function RefreshIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M13.6 2.4L12 0.8V4H8.8V5.6H14.4V0H13.6V2.4ZM12 8.8C12 10.88 10.32 12.56 8.24 12.56C6.16 12.56 4.48 10.88 4.48 8.8C4.48 6.72 6.16 5.04 8.24 5.04V8L11.44 4.8L8.24 1.6V4.48C5.84 4.48 3.92 6.4 3.92 8.8C3.92 11.2 5.84 13.12 8.24 13.12C10.64 13.12 12.56 11.2 12.56 8.8H12Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 12.8C4 13.68 4.72 14.4 5.6 14.4H10.4C11.28 14.4 12 13.68 12 12.8V4H4V12.8ZM12.8 2.4H10.4L9.6 1.6H6.4L5.6 2.4H3.2V4H12.8V2.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function DeploymentDetail() {
  const { id } = useParams<{ id: string }>();
  const logsEndRef = React.useRef<HTMLDivElement>(null);
  const [logMessages, setLogMessages] = React.useState<string[]>([]);
  const [isStreamingLogs, setIsStreamingLogs] = React.useState<boolean>(false);

  // Fixed data fetching hooks by removing useMemo
  const { data: deployment, isLoading, error, refetch } = useDeployment(id);

  // Use vLLM pod logs instead of router logs, but don't fetch automatically
  const {
    data: logs = [],
    isLoading: isLoadingLogs,
    refetch: refetchLogs,
  } = useVLLMPodLogs(id);

  const { mutate: refreshDeployment, isPending: isRefreshing } =
    useRefreshDeploymentStatus();

  const { mutate: deleteDeployment, isPending: isDeleting } =
    useDeleteDeployment();

  // State for tabs
  const [activeTab, setActiveTab] = React.useState("details"); // 'details', 'chat', or 'analytics'
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
  const [userMessage, setUserMessage] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [isModelReady, setIsModelReady] = React.useState(false);
  const [modelServiceUrl, setModelServiceUrl] = React.useState<string | null>(
    null
  );
  const [connectionError, setConnectionError] = React.useState<string | null>(
    null
  );

  // Get the check deployment ready mutation
  const { mutate: checkDeploymentReady, isPending: isCheckingDeployment } =
    useCheckDeploymentReadyForChat();

  // Get the send chat message mutation
  const { mutate: sendChatToLLM, isPending: isSendingToLLM } =
    useSendChatMessage();

  // Get metrics data for analytics tab
  const { data: gpuMetrics, isLoading: isLoadingGpuMetrics } =
    useDeploymentMetrics(id, "gpu_utilization");

  const { data: memoryMetrics, isLoading: isLoadingMemoryMetrics } =
    useDeploymentMetrics(id, "memory_usage");

  const { data: cpuMetrics, isLoading: isLoadingCpuMetrics } =
    useDeploymentMetrics(id, "cpu_usage");

  const { data: requestCountMetrics, isLoading: isLoadingRequestCountMetrics } =
    useDeploymentMetrics(id, "request_count");

  const { data: latencyMetrics, isLoading: isLoadingLatencyMetrics } =
    useDeploymentMetrics(id, "request_latency");

  // State for time interval selection
  const [timeInterval, setTimeInterval] = React.useState<number>(120);

  // Time interval options
  const timeIntervalOptions = [
    { value: 30, label: "30 minutes" },
    { value: 60, label: "1 hour" },
    { value: 120, label: "2 hours" },
    { value: 360, label: "6 hours" },
    { value: 720, label: "12 hours" },
    { value: 1440, label: "24 hours" },
  ];

  // Get all metrics from cloud metrics endpoint with the selected time interval
  const { data: tokenMetrics, isLoading: isLoadingTokenMetrics } =
    useCloudMetrics(
      deployment,
      ["prompt_tokens", "generation_tokens"],
      true,
      timeInterval
    );

  const {
    data: tokenThroughputMetrics,
    isLoading: isLoadingTokenThroughputMetrics,
  } = useCloudMetrics(deployment, ["token_throughput"], true, timeInterval);

  const { data: latencyMetricsCloud, isLoading: isLoadingLatencyMetricsCloud } =
    useCloudMetrics(
      deployment,
      ["e2e_latency", "e2e_latency_p50", "e2e_latency_p99"],
      true,
      timeInterval
    );

  const {
    data: timeToFirstTokenMetrics,
    isLoading: isLoadingTimeToFirstTokenMetrics,
  } = useCloudMetrics(deployment, ["time_to_first_token"], true, timeInterval);

  // Prepare chart data for different metrics
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

  // Process token metrics data for the chart
  React.useEffect(() => {
    try {
      // Create a map to store data points by timestamp
      const timeMap: Record<
        number,
        { time: string; promptTokens: number; generationTokens: number }
      > = {};

      // Process prompt tokens if available
      if (
        tokenMetrics?.metrics?.prompt_tokens?.values &&
        Array.isArray(tokenMetrics.metrics.prompt_tokens.values)
      ) {
        const promptValues = tokenMetrics.metrics.prompt_tokens.values;

        promptValues.forEach((item) => {
          let timestamp: number | null = null;
          let value: number | null = null;

          // Handle object format {timestamp, value}
          if (
            typeof item === "object" &&
            item !== null &&
            "timestamp" in item &&
            "value" in item
          ) {
            timestamp = Number((item as any).timestamp);
            value = parseFloat(String((item as any).value));
          }
          // Handle array format [timestamp, value]
          else if (Array.isArray(item) && item.length >= 2) {
            timestamp = Number(item[0]);
            value = parseFloat(String(item[1]));
          }

          if (
            timestamp !== null &&
            value !== null &&
            !isNaN(timestamp) &&
            !isNaN(value)
          ) {
            const timeStr = new Date(timestamp * 1000).toLocaleTimeString();

            if (!timeMap[timestamp]) {
              timeMap[timestamp] = {
                time: timeStr,
                promptTokens: 0,
                generationTokens: 0,
              };
            }

            timeMap[timestamp].promptTokens = value;
          }
        });
      }

      // Process generation tokens if available
      if (
        tokenMetrics?.metrics?.generation_tokens?.values &&
        Array.isArray(tokenMetrics.metrics.generation_tokens.values)
      ) {
        const genValues = tokenMetrics.metrics.generation_tokens.values;

        genValues.forEach((item) => {
          let timestamp: number | null = null;
          let value: number | null = null;

          // Handle object format {timestamp, value}
          if (
            typeof item === "object" &&
            item !== null &&
            "timestamp" in item &&
            "value" in item
          ) {
            timestamp = Number((item as any).timestamp);
            value = parseFloat(String((item as any).value));
          }
          // Handle array format [timestamp, value]
          else if (Array.isArray(item) && item.length >= 2) {
            timestamp = Number(item[0]);
            value = parseFloat(String(item[1]));
          }

          if (
            timestamp !== null &&
            value !== null &&
            !isNaN(timestamp) &&
            !isNaN(value)
          ) {
            const timeStr = new Date(timestamp * 1000).toLocaleTimeString();

            if (!timeMap[timestamp]) {
              timeMap[timestamp] = {
                time: timeStr,
                promptTokens: 0,
                generationTokens: 0,
              };
            }

            timeMap[timestamp].generationTokens = value;
          }
        });
      }

      // Convert the map to an array and sort by timestamp
      const chartData = Object.entries(timeMap)
        .map(([timestamp, data]) => data)
        .sort((a, b) => {
          try {
            const timeA = new Date(a.time).getTime();
            const timeB = new Date(b.time).getTime();
            return timeA - timeB;
          } catch (error) {
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
    try {
      if (
        tokenThroughputMetrics?.metrics?.token_throughput?.values &&
        Array.isArray(tokenThroughputMetrics.metrics.token_throughput.values)
      ) {
        const values = tokenThroughputMetrics.metrics.token_throughput.values;
        const chartData = values
          .map((item) => {
            // Check if item is an object with timestamp and value properties
            if (
              typeof item === "object" &&
              item !== null &&
              "timestamp" in item &&
              "value" in item
            ) {
              return {
                time: new Date(
                  Number(item.timestamp) * 1000
                ).toLocaleTimeString(),
                throughput: parseFloat(String(item.value)),
              };
            }
            // Check if item is an array with two elements
            else if (Array.isArray(item) && item.length >= 2) {
              return {
                time: new Date(Number(item[0]) * 1000).toLocaleTimeString(),
                throughput: parseFloat(String(item[1])),
              };
            }
            return null;
          })
          .filter(
            (item): item is { time: string; throughput: number } =>
              item !== null
          );

        setTokenThroughputChartData(chartData);
      }
    } catch (error) {
      console.error("Error processing token throughput metrics:", error);
      setTokenThroughputChartData([]);
    }
  }, [tokenThroughputMetrics]);

  // Process latency metrics data for the chart
  React.useEffect(() => {
    try {
      if (latencyMetricsCloud?.metrics) {
        const timeMap: Record<
          number,
          { p50?: number; p95?: number; p99?: number }
        > = {};

        // Process each metric if available
        ["e2e_latency", "e2e_latency_p50", "e2e_latency_p99"].forEach(
          (metricName) => {
            // Use type assertion to handle the possibly undefined metrics object
            const metrics = latencyMetricsCloud.metrics as Record<
              string,
              { values?: unknown[] }
            >;
            const metricValues = metrics[metricName]?.values;

            if (metricValues && Array.isArray(metricValues)) {
              metricValues.forEach((item) => {
                let timestamp: number | null = null;
                let value: number | null = null;

                // Handle object format {timestamp, value}
                if (
                  typeof item === "object" &&
                  item !== null &&
                  "timestamp" in item &&
                  "value" in item
                ) {
                  const typedItem = item as {
                    timestamp: string | number;
                    value: string | number;
                  };
                  timestamp = Number(typedItem.timestamp);
                  value = parseFloat(String(typedItem.value));
                }
                // Handle array format [timestamp, value]
                else if (Array.isArray(item) && item.length >= 2) {
                  timestamp = Number(item[0]);
                  value = parseFloat(String(item[1]));
                }

                if (
                  timestamp !== null &&
                  value !== null &&
                  !isNaN(timestamp) &&
                  !isNaN(value)
                ) {
                  if (!timeMap[timestamp]) timeMap[timestamp] = {};

                  // Map the metric name to the appropriate property
                  if (metricName === "e2e_latency") {
                    timeMap[timestamp].p95 = value * 1000; // Convert to ms
                  } else if (metricName === "e2e_latency_p50") {
                    timeMap[timestamp].p50 = value * 1000; // Convert to ms
                  } else if (metricName === "e2e_latency_p99") {
                    timeMap[timestamp].p99 = value * 1000; // Convert to ms
                  }
                }
              });
            }
          }
        );

        // Convert the map to an array and sort by timestamp
        const chartData = Object.entries(timeMap)
          .map(([timestamp, values]) => ({
            time: new Date(parseInt(timestamp) * 1000).toLocaleTimeString(),
            p50: values.p50 || 0,
            p95: values.p95 || 0,
            p99: values.p99 || 0,
          }))
          .sort((a, b) => {
            try {
              const timeA = new Date(a.time).getTime();
              const timeB = new Date(b.time).getTime();
              return timeA - timeB;
            } catch (error) {
              return 0;
            }
          });

        setLatencyChartData(chartData);
      }
    } catch (error) {
      console.error("Error processing latency metrics:", error);
      setLatencyChartData([]);
    }
  }, [latencyMetricsCloud]);

  // Process time to first token metrics data for the chart
  React.useEffect(() => {
    try {
      if (
        timeToFirstTokenMetrics?.metrics?.time_to_first_token?.values &&
        Array.isArray(
          timeToFirstTokenMetrics.metrics.time_to_first_token.values
        )
      ) {
        const values =
          timeToFirstTokenMetrics.metrics.time_to_first_token.values;
        const chartData = values
          .map((item) => {
            // Check if item is an object with timestamp and value properties
            if (
              typeof item === "object" &&
              item !== null &&
              "timestamp" in item &&
              "value" in item
            ) {
              return {
                time: new Date(
                  Number((item as any).timestamp) * 1000
                ).toLocaleTimeString(),
                ttft: parseFloat(String((item as any).value)) * 1000, // Convert to ms
              };
            }
            // Check if item is an array with two elements
            else if (Array.isArray(item) && item.length >= 2) {
              return {
                time: new Date(Number(item[0]) * 1000).toLocaleTimeString(),
                ttft: parseFloat(String(item[1])) * 1000, // Convert to ms
              };
            }
            return null;
          })
          .filter(
            (item): item is { time: string; ttft: number } => item !== null
          );

        setTimeToFirstTokenChartData(chartData);
      }
    } catch (error) {
      console.error("Error processing time to first token metrics:", error);
      setTimeToFirstTokenChartData([]);
    }
  }, [timeToFirstTokenMetrics]);

  // Check if the model is ready when the chat tab is activated
  React.useEffect(() => {
    if (
      activeTab === "chat" &&
      deployment &&
      !isModelReady &&
      !isCheckingDeployment &&
      !connectionError
    ) {
      checkModelReadiness();
    }
  }, [
    activeTab,
    deployment,
    isModelReady,
    isCheckingDeployment,
    connectionError,
  ]);

  // Check if the model is ready for chat
  const checkModelReadiness = async () => {
    if (!deployment || isCheckingDeployment || !id) return;

    try {
      checkDeploymentReady(id, {
        onSuccess: (data) => {
          setIsModelReady(true);
          setModelServiceUrl(data.serviceUrl);
          setConnectionError(null);
          console.log(`Model is ready with service URL: ${data.serviceUrl}`);
        },
        onError: (error: Error) => {
          setConnectionError(error.message);
          console.error("Error checking model readiness:", error);
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        setConnectionError(error.message);
      } else {
        setConnectionError("An unknown error occurred");
      }
      console.error("Error checking model readiness:", error);
    }
  };

  // Handle sending a message to the LLM
  const handleSendMessage = async () => {
    if (!userMessage.trim() || isSending || !isModelReady) return;

    setIsSending(true);

    // Add user message to chat
    const newMessage: ChatMessage = { role: "user", content: userMessage };
    setChatMessages((prev) => [...prev, newMessage]);
    setUserMessage("");

    try {
      // Send the message to the deployed LLM
      const typedMessages: ChatMessage[] = chatMessages.map((msg) => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
      }));

      const allMessages: ChatMessage[] = [...typedMessages, newMessage];

      if (!id) {
        throw new Error("Deployment ID is required");
      }

      sendChatToLLM(
        {
          deploymentId: id,
          messages: allMessages,
          options: {
            max_tokens: 1000,
            temperature: 0.7,
          },
        },
        {
          onSuccess: (response) => {
            // Add the LLM's response to the chat
            if (response.choices && response.choices.length > 0) {
              const assistantMessage = response.choices[0].message;
              setChatMessages((prev) => [...prev, assistantMessage]);
            }
            setIsSending(false);
          },
          onError: (error) => {
            console.error("Error sending message to LLM:", error);
            // Add an error message to the chat
            setChatMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `Error: Failed to get a response from the model. ${error.message}`,
              },
            ]);
            setIsSending(false);
          },
        }
      );
    } catch (error) {
      console.error("Error sending message:", error);
      // Add an error message to the chat
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Error: Failed to send message to the model.",
        },
      ]);
      setIsSending(false);
    }
  };

  // Setup WebSocket for real-time logs
  React.useEffect(() => {
    if (!id || !isStreamingLogs) return;

    // Create WebSocket connection for log streaming with vLLM pod type
    const ws = new WebSocket(`ws://localhost:8000/ws/logs/${id}?pod_type=vllm`);

    // Connection opened
    ws.addEventListener("open", (event) => {
      console.log("WebSocket connection opened");
    });

    // Listen for messages
    ws.addEventListener("message", (event) => {
      try {
        const logEntry = JSON.parse(event.data);
        setLogMessages((prev) => [...prev, logEntry.log]);

        // Auto-scroll to bottom when new logs arrive
        if (logsEndRef.current) {
          logsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      } catch (err) {
        console.error("Error parsing log message:", err);
      }
    });

    // Connection closed
    ws.addEventListener("close", (event) => {
      console.log("WebSocket connection closed");
      setIsStreamingLogs(false);
    });

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, [id, isStreamingLogs]); // Added isStreamingLogs to dependencies

  // Handle refresh deployment status
  const handleRefreshStatus = () => {
    if (!id) return;
    refreshDeployment(id);
  };

  // Handle delete deployment
  const handleDeleteDeployment = () => {
    if (
      !id ||
      !window.confirm("Are you sure you want to delete this deployment?")
    )
      return;
    deleteDeployment(id);
    window.location.href = "/deployments";
  };

  // Redirect if no ID
  if (!id) {
    window.location.href = "/deployments";
    return <div>Redirecting...</div>;
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-white">Loading deployment details...</p>
        </div>
      </div>
    );
  }

  // Show error state with retry button
  if (error) {
    return (
      <div className="py-8 max-w-3xl mx-auto text-center bg-gray-900 text-white min-h-screen">
        <div className="text-red-500 mb-4">
          {(error as Error).message || "Failed to load deployment details"}
        </div>
        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={() => refetch()}>
            Try Again
          </Button>
          <Button
            variant="secondary"
            onClick={() => (window.location.href = "/deployments")}
          >
            Back to Deployments
          </Button>
        </div>
      </div>
    );
  }

  // Show not found state
  if (!deployment) {
    return (
      <div className="py-8 max-w-3xl mx-auto text-center bg-gray-900 text-white min-h-screen">
        <h2 className="text-xl font-bold mb-4">Deployment Not Found</h2>
        <p className="text-gray-400 mb-6">
          The deployment you're looking for could not be found.
        </p>
        <Button onClick={() => (window.location.href = "/deployments")}>
          Back to Deployments
        </Button>
      </div>
    );
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  // Main content with deployment details
  return (
    <div className="p-6 max-w-6xl mx-auto  text-white min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{deployment.name}</h1>
          <p className="text-gray-400">
            Namespace: {deployment.namespace} | Created:{" "}
            {formatDate(deployment.created_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshStatus}
            disabled={isRefreshing}
          >
            <RefreshIcon />
            {isRefreshing ? "Refreshing..." : "Refresh Status"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteDeployment}
            disabled={isDeleting}
          >
            <DeleteIcon />
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-6">
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === "details"
              ? "text-blue-500 border-b-2 border-blue-500"
              : "text-gray-400 hover:text-gray-300"
          }`}
          onClick={() => setActiveTab("details")}
        >
          Deployment Details
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === "chat"
              ? "text-blue-500 border-b-2 border-blue-500"
              : "text-gray-400 hover:text-gray-300"
          }`}
          onClick={() => setActiveTab("chat")}
        >
          Chat with Model
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === "analytics"
              ? "text-blue-500 border-b-2 border-blue-500"
              : "text-gray-400 hover:text-gray-300"
          }`}
          onClick={() => setActiveTab("analytics")}
        >
          Analytics
        </button>
      </div>

      {activeTab === "analytics" && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Deployment Analytics</h3>

            {/* Time interval selector */}
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

          {/* Token Usage Chart */}
          <div className="mb-8">
            <h4 className="text-md font-medium mb-2">Token Usage</h4>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
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
                  Shows input (prompt) and output (generation) tokens processed
                  by this deployment over time
                </p>
              </div>
            </div>
          </div>

          {/* Token Throughput Chart */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700 mt-6">
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
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700 mt-6">
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
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700 mt-6">
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

          {/* Other metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <h4 className="text-md font-medium mb-2">GPU Utilization</h4>
              <p className="text-gray-400">Coming soon</p>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <h4 className="text-md font-medium mb-2">Memory Usage</h4>
              <p className="text-gray-400">Coming soon</p>
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

      {activeTab === "details" && (
        // Details tab content
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-800 shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4 text-white">
                Deployment Status
              </h2>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      deployment.status === "deployed"
                        ? "bg-green-500"
                        : "bg-yellow-500"
                    }`}
                  ></div>
                  <span className="font-medium text-white">
                    {deployment.status}
                  </span>
                </div>
                <dl className="space-y-2">
                  <div className="grid grid-cols-3 gap-1">
                    <dt className="text-gray-500">ID:</dt>
                    <dd className="col-span-2 font-mono text-sm text-gray-300">
                      {deployment.deployment_id}
                    </dd>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <dt className="text-gray-500">Model:</dt>
                    <dd className="col-span-2 text-gray-300">
                      {deployment.model}
                    </dd>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <dt className="text-gray-500">Health:</dt>
                    <dd className="col-span-2 text-gray-300">
                      {deployment.health_status || "Unknown"}
                    </dd>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <dt className="text-gray-500">Ready:</dt>
                    <dd className="col-span-2 text-gray-300">
                      {deployment.ready ? "Yes" : "No"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="bg-gray-800 shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4 text-white">
                Deployment Configuration
              </h2>
              <dl className="space-y-2">
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-gray-500">Name:</dt>
                  <dd className="col-span-2 text-gray-300">
                    {deployment.name}
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-gray-500">Namespace:</dt>
                  <dd className="col-span-2 text-gray-300">
                    {deployment.namespace}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Code Snippet Section */}
          <div className="space-y-2 mb-6">
            <h2 className="text-lg font-semibold text-white">
              API Usage Examples
            </h2>
            <div className="bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-md font-medium mb-3 text-white">
                Completions API
              </h3>
              <div className="bg-gray-900 p-3 rounded-md text-sm font-mono overflow-x-auto">
                <pre className="text-green-400 whitespace-pre-wrap break-all">
                  {`curl -X POST \\
${
  deployment?.external_ip
    ? `http://${deployment.external_ip}`
    : deployment?.public_url || "http://[DEPLOYMENT-IP]"
}/v1/completions \\
-H "Content-Type: application/json" \\
-d '{  
  "model": "${deployment?.model || "deployed-model"}",
  "prompt": "Write a poem about AI",
  "max_tokens": 100,
  "temperature": 0.7
}'`}
                </pre>
                <button
                  className="mt-2 text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded"
                  onClick={() => {
                    const curlCommand = `curl -X POST \\
${
  deployment?.external_ip
    ? `http://${deployment.external_ip}`
    : deployment?.public_url || "http://[DEPLOYMENT-IP]"
}/v1/completions \\
-H "Content-Type: application/json" \\
-d '{  
  "model": "${deployment?.model || "deployed-model"}",
  "prompt": "Write a poem about AI",
  "max_tokens": 100,
  "temperature": 0.7
}'`;
                    navigator.clipboard.writeText(curlCommand);
                    alert("Curl command copied to clipboard!");
                  }}
                >
                  Copy to Clipboard
                </button>
              </div>
            </div>
          </div>

          {/* vLLM Pod Logs Section */}
          <div className="space-y-2">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold text-white">
                vLLM Pod Logs
              </h2>
              <div className="flex space-x-2">
                <button
                  className="px-3 py-1 rounded text-sm bg-gray-600 hover:bg-gray-700 text-white"
                  onClick={() => {
                    refetchLogs();
                  }}
                >
                  Refresh Logs
                </button>
                <button
                  className={`px-3 py-1 rounded text-sm ${
                    isStreamingLogs
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                  onClick={() => {
                    if (!isStreamingLogs) {
                      // Start streaming logs
                      setLogMessages([]);
                      setIsStreamingLogs(true);
                      // Also fetch logs once to populate initial data
                      refetchLogs();
                    } else {
                      // Stop streaming logs
                      setIsStreamingLogs(false);
                    }
                  }}
                >
                  {isStreamingLogs ? "Stop Streaming" : "Start Streaming Logs"}
                </button>
              </div>
            </div>
            <div className="rounded-md border border-gray-700 bg-black text-white p-4 h-96 overflow-y-auto font-mono text-sm">
              {logMessages.length === 0 ? (
                <div className="text-gray-400">
                  {isStreamingLogs
                    ? "Waiting for logs..."
                    : 'Click "Start Streaming Logs" to view vLLM pod logs'}
                </div>
              ) : (
                logMessages.map((entry, index) => (
                  <div key={index} className="whitespace-pre-wrap mb-1">
                    {typeof entry === "string" ? entry : JSON.stringify(entry)}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </>
      )}

      {activeTab === "chat" && (
        // Chat tab content
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div className="p-4 h-96 overflow-y-auto">
              {isCheckingDeployment && (
                <div className="text-center py-2 mb-4">
                  <p className="text-blue-400">
                    Checking if model is ready for chat...
                  </p>
                </div>
              )}

              {connectionError && (
                <div className="text-center py-2 mb-4 bg-red-900 rounded p-2">
                  <p className="text-red-200">
                    Error connecting to model: {connectionError}
                  </p>
                  <button
                    className="mt-2 px-3 py-1 bg-red-700 text-white rounded hover:bg-red-600 text-sm"
                    onClick={checkModelReadiness}
                  >
                    Retry Connection
                  </button>
                </div>
              )}

              {chatMessages.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-gray-400">
                    {isModelReady
                      ? "Send a message to start chatting with the model"
                      : "Checking if model is ready for chat..."}
                  </p>
                  {modelServiceUrl && (
                    <p className="text-gray-500 text-sm mt-2">
                      Connected to: {modelServiceUrl}
                    </p>
                  )}
                </div>
              ) : (
                chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`mb-4 ${
                      msg.role === "user" ? "text-right" : "text-left"
                    }`}
                  >
                    <div
                      className={`inline-block rounded-lg px-4 py-2 max-w-3/4 ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-700 text-gray-200"
                      }`}
                    >
                      <p>{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Chat Input */}
            <div className="border-t border-gray-700 p-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder={
                    isModelReady
                      ? "Type your message..."
                      : "Model not ready yet..."
                  }
                  disabled={!isModelReady || isSending}
                  className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!isModelReady || isSending || !userMessage.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg"
                >
                  {isSending ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-700 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                className="flex-1 bg-gray-700 text-white rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSending || !isModelReady}
                placeholder={
                  isModelReady
                    ? "Type a message..."
                    : "Checking if model is ready..."
                }
              />
              <Button
                onClick={handleSendMessage}
                disabled={isSending || !userMessage.trim() || !isModelReady}
              >
                {isSending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

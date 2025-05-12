import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useDeployments } from "~/lib/api";
import { useClusters } from "../lib/cluster-api";
import { useCloudMetrics } from "../lib/metrics-api";
import {
  Server,
  Activity,
  Cpu,
  BarChart3,
  ArrowUpRight,
  Zap,
  Clock,
  Globe,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Plus,
  Timer,
  MessageSquare,
} from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const [timeInterval] = React.useState<number>(120); // Last 2 hours for metrics

  // Fetch all deployments and clusters
  const { data: deployments = [], isLoading: isLoadingDeployments } =
    useDeployments();
  const { data: clusters = [], isLoading: isLoadingClusters } = useClusters();

  // Aggregate stats
  const totalDeployments = deployments.length;
  const totalClusters = clusters.length;
  const runningDeployments = deployments.filter(
    (d) => d.status === "deployed" || d.status === "Running"
  ).length;
  const runningClusters = clusters.filter((c) => c.status === "RUNNING").length;
  const pendingDeployments = deployments.filter(
    (d) => d.status === "pending" || d.status === "provisioning"
  ).length;
  const failedDeployments = deployments.filter(
    (d) => d.status === "failed"
  ).length;

  // Calculate uptime percentage for deployments
  const uptimePercentage =
    totalDeployments > 0 ? (runningDeployments / totalDeployments) * 100 : 0;

  // Get overall metrics across all deployments
  // We'll use the first active deployment for demo purposes
  const activeDeployment = React.useMemo(() => {
    return (
      deployments.find(
        (d) =>
          d.status.toLowerCase() === "deployed" ||
          d.status.toLowerCase() === "running"
      ) || null
    );
  }, [deployments]);

  // Fetch metrics with time series data for the active deployment
  const { data: tokenThroughputData } = useCloudMetrics(
    activeDeployment,
    ["token_throughput"],
    true, // Get time series data
    timeInterval // 2 hours of data
  );

  const { data: latencyData } = useCloudMetrics(
    activeDeployment,
    ["e2e_latency"],
    true,
    timeInterval
  );

  const { data: requestsData } = useCloudMetrics(
    activeDeployment,
    ["requests_completed"],
    true,
    timeInterval
  );

  const { data: tokensPerRequestData } = useCloudMetrics(
    activeDeployment,
    ["mean_tokens_per_request"],
    true,
    timeInterval
  );

  // Calculate mean values from time series data
  const overallMetrics = React.useMemo(() => {
    // Function to calculate mean from time series values
    const calculateMean = (metricData: any, metricName: string): number => {
      if (
        !metricData?.metrics?.[metricName]?.values ||
        !Array.isArray(metricData.metrics[metricName].values) ||
        metricData.metrics[metricName].values.length === 0
      ) {
        return 0;
      }

      let sum = 0;
      let count = 0;

      metricData.metrics[metricName].values.forEach((item: any) => {
        try {
          // Handle array format [timestamp, value]
          if (Array.isArray(item)) {
            const value = parseFloat(String(item[1]));
            if (!isNaN(value)) {
              sum += value;
              count++;
            }
          }
          // Handle object format {timestamp, value}
          else if (typeof item === "object" && item !== null) {
            const value = parseFloat(String(item.value));
            if (!isNaN(value)) {
              sum += value;
              count++;
            }
          }
        } catch (error) {
          console.error("Error processing metric data point:", error);
        }
      });

      return count > 0 ? sum / count : 0;
    };

    // For total requests, we want the latest value, not the mean
    const getLatestValue = (metricData: any, metricName: string): number => {
      if (
        !metricData?.metrics?.[metricName]?.values ||
        !Array.isArray(metricData.metrics[metricName].values) ||
        metricData.metrics[metricName].values.length === 0
      ) {
        return 0;
      }

      // Get the latest value (last item in the array)
      const latestItem =
        metricData.metrics[metricName].values[
          metricData.metrics[metricName].values.length - 1
        ];

      try {
        // Handle array format [timestamp, value]
        if (Array.isArray(latestItem)) {
          return parseFloat(String(latestItem[1])) || 0;
        }
        // Handle object format {timestamp, value}
        else if (typeof latestItem === "object" && latestItem !== null) {
          return parseFloat(String(latestItem.value)) || 0;
        }
      } catch (error) {
        console.error("Error processing latest metric value:", error);
      }

      return 0;
    };

    return {
      avgTokenThroughput: calculateMean(
        tokenThroughputData,
        "token_throughput"
      ),
      avgLatency: calculateMean(latencyData, "e2e_latency"),
      totalRequests: getLatestValue(requestsData, "requests_completed"),
      avgTokensPerRequest: calculateMean(
        tokensPerRequestData,
        "mean_tokens_per_request"
      ),
    };
  }, [
    tokenThroughputData,
    latencyData,
    requestsData,
    tokensPerRequestData,
    timeInterval,
  ]);

  // Recent activity (last 5 deployments)
  const recentDeployments = deployments
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 5);

  const recentClusters = clusters
    .sort(
      (a, b) =>
        new Date(b.created_at || "").getTime() -
        new Date(a.created_at || "").getTime()
    )
    .slice(0, 5);

  // Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-gray-800 via-gray-900 to-black">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                <p className="text-gray-400">
                  Overview of your vLLM deployments and infrastructure
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <span onClick={() => navigate("/deployments/new")}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Deployment
                </span>
              </Button>
              <Button
                asChild
                variant="outline"
                className="bg-gray-800/50 border-gray-600 hover:bg-gray-700 text-white"
              >
                <span onClick={() => navigate("/clusters/new")}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Cluster
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 max-w-7xl mx-auto">
        {/* Infrastructure Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Total Deployments */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">
                  Total Deployments
                </p>
                <p className="text-3xl font-bold text-white mt-2">
                  {totalDeployments}
                </p>
                <div className="flex items-center space-x-4 mt-2">
                  <span className="text-green-400 text-sm">
                    <CheckCircle2 className="w-3 h-3 inline mr-1" />
                    {runningDeployments} running
                  </span>
                  {pendingDeployments > 0 && (
                    <span className="text-yellow-400 text-sm">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {pendingDeployments} pending
                    </span>
                  )}
                  {failedDeployments > 0 && (
                    <span className="text-red-400 text-sm">
                      <AlertCircle className="w-3 h-3 inline mr-1" />
                      {failedDeployments} failed
                    </span>
                  )}
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <Server className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          {/* Total Clusters */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">
                  Total Clusters
                </p>
                <p className="text-3xl font-bold text-white mt-2">
                  {totalClusters}
                </p>
                <div className="flex items-center mt-2">
                  <span className="text-green-400 text-sm">
                    <CheckCircle2 className="w-3 h-3 inline mr-1" />
                    {runningClusters} active
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center">
                <Cpu className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>

          {/* Overall Uptime */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">
                  Overall Uptime
                </p>
                <p className="text-3xl font-bold text-white mt-2">
                  {uptimePercentage.toFixed(1)}%
                </p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
                  <span className="text-green-400 text-sm">
                    {runningDeployments}/{totalDeployments} operational
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>

          {/* Cost (placeholder) */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">
                  Estimated Cost
                </p>
                <p className="text-3xl font-bold text-white mt-2">$--</p>
                <div className="flex items-center mt-2">
                  <span className="text-gray-400 text-sm">This month</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-orange-600/20 rounded-lg flex items-center justify-center">
                <Globe className="w-6 h-6 text-orange-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Average Token Throughput */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">
                  Avg Token Throughput
                </p>
                <p className="text-2xl font-bold text-white mt-2">
                  {overallMetrics.avgTokenThroughput > 0
                    ? Math.round(
                        overallMetrics.avgTokenThroughput
                      ).toLocaleString()
                    : "--"}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  tokens/second (2h avg)
                </p>
              </div>
              <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-green-400" />
              </div>
            </div>
          </div>

          {/* Average Latency */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">
                  Avg E2E Latency
                </p>
                <p className="text-2xl font-bold text-white mt-2">
                  {overallMetrics.avgLatency > 0
                    ? overallMetrics.avgLatency.toFixed(2)
                    : "--"}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  milliseconds (2h avg)
                </p>
              </div>
              <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <Timer className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </div>

          {/* Total Requests */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">
                  Total Requests
                </p>
                <p className="text-2xl font-bold text-white mt-2">
                  {overallMetrics.totalRequests > 0
                    ? Math.round(overallMetrics.totalRequests).toLocaleString()
                    : "--"}
                </p>
                <p className="text-gray-500 text-xs mt-1">processed</p>
              </div>
              <div className="w-10 h-10 bg-orange-600/20 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-orange-400" />
              </div>
            </div>
          </div>

          {/* Average Tokens per Request */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">
                  Avg Tokens/Request
                </p>
                <p className="text-2xl font-bold text-white mt-2">
                  {overallMetrics.avgTokensPerRequest > 0
                    ? Math.round(
                        overallMetrics.avgTokensPerRequest
                      ).toLocaleString()
                    : "--"}
                </p>
                <p className="text-gray-500 text-xs mt-1">tokens (2h avg)</p>
              </div>
              <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Deployments */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Recent Deployments
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/deployments")}
                className="text-blue-400 hover:text-blue-300"
              >
                View All
                <ArrowUpRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            {recentDeployments.length > 0 ? (
              <div className="space-y-3">
                {recentDeployments.map((deployment) => (
                  <div
                    key={deployment.deployment_id || deployment.id}
                    className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors"
                    onClick={() =>
                      navigate(
                        `/deployments/${
                          deployment.deployment_id || deployment.id
                        }`
                      )
                    }
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          deployment.status === "deployed" ||
                          deployment.status === "running"
                            ? "bg-green-500"
                            : deployment.status === "pending"
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                      ></div>
                      <div>
                        <p className="font-medium text-white">
                          {deployment.name}
                        </p>
                        <p className="text-sm text-gray-400">
                          {deployment.model || "Unknown model"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">
                        {formatDate(deployment.created_at)}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">
                        {deployment.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400">No deployments yet</p>
                <Button
                  size="sm"
                  onClick={() => navigate("/deployments/new")}
                  className="mt-2"
                >
                  Create First Deployment
                </Button>
              </div>
            )}
          </div>

          {/* Recent Clusters */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Recent Clusters
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/clusters")}
                className="text-blue-400 hover:text-blue-300"
              >
                View All
                <ArrowUpRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            {recentClusters.length > 0 ? (
              <div className="space-y-3">
                {recentClusters.map((cluster) => (
                  <div
                    key={cluster.cluster_id}
                    className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors"
                    onClick={() => navigate(`/clusters/${cluster.cluster_id}`)}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          cluster.status === "RUNNING"
                            ? "bg-green-500"
                            : cluster.status === "CREATING"
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                      ></div>
                      <div>
                        <p className="font-medium text-white">
                          {cluster.cluster_name}
                        </p>
                        <p className="text-sm text-gray-400">{cluster.zone}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">
                        {cluster.created_at
                          ? formatDate(cluster.created_at)
                          : "N/A"}
                      </p>
                      <p className="text-xs text-gray-500">{cluster.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400">No clusters yet</p>
                <Button
                  size="sm"
                  onClick={() => navigate("/clusters/new")}
                  className="mt-2"
                >
                  Create First Cluster
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Button
              onClick={() => navigate("/deployments/new")}
              className="bg-blue-600 hover:bg-blue-700 flex items-center justify-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Deployment</span>
            </Button>
            <Button
              onClick={() => navigate("/clusters/new")}
              variant="outline"
              className="border-green-600 text-green-400 hover:bg-green-600/10 flex items-center justify-center space-x-2"
            >
              <Cpu className="w-4 h-4" />
              <span>New Cluster</span>
            </Button>
            <Button
              onClick={() => navigate("/analytics")}
              variant="outline"
              className="border-purple-600 text-purple-400 hover:bg-purple-600/10 flex items-center justify-center space-x-2"
            >
              <BarChart3 className="w-4 h-4" />
              <span>View Analytics</span>
            </Button>
            <Button
              onClick={() => navigate("/logs")}
              variant="outline"
              className="border-orange-600 text-orange-400 hover:bg-orange-600/10 flex items-center justify-center space-x-2"
            >
              <Activity className="w-4 h-4" />
              <span>View Logs</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

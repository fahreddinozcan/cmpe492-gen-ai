"use client"

import { useState } from "react"
import { AlertTriangle, Calendar, Download, Filter, Info, RefreshCw, Search, XCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts"

interface LogEntry {
  id: string
  timestamp: string
  level: "info" | "warning" | "error"
  source: string
  message: string
}

const logEntries: LogEntry[] = [
  {
    id: "log-1",
    timestamp: "2024-03-20 14:32:45",
    level: "info",
    source: "llama3-8b-prod",
    message: "Deployment scaled to 3 replicas",
  },
  {
    id: "log-2",
    timestamp: "2024-03-20 14:30:12",
    level: "info",
    source: "mistral-7b-prod",
    message: "Health check passed successfully",
  },
  {
    id: "log-3",
    timestamp: "2024-03-20 14:28:55",
    level: "warning",
    source: "llama3-70b-prod",
    message: "High memory usage detected (98%)",
  },
  {
    id: "log-4",
    timestamp: "2024-03-20 14:25:30",
    level: "info",
    source: "gemma-7b-staging",
    message: "Model loaded successfully",
  },
  {
    id: "log-5",
    timestamp: "2024-03-20 14:22:18",
    level: "error",
    source: "llama3-70b-prod",
    message: "Out of memory error in worker-2",
  },
  {
    id: "log-6",
    timestamp: "2024-03-20 14:20:05",
    level: "info",
    source: "vllm-controller",
    message: "Starting health check for all deployments",
  },
  {
    id: "log-7",
    timestamp: "2024-03-20 14:18:42",
    level: "warning",
    source: "mistral-7b-prod",
    message: "Slow response time detected (>500ms)",
  },
  {
    id: "log-8",
    timestamp: "2024-03-20 14:15:30",
    level: "info",
    source: "ray-cluster",
    message: "New worker node joined the cluster",
  },
  {
    id: "log-9",
    timestamp: "2024-03-20 14:12:22",
    level: "error",
    source: "mistral-7b-dev",
    message: "Failed to initialize model: CUDA error",
  },
  {
    id: "log-10",
    timestamp: "2024-03-20 14:10:15",
    level: "info",
    source: "vllm-controller",
    message: "Starting new deployment: mistral-7b-dev",
  },
  {
    id: "log-11",
    timestamp: "2024-03-20 14:08:03",
    level: "info",
    source: "llama3-8b-prod",
    message: "Processing batch request (size: 32)",
  },
  {
    id: "log-12",
    timestamp: "2024-03-20 14:05:55",
    level: "warning",
    source: "gpu-node-3",
    message: "Temperature threshold approaching (78°C)",
  },
  {
    id: "log-13",
    timestamp: "2024-03-20 14:03:42",
    level: "info",
    source: "vllm-controller",
    message: "Autoscaling triggered for llama3-8b-prod",
  },
  {
    id: "log-14",
    timestamp: "2024-03-20 14:01:30",
    level: "error",
    source: "llama3-70b-prod",
    message: "Request timeout after 30s",
  },
  {
    id: "log-15",
    timestamp: "2024-03-20 14:00:18",
    level: "info",
    source: "monitoring-service",
    message: "Collecting metrics from all deployments",
  },
]

export function LogsView() {
  const [searchQuery, setSearchQuery] = useState("")
  const [levelFilter, setLevelFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [timeRange, setTimeRange] = useState("24h")

  const filteredLogs = logEntries.filter((log) => {
    const matchesSearch =
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.source.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesLevel = levelFilter === "all" || log.level === levelFilter

    const matchesSource = sourceFilter === "all" || log.source === sourceFilter

    return matchesSearch && matchesLevel && matchesSource
  })

  const getLevelBadge = (level: LogEntry["level"]) => {
    switch (level) {
      case "info":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
            INFO
          </Badge>
        )
      case "warning":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500">
            WARNING
          </Badge>
        )
      case "error":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-500">
            ERROR
          </Badge>
        )
      default:
        return null
    }
  }

  const getLevelIcon = (level: LogEntry["level"]) => {
    switch (level) {
      case "info":
        return <Info className="h-4 w-4 text-blue-500" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  const uniqueSources = Array.from(new Set(logEntries.map((log) => log.source)))

  // Calculate log level statistics
  const logLevelStats = logEntries.reduce((acc, log) => {
    acc[log.level] = (acc[log.level] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const logLevelData = Object.entries(logLevelStats).map(([name, value]) => ({
    name,
    value,
  }))

  // Calculate source statistics
  const sourceStats = logEntries.reduce((acc, log) => {
    acc[log.source] = (acc[log.source] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const sourceData = Object.entries(sourceStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({
      name,
      value,
    }))

  // Generate time-based statistics (last 24 hours in 2-hour intervals)
  const now = new Date("2024-03-20 14:32:45").getTime() // Using the latest log timestamp
  const timeData = Array.from({ length: 12 }, (_, i) => {
    const timeSlot = new Date(now - (11 - i) * 2 * 60 * 60 * 1000)
    const count = logEntries.filter(log => {
      const logTime = new Date(log.timestamp).getTime()
      return logTime >= timeSlot.getTime() && logTime < timeSlot.getTime() + 2 * 60 * 60 * 1000
    }).length
    return {
      time: timeSlot.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      count,
    }
  })

  const LEVEL_COLORS = {
    info: "#3b82f6",    // blue-500
    warning: "#f59e0b", // amber-500
    error: "#ef4444",   // red-500
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
        <p className="text-muted-foreground">View and analyze system and deployment logs</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search logs..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-[130px]">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <SelectValue placeholder="Log Level" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[180px]">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <SelectValue placeholder="Source" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {uniqueSources.map((source) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last hour</SelectItem>
              <SelectItem value="6h">Last 6 hours</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>

          {timeRange === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <Calendar className="mr-2 h-4 w-4" />
                  Date Range
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                {/* Date picker would go here */}
                <div className="p-4">
                  <p>Date picker placeholder</p>
                </div>
              </PopoverContent>
            </Popover>
          )}

          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-xl">Log Explorer</CardTitle>
          <CardDescription>
            Showing {filteredLogs.length} of {logEntries.length} log entries
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <div className="grid grid-cols-12 gap-4 border-b bg-muted/50 p-4 font-medium">
              <div className="col-span-2">Timestamp</div>
              <div className="col-span-1">Level</div>
              <div className="col-span-2">Source</div>
              <div className="col-span-7">Message</div>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">No logs found matching your criteria</div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="grid grid-cols-12 gap-4 border-b p-4 items-center">
                  <div className="col-span-2 text-sm text-muted-foreground">{log.timestamp}</div>
                  <div className="col-span-1 flex items-center">
                    <div className="flex items-center gap-1">
                      {getLevelIcon(log.level)}
                      <span className="sr-only">{log.level}</span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Badge variant="outline">{log.source}</Badge>
                  </div>
                  <div className="col-span-7 font-mono text-sm">{log.message}</div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Log Statistics</CardTitle>
          <CardDescription>Summary of log activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-sm font-medium">Log Levels</div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={logLevelData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      innerRadius={30}
                      paddingAngle={2}
                    >
                      {logLevelData.map((entry) => (
                        <Cell 
                          key={entry.name} 
                          fill={LEVEL_COLORS[entry.name as keyof typeof LEVEL_COLORS]}
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        `${value} logs`,
                        name.charAt(0).toUpperCase() + name.slice(1)
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 text-sm">
                {logLevelData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ 
                        backgroundColor: LEVEL_COLORS[entry.name as keyof typeof LEVEL_COLORS]
                      }} 
                    />
                    <span className="capitalize">{entry.name}</span>
                    <span className="text-muted-foreground">({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Top Sources</div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sourceData} layout="vertical">
                    <XAxis type="number" />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={100}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip />
                    <Bar 
                      dataKey="value" 
                      fill="#6366f1"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Log Volume Over Time</div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeData}>
                    <XAxis 
                      dataKey="time"
                      tick={{ fontSize: 12 }}
                      interval={1}
                      angle={-45}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={{ fill: "#6366f1" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

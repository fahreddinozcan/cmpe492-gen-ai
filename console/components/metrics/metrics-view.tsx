"use client"

import { useState } from "react"
import { Calendar, Download, RefreshCw, Cpu, HardDrive, Clock, Users, ArrowUp, ArrowDown, Server } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// Mock data for charts
const performanceData = [
  { time: "00:00", responseTime: 150, throughput: 50 },
  { time: "04:00", responseTime: 230, throughput: 45 },
  { time: "08:00", responseTime: 380, throughput: 120 },
  { time: "12:00", responseTime: 420, throughput: 160 },
  { time: "16:00", responseTime: 280, throughput: 180 },
  { time: "20:00", responseTime: 190, throughput: 140 },
]

const resourceData = [
  { time: "00:00", memoryUsage: 45, gpuUtilization: 40 },
  { time: "04:00", memoryUsage: 52, gpuUtilization: 48 },
  { time: "08:00", memoryUsage: 78, gpuUtilization: 82 },
  { time: "12:00", memoryUsage: 85, gpuUtilization: 88 },
  { time: "16:00", memoryUsage: 72, gpuUtilization: 75 },
  { time: "20:00", memoryUsage: 65, gpuUtilization: 60 },
]

const requestData = [
  { name: "Success", value: 85, fill: "rgb(16, 185, 129)" },
  { name: "Error", value: 10, fill: "rgb(239, 68, 68)" },
  { name: "Timeout", value: 5, fill: "rgb(234, 179, 8)" }
]

export function MetricsView() {
  const [timeRange, setTimeRange] = useState("24h")
  const [deployment, setDeployment] = useState("all")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Metrics</h1>
        <p className="text-muted-foreground">Monitor performance and resource utilization</p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-2">
          <Select value={deployment} onValueChange={setDeployment}>
            <SelectTrigger className="w-[180px]">
              <Server className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Select Deployment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Deployments</SelectItem>
              <SelectItem value="llama-7b">llama-7b</SelectItem>
              <SelectItem value="mistral-7b">mistral-7b</SelectItem>
            </SelectContent>
          </Select>

          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <Clock className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">52,834</div>
            <p className="text-xs text-muted-foreground">
              <ArrowUp className="inline h-4 w-4 text-green-500" /> +12% from last period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">275ms</div>
            <p className="text-xs text-muted-foreground">
              <ArrowDown className="inline h-4 w-4 text-green-500" /> -8% from last period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">GPU Memory Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">72%</div>
            <p className="text-xs text-muted-foreground">
              <ArrowUp className="inline h-4 w-4 text-yellow-500" /> +5% from last period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">GPU Utilization</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">68%</div>
            <p className="text-xs text-muted-foreground">
              <ArrowUp className="inline h-4 w-4 text-yellow-500" /> +3% from last period
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>Response time and throughput over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="responseTime"
                    name="Response Time (ms)"
                    stroke="rgb(59, 130, 246)"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="throughput"
                    name="Throughput (req/s)"
                    stroke="rgb(16, 185, 129)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Resource Usage</CardTitle>
            <CardDescription>GPU memory and utilization over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={resourceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="memoryUsage"
                    name="GPU Memory Usage (%)"
                    stroke="rgb(249, 115, 22)"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="gpuUtilization"
                    name="GPU Utilization (%)"
                    stroke="rgb(168, 85, 247)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Request Distribution</CardTitle>
            <CardDescription>Success vs error rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={requestData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" name="Requests" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Model Performance</CardTitle>
            <CardDescription>Performance metrics by model</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">llama-7b</p>
                  <div className="text-xs text-muted-foreground">Avg. Response Time: 245ms</div>
                </div>
                <div className="text-sm text-green-500">98.5% Success</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">mistral-7b</p>
                  <div className="text-xs text-muted-foreground">Avg. Response Time: 280ms</div>
                </div>
                <div className="text-sm text-green-500">97.8% Success</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">llama-7b-q4</p>
                  <div className="text-xs text-muted-foreground">Avg. Response Time: 210ms</div>
                </div>
                <div className="text-sm text-green-500">99.1% Success</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

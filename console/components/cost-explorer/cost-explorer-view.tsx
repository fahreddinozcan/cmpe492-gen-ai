"use client"

import { useState } from "react"
import { Calendar, Download, PieChart, RefreshCw } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell } from 'recharts'

const mockCostData = [
  { date: '2024-03-01', cost: 120 },
  { date: '2024-03-02', cost: 132 },
  { date: '2024-03-03', cost: 145 },
  { date: '2024-03-04', cost: 155 },
  { date: '2024-03-05', cost: 148 },
  { date: '2024-03-06', cost: 138 },
  { date: '2024-03-07', cost: 142 },
  { date: '2024-03-08', cost: 152 },
  { date: '2024-03-09', cost: 161 },
  { date: '2024-03-10', cost: 168 },
  { date: '2024-03-11', cost: 172 },
  { date: '2024-03-12', cost: 169 },
  { date: '2024-03-13', cost: 178 },
  { date: '2024-03-14', cost: 185 },
]

const mockPieData = [
  { name: 'GPUs', value: 2500 },
  { name: 'Storage', value: 800 },
  { name: 'Network', value: 600 },
  { name: 'Other', value: 385.72 },
]

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

export function CostExplorerView() {
  const [timeRange, setTimeRange] = useState("30d")
  const [groupBy, setGroupBy] = useState("deployment")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Cost Explorer</h1>
        <p className="text-muted-foreground">Analyze and optimize your resource costs</p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="deployments">By Deployment</TabsTrigger>
            <TabsTrigger value="resources">By Resource</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-2">
          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger className="w-[180px]">
              <div className="flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                <SelectValue placeholder="Group by" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deployment">By Deployment</SelectItem>
              <SelectItem value="model">By Model</SelectItem>
              <SelectItem value="resource">By Resource Type</SelectItem>
              <SelectItem value="node">By Node</SelectItem>
            </SelectContent>
          </Select>

          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="ytd">Year to date</SelectItem>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$4,285.72</div>
            <p className="text-xs text-muted-foreground">+$842.30 from previous period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">GPU Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$2,500.00</div>
            <p className="text-xs text-muted-foreground">58.3% of total cost</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Storage Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$800.00</div>
            <p className="text-xs text-muted-foreground">18.7% of total cost</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Network Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$600.00</div>
            <p className="text-xs text-muted-foreground">14% of total cost</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cost Over Time</CardTitle>
            <CardDescription>Daily cost breakdown for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockCostData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                    dx={-10}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                    formatter={(value) => [`$${value}`, 'Cost']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="cost" 
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#costGradient)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost Distribution</CardTitle>
            <CardDescription>Breakdown by resource type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex flex-col">
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={mockPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {mockPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                {mockPieData.map((entry, index) => (
                  <div key={entry.name} className="flex flex-col items-center gap-1">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                    <span className="text-xs text-muted-foreground">{entry.name}</span>
                    <span className="text-xs font-medium">${entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

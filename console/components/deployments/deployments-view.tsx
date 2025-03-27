"use client"

import { useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Deployment {
  id: string
  name: string
  model: string
  status: "running" | "warning" | "error" | "pending"
  replicas: number
  created: string
  lastUpdated: string
  resourceUsage: {
    cpu: string
    memory: string
    gpu: string
  }
}

const deployments: Deployment[] = [
  {
    id: "dep-1",
    name: "llama3-8b-prod",
    model: "llama3-8b",
    status: "running",
    replicas: 3,
    created: "2023-12-15",
    lastUpdated: "2024-03-10",
    resourceUsage: {
      cpu: "12 cores",
      memory: "24GB",
      gpu: "3x A100",
    },
  },
  {
    id: "dep-2",
    name: "mistral-7b-prod",
    model: "mistral-7b",
    status: "running",
    replicas: 2,
    created: "2024-01-05",
    lastUpdated: "2024-03-15",
    resourceUsage: {
      cpu: "8 cores",
      memory: "16GB",
      gpu: "2x A100",
    },
  },
  {
    id: "dep-3",
    name: "llama3-70b-prod",
    model: "llama3-70b",
    status: "warning",
    replicas: 4,
    created: "2024-02-20",
    lastUpdated: "2024-03-18",
    resourceUsage: {
      cpu: "16 cores",
      memory: "32GB",
      gpu: "4x A100",
    },
  },
  {
    id: "dep-4",
    name: "gemma-7b-staging",
    model: "gemma-7b",
    status: "running",
    replicas: 1,
    created: "2024-03-01",
    lastUpdated: "2024-03-01",
    resourceUsage: {
      cpu: "4 cores",
      memory: "8GB",
      gpu: "1x A100",
    },
  },
  {
    id: "dep-5",
    name: "llama3-8b-staging",
    model: "llama3-8b",
    status: "running",
    replicas: 1,
    created: "2024-03-05",
    lastUpdated: "2024-03-05",
    resourceUsage: {
      cpu: "4 cores",
      memory: "8GB",
      gpu: "1x A100",
    },
  },
  {
    id: "dep-6",
    name: "mistral-7b-dev",
    model: "mistral-7b",
    status: "pending",
    replicas: 1,
    created: "2024-03-20",
    lastUpdated: "2024-03-20",
    resourceUsage: {
      cpu: "4 cores",
      memory: "8GB",
      gpu: "1x A100",
    },
  },
]

export function DeploymentsView() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const filteredDeployments = deployments.filter((deployment) => {
    const matchesSearch =
      deployment.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deployment.model.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || deployment.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: Deployment["status"]) => {
    switch (status) {
      case "running":
        return <Badge className="bg-green-500">Running</Badge>
      case "warning":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500">
            Warning
          </Badge>
        )
      case "error":
        return <Badge variant="destructive">Error</Badge>
      case "pending":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
            Pending
          </Badge>
        )
      default:
        return null
    }
  }

  const getStatusIcon = (status: Deployment["status"]) => {
    switch (status) {
      case "running":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-500" />
      case "error":
        return <AlertTriangle className="h-5 w-5 text-red-500" />
      case "pending":
        return <Clock className="h-5 w-5 text-blue-500" />
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Deployments</h1>
          <p className="text-muted-foreground">Manage your vLLM model deployments</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search deployments..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Deployment
        </Button>
        <Button variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-xl">Deployments</CardTitle>
          <CardDescription>
            Showing {filteredDeployments.length} of {deployments.length} deployments
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <div className="grid grid-cols-12 gap-4 border-b bg-muted/50 p-4 font-medium">
              <div className="col-span-4">Name</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Replicas</div>
              <div className="col-span-3">Resources</div>
              <div className="col-span-1"></div>
            </div>

            {filteredDeployments.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No deployments found matching your criteria
              </div>
            ) : (
              filteredDeployments.map((deployment) => (
                <div key={deployment.id} className="grid grid-cols-12 gap-4 border-b p-4 items-center">
                  <div className="col-span-4">
                    <div className="font-medium">{deployment.name}</div>
                    <div className="text-sm text-muted-foreground">Model: {deployment.model}</div>
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    {getStatusIcon(deployment.status)}
                    <span>{getStatusBadge(deployment.status)}</span>
                  </div>
                  <div className="col-span-2">
                    {deployment.replicas} {deployment.replicas === 1 ? "replica" : "replicas"}
                  </div>
                  <div className="col-span-3">
                    <div className="text-sm">
                      <div>CPU: {deployment.resourceUsage.cpu}</div>
                      <div>Memory: {deployment.resourceUsage.memory}</div>
                      <div>GPU: {deployment.resourceUsage.gpu}</div>
                    </div>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Edit Configuration</DropdownMenuItem>
                        <DropdownMenuItem>Scale Replicas</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-500">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Deployment
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

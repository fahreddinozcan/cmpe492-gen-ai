"use client"

import type React from "react"

import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Info,
  Layers,
  RefreshCw,
  Server,
  Settings,
  Upload,
  User,
} from "lucide-react"

interface ActivityItem {
  id: string
  icon: React.ElementType
  iconColor: string
  title: string
  description: string
  time: string
  user: string
}

const activityData: ActivityItem[] = [
  {
    id: "act-1",
    icon: Upload,
    iconColor: "text-blue-500",
    title: "Model Deployed",
    description: "llama3-8b model deployed successfully",
    time: "10 minutes ago",
    user: "admin@example.com",
  },
  {
    id: "act-2",
    icon: Settings,
    iconColor: "text-purple-500",
    title: "Configuration Updated",
    description: "Updated tensor parallelism settings for mistral-7b",
    time: "45 minutes ago",
    user: "devops@example.com",
  },
  {
    id: "act-3",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    title: "Warning Alert",
    description: "High memory usage detected on llama3-70b deployment",
    time: "1 hour ago",
    user: "system",
  },
  {
    id: "act-4",
    icon: Server,
    iconColor: "text-green-500",
    title: "Node Added",
    description: "New A100 GPU node added to the cluster",
    time: "3 hours ago",
    user: "admin@example.com",
  },
  {
    id: "act-5",
    icon: RefreshCw,
    iconColor: "text-blue-500",
    title: "Deployment Restarted",
    description: "gemma-7b deployment restarted successfully",
    time: "5 hours ago",
    user: "devops@example.com",
  },
  {
    id: "act-6",
    icon: Database,
    iconColor: "text-purple-500",
    title: "Model Added",
    description: "Added gemma-7b model to the registry",
    time: "8 hours ago",
    user: "ml-engineer@example.com",
  },
  {
    id: "act-7",
    icon: CheckCircle2,
    iconColor: "text-green-500",
    title: "Health Check Passed",
    description: "All deployments passed health checks",
    time: "12 hours ago",
    user: "system",
  },
  {
    id: "act-8",
    icon: Info,
    iconColor: "text-blue-500",
    title: "Maintenance Scheduled",
    description: "Cluster maintenance scheduled for next week",
    time: "1 day ago",
    user: "admin@example.com",
  },
  {
    id: "act-9",
    icon: Layers,
    iconColor: "text-red-500",
    title: "Deployment Deleted",
    description: "Removed deprecated model deployment",
    time: "2 days ago",
    user: "devops@example.com",
  },
  {
    id: "act-10",
    icon: User,
    iconColor: "text-purple-500",
    title: "User Added",
    description: "New user added with developer permissions",
    time: "3 days ago",
    user: "admin@example.com",
  },
]

export function RecentActivity({ extended = false }: { extended?: boolean }) {
  const displayItems = extended ? activityData : activityData.slice(0, 5)

  return (
    <div className="space-y-4">
      {displayItems.map((item) => (
        <div key={item.id} className="flex items-start gap-4 rounded-lg border p-3">
          <div className={`rounded-full p-2 ${item.iconColor} bg-muted`}>
            <item.icon className="h-4 w-4" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{item.title}</p>
              <span className="text-xs text-muted-foreground">{item.time}</span>
            </div>
            <p className="text-sm text-muted-foreground">{item.description}</p>
            <p className="text-xs text-muted-foreground">By: {item.user}</p>
          </div>
        </div>
      ))}
    </div>
  )
}


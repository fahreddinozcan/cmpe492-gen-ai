"use client"

import { useState } from "react"
import { Check, ChevronDown, Server } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const apps = [
  { id: "prod-cluster", name: "Production Cluster" },
  { id: "staging-cluster", name: "Staging Cluster" },
  { id: "dev-cluster", name: "Development Cluster" },
  { id: "research-cluster", name: "Research Cluster" },
]

export function AppSelector() {
  const [open, setOpen] = useState(false)
  const [selectedApp, setSelectedApp] = useState(apps[0])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          <div className="flex items-center gap-2 truncate">
            <Server className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{selectedApp.name}</span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command>
          <CommandInput placeholder="Search clusters..." />
          <CommandList>
            <CommandEmpty>No clusters found.</CommandEmpty>
            <CommandGroup>
              {apps.map((app) => (
                <CommandItem
                  key={app.id}
                  value={app.name}
                  onSelect={() => {
                    setSelectedApp(app)
                    setOpen(false)
                  }}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Server className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{app.name}</span>
                  </div>
                  <Check className={`ml-auto h-4 w-4 ${selectedApp.id === app.id ? "opacity-100" : "opacity-0"}`} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}


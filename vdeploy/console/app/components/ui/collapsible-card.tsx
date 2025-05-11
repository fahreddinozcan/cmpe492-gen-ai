import * as React from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

interface CollapsibleCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function CollapsibleCard({
  title,
  description,
  children,
  footer,
  defaultOpen = true,
  className,
}: CollapsibleCardProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <Card className={className}>
      <CollapsiblePrimitive.Root
        open={isOpen}
        onOpenChange={setIsOpen}
        className="w-full"
      >
        <CardHeader
          className={cn(
            "cursor-pointer flex flex-row items-center justify-between",
            isOpen && "mb-4"
          )}
          onClick={() => setIsOpen(!isOpen)}
        >
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          <CollapsiblePrimitive.Trigger asChild>
            <div className="rounded-full p-2 hover:bg-gray-100 transition-colors">
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              )}
            </div>
          </CollapsiblePrimitive.Trigger>
        </CardHeader>
        <CollapsiblePrimitive.Content>
          <CardContent className={cn("pt-0")}>{children}</CardContent>
          {footer && <CardFooter>{footer}</CardFooter>}
        </CollapsiblePrimitive.Content>
      </CollapsiblePrimitive.Root>
    </Card>
  );
}

import { useState, useEffect, useRef } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useDeployments, useDeployment } from "~/lib/api";
import { Slider } from "../components/ui/slider";

import type { ChatMessage } from "~/lib/api";

interface Message extends ChatMessage {}

interface CompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    text: string;
    delta?: { content?: string };
    logprobs: null;
    finish_reason: string;
    stop_reason: null;
    prompt_logprobs: null;
  }[];
  usage: {
    prompt_tokens: number;
    total_tokens: number;
    completion_tokens: number;
    prompt_tokens_details: null;
  };
}

export default function Completions() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [maxTokens, setMaxTokens] = useState(100);
  const [temperature, setTemperature] = useState(0.7);
  const [selectedDeployment, setSelectedDeployment] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");

  const { data: deployments = [], isLoading: isLoadingDeployments } =
    useDeployments();
  const { data: deployment } = useDeployment(selectedDeployment);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const handleSubmit = async () => {
    if (!input.trim() || !selectedDeployment || !deployment?.public_url) return;

    // Add user message immediately
    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);

    setInput("");
    setLoading(true);
    setStreamingContent("");

    try {
      // Convert chat history to text prompt
      const historyText = messages
        .map(
          (msg) =>
            `${msg.role === "user" ? "Human" : "Assistant"}: ${msg.content}`
        )
        .join("\n");

      const fullPrompt = `${historyText}${
        historyText ? "\n" : ""
      }Human: ${input}\nAssistant:`;

      const response = await fetch(`${deployment.public_url}/v1/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          model: deployment.model,
          prompt: fullPrompt,
          max_tokens: maxTokens,
          temperature: temperature,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullAssistantResponse = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.text || "";
              fullAssistantResponse += content;
              setStreamingContent(fullAssistantResponse);
              setLoading(false);
            } catch (e) {
              console.error("Error parsing SSE:", e);
            }
          }
        }
      }

      // Add assistant response to messages
      if (fullAssistantResponse) {
        const assistantMessage: Message = {
          role: "assistant",
          content: fullAssistantResponse,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setStreamingContent("");
      }
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, there was an error processing your request.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // Truncate deployment name for display
  const getDeploymentDisplayName = (deploymentId: string) => {
    const dep = deployments.find((d) => d.deployment_id === deploymentId);
    if (!dep) return "Select deployment";

    const modelName = dep.model.split("/").pop() || "";
    const name =
      dep.name.length > 15 ? dep.name.slice(0, 12) + "..." : dep.name;
    return `${name} (${modelName})`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6 h-screen flex flex-col">
      <h1 className="text-2xl font-bold">Chat Completions</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-1 overflow-hidden">
        <div className="md:col-span-3 flex flex-col">
          {/* Chat Messages */}
          <div
            ref={messagesContainerRef}
            className="bg-muted rounded-lg p-4 overflow-y-auto mb-4 space-y-4 h-[calc(100vh-200px)]"
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary"
                  }`}
                >
                  <pre className="whitespace-pre-wrap break-words font-sans">
                    {msg.content}
                  </pre>
                </div>
              </div>
            ))}
            {streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg p-3 bg-secondary">
                  <pre className="whitespace-pre-wrap break-words font-sans">
                    {streamingContent}
                  </pre>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="flex space-x-2 items-center">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Type your message..."
              className="flex-1"
            />
            <Button
              onClick={handleSubmit}
              disabled={
                !selectedDeployment || !deployment?.public_url || loading
              }
            >
              {loading || (selectedDeployment && !deployment?.public_url)
                ? "Loading..."
                : "Send"}
            </Button>
          </div>
        </div>

        {/* Settings Panel */}
        <Card className="p-4 space-y-4 h-min">
          <div className="space-y-2">
            <Label>Deployment</Label>
            <Select
              value={selectedDeployment}
              onValueChange={setSelectedDeployment}
            >
              <SelectTrigger className="w-full max-w-[300px] truncate">
                <SelectValue placeholder="Select deployment">
                  {selectedDeployment
                    ? getDeploymentDisplayName(selectedDeployment)
                    : "Select deployment"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {deployments.map((d) => (
                  <SelectItem key={d.deployment_id} value={d.deployment_id}>
                    {d.name.length > 20 ? d.name.slice(0, 17) + "..." : d.name}{" "}
                    ({d.model.split("/").pop()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Temperature: {temperature}</Label>
            <Slider
              value={[temperature]}
              onValueChange={([value]: number[]) => setTemperature(value)}
              min={0}
              max={2}
              step={0.1}
            />
          </div>

          <div className="space-y-2">
            <Label>Max Tokens: {maxTokens}</Label>
            <Slider
              value={[maxTokens]}
              onValueChange={([value]: number[]) => setMaxTokens(value)}
              min={1}
              max={2048}
              step={1}
            />
          </div>

          <div className="text-sm text-muted-foreground">
            <p>Press Shift + Enter for new line</p>
            <p>Press Enter to send</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

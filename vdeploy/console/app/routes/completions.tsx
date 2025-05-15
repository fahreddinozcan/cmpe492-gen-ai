import { useState, useEffect, useRef } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useDeployments, useDeployment } from "~/lib/api";
import { Slider } from "../components/ui/slider";
import {
  Send,
  MessageSquare,
  Settings,
  Thermometer,
  Hash,
  Server,
  RefreshCw,
  Plus,
} from "lucide-react";

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
    <div className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-gray-800 via-gray-900 to-black">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg flex items-center justify-center shadow-lg">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Completions</h1>
                <p className="text-gray-400">
                  Test your deployed models with text completions
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="bg-gray-800/50 border-gray-600 hover:bg-gray-700 text-white"
                disabled={isLoadingDeployments}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${
                    isLoadingDeployments ? "animate-spin" : ""
                  }`}
                />
                Refresh
              </Button>
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <span onClick={() => {}}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Session
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Chat Area - 3/4 width on larger screens */}
          <div className="md:col-span-3 flex flex-col space-y-4">
            {/* Messages Container */}
            <div 
              ref={messagesContainerRef}
              className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 overflow-y-auto mb-4 space-y-4 h-[calc(100vh-250px)]"
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <div className="w-16 h-16 bg-gray-700/50 rounded-lg flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium mb-2 text-white">
                    No messages yet
                  </h3>
                  <p className="text-gray-400 mb-6 max-w-md">
                    Select a deployment from the settings panel and start sending messages to test completions.
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-4 ${
                          msg.role === "user"
                            ? "bg-blue-600/80 text-white"
                            : "bg-gray-700/80 text-gray-100"
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
                      <div className="max-w-[80%] rounded-lg p-4 bg-gray-700/80 text-gray-100">
                        <pre className="whitespace-pre-wrap break-words font-sans">
                          {streamingContent}
                        </pre>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50 flex items-center space-x-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Type your message..."
                className="flex-1 bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-400 focus-visible:ring-blue-500"
              />
              <Button
                onClick={handleSubmit}
                disabled={
                  !selectedDeployment || !deployment?.public_url || loading
                }
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span className="ml-2">Send</span>
              </Button>
            </div>
          </div>

          {/* Settings Panel - 1/4 width */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center space-x-3 mb-6">
              <Settings className="w-5 h-5 text-gray-400" />
              <h3 className="text-lg font-semibold text-white">Settings</h3>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-gray-300">
                  <Server className="w-4 h-4 inline mr-2 text-gray-400" />
                  Deployment
                </Label>
                <Select
                  value={selectedDeployment}
                  onValueChange={setSelectedDeployment}
                >
                  <SelectTrigger className="w-full bg-gray-700/50 border-gray-600 text-white">
                    <SelectValue placeholder="Select deployment">
                      {selectedDeployment
                        ? getDeploymentDisplayName(selectedDeployment)
                        : "Select deployment"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    {deployments.map((d) => (
                      <SelectItem key={d.deployment_id} value={d.deployment_id} className="focus:bg-gray-700">
                        {d.name.length > 20 ? d.name.slice(0, 17) + "..." : d.name}{" "}
                        ({d.model.split("/").pop()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 pt-3 border-t border-gray-700/50">
                <Label className="text-gray-300">
                  <Thermometer className="w-4 h-4 inline mr-2 text-gray-400" />
                  Temperature: {temperature.toFixed(1)}
                </Label>
                <Slider
                  value={[temperature]}
                  onValueChange={([value]: number[]) => setTemperature(value)}
                  min={0}
                  max={2}
                  step={0.1}
                  className="py-2"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Higher values = more creative, lower = more deterministic
                </p>
              </div>

              <div className="space-y-3 pt-3 border-t border-gray-700/50">
                <Label className="text-gray-300">
                  <Hash className="w-4 h-4 inline mr-2 text-gray-400" />
                  Max Tokens: {maxTokens}
                </Label>
                <Slider
                  value={[maxTokens]}
                  onValueChange={([value]: number[]) => setMaxTokens(value)}
                  min={1}
                  max={2048}
                  step={10}
                  className="py-2"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Maximum response length in tokens
                </p>
              </div>

              <div className="bg-gray-700/30 rounded-lg p-3 mt-6">
                <p className="text-sm text-gray-300 font-medium mb-2">Keyboard Shortcuts</p>
                <div className="text-xs text-gray-400 space-y-1">
                  <p>• <span className="bg-gray-600 text-gray-200 rounded px-1.5 py-0.5 text-xs">Enter</span> Send message</p>
                  <p>• <span className="bg-gray-600 text-gray-200 rounded px-1.5 py-0.5 text-xs">Shift + Enter</span> New line</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

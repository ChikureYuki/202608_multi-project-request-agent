import type { ChatMessage, ChatResponse, ToolDefinition } from "../types.js";

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  thoughtSignature?: string;
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  error?: { message: string; code?: number };
}

export class GeminiClient {
  private readonly baseUrl =
    "https://generativelanguage.googleapis.com/v1beta/models";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async chat(messages: ChatMessage[], tools?: ToolDefinition[]): Promise<ChatResponse> {
    const systemInstruction = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content ?? "")
      .join("\n\n");

    const contents = this.toGeminiContents(messages.filter((m) => m.role !== "system"));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: { temperature: 0.2 },
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    if (tools && tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
          })),
        },
      ];
    }

    const url = `${this.baseUrl}/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const response = await this.fetchWithRetry(url, body);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${sanitizeError(text)}`);
    }

    const data = (await response.json()) as GeminiGenerateResponse;
    if (data.error) {
      throw new Error(`Gemini API error: ${data.error.message}`);
    }

    return this.parseResponse(data);
  }

  private async fetchWithRetry(
    url: string,
    body: Record<string, unknown>,
    maxRetries = 8,
  ): Promise<Response> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });

      if (response.status !== 429 || attempt === maxRetries) {
        return response;
      }

      const text = await response.text();
      const delayMs = parseRetryDelayMs(text) ?? 15_000 * (attempt + 1);
      console.warn(
        `Gemini API rate limit (429). ${Math.ceil(delayMs / 1000)}秒後に再試行 (${attempt + 1}/${maxRetries})...`,
      );
      await sleep(delayMs);
    }

    throw new Error("Gemini API retry limit exceeded");
  }

  private toGeminiContents(messages: ChatMessage[]): GeminiContent[] {
    const contents: GeminiContent[] = [];

    for (const message of messages) {
      if (message.role === "user") {
        contents.push({
          role: "user",
          parts: [{ text: message.content ?? "" }],
        });
      } else if (message.role === "assistant") {
        const parts: GeminiPart[] = [];
        if (message.content) parts.push({ text: message.content });
        for (const call of message.toolCalls ?? []) {
          const part: GeminiPart = {
            functionCall: {
              name: call.name,
              args: safeParseArgs(call.arguments),
            },
          };
          if (call.thoughtSignature) {
            part.thoughtSignature = call.thoughtSignature;
          }
          parts.push(part);
        }
        if (parts.length > 0) contents.push({ role: "model", parts });
      } else if (message.role === "tool") {
        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: normalizeToolName(message.name ?? "tool"),
                response: safeParseResponse(message.content ?? "{}"),
              },
            },
          ],
        });
      }
    }

    return contents;
  }

  private parseResponse(data: GeminiGenerateResponse): ChatResponse {
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    let content: string | null = null;
    const toolCalls: ChatResponse["toolCalls"] = [];

    for (const part of parts) {
      if (part.text) content = (content ?? "") + part.text;
      if (part.functionCall) {
        toolCalls.push({
          id: `call_${part.functionCall.name}_${toolCalls.length}`,
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args ?? {}),
          thoughtSignature: part.thoughtSignature,
        });
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}

export function normalizeToolName(name: string): string {
  return name.replace(/^default_api:/, "");
}

function safeParseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function safeParseResponse(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { result: parsed };
  } catch {
    return { result: raw };
  }
}

function sanitizeError(text: string): string {
  return text.replace(/AIza[0-9A-Za-z_-]+/g, "[REDACTED]");
}

function parseRetryDelayMs(errorText: string): number | null {
  try {
    const parsed = JSON.parse(errorText) as {
      error?: { details?: Array<{ "@type"?: string; retryDelay?: string }> };
    };
    for (const detail of parsed.error?.details ?? []) {
      if (detail["@type"]?.includes("RetryInfo") && detail.retryDelay) {
        const seconds = Number.parseFloat(detail.retryDelay.replace(/s$/, ""));
        if (Number.isFinite(seconds) && seconds > 0) {
          return Math.ceil(seconds * 1000) + 500;
        }
      }
    }
  } catch {
    // fall through
  }

  const match = errorText.match(/retry in ([0-9.]+)s/i);
  if (match) {
    const seconds = Number.parseFloat(match[1]!);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds * 1000) + 500;
    }
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

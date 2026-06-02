// OpenRouter / compatible LLM client using Obsidian's requestUrl
// Works on desktop AND mobile (bypasses CORS)

import { requestUrl, RequestUrlParam, RequestUrlResponse } from "obsidian";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  text: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class LLMClient {
  private endpoint: string;
  private apiKey: string;
  private model: string;
  private maxTokens: number;

  constructor(endpoint: string, apiKey: string, model: string, maxTokens: number = 1024) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.model = model;
    this.maxTokens = maxTokens;
  }

  async sendMessage(messages: LLMMessage[]): Promise<LLMResponse> {
    const params: RequestUrlParam = {
      url: this.endpoint,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
        "HTTP-Referer": "https://obsidian.md",
        "X-Title": "Logography",
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        max_tokens: this.maxTokens,
        temperature: 0.7,
      }),
      contentType: "application/json",
    };

    try {
      const response: RequestUrlResponse = await requestUrl(params);

      if (response.status !== 200) {
        throw new Error(`API error ${response.status}: ${response.text}`);
      }

      const data = response.json;
      const choice = data.choices?.[0];

      if (!choice) {
        throw new Error("No response from API");
      }

      return {
        text: choice.message?.content || "",
        model: data.model || this.model,
        usage: data.usage,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`LLM request failed: ${error.message}`);
      }
      throw error;
    }
  }

  // Quick single-message call (for dream extraction, etc.)
  async ask(systemPrompt: string, userMessage: string): Promise<string> {
    const response = await this.sendMessage([
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ]);
    return response.text;
  }

  updateConfig(endpoint: string, apiKey: string, model: string, maxTokens: number) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.model = model;
    this.maxTokens = maxTokens;
  }
}

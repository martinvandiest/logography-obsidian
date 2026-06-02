// Logography Server Client — thin client for the Logography API
// All intelligence lives on the server. This is just HTTP.

import { requestUrl, RequestUrlParam } from "obsidian";

export interface ServerResponse {
  text: string;
  phase: string;
  step: string;
  turn_count: number;
  phase_changed: boolean;
  session_completed: boolean;
  session_id: string;
}

export interface SessionStatus {
  session_id: string;
  phase: string;
  step: string;
  turn_count: number;
  scenes_count: number;
  beliefs_count: number;
  beliefs: { statement: string; status: string }[];
  completed: boolean;
}

export interface SessionSummary {
  session_id: string;
  title: string;
  created_at: string;
  completed: boolean;
  message_count: number;
  phase: string;
}

export class LogographyServer {
  private serverUrl: string;
  private apiKey: string;
  private userId: string;

  constructor(serverUrl: string, apiKey: string, userId: string) {
    this.serverUrl = serverUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.userId = userId;
  }

  updateConfig(serverUrl: string, apiKey: string): void {
    this.serverUrl = serverUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const params: RequestUrlParam = {
      url: `${this.serverUrl}${path}`,
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      contentType: "application/json",
    };

    if (body) {
      params.body = JSON.stringify(body);
    }

    const response = await requestUrl(params);

    if (response.status === 401) {
      throw new Error("Invalid API key. Check your Logography settings.");
    }
    if (response.status === 403) {
      throw new Error("Account inactive or session limit reached.");
    }
    if (response.status === 429) {
      throw new Error("Rate limited. Please wait a moment.");
    }
    if (response.status >= 500) {
      throw new Error("Server error. Please try again later.");
    }
    if (response.status !== 200) {
      throw new Error(`Request failed (${response.status})`);
    }

    return response.json;
  }

  async sendMessage(message: string): Promise<ServerResponse> {
    return this.request("POST", "/api/chat", {
      user_id: this.userId,
      message,
    });
  }

  async newSession(): Promise<{ session_id: string }> {
    return this.request("POST", "/api/session/new", {
      user_id: this.userId,
    });
  }

  async getSessionStatus(): Promise<SessionStatus> {
    return this.request("GET", `/api/session/${this.userId}`);
  }

  async listSessions(): Promise<SessionSummary[]> {
    return this.request("GET", `/api/sessions/${this.userId}`);
  }

  async loadSession(sessionId: string): Promise<any> {
    return this.request("POST", "/api/sessions/load", {
      user_id: this.userId,
      session_id: sessionId,
    });
  }

  async reviewSession(): Promise<{ summary: string }> {
    return this.request("POST", `/api/review/${this.userId}`);
  }

  async health(): Promise<{ status: string; model: string }> {
    return this.request("GET", "/api/health");
  }
}

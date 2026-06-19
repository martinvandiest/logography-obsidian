// Logography Server Client — stateless inference passthrough
// Server authenticates, routes to AI model, returns response. Stores nothing.

import { requestUrl, RequestUrlParam } from 'obsidian';
import { SessionState, PhaseValue } from '../engine/types';
import { CrossSessionContext } from '../engine/CrossSessionMemory';

export interface VaultChatRequest {
  message: string;
  session_state: Record<string, unknown>;
  cross_session_context: Record<string, unknown>;
  faith_tradition?: string;
  session_id: string;
}

export interface VaultChatResponse {
  text: string;
  updated_session_state: Record<string, unknown>;
  session_id: string;
}

export interface AuthResponse {
  token: string;
  user_id: string;
  email: string;
  mfa_required?: boolean;
}

export interface MetricsPayload {
  user_id: string;
  session_id: string;
  metrics: {
    turn_count: number;
    duration_minutes: number;
    phases_completed: string[];
    beliefs_surfaced: number;
    beliefs_deflated: number;
    understanding_score: number;
    entry_type: string;
    completed: boolean;
  };
}

export class LogographyServer {
  private serverUrl: string;
  private apiKey: string;
  private userId: string;

  constructor(serverUrl: string, apiKey: string, userId: string) {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.userId = userId;
  }

  updateConfig(serverUrl: string, apiKey: string): void {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  updateUserId(userId: string): void {
    this.userId = userId;
  }

  // --- Core API ---

  /**
   * Send a message via the stateless vault endpoint.
   * Plugin sends full context; server returns response + updated state.
   */
  async sendVaultMessage(
    message: string,
    sessionState: SessionState,
    crossSessionContext: CrossSessionContext,
    faithTradition?: string
  ): Promise<VaultChatResponse> {
    const request: VaultChatRequest = {
      message,
      session_state: this.serializeState(sessionState),
      cross_session_context: crossSessionContext as unknown as Record<string, unknown>,
      faith_tradition: faithTradition,
      session_id: sessionState.sessionId,
    };

    return this.request('POST', '/api/chat/vault', request);
  }

  /**
   * Push lightweight session metrics (no content).
   */
  async sendMetrics(payload: MetricsPayload): Promise<void> {
    try {
      await this.request('POST', '/api/metrics', payload);
    } catch {
      // Fire-and-forget — failures are silent
    }
  }

  // --- Auth ---

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request('POST', '/api/auth/login', { email, password });
  }

  async signup(email: string, password: string): Promise<AuthResponse> {
    return this.request('POST', '/api/auth/signup', { email, password });
  }

  async verifyMfa(email: string, code: string, tempToken: string): Promise<AuthResponse> {
    return this.request('POST', '/api/auth/mfa/verify', {
      email,
      code,
      temp_token: tempToken,
    });
  }

  // --- Health ---

  async health(): Promise<{ status: string; model: string }> {
    return this.request('GET', '/api/health');
  }

  // --- Internal ---

  private async request(method: string, path: string, body?: unknown): Promise<any> {
    const params: RequestUrlParam = {
      url: `${this.serverUrl}${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      contentType: 'application/json',
    };

    if (body) {
      params.body = JSON.stringify(body);
    }

    const response = await requestUrl(params);

    if (response.status === 401) {
      throw new Error('Invalid API key. Check your Logography settings.');
    }
    if (response.status === 403) {
      throw new Error('Account inactive or session limit reached.');
    }
    if (response.status === 429) {
      throw new Error('Rate limited. Please wait a moment.');
    }
    if (response.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }
    if (response.status !== 200) {
      throw new Error(`Request failed (${response.status})`);
    }

    return response.json;
  }

  /**
   * Serialize SessionState for the API request.
   * Converts camelCase to snake_case for the Python backend.
   */
  private serializeState(state: SessionState): Record<string, unknown> {
    return {
      session_id: state.sessionId,
      user_id: state.userId,
      session_number: state.sessionNumber,
      started_at: state.startedAt,
      current_phase: state.currentPhase,
      current_step: state.currentPhase, // Will be computed by backend
      turn_count: state.turnCount,
      entry_type: state.entryType,
      scenes: state.scenes.map(s => ({
        id: s.id,
        description: s.description,
        emotional_charge: s.emotionalCharge,
        negative_state: s.negativeState,
        selected: s.selected,
      })),
      beliefs: state.beliefs.map(b => ({
        id: b.id,
        statement: b.statement,
        status: b.status,
        origin_scene: b.originScene,
        origin_traced: b.originTraced,
        contradictions_tested: b.contradictionsTested,
        deflation_level: b.deflationLevel,
      })),
      current_belief_idx: state.currentBeliefIdx,
      completed: state.completed,
    };
  }
}

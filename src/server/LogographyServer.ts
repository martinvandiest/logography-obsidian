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
  token?: string;
  user_id: string;
  email: string;
  display_name?: string;
  tier?: string;
  status?: string;
  beta_tester?: boolean;
  mfa_required?: boolean;
  mfa_verified?: boolean;
  message?: string;
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

export interface ServerSessionSummary {
  session_id: string;
  title: string;
  created_at: string;
  completed: boolean;
  message_count: number;
  phase: string;
}

export interface ServerSessionDetail {
  session_id: string;
  conversation: Array<{ role: string; content: string; timestamp?: string }>;
  completed: boolean;
  phase: string;
}

export class LogographyServer {
  private serverUrl: string;
  private apiKey: string;
  private userId: string;
  onAuthExpired: (() => Promise<boolean>) | null = null;

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
    return this.request('POST', '/api/login', { email, password });
  }

  async signup(email: string, password: string, inviteCode: string): Promise<AuthResponse> {
    return this.request('POST', '/api/signup', { email, password, invite_code: inviteCode });
  }

  async verifyMfa(email: string, code: string, userId: string): Promise<AuthResponse> {
    return this.request('POST', '/api/mfa/login', {
      user_id: userId,
      code,
    });
  }

  // --- Health ---

  async health(): Promise<{ status: string; model: string }> {
    return this.request('GET', '/api/health');
  }

  // --- Session Migration (one-time import from server to vault) ---

  async listServerSessions(): Promise<ServerSessionSummary[]> {
    return this.request('GET', `/api/sessions/${this.userId}`);
  }

  async getServerSessionMessages(sessionId: string): Promise<ServerSessionDetail> {
    return this.request('GET', `/api/sessions/${this.userId}/${sessionId}/messages`);
  }

  // --- Session Sync (opt-in push to server) ---

  /**
   * Push full session content to server for cross-device sync.
   * Fire-and-forget — failures are silent.
   */
  async syncSession(sessionState: SessionState, summary?: string): Promise<void> {
    try {
      await this.request('PUT', '/api/sessions/vault', {
        user_id: this.userId,
        session_id: sessionState.sessionId,
        session_state: this.serializeState(sessionState),
        conversation: sessionState.conversation,
        completed: sessionState.completed,
        summary: summary || '',
        started_at: sessionState.startedAt,
        faith_tradition: sessionState.faithTradition || '',
      });
    } catch {
      // Silent — sync failures don't disrupt the user
    }
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
      // Try silent re-login if we have stored credentials
      if (this.onAuthExpired) {
        const refreshed = await this.onAuthExpired();
        if (refreshed) {
          // Retry the request with new token
          params.headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          };
          const retry = await requestUrl(params);
          if (retry.status === 200) return retry.json;
        }
      }
      throw new Error('Session expired. Please log in again in Settings.');
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

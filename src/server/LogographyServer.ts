// Logography Server Client — stateless inference passthrough
// Server authenticates, routes to AI model, returns response. Stores nothing.

import { requestUrl, RequestUrlParam } from 'obsidian';
import { SessionState } from '../engine/types';
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
  refresh_token?: string;
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

export interface SupportTicket {
  ticket_id: string;
  subject: string;
  category: string;
  severity: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
  message_count: number;
}

export interface SupportTicketMessage {
  message_id: string;
  sender: string;
  message: string;
  created_at: string;
}

export interface SupportTicketDetail extends SupportTicket {
  description: string;
  messages: SupportTicketMessage[];
}

export class LogographyServer {
  private serverUrl: string;
  private apiKey: string;
  private refreshToken: string;
  private userId: string;
  onTokensUpdated: ((token: string, refreshToken: string) => void | Promise<void>) | null = null;

  constructor(serverUrl: string, apiKey: string, userId: string, refreshToken = '') {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.userId = userId;
    this.refreshToken = refreshToken;
  }

  updateConfig(serverUrl: string, apiKey: string, refreshToken?: string): void {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    if (refreshToken !== undefined) this.refreshToken = refreshToken;
  }

  updateUserId(userId: string): void {
    this.userId = userId;
  }

  updateRefreshToken(refreshToken: string): void {
    this.refreshToken = refreshToken;
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

  // --- Support Tickets ---

  async createTicket(
    subject: string,
    category: string,
    severity: string,
    description: string
  ): Promise<SupportTicket> {
    return this.request('POST', '/api/support/tickets', {
      subject,
      category,
      severity,
      description,
    });
  }

  async listMyTickets(): Promise<SupportTicket[]> {
    return this.request('GET', '/api/support/tickets/my');
  }

  async getMyTicketDetail(ticketId: string): Promise<SupportTicketDetail> {
    return this.request('GET', `/api/support/tickets/my/${ticketId}`);
  }

  async replyToTicket(ticketId: string, message: string): Promise<void> {
    await this.request('POST', `/api/support/tickets/my/${ticketId}/reply`, {
      message,
    });
  }

  // --- Internal ---

  private async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
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
      // Try silent refresh if we have a refresh token
      if (this.refreshToken) {
        try {
          const refreshRes = await requestUrl({
            url: this.serverUrl + '/api/auth/refresh',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: this.refreshToken }),
          });
          if (refreshRes.status === 200) {
            const refreshData = refreshRes.json as { token?: string; refresh_token?: string };
            if (refreshData.token) {
              this.apiKey = refreshData.token;
              if (refreshData.refresh_token) {
                this.refreshToken = refreshData.refresh_token;
              }
              if (this.onTokensUpdated) {
                void this.onTokensUpdated(this.apiKey, this.refreshToken);
              }
              // Retry original request with new token
              params.headers = {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + this.apiKey,
              };
              const retry = await requestUrl(params);
              if (retry.status === 200) return retry.json as T;
            }
          }
        } catch {
          // Refresh failed — fall through to error
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

    return response.json as T;
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

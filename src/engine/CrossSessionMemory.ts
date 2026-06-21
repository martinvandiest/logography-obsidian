// Cross-Session Memory — scan vault for previous sessions, build context for AI
// This replaces the server-side _extract_session_summary() and buildSessionIndex()

import { VaultStorage } from '../storage/VaultStorage';
import { SessionState } from './types';

export interface CrossSessionContext {
  recentSessions: SessionSummary[];
  recentExchanges: ExchangePair[];
  recurringBeliefs: string[];
  recurringThemes: string[];
  overallTrajectory: 'improving' | 'stable' | 'declining' | 'new_user';
}

export interface SessionSummary {
  date: string;
  summary: string;
  beliefs: string[];
  themes: string[];
  phase: string;
  completed: boolean;
}

export interface ExchangePair {
  date: string;
  user: string;
  ai: string;
}

const MAX_SUMMARY_TOKENS = 2000;
const MAX_EXCHANGES = 5;
const MAX_SESSIONS_FOR_SUMMARY = 10;
const MAX_SESSIONS_FOR_EXCHANGES = 3;

export class CrossSessionMemory {
  private storage: VaultStorage;

  constructor(storage: VaultStorage) {
    this.storage = storage;
  }

  /**
   * Build cross-session context from vault files.
   * Reads frontmatter from all sessions (fast), full conversation from last 3.
   */
  async buildContext(currentSessionId?: string): Promise<CrossSessionContext> {
    const allSessions = await this.storage.listSessions();

    // Exclude current session, include completed or substantial sessions
    const previousSessions = allSessions.filter(s =>
      s.sessionId !== currentSessionId && (s.completed || s.conversation.length >= 4)
    );

    if (previousSessions.length === 0) {
      return {
        recentSessions: [],
        recentExchanges: [],
        recurringBeliefs: [],
        recurringThemes: [],
        overallTrajectory: 'new_user',
      };
    }

    // Summaries from frontmatter (last N sessions)
    const recentSessions: SessionSummary[] = previousSessions
      .slice(0, MAX_SESSIONS_FOR_SUMMARY)
      .map(s => this.extractSummary(s));

    // Full exchanges from last 3 sessions (for richer context)
    const recentExchanges: ExchangePair[] = [];
    for (const session of previousSessions.slice(0, MAX_SESSIONS_FOR_EXCHANGES)) {
      const exchanges = this.extractExchanges(session);
      recentExchanges.push(...exchanges);
    }

    // Recurring patterns
    const recurringBeliefs = this.findRecurringBeliefs(previousSessions);
    const recurringThemes = this.findRecurringThemes(previousSessions);
    const overallTrajectory = this.computeTrajectory(previousSessions);

    return {
      recentSessions,
      recentExchanges: recentExchanges.slice(0, MAX_EXCHANGES),
      recurringBeliefs,
      recurringThemes,
      overallTrajectory,
    };
  }

  /**
   * Format cross-session context as a string for injection into the system prompt.
   * Stays within token budget (~2000 tokens).
   */
  formatForPrompt(ctx: CrossSessionContext): string {
    if (ctx.overallTrajectory === 'new_user') {
      return 'Cross-session memory: none yet (first session).';
    }

    let prompt = '## CROSS-SESSION MEMORY\n\n';

    // Session summaries
    if (ctx.recentSessions.length > 0) {
      prompt += '### Recent Sessions\n';
      for (const s of ctx.recentSessions.slice(0, 5)) {
        prompt += `- **${s.date}** (${s.phase}): ${s.summary}\n`;
        if (s.beliefs.length > 0) {
          prompt += `  Beliefs: ${s.beliefs.map(b => `"${b}"`).join(', ')}\n`;
        }
      }
      prompt += '\n';
    }

    // Recurring patterns
    if (ctx.recurringBeliefs.length > 0) {
      prompt += '### Recurring Beliefs\n';
      for (const b of ctx.recurringBeliefs) {
        prompt += `- "${b}"\n`;
      }
      prompt += '\n';
    }

    if (ctx.recurringThemes.length > 0) {
      prompt += `### Recurring Themes: ${ctx.recurringThemes.join(', ')}\n\n`;
    }

    // Recent exchanges (raw conversation context)
    if (ctx.recentExchanges.length > 0) {
      prompt += '### Key Exchanges from Previous Sessions\n';
      for (const ex of ctx.recentExchanges) {
        prompt += `(${ex.date})\nUser: ${ex.user}\nGuide: ${ex.ai}\n\n`;
      }
    }

    // Trajectory
    prompt += `### Overall Trajectory: ${ctx.overallTrajectory}\n`;

    // Trim to token budget (rough: 4 chars per token)
    if (prompt.length > MAX_SUMMARY_TOKENS * 4) {
      prompt = prompt.slice(0, MAX_SUMMARY_TOKENS * 4) + '\n...(truncated)';
    }

    return prompt;
  }

  // --- Private helpers ---

  private extractSummary(session: SessionState): SessionSummary {
    const beliefs = session.beliefs.map(b => b.statement);
    const themes = this.extractThemes(session);

    return {
      date: session.startedAt.slice(0, 10),
      summary: session.summary || this.generateBriefSummary(session),
      beliefs,
      themes,
      phase: session.currentPhase,
      completed: session.completed,
    };
  }

  private generateBriefSummary(session: SessionState): string {
    // Fallback if no summary in frontmatter
    const entryType = session.entryType || 'session';
    const beliefCount = session.beliefs.length;
    const deflated = session.beliefs.filter(b => b.status === 'deflated').length;

    if (beliefCount > 0) {
      return `${entryType} — ${beliefCount} belief(s) surfaced, ${deflated} deflated.`;
    }
    return `${entryType} — explored ${session.currentPhase} phase.`;
  }

  private extractThemes(session: SessionState): string[] {
    const themes: string[] = [];

    // Extract from scene descriptions
    for (const scene of session.scenes) {
      const words = scene.description.toLowerCase().split(/\s+/);
      // Simple keyword extraction — nouns and significant words
      for (const word of words) {
        if (word.length > 4 && !['about', 'would', 'could', 'there', 'their', 'which', 'being', 'having'].includes(word)) {
          themes.push(word);
        }
      }
    }

    // Deduplicate
    return Array.from(new Set(themes)).slice(0, 5);
  }

  private extractExchanges(session: SessionState): ExchangePair[] {
    const exchanges: ExchangePair[] = [];
    const date = session.startedAt.slice(0, 10);

    // Find user-AI pairs
    for (let i = 0; i < session.conversation.length - 1; i++) {
      const curr = session.conversation[i];
      const next = session.conversation[i + 1];

      if (curr.role === 'user' && next.role === 'assistant') {
        exchanges.push({
          date,
          user: curr.content.slice(0, 200),
          ai: next.content.slice(0, 200),
        });
      }
    }

    // Return last N exchanges (most recent = most relevant)
    return exchanges.slice(-MAX_EXCHANGES);
  }

  private findRecurringBeliefs(sessions: SessionState[]): string[] {
    const beliefCounts = new Map<string, number>();

    for (const session of sessions) {
      for (const belief of session.beliefs) {
        const normalized = belief.statement.toLowerCase().trim();
        beliefCounts.set(normalized, (beliefCounts.get(normalized) || 0) + 1);
      }
    }

    // Return beliefs that appear more than once
    return Array.from(beliefCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([belief]) => belief)
      .slice(0, 5);
  }

  private findRecurringThemes(sessions: SessionState[]): string[] {
    const themeCounts = new Map<string, number>();

    for (const session of sessions) {
      const themes = this.extractThemes(session);
      for (const theme of themes) {
        themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
      }
    }

    // Return themes that appear more than once
    return Array.from(themeCounts.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .map(([theme]) => theme)
      .slice(0, 5);
  }

  private computeTrajectory(sessions: SessionState[]): 'improving' | 'stable' | 'declining' | 'new_user' {
    if (sessions.length < 2) return 'new_user';

    // Simple heuristic: compare belief deflation rates over time
    const recent = sessions.slice(0, 3);
    const older = sessions.slice(3, 6);

    if (older.length === 0) return 'stable';

    const recentDeflationRate = this.deflationRate(recent);
    const olderDeflationRate = this.deflationRate(older);

    if (recentDeflationRate > olderDeflationRate + 0.1) return 'improving';
    if (recentDeflationRate < olderDeflationRate - 0.1) return 'declining';
    return 'stable';
  }

  private deflationRate(sessions: SessionState[]): number {
    const allBeliefs = sessions.flatMap(s => s.beliefs);
    if (allBeliefs.length === 0) return 0;
    const deflated = allBeliefs.filter(b => b.status === 'deflated' || b.status === 'partially_deflated').length;
    return deflated / allBeliefs.length;
  }
}

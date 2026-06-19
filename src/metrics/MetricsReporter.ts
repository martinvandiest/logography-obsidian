// Metrics Reporter — push lightweight session metrics to server
// No content, no conversation, just numbers. Fire-and-forget.

import { LogographyServer, MetricsPayload } from '../server/LogographyServer';

export class MetricsReporter {
  private server: LogographyServer;

  constructor(server: LogographyServer) {
    this.server = server;
  }

  /**
   * Report session metrics. Silent — no errors thrown.
   */
  async reportSession(
    userId: string,
    sessionId: string,
    metrics: {
      turnCount: number;
      durationMinutes: number;
      phasesCompleted: string[];
      beliefsSurfaced: number;
      beliefsDeflated: number;
      understandingScore: number;
      entryType: string;
      completed: boolean;
    }
  ): Promise<void> {
    const payload: MetricsPayload = {
      user_id: userId,
      session_id: sessionId,
      metrics: {
        turn_count: metrics.turnCount,
        duration_minutes: metrics.durationMinutes,
        phases_completed: metrics.phasesCompleted,
        beliefs_surfaced: metrics.beliefsSurfaced,
        beliefs_deflated: metrics.beliefsDeflated,
        understanding_score: metrics.understandingScore,
        entry_type: metrics.entryType,
        completed: metrics.completed,
      },
    };

    await this.server.sendMetrics(payload);
  }
}

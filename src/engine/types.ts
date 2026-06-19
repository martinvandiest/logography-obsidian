// Logography — State Machine Types
// Port of Python state_machine/phases.py

export type PhaseValue = 'terrain' | 'scenes' | 'diagram' | 'cross_exam' | 'integration';

export const Phase = {
  TERRAIN: 'terrain',
  SCENES: 'scenes',
  DIAGRAM: 'diagram',
  CROSS_EXAM: 'cross_exam',
  INTEGRATION: 'integration',
} as const;

export const PHASE_ORDER: PhaseValue[] = [
  Phase.TERRAIN,
  Phase.SCENES,
  Phase.DIAGRAM,
  Phase.CROSS_EXAM,
  Phase.INTEGRATION,
];

export const PHASE_STEPS: Record<PhaseValue, string[]> = {
  terrain: ['opening', 'dream_narration', 'expectations', 'goals'],
  scenes: ['scene_selection', 'scene_detail', 'high_low', 'negative_state', 'obstacles', 'doorway'],
  diagram: ['pattern_identification', 'belief_hypothesis', 'belief_articulation'],
  cross_exam: ['examine_truth', 'trace_origin', 'test_contradictions', 'examine_consequences', 'deflation_test'],
  integration: ['insight_reflection', 'logos_recognition', 'excellence_vision', 'session_close'],
};

export type PhaseSignal = 'continue' | 'advance_step' | 'advance_phase' | 'recurse_phase_iv' | 'pause' | 'distress';

export interface Belief {
  id: number;
  statement: string;
  status: 'identified' | 'under_examination' | 'partially_deflated' | 'deflated';
  originScene?: string;
  originTraced: boolean;
  contradictionsTested: boolean;
  deflationLevel: 'none' | 'partial' | 'full';
  deeperThanBelief?: number;
}

export interface Scene {
  id: number;
  description: string;
  emotionalCharge: number;
  negativeState?: string;
  selected: boolean;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SessionState {
  sessionId: string;
  userId: string;
  sessionNumber: number;
  startedAt: string;
  currentPhase: PhaseValue;
  currentStepIdx: number;
  entryType?: 'dream' | 'problem' | 'question';
  rawNarration?: string;
  scenes: Scene[];
  beliefs: Belief[];
  currentBeliefIdx?: number;
  turnCount: number;
  completed: boolean;
  conversation: ConversationMessage[];
  // Vault-specific additions
  faithTradition?: string;
  summary?: string;
}

export function currentStep(state: SessionState): string {
  return PHASE_STEPS[state.currentPhase][state.currentStepIdx];
}

export function currentBelief(state: SessionState): Belief | undefined {
  if (state.currentBeliefIdx !== undefined && state.currentBeliefIdx < state.beliefs.length) {
    return state.beliefs[state.currentBeliefIdx];
  }
  return undefined;
}

export function createSession(userId: string, sessionNumber: number, faithTradition?: string): SessionState {
  return {
    sessionId: crypto.randomUUID().slice(0, 8),
    userId,
    sessionNumber,
    startedAt: new Date().toISOString(),
    currentPhase: Phase.TERRAIN,
    currentStepIdx: 0,
    scenes: [],
    beliefs: [],
    turnCount: 0,
    completed: false,
    conversation: [],
    faithTradition,
  };
}

export function stateToContextString(state: SessionState): string {
  let ctx = `## SESSION STATE\nPhase: ${state.currentPhase} (Step: ${currentStep(state)})\nTurn: ${state.turnCount}\n`;

  const selected = state.scenes.filter(s => s.selected);
  if (selected.length > 0) {
    ctx += `Active scene: ${selected[0].description.slice(0, 80)}...\n`;
    if (selected[0].negativeState) {
      ctx += `Negative state: ${selected[0].negativeState}\n`;
    }
  }

  if (state.beliefs.length > 0) {
    ctx += 'Beliefs identified:\n';
    for (const b of state.beliefs) {
      ctx += `  - "${b.statement}" [${b.status}]\n`;
    }
  }

  return ctx;
}

// Serialize to JSON-safe dict (for vault frontmatter)
export function stateToDict(state: SessionState): Record<string, unknown> {
  return {
    session_id: state.sessionId,
    user_id: state.userId,
    session_number: state.sessionNumber,
    started_at: state.startedAt,
    current_phase: state.currentPhase,
    current_step: currentStep(state),
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
    faith_tradition: state.faithTradition,
    summary: state.summary,
  };
}

// Deserialize from JSON dict (from vault frontmatter)
export function dictToState(data: Record<string, unknown>): SessionState {
  const phase = data.current_phase as PhaseValue;
  const stepIdx = PHASE_STEPS[phase].indexOf(data.current_step as string);

  return {
    sessionId: data.session_id as string,
    userId: data.user_id as string,
    sessionNumber: data.session_number as number,
    startedAt: data.started_at as string,
    currentPhase: phase,
    currentStepIdx: stepIdx >= 0 ? stepIdx : 0,
    entryType: data.entry_type as SessionState['entryType'],
    scenes: ((data.scenes as Array<Record<string, unknown>>) || []).map(s => ({
      id: s.id as number,
      description: s.description as string,
      emotionalCharge: (s.emotional_charge as number) || 5,
      negativeState: s.negative_state as string | undefined,
      selected: s.selected as boolean,
    })),
    beliefs: ((data.beliefs as Array<Record<string, unknown>>) || []).map(b => ({
      id: b.id as number,
      statement: b.statement as string,
      status: b.status as Belief['status'],
      originScene: b.origin_scene as string | undefined,
      originTraced: b.origin_traced as boolean,
      contradictionsTested: b.contradictions_tested as boolean,
      deflationLevel: b.deflation_level as Belief['deflationLevel'],
    })),
    currentBeliefIdx: data.current_belief_idx as number | undefined,
    turnCount: (data.turn_count as number) || 0,
    completed: (data.completed as boolean) || false,
    conversation: ((data.conversation as Array<Record<string, unknown>>) || []).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content as string,
      timestamp: m.timestamp as string,
    })),
    faithTradition: data.faith_tradition as string | undefined,
    summary: data.summary as string | undefined,
  };
}

// Phase Machine — 5-phase state machine for Philosophical Midwifery
// Phase transitions are RULE-BASED, never LLM-decided

export type Phase = "I" | "II" | "III" | "IV" | "V";
export type EntryType = "dream" | "problem" | "question";

export interface DreamElement {
  name: string;
  description: string;
  emotionalTone: "positive" | "negative" | "neutral";
}

export interface Scene {
  id: number;
  description: string;
  emotionalCharge: number;
  negativeState: string;
  selected: boolean;
}

export interface Belief {
  id: number;
  statement: string;
  status: "identified" | "under_examination" | "deflated" | "paused";
  originScene: string | null;
  originTraced: boolean;
  contradictionsTested: boolean;
  deflationLevel: "none" | "partial" | "full";
  deeperThanBelief?: number;
}

export interface Insight {
  text: string;
  relatedBelief: number;
  phase: string;
}

export interface SessionState {
  sessionId: string;
  currentPhase: Phase;
  currentStep: string;
  
  entryType: EntryType | null;
  rawNarration: string;
  dreamElements: {
    characters: DreamElement[];
    locations: any[];
    emotions: any[];
    actions: any[];
    recurring: string[];
  };
  
  scenes: Scene[];
  beliefs: Belief[];
  goals: string[];
  insights: Insight[];
  
  exchangeCount: number; // per belief, for depth enforcement
  negativeState: string;
  phaseHistory: { phase: Phase; step: string; timestamp: number }[];
}

export function createInitialState(sessionId: string): SessionState {
  return {
    sessionId,
    currentPhase: "I",
    currentStep: "opening",
    entryType: null,
    rawNarration: "",
    dreamElements: {
      characters: [],
      locations: [],
      emotions: [],
      actions: [],
      recurring: [],
    },
    scenes: [],
    beliefs: [],
    goals: [],
    insights: [],
    exchangeCount: 0,
    negativeState: "",
    phaseHistory: [{ phase: "I", step: "opening", timestamp: Date.now() }],
  };
}

// Step sequences per phase
const PHASE_STEPS: Record<Phase, string[]> = {
  I: ["opening", "dream_narration", "expectations", "goals"],
  II: ["scene_selection", "scene_detail", "high_low", "negative_state", "obstacles", "doorway"],
  III: ["pattern_identification", "belief_hypothesis", "belief_articulation"],
  IV: ["examine_truth", "trace_origin", "test_contradictions", "examine_consequences", "deflation_test"],
  V: ["insight_reflection", "logos_recognition", "excellence_vision", "session_close"],
};

// Transition logic — called after each LLM response
export function evaluateTransition(
  state: SessionState,
  llmResponse: string
): SessionState {
  const response = llmResponse.toLowerCase();
  const newState = { ...state };
  newState.exchangeCount++;

  // Phase-specific transition rules
  switch (state.currentPhase) {
    case "I":
      // Move to Phase II when user has described dream AND articulated a goal
      if (state.rawNarration && state.goals.length > 0) {
        return advancePhase(newState, "II", "scene_selection");
      }
      // Auto-advance through steps if content exists
      if (state.currentStep === "opening" && state.rawNarration) {
        return advanceStep(newState, "dream_narration");
      }
      break;

    case "II":
      // Move to Phase III when a scene is selected AND negative state identified
      if (state.scenes.some(s => s.selected) && state.negativeState) {
        return advancePhase(newState, "III", "belief_hypothesis");
      }
      break;

    case "III":
      // Move to Phase IV when a belief is articulated
      if (state.beliefs.some(b => b.status === "under_examination")) {
        return advancePhase(newState, "IV", "examine_truth");
        newState.exchangeCount = 0; // reset for depth tracking
      }
      break;

    case "IV":
      // Check for deflation signals
      const deflationSignals = [
        "i see it now", "it's not really true", "i feel lighter",
        "that's not true", "i don't believe that anymore",
        "i see what you mean", "it's just a belief"
      ];
      const resistanceSignals = [
        "but it is true", "i can't let go", "no that's real",
        "you don't understand", "it's different"
      ];

      if (deflationSignals.some(s => response.includes(s))) {
        const activeBelief = state.beliefs.find(b => b.status === "under_examination");
        if (activeBelief) {
          activeBelief.deflationLevel = "full";
          activeBelief.status = "deflated";
        }
        return advancePhase(newState, "V", "insight_reflection");
      }

      // Check for deeper belief discovery
      if (response.includes("deeper") || response.includes("underneath")) {
        // Stay in Phase IV, let the LLM surface the deeper belief
        return advanceStep(newState, "examine_truth");
      }

      // Enforce minimum depth (5 exchanges before allowing deflation)
      if (state.exchangeCount < 5 && state.currentStep === "deflation_test") {
        // Don't advance yet
        return newState;
      }
      break;

    case "V":
      // Session close or deeper exploration
      if (state.currentStep === "session_close") {
        // Session complete
        return newState;
      }
      break;
  }

  return newState;
}

// Deeper belief discovery — recurse Phase IV
export function recursePhaseIV(state: SessionState, deeperBelief: string): SessionState {
  const parentBelief = state.beliefs.find(b => b.status === "under_examination");
  const newBelief: Belief = {
    id: state.beliefs.length + 1,
    statement: deeperBelief,
    status: "under_examination",
    originScene: null,
    originTraced: false,
    contradictionsTested: false,
    deflationLevel: "none",
    deeperThanBelief: parentBelief?.id,
  };
  
  const newState = { ...state };
  newState.beliefs.push(newBelief);
  newState.currentPhase = "IV";
  newState.currentStep = "examine_truth";
  newState.exchangeCount = 0;
  newState.phaseHistory.push({ phase: "IV", step: "examine_truth", timestamp: Date.now() });
  
  return newState;
}

function advancePhase(state: SessionState, phase: Phase, step: string): SessionState {
  state.currentPhase = phase;
  state.currentStep = step;
  state.phaseHistory.push({ phase, step, timestamp: Date.now() });
  return state;
}

function advanceStep(state: SessionState, step: string): SessionState {
  state.currentStep = step;
  state.phaseHistory.push({ phase: state.currentPhase, step, timestamp: Date.now() });
  return state;
}

// Serialize state for prompt injection
export function serializeSessionContext(state: SessionState): string {
  const lines: string[] = [
    `## Session Context`,
    `Phase: ${state.currentPhase} | Step: ${state.currentStep}`,
    `Session #${state.sessionId.slice(0, 8)}`,
  ];

  if (state.entryType) {
    lines.push(`Entry type: ${state.entryType}`);
  }

  if (state.rawNarration) {
    lines.push(`\n### Dream/Problem`);
    lines.push(state.rawNarration.slice(0, 500));
  }

  if (state.scenes.length > 0) {
    lines.push(`\n### Scenes`);
    state.scenes.forEach(s => {
      const marker = s.selected ? " (SELECTED)" : "";
      lines.push(`- ${s.description} [charge: ${s.emotionalCharge}]${marker}`);
    });
  }

  if (state.negativeState) {
    lines.push(`\nNegative state: ${state.negativeState}`);
  }

  if (state.beliefs.length > 0) {
    lines.push(`\n### Beliefs`);
    state.beliefs.forEach(b => {
      const depth = b.deeperThanBelief ? ` (deeper than #${b.deeperThanBelief})` : "";
      lines.push(`- "${b.statement}" [${b.status}]${depth}`);
    });
  }

  if (state.insights.length > 0) {
    lines.push(`\n### Insights`);
    state.insights.forEach(i => lines.push(`- ${i.text}`));
  }

  if (state.goals.length > 0) {
    lines.push(`\n### Goals`);
    state.goals.forEach(g => lines.push(`- ${g}`));
  }

  return lines.join("\n");
}

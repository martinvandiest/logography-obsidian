// Logography — State Machine
// Port of Python StateMachine.processSignal() — rule-based phase transitions.
// The LLM emits signals after each turn. This machine interprets them.

import {
  SessionState,
  PhaseValue,
  Phase,
  PHASE_ORDER,
  PHASE_STEPS,
  PhaseSignal,
  currentStep,
} from './types';

export class StateMachine {
  /**
   * Process an LLM signal and advance the session state.
   * Returns updated state (mutates in place).
   */
  processSignal(state: SessionState, signal: PhaseSignal, _detail: string = ''): SessionState {
    state.turnCount += 1;

    switch (signal) {
      case 'advance_step':
        this.advanceStep(state);
        break;
      case 'advance_phase':
        this.advancePhase(state);
        break;
      case 'recurse_phase_iv':
        state.currentPhase = Phase.CROSS_EXAM;
        state.currentStepIdx = 0;
        break;
      case 'pause':
        state.completed = true;
        break;
      case 'distress':
        state.currentPhase = Phase.INTEGRATION;
        state.currentStepIdx = 0;
        break;
      // 'continue' — no change, just increment turn
    }

    return state;
  }

  /**
   * Parse the signal JSON from the LLM response.
   * Looks for {"phase_signal": "...", "signal_detail": "..."} at the end of the response.
   */
  parseSignal(responseText: string): { signal: PhaseSignal; detail: string } {
    // Look for JSON block at end of response
    const jsonMatch = responseText.match(/\{[^}]*"phase_signal"\s*:\s*"([^"]+)"[^}]*\}/);
    if (jsonMatch) {
      const signal = jsonMatch[1] as PhaseSignal;
      const detailMatch = responseText.match(/"signal_detail"\s*:\s*"([^"]*)"/);
      const detail = detailMatch ? detailMatch[1] : '';
      return { signal, detail };
    }

    // Default: continue
    return { signal: 'continue', detail: '' };
  }

  /**
   * Strip the signal JSON from the response text (user shouldn't see it).
   */
  stripSignal(responseText: string): string {
    return responseText.replace(/\n?\{[^}]*"phase_signal"[^}]*\}\s*$/, '').trim();
  }

  private advanceStep(state: SessionState): void {
    const steps = PHASE_STEPS[state.currentPhase];
    if (state.currentStepIdx < steps.length - 1) {
      state.currentStepIdx += 1;
    } else {
      // At end of phase, advance phase
      this.advancePhase(state);
    }
  }

  private advancePhase(state: SessionState): void {
    const currentIdx = PHASE_ORDER.indexOf(state.currentPhase);
    if (currentIdx < PHASE_ORDER.length - 1) {
      state.currentPhase = PHASE_ORDER[currentIdx + 1];
      state.currentStepIdx = 0;
    } else {
      // At end of integration, session complete
      state.completed = true;
    }
  }
}

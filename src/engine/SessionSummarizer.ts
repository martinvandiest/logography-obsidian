// Session Summarizer — compute summaries for frontmatter after each session
// Runs locally — no API call needed, pure text analysis

import { SessionState, ConversationMessage } from './types';

export interface SessionSummaryData {
  summary: string;
  beliefs: string[];
  themes: string[];
  emotionalArc: EmotionalPoint[];
  keyExchanges: ExchangePair[];
}

export interface EmotionalPoint {
  turn: number;
  valence: number;  // -1 (negative) to 1 (positive)
  arousal: number;  // 0 (calm) to 1 (intense)
}

export interface ExchangePair {
  user: string;
  ai: string;
}

/**
 * Compute a session summary from conversation history.
 * Emotional scoring, theme extraction, key exchange selection.
 */
export function summarizeSession(state: SessionState): SessionSummaryData {
  const messages = state.conversation;
  const emotionalArc = scoreEmotionalArc(messages);
  const themes = extractThemes(state);
  const beliefs = state.beliefs.map(b => b.statement);
  const keyExchanges = selectKeyExchanges(messages);
  const summary = generateSummary(state, emotionalArc, themes, beliefs);

  return {
    summary,
    beliefs,
    themes,
    emotionalArc,
    keyExchanges,
  };
}

/**
 * Generate a 250-char summary for frontmatter storage.
 */
function generateSummary(
  state: SessionState,
  emotionalArc: EmotionalPoint[],
  themes: string[],
  beliefs: string[]
): string {
  const entryType = state.entryType || 'session';
  const phase = state.currentPhase;
  const turnCount = state.turnCount;

  // Emotional trajectory
  let emotionalNote = '';
  if (emotionalArc.length >= 2) {
    const first = emotionalArc[0];
    const last = emotionalArc[emotionalArc.length - 1];
    const valenceShift = last.valence - first.valence;
    if (valenceShift > 0.3) emotionalNote = 'Emotional shift toward clarity.';
    else if (valenceShift < -0.3) emotionalNote = 'Emotional intensity increased.';
    else emotionalNote = 'Emotional tone remained steady.';
  }

  // Belief summary
  let beliefNote = '';
  if (beliefs.length > 0) {
    const deflated = state.beliefs.filter(b => b.status === 'deflated' || b.status === 'partially_deflated').length;
    beliefNote = `${beliefs.length} belief(s) surfaced, ${deflated} deflated.`;
  }

  // Theme summary
  const themeNote = themes.length > 0 ? `Themes: ${themes.slice(0, 3).join(', ')}.` : '';

  // Compose
  const parts = [`${entryType} (${phase}, ${turnCount} turns).`, emotionalNote, beliefNote, themeNote]
    .filter(Boolean)
    .join(' ');

  // Trim to 250 chars
  if (parts.length > 250) {
    return parts.slice(0, 247) + '...';
  }
  return parts;
}

/**
 * Score emotional arc across conversation turns.
 * Simple heuristic: look for emotional keywords in user messages.
 */
function scoreEmotionalArc(messages: ConversationMessage[]): EmotionalPoint[] {
  const arc: EmotionalPoint[] = [];
  let turn = 0;

  for (const msg of messages) {
    if (msg.role !== 'user') continue;
    turn++;

    const text = msg.content.toLowerCase();
    const valence = estimateValence(text);
    const arousal = estimateArousal(text);

    arc.push({ turn, valence, arousal });
  }

  return arc;
}

/**
 * Estimate emotional valence from text. -1 (negative) to 1 (positive).
 */
function estimateValence(text: string): number {
  const positive = ['happy', 'joy', 'peace', 'clarity', 'insight', 'understand', 'free', 'light', 'calm', 'relief', 'hope', 'love', 'grateful', 'clear', 'better', 'good', 'beautiful', 'warm', 'safe'];
  const negative = ['afraid', 'scared', 'angry', 'sad', 'confused', 'trapped', 'stuck', 'heavy', 'dark', 'pain', 'fear', 'anxiety', 'hopeless', 'worthless', 'lost', 'alone', 'broken', 'hurt', 'terrible'];

  let score = 0;
  for (const word of positive) {
    if (text.includes(word)) score += 0.1;
  }
  for (const word of negative) {
    if (text.includes(word)) score -= 0.1;
  }

  return Math.max(-1, Math.min(1, score));
}

/**
 * Estimate emotional arousal from text. 0 (calm) to 1 (intense).
 */
function estimateArousal(text: string): number {
  const highArousal = ['terrified', 'furious', 'screaming', 'panic', 'overwhelmed', 'desperate', 'frantic', 'explosive', 'intense', 'extreme', '!!!', 'HELP'];
  const lowArousal = ['calm', 'peaceful', 'quiet', 'gentle', 'still', 'serene', 'soft', 'breathe', 'relax'];

  let score = 0.5; // baseline
  for (const word of highArousal) {
    if (text.includes(word)) score += 0.15;
  }
  for (const word of lowArousal) {
    if (text.includes(word)) score -= 0.15;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Extract themes from session state (scenes, narration, beliefs).
 */
function extractThemes(state: SessionState): string[] {
  const themes: Set<string> = new Set();

  // From scenes
  for (const scene of state.scenes) {
    const words = scene.description.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    for (const word of words) {
      if (!STOP_WORDS.has(word)) themes.add(word);
    }
  }

  // From beliefs
  for (const belief of state.beliefs) {
    const words = belief.statement.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    for (const word of words) {
      if (!STOP_WORDS.has(word)) themes.add(word);
    }
  }

  // From raw narration
  if (state.rawNarration) {
    const words = state.rawNarration.toLowerCase().split(/\s+/).filter(w => w.length > 5);
    for (const word of words.slice(0, 50)) { // limit to first 50 words
      if (!STOP_WORDS.has(word)) themes.add(word);
    }
  }

  return Array.from(themes).slice(0, 8);
}

/**
 * Select the most significant exchanges from the conversation.
 * Looks for: long user messages (deep sharing), emotional shifts, belief articulations.
 */
function selectKeyExchanges(messages: ConversationMessage[]): ExchangePair[] {
  const pairs: { pair: ExchangePair; score: number }[] = [];

  for (let i = 0; i < messages.length - 1; i++) {
    const curr = messages[i];
    const next = messages[i + 1];

    if (curr.role === 'user' && next.role === 'assistant') {
      let score = 0;

      // Longer user messages = more sharing
      if (curr.content.length > 100) score += 2;
      if (curr.content.length > 200) score += 3;

      // Contains emotional language
      const text = curr.content.toLowerCase();
      if (['feel', 'felt', 'realized', 'understand', 'see now', 'breakthrough'].some(w => text.includes(w))) {
        score += 3;
      }

      // Contains belief language
      if (['i am', 'i must', 'i can\'t', 'i\'m not', 'i always', 'i never'].some(w => text.includes(w))) {
        score += 4;
      }

      pairs.push({
        pair: {
          user: curr.content.slice(0, 200),
          ai: next.content.slice(0, 200),
        },
        score,
      });
    }
  }

  // Sort by score, return top 5
  pairs.sort((a, b) => b.score - a.score);
  return pairs.slice(0, 5).map(p => p.pair);
}

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'another', 'back', 'been', 'before',
  'being', 'between', 'came', 'could', 'don\'t', 'down', 'each', 'even',
  'first', 'from', 'going', 'good', 'great', 'have', 'here', 'high',
  'just', 'keep', 'know', 'last', 'like', 'little', 'long', 'look',
  'made', 'make', 'many', 'might', 'more', 'most', 'much', 'must',
  'never', 'next', 'only', 'open', 'over', 'own', 'part', 'put',
  'right', 'same', 'seem', 'should', 'show', 'small', 'some', 'something',
  'stand', 'still', 'such', 'sure', 'take', 'tell', 'than', 'that',
  'their', 'them', 'then', 'there', 'these', 'they', 'thing', 'think',
  'this', 'those', 'through', 'time', 'under', 'very', 'want', 'well',
  'were', 'what', 'when', 'where', 'which', 'while', 'will', 'with',
  'work', 'would', 'year', 'your', 'really', 'started', 'wanted',
  'didn\'t', 'doesn\'t', 'having', 'looking', 'trying', 'going', 'around',
  'together', 'happened', 'remember', 'suddenly', 'everything', 'nothing',
  'someone', 'everyone', 'another', 'already', 'become', 'because',
]);

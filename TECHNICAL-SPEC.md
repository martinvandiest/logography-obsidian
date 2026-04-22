# Dream Analysis App — Technical Specification
## For Developer Implementation

*Based on Pierre Grimes' Philosophical Midwifery method. Original product informed by structural research into how insight emerges through dialectical inquiry.*

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Mobile/Web)                       │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │  Chat UI  │  │ Session View │  │ Dream Journal / History   │ │
│  └─────┬────┘  └──────┬───────┘  └───────────────────────────┘ │
└────────┼───────────────┼────────────────────────────────────────┘
         │               │
┌────────▼───────────────▼────────────────────────────────────────┐
│                         API LAYER                                │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Auth/Session │  │ Dream Entry  │  │ User Profile/Prefs     │ │
│  └─────────────┘  └──────────────┘  └────────────────────────┘ │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                    CONVERSATION ENGINE                           │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              STATE MACHINE (deterministic)                 │  │
│  │                                                           │  │
│  │  terrain ──► scenes ──► diagram ──► cross_exam ──► integrate│  │
│  │     ▲                                    │          │      │  │
│  │     │         ┌──────────────────────────┘          │      │  │
│  │     │         │ (deeper belief found)               ▼      │  │
│  │     │         └──► recurse                    new/done     │  │
│  │     └─────────────────────────────────────────────────────┘  │
│  │                                                           │  │
│  │  Rules:                                                   │  │
│  │  - Phase transitions are RULE-BASED, never LLM-decided   │  │
│  │  - Each phase has defined entry/exit conditions           │  │
│  │  - Depth tracking (1=surface, 2=first belief, 3+=deeper) │  │
│  │  - Recursion triggers on deeper belief discovery          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              LLM CONVERSATION (generative)                 │  │
│  │                                                           │  │
│  │  Input: phase + step + session_state + user_message       │  │
│  │  Output: single question/statement                        │  │
│  │                                                           │  │
│  │  Responsibilities:                                        │  │
│  │  - Generate appropriate questions for current phase/step  │  │
│  │  - Use dreamer's exact words back to them                 │  │
│  │  - Detect resistance type and adapt approach              │  │
│  │  - Maintain conversational warmth and pace                │  │
│  │  - NEVER decide phase transitions                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              STYLE ADAPTER (rule + heuristic)              │  │
│  │                                                           │  │
│  │  Detects dreamer personality and adjusts:                 │  │
│  │  - Question frequency: high / medium / low                │  │
│  │  - Silence usage: frequent / occasional / rare            │  │
│  │  - Challenge level: high / medium / low                   │  │
│  │  - Directiveness: high / medium / low                     │  │
│  │                                                           │  │
│  │  Signals:                                                 │  │
│  │  - High intellectual tendency → reduce directiveness      │  │
│  │  - High resistance → increase silence, reduce challenge   │  │
│  │  - High emotional access → reduce questions, let flow     │  │
│  │  - Low openness → gentle probing, no force                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                        DATA LAYER                                │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Users/Auth  │  │  Sessions    │  │ Cross-Session Memory   │ │
│  │             │  │  (per conv)  │  │ (beliefs over time)    │ │
│  └─────────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Components

### 2.1 State Machine

The state machine controls ALL phase transitions. The LLM never decides when to move phases.

**States:**

| Phase | Steps | Entry Condition | Exit Condition |
|-------|-------|-----------------|----------------|
| `terrain` | `opening`, `dream_narration`, `expectations`, `goals` | Session start | User describes dream/problem AND articulates goal |
| `scenes` | `scene_selection`, `scene_detail`, `high_low`, `negative_state`, `obstacles`, `doorway` | Goal established | One scene examined + negative state identified |
| `diagram` | `pattern_identification`, `belief_hypothesis`, `belief_articulation` | Negative state identified | Belief articulated in user's words |
| `cross_exam` | `examine_truth`, `trace_origin`, `test_contradictions`, `examine_consequences`, `deflation_test` | Belief articulated | Belief deflated OR deeper belief found OR user overwhelmed |
| `integration` | `insight_reflection`, `logos_recognition`, `excellence_vision`, `session_close`, `deeper_layer_found`, `pause_requested` | Deflation/overwhelm/pause | User chooses: new goal / go deeper / end |

**Transition Rules (hard-coded):**

```python
# Pseudocode for phase transitions
def evaluate_transition(session_state, user_input, llm_response):
    current = session_state.current_phase
    step = session_state.current_step

    if current == "terrain":
        if has_dream_description(session_state) and has_goal(session_state):
            return Phase("scenes", "scene_selection")
    
    elif current == "scenes":
        if scene_examined(session_state) and negative_state_identified(session_state):
            return Phase("diagram", "pattern_identification")
    
    elif current == "diagram":
        if belief_articulated(session_state):
            return Phase("cross_exam", "examine_truth")
    
    elif current == "cross_exam":
        status = detect_deflation_status(user_input, llm_response)
        if status == "deflated":
            return Phase("integration", "insight_reflection")
        elif status == "deeper_belief":
            session_state.record_deeper_belief()
            return Phase("cross_exam", "examine_truth")  # Recurse
        elif status == "overwhelmed":
            return Phase("integration", "insight_reflection")
        # else: stay in cross_exam, advance step
    
    elif current == "integration":
        choice = detect_user_choice(user_input)
        if choice == "new_goal":
            return Phase("terrain", "opening")
        elif choice == "deeper":
            return Phase("cross_exam", "examine_truth")
        elif choice == "end":
            return None  # Session complete
    
    # Default: stay in current phase, advance step
    return advance_step(current, step)
```

**Step Advancement (within phase):**
The LLM can suggest when a step feels complete (via session state signals), but the state machine makes the final call based on rule-based detection.

### 2.2 LLM Conversation Handler

**Input Contract:**
```json
{
  "system_prompt": "master system prompt with phase-specific instructions injected",
  "session_state": {
    "phase": "cross_exam",
    "step": "trace_origin",
    "depth_level": 2,
    "beliefs": [...],
    "current_belief": {
      "statement": "I'm not allowed to leave",
      "status": "under_examination",
      "origin_traced": false
    },
    "emotional_arc": ["fear", "confusion", "resistance"],
    "style_params": {
      "question_frequency": "medium",
      "silence_usage": "frequent",
      "challenge_level": "low",
      "directiveness": "medium"
    }
  },
  "conversation_history": [...],
  "user_message": "I think it started when I was seven..."
}
```

**Output Contract:**
```json
{
  "response": "What was happening in your life when you were seven?",
  "step_signals": {
    "step_feels_complete": false,
    "resistance_detected": false,
    "breakthrough_potential": false,
    "deeper_belief_hint": null
  },
  "session_updates": {
    "origin_period": "childhood",
    "origin_scene_hint": "age 7, some family event"
  }
}
```

**Critical LLM Rules:**
1. ONE question at a time — never stack
2. Use user's exact words back to them
3. Default question: "What was that like?" (not "Why?" — Pierre rarely asks why)
4. End responses with a single clear question
5. Short responses (2-4 sentences typically)
6. Let silence happen — if user says "hmm" or goes quiet, don't fill space
7. When user deflects/intellectualizes, calmly restate the question
8. "That's right." only for genuine breakthroughs (used sparingly)
9. "Of course." for understated validation (used frequently)

### 2.3 Style Adapter

Dynamically adjusts LLM behavior based on dreamer signals:

```python
class StyleAdapter:
    def analyze_dreamer(self, conversation_history) -> StyleParams:
        """Run every 5-10 exchanges to update style."""
        signals = {
            "intellectual_tendency": self.detect_intellectualization(conversation),
            "emotional_access": self.detect_emotional_language(conversation),
            "resistance_frequency": self.detect_resistance_patterns(conversation),
            "openness": self.detect_openness(conversation),
        }
        return self.map_to_style(signals)
    
    def map_to_style(self, signals) -> StyleParams:
        if signals["intellectual_tendency"] > 0.7:
            return StyleParams(
                question_frequency="low",
                silence_usage="frequent",
                challenge_level="low",
                directiveness="low",
                # Let them sit with their own analysis
            )
        elif signals["resistance_frequency"] > 0.6:
            return StyleParams(
                question_frequency="medium",
                silence_usage="frequent",
                challenge_level="low",
                directiveness="low",
                # Don't push — hold the space
            )
        elif signals["emotional_access"] > 0.7:
            return StyleParams(
                question_frequency="low",
                silence_usage="frequent",
                challenge_level="medium",
                directiveness="low",
                # They're flowing — don't interrupt
            )
        else:
            return StyleParams(
                question_frequency="high",
                silence_usage="rare",
                challenge_level="high",
                directiveness="high",
                # They need structure — guide actively
            )
```

### 2.4 Dream Element Extraction (Preprocessing)

Before the conversation begins, extract structural elements from the dream text:

```python
def extract_dream_elements(dream_text: str) -> DreamElements:
    """
    Run once at session start. LLM extracts structural elements.
    This is NOT analysis — just inventory.
    """
    # Returns:
    {
        "characters": ["mother", "faceless stranger"],
        "locations": ["childhood home", "dark hallway"],
        "emotions": ["fear", "confusion"],
        "actions": ["running", "door locked"],
        "anomalies": ["light switch doesn't work"],
        "transitions": ["inside to outside"],
        "recurring_elements": ["dark hallway appeared in session 2"],
        "emotional_charge_ranking": [
            {"element": "faceless stranger", "charge": 9},
            {"element": "dark hallway", "charge": 7},
        ]
    }
```

---

## 3. Data Models

### 3.1 User

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    preferences JSONB DEFAULT '{}',
    -- preferences may include: display_name, notification_settings, etc.
    total_sessions INT DEFAULT 0
);
```

### 3.2 Session

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    session_number INT,  -- sequential per user
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    current_phase TEXT,  -- terrain | scenes | diagram | cross_exam | integration
    current_step TEXT,
    depth_level INT DEFAULT 1,
    status TEXT DEFAULT 'active',  -- active | completed | paused
    entry_type TEXT,  -- dream | problem | question
    dream_text TEXT,  -- raw dream narration
    dream_elements JSONB,  -- extracted structural elements
    style_params JSONB,  -- current style adapter settings
    summary TEXT  -- generated at session close
);
```

### 3.3 Conversation Turn

```sql
CREATE TABLE conversation_turns (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    turn_number INT,
    role TEXT,  -- user | assistant
    content TEXT,
    phase TEXT,
    step TEXT,
    depth_level INT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB  -- resistance_detected, breakthrough_potential, etc.
);
```

### 3.4 Belief (Cross-Session)

```sql
CREATE TABLE beliefs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    statement TEXT NOT NULL,
    category TEXT,  -- self_worth | control | permission | safety | belonging | competence | freedom | other
    first_seen_session UUID REFERENCES sessions(id),
    status TEXT DEFAULT 'identified',  -- identified | under_examination | partial | full | resisted
    origin_traced BOOLEAN DEFAULT FALSE,
    origin_period TEXT,  -- childhood | adolescence | adulthood | unknown
    origin_scene_description TEXT,
    deflation_level TEXT,  -- none | partial | full
    depth_layer INT DEFAULT 1,
    parent_belief_id UUID REFERENCES beliefs(id),  -- if deeper than another belief
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.5 Session Event (Beliefs, Breakthroughs, Resistance)

```sql
CREATE TABLE session_events (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    event_type TEXT,  -- belief_identified | belief_examination | resistance | breakthrough | deflation
    belief_id UUID REFERENCES beliefs(id),
    turn_number INT,
    phase TEXT,
    details JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. API Endpoints

### 4.1 Auth

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
```

### 4.2 Sessions

```
POST   /api/sessions                    -- Start new session
GET    /api/sessions                    -- List user's sessions
GET    /api/sessions/:id                -- Get session detail + conversation
POST   /api/sessions/:id/message        -- Send message (core endpoint)
PUT    /api/sessions/:id/pause          -- Pause session
PUT    /api/sessions/:id/resume         -- Resume paused session
GET    /api/sessions/:id/summary        -- Get session summary
```

### 4.3 Beliefs

```
GET    /api/beliefs                     -- List all user beliefs
GET    /api/beliefs/:id                 -- Belief detail + history
GET    /api/beliefs/:id/sessions        -- Sessions where this belief appeared
GET    /api/beliefs/active              -- Currently under examination
GET    /api/beliefs/deflated            -- Resolved beliefs
```

### 4.4 Dreams

```
POST   /api/dreams                      -- Log a dream (pre-session)
GET    /api/dreams                      -- Dream journal
GET    /api/dreams/:id                  -- Dream detail + linked session
GET    /api/dreams/recurring            -- Dreams with recurring elements
```

---

## 5. Core API Flow: Sending a Message

This is the main endpoint. Everything else is supporting.

```
POST /api/sessions/:id/message
Body: { "content": "I think it started when I was seven..." }

Processing:
1. Load session state (phase, step, beliefs, style_params)
2. Run state machine check: is previous turn's step complete?
   - If yes: advance step (and possibly phase)
3. Inject updated state into LLM prompt
4. Call LLM with: system_prompt + session_state + conversation_history + user_message
5. Parse LLM response + step_signals
6. Detect resistance patterns → update style adapter
7. Detect breakthrough markers → log session_event
8. Detect deeper belief hints → flag for state machine
9. Save conversation turn
10. Return response to user

Response:
{
  "response": "What was happening in your life when you were seven?",
  "phase": "cross_exam",
  "step": "trace_origin",
  "depth_level": 2,
  "session_events": [],  // any new events detected
  "is_step_complete": false
}
```

---

## 6. Resistance Detection

The system must detect when the user is resisting the inquiry. This drives the style adapter.

### 6.1 Resistance Types

| Type | Signals | Response Strategy |
|------|---------|-------------------|
| Intellectualization | Abstract language, "analytically speaking", theoretical framing | Redirect to experience: "What was that like?" |
| Deflection | Topic change, humor as shield, "that doesn't matter" | Hold the question: "I just have my question." |
| Label-seeking | "What do you call this?", "I need a name for it" | Release the need: "You don't need an explanation." |
| Sarcasm/humor | Jokes about the process, self-deprecation | Let it land, don't engage the joke |
| Topic change | Abrupt subject shift, "anyway..." | Gently redirect: "Let me go back to..." |
| Justification | "But it's true because...", rationalizing | Don't argue — ask: "Is that always true?" |
| Withdrawal | Short responses, "I don't know", silence | Wait. Don't fill space. |
| Overwhelm | Emotional flooding, "I can't do this", crying | Move to integration immediately. Compassion. |

### 6.2 Detection Heuristic

```python
def detect_resistance(user_input, conversation_history) -> ResistanceDetection:
    signals = []
    
    # Length signal: very short after detailed exchanges
    if len(user_input) < 20 and recent_turns_detailed(conversation_history):
        signals.append(("withdrawal", 0.6))
    
    # Topic shift signal
    if topic_shift_detected(user_input, conversation_history):
        signals.append(("deflection", 0.7))
    
    # Intellectual framing signal
    if contains_abstract_language(user_input):
        signals.append(("intellectualization", 0.5))
    
    # Emotional flooding signal
    if emotional_intensity > 0.8:
        signals.append(("overwhelm", 0.9))
    
    # Return highest signal or null
    return max(signals, key=lambda x: x[1]) if signals else None
```

---

## 7. Breakthrough Detection

### 7.1 Marker Types

| Marker | Signals |
|--------|---------|
| Vocabulary shift | User starts using new/different words for the same thing |
| Emotional shift | Sudden calm after anxiety, laughter after tension |
| Spontaneous insight | "Oh... I never saw it that way", unprompted realization |
| Laughter | Genuine (not nervous) laughter — often signals release |
| Silence | Extended pause after a question — processing happening |
| Tears | Emotional release connected to seeing a belief clearly |
| Body shift | "I feel lighter", physical description of change |
| Connection | "That's connected to..." — user links to other insights |

### 7.2 Detection

```python
def detect_breakthrough(user_input, conversation_history) -> BreakthroughMarker:
    # Language shift: compare vocabulary to previous turns
    vocab_shift = compute_vocabulary_delta(user_input, conversation_history)
    
    # Emotional shift: detect change in emotional valence
    emotional_shift = detect_valence_change(user_input, conversation_history)
    
    # Insight phrases
    insight_phrases = [
        "i never saw", "oh...", "that's it", "i see it now",
        "that makes sense", "of course", "i feel different",
        "that's connected", "wait", "huh"
    ]
    has_insight_phrase = any(p in user_input.lower() for p in insight_phrases)
    
    if vocab_shift > 0.7 or emotional_shift or has_insight_phrase:
        return BreakthroughMarker(
            type=classify_marker_type(user_input),
            confidence=compute_confidence(signals),
            associated_belief=current_belief_under_examination
        )
```

---

## 8. LLM Provider Strategy

### 8.1 Recommended: Claude API (Anthropic)

**Why:**
- Strong instruction-following (critical for phase/step constraints)
- Good at maintaining persona across long conversations
- Structured output support
- Reasonable pricing

**Model selection:**
- Primary conversation: Claude Sonnet (balance of quality/cost)
- Dream element extraction (preprocessing): Claude Haiku (fast, cheap, one-shot)
- Style adapter analysis: Claude Haiku

### 8.2 Alternative: GPT-4o (OpenAI)

Comparable quality. Choose based on:
- Pricing at time of build
- Structured output reliability
- Latency in your target region

### 8.3 Cost Estimate

Per session (~20 turns, ~30 min conversation):
- System prompt: ~2,000 tokens (cached)
- Conversation history: grows per turn, ~500 tokens/turn avg
- Total per session: ~25K input tokens + ~3K output tokens
- Claude Sonnet: ~$0.10-0.15 per session
- At scale (1000 sessions/day): ~$100-150/day

### 8.4 Token Budget Management

```python
class TokenBudget:
    MAX_CONTEXT = 100000  # Claude's context window
    RESERVED_FOR_RESPONSE = 4000
    
    def build_context(self, session_state, history):
        system_prompt = self.build_system_prompt(session_state)  # ~2000 tokens
        state_summary = self.summarize_state(session_state)      # ~500 tokens
        recent_history = self.get_recent_turns(history, limit=20) # ~10000 tokens
        older_summary = self.summarize_older_turns(history)       # ~1000 tokens
        
        return system_prompt + state_summary + recent_history + older_summary
```

---

## 9. Privacy & Security

### 9.1 Non-Negotiable

- **Encryption at rest** — All session data, dream text, beliefs encrypted in database
- **No training on user data** — LLM API calls use no-training agreements (Claude API default, OpenAI API opt-out)
- **Session isolation** — User A cannot access User B's data (standard auth)
- **Dream text is deeply personal** — Treat as health-adjacent data

### 9.2 Recommended

- End-to-end encryption for conversation (if client-side key management feasible)
- Data export/delete functionality (GDPR compliance)
- Anonymous analytics only (breakthrough rates, session depth — no content)
- Clear privacy policy stating: "Your dreams and self-examination are never shared, sold, or used for AI training"

### 9.3 Crisis Detection

If the user expresses:
- Suicidal ideation
- Self-harm intent
- Abuse disclosure
- Severe mental health crisis

→ Immediately provide crisis resources (988 Lifeline, Crisis Text Line)
→ Do NOT attempt to "solve" with the method
→ Log the event (anonymized) for platform safety review

---

## 10. Frontend Requirements

### 10.1 Core Screens

1. **Chat Interface** (primary product surface)
   - Clean, minimal — conversation IS the product
   - Phase indicator (subtle, not clinical)
   - "Pause" button always visible
   - No distracting UI elements during session

2. **Dream Journal**
   - Text entry for dreams before starting a session
   - History of past dreams
   - Recurring element highlighting
   - "Start session from this dream" button

3. **Session History**
   - List of past sessions with date, summary, phase reached
   - Tap to view full conversation
   - Beliefs identified in each session

4. **Belief Map** (differentiator — no competitor has this)
   - Visual graph of beliefs: surface → deeper → deepest
   - Status indicators: identified / under examination / deflated
   - Timeline: when each belief first appeared, how it evolved
   - Connections between beliefs

5. **Insights Dashboard**
   - Emotional arc visualization per session
   - Depth achieved over time (trend)
   - Breakthrough frequency
   - Recurring themes

### 10.2 Mobile-First

This is a personal, intimate product. Users will use it:
- In bed after waking from a dream
- During quiet moments of reflection
- Privately, on their phone

Design for mobile first. Web is secondary.

### 10.3 Chat UX Details

- Typing indicator when AI is "thinking" (builds anticipation)
- Smooth scrolling, auto-scroll to latest
- Long-press to quote/reference earlier dream content
- Subtle phase transition animation (not jarring)
- "Save this moment" button for breakthroughs (bookmark insight)

---

## 11. Tech Stack Recommendation

### Backend

| Component | Recommendation | Rationale |
|-----------|---------------|-----------|
| Language | Python 3.11+ | AI/ML ecosystem, prompt engineering tooling |
| Framework | FastAPI | Async, typed, fast, good for AI APIs |
| Database | PostgreSQL | Relational data (sessions, beliefs, turns), JSONB for flexible fields |
| Cache | Redis | Session state, conversation history hot cache |
| Queue | Celery + Redis | Async LLM calls, dream extraction preprocessing |
| Auth | JWT + bcrypt | Standard, stateless |

### Frontend

| Component | Recommendation | Rationale |
|-----------|---------------|-----------|
| Framework | React Native | iOS + Android from one codebase |
| Alternative | Next.js (PWA) | If web-first, installable as app |
| State | Zustand or React Query | Lightweight, server state management |
| Chat | Custom component | Control over timing, animations, phase indicators |

### Infrastructure

| Component | Recommendation | Rationale |
|-----------|---------------|-----------|
| Hosting | Railway / Render / Fly.io | Simple deploy, scales to medium |
| DB hosting | Supabase / Neon | Managed Postgres, generous free tier |
| File storage | S3 / R2 | Dream exports, session backups |
| CI/CD | GitHub Actions | Standard |
| Monitoring | Sentry + basic APM | Error tracking, performance |

### Alternative (Simpler)

If prototyping fast:
- **Supabase** for auth + database + storage (one service)
- **Vercel** for Next.js frontend
- **Vercel Edge Functions** for API
- Total: 2 services to manage

---

## 12. Development Phases

### Phase 1: Core Conversation Engine (MVP)

**Goal:** One user can have a complete dream analysis session via chat

- [ ] State machine implementation (5 phases, all steps)
- [ ] LLM conversation handler with Claude API
- [ ] Basic prompt system (master + phase prompts)
- [ ] Session storage (Postgres)
- [ ] Simple chat UI (web, not mobile yet)
- [ ] Dream text input → element extraction
- [ ] Session summary generation

**Success metric:** User can go from dream input → complete session → summary

### Phase 2: Intelligence Layer

**Goal:** The system adapts and detects patterns

- [ ] Style adapter implementation
- [ ] Resistance detection
- [ ] Breakthrough detection
- [ ] Cross-session belief tracking
- [ ] Session memory (reference previous sessions)

**Success metric:** System detects resistance and adjusts; beliefs tracked across sessions

### Phase 3: Mobile App + Polish

**Goal:** Production-ready product

- [ ] React Native app (iOS + Android)
- [ ] Dream journal with history
- [ ] Belief map visualization
- [ ] Insights dashboard
- [ ] Push notifications ("You have a dream to explore")
- [ ] User onboarding flow
- [ ] Privacy policy + terms of service

**Success metric:** App store ready

### Phase 4: Growth + Estate Approach

**Goal:** Scale and partnership

- [ ] Analytics (anonymized) — depth achieved, completion rates, breakthrough frequency
- [ ] Subscription model
- [ ] Approach Nancy Grimes for licensing (name/likeness for marketing)
- [ ] Content marketing (blog, social — "what dreams are trying to tell you")
- [ ] Referral system

---

## 13. Prompt System Architecture

The prompt system is layered. Each layer adds context:

```
┌─────────────────────────────────────┐
│  MASTER SYSTEM PROMPT               │  ← Persona, method, guardrails
│  (constant across all sessions)     │
├─────────────────────────────────────┤
│  PHASE + STEP PROMPT                │  ← Current phase instructions
│  (changes with state machine)       │     + step-specific guidance
├─────────────────────────────────────┤
│  SESSION STATE INJECTION            │  ← Beliefs, depth, style params
│  (changes every turn)               │     + emotional arc
├─────────────────────────────────────┤
│  CONVERSATION HISTORY               │  ← Recent turns (token budgeted)
│  (rolling window)                   │
├─────────────────────────────────────┤
│  USER MESSAGE                       │  ← Current input
└─────────────────────────────────────┘
```

### Prompt Construction (per turn)

```python
def build_prompt(session_state, conversation_history, user_message):
    sections = []
    
    # 1. Master system prompt (cached — same every turn)
    sections.append(MASTER_SYSTEM_PROMPT)
    
    # 2. Phase-specific prompt
    phase_prompt = get_phase_prompt(
        phase=session_state.current_phase,
        step=session_state.current_step,
        current_belief=session_state.current_belief,
    )
    sections.append(phase_prompt)
    
    # 3. Session state summary
    sections.append(format_state_summary(session_state))
    
    # 4. Style instructions
    sections.append(format_style_params(session_state.style_params))
    
    # 5. Conversation history (token-budgeted)
    sections.append(format_history(conversation_history))
    
    # 6. User message
    sections.append(f"\n\nUser: {user_message}")
    
    return "\n\n---\n\n".join(sections)
```

---

## 14. Key Design Decisions (for discussion)

These are open questions your team should decide:

1. **Streaming vs. complete responses?**
   - Streaming feels more conversational but makes step_signal detection harder
   - Recommend: stream to user, run detection on complete response

2. **How long should sessions be?**
   - Pierre's average: 20-60 min
   - AI can be faster but shouldn't rush
   - Recommend: no hard time limit, but gentle check-in at 30 min

3. **Free tier vs. paid?**
   - Each session costs ~$0.10-0.15 in LLM tokens
   - Free: 3 sessions/month (enough to hook, not enough to drain)
   - Paid: unlimited sessions + belief map + history

4. **Multi-language?**
   - Not for MVP. English only.
   - Pierre's method is language-dependent (specific question patterns)

5. **Voice input?**
   - Dreams are often recalled as stories — voice is natural
   - Speech-to-text (Whisper API) → text pipeline
   - Nice-to-have for Phase 3

---

## 15. Existing Assets (ready to use)

| Asset | Location | Used For |
|-------|----------|----------|
| Master prompt spec | `prompt-engine-spec.md` | System prompt, phase prompts |
| Question patterns | `pierre-questioning-patterns.md` | LLM behavior calibration |
| Logos extraction schema | `research/logos-extraction-prompt.md` | Session data model design |
| Resistance taxonomy | Skill doc (this file, §6) | Resistance detection |
| Market research | `research/dream-journal-market-research.md` | Product positioning |
| Extracted session data | `research/extracted/*.json` | Training data for style detection |
| Legal framework | `LEGAL-IP-FRAMEWORK.md` | IP boundaries |

---

*Document generated April 22, 2026*
*For: dreamaster build team*
*Author: protostate + Hermes Agent*

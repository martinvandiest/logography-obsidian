# Logos Extraction — Structured Analysis Prompt
## For analyzing diarized Pierre Grimes dream session transcripts

*Feed this prompt + a transcript to Claude/GPT-4. Outputs structured JSON for pattern analysis.*
*All outputs are structural metadata — no transcript content is reproduced.*

---

## THE PROMPT

```
You are analyzing a philosophical dream analysis session. The session 
was conducted by Pierre Grimes using his method of Philosophical 
Midwifery — a Socratic dialectic applied to dreams and life problems.

Your task is to extract STRUCTURAL PATTERNS from this session. You are 
NOT summarizing content. You are mapping the MECHANICS of how insight 
emerges.

The transcript includes speaker labels from diarization. "PG" is the 
philosophical guide (Pierre Grimes). "D1", "D2", etc. are dreamers 
in order of appearance.

Analyze the following transcript and output ONLY valid JSON matching 
the schema below. No commentary, no markdown, just JSON.

## SCHEMA

{
  "meta": {
    "session_id": "string — archive.org identifier",
    "date": "YYYY-MM-DD",
    "duration_min": number,
    "dreamer_count": number,
    "dreamers": ["D1: name/identifier if given", "D2: ..."],
    "session_types": ["dream_exploration", "midwifery", "lecture", "discussion"]
  },

  "phases": [
    {
      "phase": "terrain | scenes | analysis | cross_exam | integration",
      "dreamer": "D1",
      "start_approx_min": number,
      "end_approx_min": number,
      "duration_min": number,
      "steps_completed": ["opening", "dream_narration", "scene_selection", ...],
      "completed": true,
      "notes": "brief structural note"
    }
  ],

  "questions": [
    {
      "timestamp_approx_min": number,
      "pg_asks": "paraphrase of Pierre's question (NOT a quote — describe the question type)",
      "question_type": "opening | probing | clarifying | challenging | redirecting | releasing | connecting | naming",
      "trigger": "what the dreamer said/did that prompted this question",
      "trigger_type": "descriptive | emotional | intellectual | resistant | confused | breakthrough | silence",
      "dreamer_response_type": "descriptive | emotional | intellectual | resistant | confused | insightful | silent",
      "follow_up_type": "deeper | lateral | release | confirm | wait | redirect",
      "phase": "terrain | scenes | analysis | cross_exam | integration",
      "depth_level": number
    }
  ],

  "beliefs_identified": [
    {
      "id": number,
      "dreamer": "D1",
      "statement_paraphrase": "paraphrase of the belief (NOT a quote)",
      "belief_category": "self_worth | control | permission | safety | belonging | competence | freedom | other",
      "origin_traced": true,
      "origin_scene_paraphrase": "brief paraphrase if traced",
      "origin_period": "childhood | adolescence | adulthood | unknown",
      "depth_layer": number,
      "parent_belief_id": null,
      "deflation_status": "identified | under_examination | partial | full | resisted | unclear",
      "deflation_trigger": "what caused deflation if it occurred",
      "examined_in_phases": ["cross_exam", "integration"]
    }
  ],

  "resistance_moments": [
    {
      "timestamp_approx_min": number,
      "dreamer": "D1",
      "resistance_type": "intellectualization | deflection | label_seeking | sarcasm | topic_change | justification | withdrawal | overwhelm",
      "pg_response_type": "redirect | hold | release | humor | silence | reframe | gentle_push",
      "resolved": true,
      "resolution_method": "brief description of how resistance dissolved"
    }
  ],

  "breakthrough_markers": [
    {
      "timestamp_approx_min": number,
      "dreamer": "D1",
      "marker_type": "vocabulary_shift | emotional_shift | spontaneous_insight | laughter | silence | tears | body_shift | connection",
      "before_state": "brief description",
      "after_state": "brief description",
      "associated_belief_id": number,
      "depth_at_breakthrough": number
    }
  ],

  "emotional_arc": [
    {
      "approx_min": number,
      "dreamer": "D1",
      "state": "anxiety | fear | confusion | frustration | curiosity | resistance | openness | insight | relief | calm | joy | clarity"
    }
  ],

  "logos_indicators": [
    {
      "timestamp_approx_min": number,
      "dreamer": "D1",
      "indicator_type": "spontaneous_action | ego_free_description | appropriate_response | natural_clarity | no_explanation_needed | effortless_choice",
      "context_paraphrase": "brief description of what happened"
    }
  ],

  "session_dynamics": {
    "pg_style": {
      "question_frequency": "high | medium | low",
      "silence_usage": "frequent | occasional | rare",
      "humor_level": "none | light | moderate",
      "directiveness": "high | medium | low",
      "challenge_level": "high | medium | low"
    },
    "dreamer_engagement": {
      "D1": {
        "openness": "high | medium | low",
        "intellectual_tendency": "high | medium | low",
        "emotional_access": "high | medium | low",
        "resistance_frequency": "high | medium | low"
      }
    },
    "session_arc": "linear_deep | recursive_deep | broad_surface | breakthrough | stalled | mixed",
    "depth_achieved": number,
    "beliefs_examined": number,
    "beliefs_deflated": number,
    "notable_patterns": ["list of structural patterns worth noting"]
  },

  "cross_session_connections": {
    "references_prior_session": true,
    "recurring_elements": ["elements that appeared in previous sessions if mentioned"],
    "belief_evolution": ["beliefs that seem to have evolved from prior work"]
  }
}

## EXTRACTION RULES

1. NEVER quote the transcript. All content fields use PARAPHRASE only.
2. Use question TYPES not question WORDS. ("probing" not "What was that like?")
3. Use belief CATEGORIES not belief CONTENT. ("self_worth" not "I'm worthless")
4. Timestamps are approximate (round to nearest minute).
5. If something is unclear, use null rather than guessing.
6. If the session is too short or unstructured for a full analysis, 
   output what you can and note limitations in meta.notes.
7. Depth levels: 1 = surface presenting issue, 2 = first belief layer, 
   3+ = deeper recursive layers.
8. session_types: Most sessions have multiple types. Tag all that apply.
9. For multi-dreamer sessions, analyze each dreamer's arc separately 
   but capture group dynamics in session_dynamics.
10. logos_indicators are moments where the dreamer demonstrates 
    spontaneous, ego-free, appropriate action or understanding — 
    the signature of the Logos emerging.

## DREAM SYMBOL EXTRACTION (OPTIONAL SECTION)

If the session includes dream content, also extract:

  "dream_elements": [
    {
      "dreamer": "D1",
      "element_type": "character | location | object | action | anomaly | transition",
      "description_paraphrase": "brief paraphrase",
      "emotional_charge": 1-10,
      "associated_emotion": "string",
      "associated_belief_id": null,
      "examined": true
    }
  ],

  "scene_structure": [
    {
      "dreamer": "D1",
      "scene_number": number,
      "description_paraphrase": "brief",
      "emotional_peak": "what emotion and when",
      "key_action": "what happened at the peak",
      "pg_focus": "did Pierre focus on this scene?"
    }
  ]
```

## OUTPUT

Return ONLY the JSON object. No markdown fences, no commentary.
The JSON must be valid and parseable.

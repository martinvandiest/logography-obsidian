# Hermes Agent → Dream App: Architecture Breakdown

*What to keep, what to strip, what to build. For non-coders.*

**License:** MIT (free to fork, rebrand, sell)
**Repo:** github.com/NousResearch/hermes-agent

---

## THE BIG PICTURE

Hermes is ~25,000 lines of Python. But most of that is tools the dream app doesn't need.
The actual *core* — the parts that make memory and conversation work — is about 3,000 lines.

Think of it like a car. You want the engine, transmission, and dashboard.
You don't need the winch, the plow attachment, or the radar system.

---

## ✅ KEEP (The Engine)

These files form the core. They work together and can't be separated:

### 1. `run_agent.py` (11,000 lines — but mostly tool wiring)
**What it does:** The conversation loop. Send message → get response → execute tools → repeat.
**Why you need it:** This IS the agent. Everything else plugs into it.
**What to strip from it:** References to terminal, browser, code execution tools.
**Realistic size after cleanup:** ~3,000 lines.

### 2. `tools/memory_tool.py` (584 lines)
**What it does:** Persistent memory across sessions. Two text files (MEMORY.md + USER.md).
**Why you need it:** This is the "I remember you" feature. Core to the app.
**Changes needed:** None. Works as-is.

### 3. `tools/session_search_tool.py` (554 lines)
**What it does:** Full-text search across all past conversations. SQLite + FTS5.
**Why you need it:** "Show me all dreams about water" / "What patterns recur in my dreams?"
**Changes needed:** Rename UI labels. Backend is perfect.

### 4. `agent/memory_manager.py` (361 lines)
**What it does:** Loads memory into the system prompt at session start. Syncs after each turn.
**Why you need it:** Connects memory files to the conversation.
**Changes needed:** None.

### 5. `agent/prompt_builder.py` (1,043 lines)
**What it does:** Assembles the system prompt — identity, skills, memory, instructions.
**Why you need it:** This is where you'd set the dream app's personality and Grimes-method instructions.
**Changes needed:** Replace agent identity with dream app identity. Add Grimes extraction prompt.

### 6. `agent/context_engine.py` (184 lines)
**What it does:** Manages context window — decides what to include/exclude to stay within token limits.
**Why you need it:** Long dream sessions will hit context limits. This handles it gracefully.

### 7. `gateway/session.py` (1,086 lines)
**What it does:** Session management — tracks conversations, persists to disk, handles resets.
**Why you need it:** Each dream analysis is a "session." This manages them.

### 8. `tools/registry.py` + `model_tools.py` + `toolsets.py`
**What they do:** Tool registration and dispatch. The plumbing that connects tools to the agent.
**Why you need them:** Even with stripped tools, you need the plumbing for memory + search.
**Changes needed:** Remove tool registrations for stripped tools.

---

## 🔧 MODIFY (Repurpose)

### `agent/prompt_builder.py` — Replace Identity
Currently builds prompts like "You are Hermes Agent, an intelligent AI assistant..."
Replace with: "You are [DreamAppName], a philosophical midwifery companion based on Pierre Grimes' method..."

### `tools/transcription_tools.py` — Keep for Voice Dreams
Hermes already has Whisper integration. Users could *speak* their dreams instead of typing.
Keep this. It's a feature, not bloat.

### `agent/skill_utils.py` — Repurpose for Dream Patterns
Skills in Hermes are "how to do tasks." In the dream app, repurpose as "dream pattern templates" — recurring extraction patterns, user-specific analysis styles.

---

## ❌ STRIP (The Plow Attachment)

These tools exist for an AI agent that does things in the world.
A dream app listens and analyzes. It doesn't run commands.

| File | What It Does | Why Strip |
|---|---|---|
| `tools/terminal_tool.py` | Runs shell commands | Dreams don't need bash |
| `tools/browser_tool.py` | Web automation | No browsing needed |
| `tools/browser_camofox.py` | Stealth browsing | Definitely not needed |
| `tools/code_execution_tool.py` | Runs Python code | Not a coding assistant |
| `tools/delegate_tool.py` | Spawns sub-agents | Overkill for dream app |
| `tools/file_operations.py` | Read/write/edit files | Users shouldn't access filesystem |
| `tools/file_tools.py` | More file operations | Same |
| `tools/cronjob_tools.py` | Scheduled tasks | Could keep for "dream reminders" but optional |
| `tools/skills_tool.py` | Agent skill management | Repurpose or strip |
| `tools/skill_manager_tool.py` | Skill creation | Strip |
| `tools/homeassistant_tool.py` | Smart home control | No |
| `tools/image_generation_tool.py` | DALL-E/Stable Diffusion | Optional — could visualize dreams? |
| `tools/mcp_tool.py` | Model Context Protocol | Agent integration, not needed |
| `tools/mixture_of_agents_tool.py` | Multi-agent orchestration | Overkill |
| `tools/execute_code` (in toolsets) | Code execution | Strip |
| `tools/website_policy.py` | Web scraping policy | Strip |
| `tools/url_safety.py` | URL safety checks | Strip |
| `tools/osv_check.py` | Vulnerability scanning | Strip |

**Total stripped:** ~15 files, ~8,000 lines removed.

---

## ❌ BUILD NEW (Dream-Specific)

These don't exist in Hermes and are needed for the dream app:

### 1. Multi-User Authentication
Hermes is single-user. The dream app needs:
- User signup/login (email + password or OAuth)
- Each user gets their own memory files, session database
- **Complexity:** Medium. Standard web auth patterns.
- **Existing code to reference:** `gateway/session.py` already does session tracking per-platform. Extend this to per-user.

### 2. Chatbot Web UI
Hermes has no web UI (it runs in Discord/Telegram/CLI). Dream app needs:
- Chat interface (React, Vue, or even simple HTML/JS)
- Voice recording button (sends audio to Whisper)
- Dream archive browser (past sessions, searchable)
- Pattern visualization (emotional arcs, recurring elements)
- **Complexity:** Medium-High. This is the biggest new piece.

### 3. Dream Extraction Pipeline
Hermes has cron jobs. Dream app needs:
- After each dream session, auto-run extraction prompt
- Store structured JSON alongside conversation
- Build pattern library over time
- **Complexity:** Low. Your extraction prompt already works. Just schedule it post-session.

### 4. Dream Archive + Pattern Analysis
Hermes has session search. Dream app needs:
- Browse past dreams by date, emotion, theme
- Show recurring symbols, beliefs, emotional arcs
- Cross-session connections (like we just did with Black Knight → Georgia)
- **Complexity:** Medium. Build on top of session search + extraction JSON.

---

## THE MATH

| Component | Lines | Status |
|---|---|---|
| Core keepers | ~3,000 | Ready |
| Stripped tools | ~8,000 | Delete |
| Gateway/session | ~1,000 | Modify |
| Prompt builder | ~1,000 | Modify |
| Tool plumbing | ~1,500 | Simplify |
| **Existing usable code** | **~5,500** | |
| Multi-user auth | ~500 | Build new |
| Chatbot UI | ~2,000 | Build new |
| Extraction pipeline | ~300 | Build new |
| Archive/visualization | ~1,000 | Build new |
| **New code needed** | **~3,800** | |

**Bottom line:** You'd reuse ~5,500 lines and write ~3,800 new lines.
The hard problems (memory, session management, model abstraction, conversation loop) are already solved.

---

## RECOMMENDED APPROACH

1. **Fork the repo** — Start from the Hermes codebase
2. **Delete the stripped tools** — Remove ~15 files, clean up imports
3. **Simplify toolsets** — Only register memory + session_search + transcription
4. **Replace the identity** — Swap agent persona for dream app persona
5. **Add auth layer** — Multi-user login, per-user data directories
6. **Build web UI** — Chat interface with voice + archive browser
7. **Wire extraction pipeline** — Your prompt runs automatically post-session
8. **Test with Claude + open models** — Quality comparison we discussed

Your brother looks at this and immediately sees the path. The code is clean, well-documented, and MIT licensed.

---

*Document created: 2026-04-23*
*Source: /opt/hermes/ codebase analysis*

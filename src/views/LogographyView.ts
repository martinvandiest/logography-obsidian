// Logography Chat View — sidebar pane for dream analysis
import { ItemView, WorkspaceLeaf, MarkdownView } from "obsidian";
import type LogographyPlugin from "../main";
import { LLMMessage } from "../llm/OpenRouterClient";
import { createInitialState, evaluateTransition, serializeSessionContext, Phase, SessionState } from "../state/PhaseMachine";
import { buildMasterSystemPrompt, buildPhasePrompt, DREAM_EXTRACTOR_PROMPT, CRISIS_KEYWORDS, CRISIS_RESPONSE } from "../prompts/master";

export const VIEW_TYPE_LOGOGRAPHY = "logography-chat-view";

export class LogographyView extends ItemView {
  plugin: LogographyPlugin;
  private messagesEl: HTMLElement;
  private inputEl: HTMLTextAreaElement;
  private phaseEl: HTMLElement;
  private messages: LLMMessage[] = [];
  private sessionState: SessionState;
  private sessionFile: string | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: LogographyPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.sessionState = createInitialState(this.generateSessionId());
  }

  getViewType(): string {
    return VIEW_TYPE_LOGOGRAPHY;
  }

  getDisplayText(): string {
    return "Logography";
  }

  getIcon(): string {
    return "brain";
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("logography-chat-container");

    // Header with new session button
    const header = container.createDiv("logography-header");
    header.createEl("span", { text: "Logography", cls: "logography-title" });
    const newSessionBtn = header.createEl("button", {
      text: "New Session",
      cls: "logography-new-session-btn",
    });
    newSessionBtn.addEventListener("click", () => this.startNewSession());

    // Phase indicator
    this.phaseEl = container.createDiv("logography-phase-indicator");
    this.updatePhaseIndicator();

    // Messages area
    this.messagesEl = container.createDiv("logography-messages");

    // Input area
    const inputArea = container.createDiv("logography-input-area");
    this.inputEl = inputArea.createEl("textarea", {
      cls: "logography-input",
      attr: {
        placeholder: "Share a dream, a problem, or a question...",
        rows: "2",
      },
    });

    const sendBtn = inputArea.createEl("button", {
      text: "Send",
      cls: "logography-send-btn mod-cta",
    });

    // Event listeners
    sendBtn.addEventListener("click", () => this.handleSend());
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Auto-resize textarea
    this.inputEl.addEventListener("input", () => {
      this.inputEl.style.height = "auto";
      this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 120) + "px";
    });

    // Initial greeting
    this.addMessage("assistant", "What would you like to explore today? A dream, a problem, a question about yourself?");
  }

  async onClose(): Promise<void> {
    // Save session state on close
    if (this.plugin.settings.enableAuthorMemory && this.sessionState.rawNarration) {
      await this.saveSessionState();
    }
  }

  private async handleSend(): Promise<void> {
    const text = this.inputEl.value.trim();
    if (!text) return;

    // Check for crisis keywords
    if (this.detectCrisis(text)) {
      this.addMessage("assistant", CRISIS_RESPONSE);
      this.inputEl.value = "";
      return;
    }

    // Add user message
    this.addMessage("user", text);
    this.inputEl.value = "";
    this.inputEl.style.height = "auto";

    // Update session state with user input
    this.updateStateFromUserInput(text);

    try {
      // Show thinking indicator
      const thinkingEl = this.addMessage("assistant", "...");
      thinkingEl.addClass("logography-thinking");

      // Build the prompt
      const systemPrompt = this.buildSystemPrompt();
      const messages: LLMMessage[] = [
        { role: "system", content: systemPrompt },
        ...this.messages.slice(-20), // Rolling window of 20 messages
      ];

      // Call LLM
      const response = await this.plugin.llm.sendMessage(messages);

      // Remove thinking indicator and add real response
      thinkingEl.remove();
      this.addMessage("assistant", response.text);

      // Update session state based on response
      this.sessionState = evaluateTransition(this.sessionState, response.text);
      this.updatePhaseIndicator();

      // Update author memory
      if (this.plugin.settings.enableAuthorMemory) {
        await this.updateAuthorMemory(response.text);
      }

    } catch (error) {
      // Remove thinking indicator
      const thinking = this.messagesEl.querySelector(".logography-thinking");
      if (thinking) thinking.remove();

      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      this.addMessage("assistant", `I'm having trouble connecting. ${errorMsg}`);
    }
  }

  private updateStateFromUserInput(text: string): void {
    const state = this.sessionState;

    // Phase I: capture narration
    if (state.currentPhase === "I" && !state.rawNarration) {
      state.rawNarration = text;
      state.entryType = "dream"; // Default, could be refined
      
      // Trigger dream extraction if it looks like a dream
      if (text.length > 50 && (
        text.toLowerCase().includes("dream") ||
        text.toLowerCase().includes("i was") ||
        text.toLowerCase().includes("nightmare")
      )) {
        state.entryType = "dream";
      }
    }

    // Phase II: capture negative state
    if (state.currentPhase === "II" && state.currentStep === "negative_state") {
      if (text.split(" ").length <= 5) {
        state.negativeState = text;
      }
    }

    // Phase III: capture belief
    if (state.currentPhase === "III" && state.currentStep === "belief_articulation") {
      const existingBelief = state.beliefs.find(b => b.status === "under_examination");
      if (!existingBelief) {
        state.beliefs.push({
          id: state.beliefs.length + 1,
          statement: text,
          status: "under_examination",
          originScene: null,
          originTraced: false,
          contradictionsTested: false,
          deflationLevel: "none",
        });
      }
    }

    // Track goals
    if (state.currentPhase === "I" && state.currentStep === "goals") {
      state.goals.push(text);
    }
  }

  private buildSystemPrompt(): string {
    const parts: string[] = [];

    // Master system prompt
    parts.push(buildMasterSystemPrompt(this.plugin.settings.userName));

    // Phase-specific prompt
    parts.push(buildPhasePrompt(
      this.sessionState.currentPhase,
      this.sessionState.currentStep,
      {
        identifiedBelief: this.sessionState.beliefs.find(b => b.status === "under_examination")?.statement,
        negativeState: this.sessionState.negativeState,
      }
    ));

    // Session context
    parts.push(serializeSessionContext(this.sessionState));

    // Author memory
    if (this.plugin.settings.enableAuthorMemory) {
      const memoryContext = this.plugin.authorMemory.getContextForPrompt(
        this.plugin.settings.enableAuthorMemory,
        this.plugin.settings.shareMemoryWithAI
      );
      parts.push(memoryContext);
    }

    return parts.join("\n\n---\n\n");
  }

  private addMessage(role: "user" | "assistant", text: string): HTMLElement {
    const msgEl = this.messagesEl.createDiv(`logography-message ${role}`);
    msgEl.textContent = text;
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

    // Track in message history
    this.messages.push({ role, content: text });

    return msgEl;
  }

  private updatePhaseIndicator(): void {
    const phaseNames: Record<Phase, string> = {
      I: "Terrain",
      II: "Scenes",
      III: "Analysis",
      IV: "Cross-Examination",
      V: "Integration",
    };
    const phase = this.sessionState.currentPhase;
    const step = this.sessionState.currentStep.replace(/_/g, " ");
    this.phaseEl.textContent = `Phase ${phase}: ${phaseNames[phase]} — ${step}`;
  }

  private async updateAuthorMemory(aiResponse: string): Promise<void> {
    try {
      const instruction = this.plugin.authorMemory.getUpdateInstruction();
      const summary = await this.plugin.llm.ask(instruction, `Session context:\n${serializeSessionContext(this.sessionState)}\n\nLatest exchange:\nUser: ${this.messages[this.messages.length - 2]?.content || ""}\nAI: ${aiResponse}`);
      this.plugin.authorMemory.queueUpdate(summary);
    } catch {
      // Silent fail — memory update is non-critical
    }
  }

  private async saveSessionState(): Promise<void> {
    try {
      this.sessionFile = await this.plugin.vaultStorage.saveSession(this.sessionState);
    } catch {
      // Silent fail
    }
  }

  private startNewSession(): void {
    // Save current session first
    if (this.sessionState.rawNarration) {
      this.saveSessionState();
    }

    // Reset
    this.sessionState = createInitialState(this.generateSessionId());
    this.messages = [];
    this.sessionFile = null;
    this.messagesEl.empty();
    this.updatePhaseIndicator();
    this.addMessage("assistant", "What would you like to explore today? A dream, a problem, a question about yourself?");
  }

  private detectCrisis(text: string): boolean {
    const lower = text.toLowerCase();
    return CRISIS_KEYWORDS.some(keyword => lower.includes(keyword));
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

// Logography Chat View — sidebar pane for dream analysis
// Thin UI client. All intelligence lives on the server.
import { ItemView, WorkspaceLeaf } from "obsidian";
import type LogographyPlugin from "../main";
import type { ServerResponse } from "../server/LogographyServer";

export const VIEW_TYPE_LOGOGRAPHY = "logography-chat-view";

export class LogographyView extends ItemView {
  plugin: LogographyPlugin;
  private messagesEl: HTMLElement;
  private inputEl: HTMLTextAreaElement;
  private phaseEl: HTMLElement;
  private sessionId: string | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: LogographyPlugin) {
    super(leaf);
    this.plugin = plugin;
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
    this.updatePhaseIndicator("I", "opening");

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

    // Sleepy UI: auto-focus input so dreamer can start typing immediately
    setTimeout(() => this.inputEl.focus(), 50);

    // Initial greeting
    this.addMessage("assistant", "What would you like to explore today? A dream, a problem, a question about yourself?");
  }

  async onClose(): Promise<void> {
    // Save session on close if there's content
    if (this.sessionId && this.plugin.settings.enableAuthorMemory) {
      try {
        const summary = await this.plugin.server.reviewSession();
        if (summary.summary) {
          this.plugin.authorMemory.queueUpdate(summary.summary);
        }
      } catch {
        // Silent fail — non-critical
      }
    }
  }

  private async handleSend(): Promise<void> {
    const text = this.inputEl.value.trim();
    if (!text) return;

    // Local crisis detection
    if (this.detectCrisis(text)) {
      this.addMessage("assistant", "I want to pause here. If you're in crisis, please reach out to the 988 Suicide & Crisis Lifeline (call or text 988) or the Crisis Text Line (text HOME to 741741). You don't have to face this alone.");
      this.inputEl.value = "";
      return;
    }

    // Add user message to UI
    this.addMessage("user", text);
    this.inputEl.value = "";
    this.inputEl.style.height = "auto";

    try {
      // Show thinking indicator
      const thinkingEl = this.addMessage("assistant", "...");
      thinkingEl.addClass("logography-thinking");

      // Send to server — server handles prompts, state machine, LLM
      const response = await this.plugin.server.sendMessage(text);

      // Remove thinking indicator and show response
      thinkingEl.remove();
      this.addMessage("assistant", response.text);

      // Update phase indicator from server response
      this.updatePhaseIndicator(response.phase, response.step);
      this.sessionId = response.session_id;

      // Save session to vault (local backup)
      if (this.plugin.settings.enableAuthorMemory) {
        await this.saveToVault(text, response);
      }

    } catch (error) {
      // Remove thinking indicator
      const thinking = this.messagesEl.querySelector(".logography-thinking");
      if (thinking) thinking.remove();

      const errorMsg = error instanceof Error ? error.message : "Connection error";
      this.addMessage("assistant", errorMsg);
    }
  }

  private addMessage(role: "user" | "assistant", text: string): HTMLElement {
    const msgEl = this.messagesEl.createDiv(`logography-message ${role}`);
    msgEl.textContent = text;
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return msgEl;
  }

  private updatePhaseIndicator(phase: string, step: string): void {
    const phaseNames: Record<string, string> = {
      I: "Terrain",
      II: "Scenes",
      III: "Analysis",
      IV: "Cross-Examination",
      V: "Integration",
      terrain: "Terrain",
      scenes: "Scenes",
      diagram: "Analysis",
      cross_exam: "Cross-Examination",
      integration: "Integration",
    };
    const phaseName = phaseNames[phase] || phase;
    const stepName = step.replace(/_/g, " ");
    this.phaseEl.textContent = `Phase ${phase}: ${phaseName} — ${stepName}`;
  }

  private async saveToVault(userMessage: string, response: ServerResponse): Promise<void> {
    try {
      // Append to a running session file in the vault
      const sessionFile = `Logography/Sessions/${new Date().toISOString().slice(0, 10)}-session.md`;
      const existing = this.plugin.vaultStorage.getVault().getAbstractFileByPath(sessionFile);

      const entry = `\n\n**You:** ${userMessage}\n\n**Guide:** ${response.text}\n`;

      if (existing) {
        await this.plugin.vaultStorage.getVault().process(existing as any, (data) => data + entry);
      } else {
        const header = `# Logography Session — ${new Date().toLocaleDateString()}\n\n*Phase: ${response.phase} | Step: ${response.step}*\n`;
        await this.plugin.vaultStorage.getVault().create(sessionFile, header + entry);
      }
    } catch {
      // Silent fail — vault storage is non-critical
    }
  }

  private startNewSession(): void {
    this.sessionId = null;
    this.messagesEl.empty();
    this.updatePhaseIndicator("I", "opening");
    this.addMessage("assistant", "What would you like to explore today? A dream, a problem, a question about yourself?");
  }

  // Sleepy UI: expose focus for Quick Capture command
  focusInput(): void {
    if (this.inputEl) {
      this.inputEl.focus();
    }
  }

  private detectCrisis(text: string): boolean {
    const crisisKeywords = [
      "kill myself", "suicide", "want to die", "end my life",
      "self harm", "hurting myself", "no reason to live",
      "better off dead", "can't go on", "give up on life",
    ];
    const lower = text.toLowerCase();
    return crisisKeywords.some(keyword => lower.includes(keyword));
  }
}

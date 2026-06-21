// Logography Chat View — sidebar pane for dream analysis
// Vault as source of truth. Plugin is the brain, server is the tongue.

import { ItemView, WorkspaceLeaf } from 'obsidian';
import type LogographyPlugin from '../main';
import { SessionState, createSession, currentStep, currentBelief, PhaseSignal } from '../engine/types';
import { StateMachine } from '../engine/StateMachine';
import { CrossSessionMemory } from '../engine/CrossSessionMemory';
import { summarizeSession } from '../engine/SessionSummarizer';

export const VIEW_TYPE_LOGOGRAPHY = 'logography-chat-view';

export class LogographyView extends ItemView {
  plugin: LogographyPlugin;
  private messagesEl: HTMLElement;
  private inputEl: HTMLTextAreaElement;
  private phaseEl: HTMLElement;
  private sessionState: SessionState | null = null;
  private stateMachine: StateMachine;
  private crossSessionMemory: CrossSessionMemory;
  private sessionStartTime: number = 0;

  constructor(leaf: WorkspaceLeaf, plugin: LogographyPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.stateMachine = new StateMachine();
    this.crossSessionMemory = new CrossSessionMemory(plugin.vaultStorage);
  }

  getViewType(): string {
    return VIEW_TYPE_LOGOGRAPHY;
  }

  getDisplayText(): string {
    return 'Logography';
  }

  getIcon(): string {
    return 'brain';
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass('logography-chat-container');

    // Header with new session button
    const header = container.createDiv('logography-header');
    header.createEl('span', { text: 'Logography', cls: 'logography-title' });
    const newSessionBtn = header.createEl('button', {
      text: 'New Session',
      cls: 'logography-new-session-btn',
    });
    newSessionBtn.addEventListener('click', () => this.startNewSession());

    // Phase indicator
    this.phaseEl = container.createDiv('logography-phase-indicator');

    // Messages area
    this.messagesEl = container.createDiv('logography-messages');

    // Input area
    const inputArea = container.createDiv('logography-input-area');
    this.inputEl = inputArea.createEl('textarea', {
      cls: 'logography-input',
      attr: {
        placeholder: 'Share a dream, a problem, or a question...',
        rows: '2',
      },
    });

    const sendBtn = inputArea.createEl('button', {
      text: 'Send',
      cls: 'logography-send-btn mod-cta',
    });

    // Event listeners
    sendBtn.addEventListener('click', () => this.handleSend());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Auto-resize textarea
    this.inputEl.addEventListener('input', () => {
      this.inputEl.style.height = 'auto';
      this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 120) + 'px';
    });

    // Sleepy UI: auto-focus input
    setTimeout(() => this.inputEl.focus(), 50);

    // Load or create session
    await this.loadOrCreateSession();
  }

  async onClose(): Promise<void> {
    // Save session on close
    if (this.sessionState && this.sessionState.conversation.length > 0) {
      await this.saveSession();
    }
  }

  private async loadOrCreateSession(): Promise<void> {
    // Try to resume latest incomplete session
    const existing = await this.plugin.vaultStorage.loadLatestSession();
    if (existing) {
      this.sessionState = existing;
      this.sessionStartTime = Date.now();
      this.updatePhaseIndicator(existing.currentPhase, currentStep(existing));

      // Re-render conversation
      for (const msg of existing.conversation) {
        this.addMessage(msg.role, msg.content);
      }

      if (existing.conversation.length === 0) {
        this.addMessage('assistant', 'Welcome back. Would you like to continue where we left off?');
      }
    } else {
      await this.startNewSession();
    }
  }

  private async handleSend(): Promise<void> {
    const text = this.inputEl.value.trim();
    if (!text || !this.sessionState) return;

    // Local crisis detection
    if (this.detectCrisis(text)) {
      this.addMessage('assistant', 'I want to pause here. If you\'re in crisis, please reach out to the 988 Suicide & Crisis Lifeline (call or text 988) or the Crisis Text Line (text HOME to 741741). You don\'t have to face this alone.');
      this.inputEl.value = '';
      return;
    }

    // Add user message to UI
    this.addMessage('user', text);
    this.inputEl.value = '';
    this.inputEl.style.height = 'auto';

    // Add to state conversation
    this.sessionState.conversation.push({
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    });

    // Track entry type on first message
    if (this.sessionState.turnCount === 0) {
      this.sessionState.entryType = this.detectEntryType(text);
      this.sessionState.rawNarration = text;
    }

    try {
      // Show thinking indicator
      const thinkingEl = this.addMessage('assistant', '...');
      thinkingEl.addClass('logography-thinking');

      // Build cross-session context
      const crossSessionContext = await this.crossSessionMemory.buildContext(this.sessionState.sessionId);

      // Send to server (stateless inference)
      const response = await this.plugin.server.sendVaultMessage(
        text,
        this.sessionState,
        crossSessionContext,
        this.sessionState.faithTradition
      );

      // Remove thinking indicator
      thinkingEl.remove();

      // Parse LLM response for phase signals
      const { signal, detail } = this.stateMachine.parseSignal(response.text);
      const cleanText = this.stateMachine.stripSignal(response.text);

      // Display AI response
      this.addMessage('assistant', cleanText);

      // Add to state conversation
      this.sessionState.conversation.push({
        role: 'assistant',
        content: cleanText,
        timestamp: new Date().toISOString(),
      });

      // Process phase signal and advance state
      this.stateMachine.processSignal(this.sessionState, signal, detail);

      // Update phase indicator
      this.updatePhaseIndicator(this.sessionState.currentPhase, currentStep(this.sessionState));

      // Save to vault
      await this.saveSession();

      // If session completed, compute summary and push metrics
      if (this.sessionState.completed) {
        await this.onSessionComplete();
      }

    } catch (error) {
      // Remove thinking indicator
      const thinking = this.messagesEl.querySelector('.logography-thinking');
      if (thinking) thinking.remove();

      const errorMsg = error instanceof Error ? error.message : 'Connection error';
      this.addMessage('assistant', errorMsg);

      // On auth errors, put the message back in the input so it's not lost
      if (errorMsg.includes('expired') || errorMsg.includes('Invalid API key') || errorMsg.includes('401')) {
        this.inputEl.value = text;
        this.sessionState.conversation.pop(); // Remove the user message from state too
      }
    }
  }

  private async saveSession(): Promise<void> {
    if (!this.sessionState) return;
    try {
      await this.plugin.vaultStorage.saveSession(this.sessionState);
    } catch (err) {
      console.error('Failed to save session to vault:', err);
    }

    // Sync to server if enabled
    if (this.plugin.settings.syncEnabled && this.plugin.settings.apiKey) {
      this.plugin.server.syncSession(this.sessionState, this.sessionState.summary);
    }
  }

  private async onSessionComplete(): Promise<void> {
    if (!this.sessionState) return;

    // Compute summary for frontmatter
    const summaryData = summarizeSession(this.sessionState);
    this.sessionState.summary = summaryData.summary;

    // Save final state with summary
    await this.saveSession();

    // Push metrics (fire-and-forget)
    const durationMinutes = Math.round((Date.now() - this.sessionStartTime) / 60000);
    const phasesCompleted = this.getPhasesCompleted();
    const deflated = this.sessionState.beliefs.filter(b => b.status === 'deflated' || b.status === 'partially_deflated').length;

    this.plugin.server.sendMetrics({
      user_id: this.sessionState.userId,
      session_id: this.sessionState.sessionId,
      metrics: {
        turn_count: this.sessionState.turnCount,
        duration_minutes: durationMinutes,
        phases_completed: phasesCompleted,
        beliefs_surfaced: this.sessionState.beliefs.length,
        beliefs_deflated: deflated,
        understanding_score: 0, // Will be set by user UI later
        entry_type: this.sessionState.entryType || 'session',
        completed: true,
      },
    });
  }

  private getPhasesCompleted(): string[] {
    if (!this.sessionState) return [];
    const allPhases = ['terrain', 'scenes', 'diagram', 'cross_exam', 'integration'];
    const currentIdx = allPhases.indexOf(this.sessionState.currentPhase);
    return allPhases.slice(0, currentIdx + 1);
  }

  private async startNewSession(): Promise<void> {
    // Save any existing session first
    if (this.sessionState && this.sessionState.conversation.length > 0) {
      await this.saveSession();
    }

    // Count existing sessions for numbering
    const existingSessions = await this.plugin.vaultStorage.listSessions();
    const sessionNumber = existingSessions.length + 1;

    // Create new session
    this.sessionState = createSession(
      this.plugin.settings.userId,
      sessionNumber,
      this.plugin.settings.faithTradition
    );
    this.sessionStartTime = Date.now();

    // Clear UI
    this.messagesEl.empty();
    this.updatePhaseIndicator(this.sessionState.currentPhase, currentStep(this.sessionState));

    // Initial greeting
    this.addMessage('assistant', 'What would you like to explore today? A dream, a problem, a question about yourself?');
  }

  private addMessage(role: 'user' | 'assistant', text: string): HTMLElement {
    const msgEl = this.messagesEl.createDiv(`logography-message ${role}`);
    msgEl.textContent = text;
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return msgEl;
  }

  private updatePhaseIndicator(phase: string, step: string): void {
    const phaseNames: Record<string, string> = {
      terrain: 'I: Terrain',
      scenes: 'II: Scenes',
      diagram: 'III: Analysis',
      cross_exam: 'IV: Cross-Examination',
      integration: 'V: Integration',
    };
    const phaseName = phaseNames[phase] || phase;
    const stepName = step.replace(/_/g, ' ');
    this.phaseEl.textContent = `${phaseName} — ${stepName}`;
  }

  private detectEntryType(text: string): 'dream' | 'problem' | 'question' {
    const lower = text.toLowerCase();
    if (lower.includes('dream') || lower.includes('nightmare') || lower.includes('sleep')) return 'dream';
    if (lower.includes('?') || lower.includes('how') || lower.includes('why') || lower.includes('what')) return 'question';
    return 'problem';
  }

  focusInput(): void {
    if (this.inputEl) {
      this.inputEl.focus();
    }
  }

  async loadSession(session: SessionState): Promise<void> {
    // Save current session if any
    if (this.sessionState && this.sessionState.conversation.length > 0) {
      await this.saveSession();
    }

    // Load the passed session
    this.sessionState = session;
    this.sessionStartTime = Date.now();

    // Clear and re-render
    this.messagesEl.empty();
    this.updatePhaseIndicator(session.currentPhase, currentStep(session));

    for (const msg of session.conversation) {
      this.addMessage(msg.role, msg.content);
    }

    if (session.conversation.length === 0) {
      this.addMessage('assistant', 'This session is empty. What would you like to explore?');
    }
  }

  private detectCrisis(text: string): boolean {
    const crisisKeywords = [
      'kill myself', 'suicide', 'want to die', 'end my life',
      'self harm', 'hurting myself', 'no reason to live',
      'better off dead', 'can\'t go on', 'give up on life',
    ];
    const lower = text.toLowerCase();
    return crisisKeywords.some(keyword => lower.includes(keyword));
  }
}

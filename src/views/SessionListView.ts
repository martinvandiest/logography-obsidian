// Session List — sidebar panel showing past sessions from vault
import { ItemView, WorkspaceLeaf } from 'obsidian';
import type LogographyPlugin from '../main';
import { LogographyView, VIEW_TYPE_LOGOGRAPHY } from './LogographyView';

export const VIEW_TYPE_SESSION_LIST = 'logography-session-list';

export class SessionListView extends ItemView {
  plugin: LogographyPlugin;
  private listEl: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: LogographyPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return VIEW_TYPE_SESSION_LIST; }
  getDisplayText(): string { return 'Sessions'; }
  getIcon(): string { return 'list'; }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass('logography-session-list');

    // Header
    const header = container.createDiv('logography-session-list-header');
    header.createEl('span', { text: 'Sessions', cls: 'logography-title' });
    const refreshBtn = header.createEl('button', {
      text: '↻',
      cls: 'logography-new-session-btn',
      attr: { title: 'Refresh session list' },
    });
    refreshBtn.addEventListener('click', () => void this.refresh());

    // List container
    this.listEl = container.createDiv('logography-sessions');

    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.listEl.empty();

    const sessions = await this.plugin.vaultStorage.listSessions();

    if (sessions.length === 0) {
      this.listEl.createDiv({ text: 'No sessions yet', cls: 'logography-session-date' });
      return;
    }

    // Sort newest first
    const sorted = [...sessions].sort((a, b) =>
      (b.startedAt || '').localeCompare(a.startedAt || '')
    );

    for (const session of sorted) {
      const item = this.listEl.createDiv('logography-session-item');

      const dateStr = session.startedAt
        ? new Date(session.startedAt).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
          })
        : 'Unknown date';

      const phase = session.currentPhase || '?';
      const turnCount = session.conversation?.length || 0;
      const completed = session.completed ? '✓' : '○';

      const dateEl = item.createDiv('logography-session-date');
      dateEl.textContent = `${completed} ${dateStr} — ${phase} (${turnCount} msgs)`;

      // Show summary if available
      if (session.summary) {
        const summaryEl = item.createDiv('logography-session-summary');
        summaryEl.textContent = session.summary.slice(0, 100) + (session.summary.length > 100 ? '...' : '');
      }

      // Click to open session in chat view
      item.addEventListener('click', () => {
        void (async () => {
          // Find or create the chat view
          let chatLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_LOGOGRAPHY)[0];
          if (!chatLeaf) {
            chatLeaf = this.app.workspace.getRightLeaf(false) || this.app.workspace.getLeaf();
            await chatLeaf.setViewState({ type: VIEW_TYPE_LOGOGRAPHY, active: true });
          }

          const chatView = chatLeaf.view as LogographyView;
          await chatView.loadSession(session);
          await this.app.workspace.revealLeaf(chatLeaf);

          // Highlight active session
          this.listEl.querySelectorAll('.logography-session-item').forEach(el =>
            el.removeClass('active')
          );
          item.addClass('active');
        })();
      });
    }
  }

  async onClose(): Promise<void> {}
}

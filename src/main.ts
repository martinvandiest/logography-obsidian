// Logography — Obsidian Plugin for AI Dream Analysis
// Architecture: Vault as source of truth. Plugin is the brain, server is the tongue.

import { Plugin, WorkspaceLeaf } from 'obsidian';
import { LogographySettings, DEFAULT_SETTINGS, LogographySettingTab } from './settings';
import { LogographyView, VIEW_TYPE_LOGOGRAPHY } from './views/LogographyView';
import { SessionListView, VIEW_TYPE_SESSION_LIST } from './views/SessionListView';
import { LogographyServer } from './server/LogographyServer';
import { VaultStorage } from './storage/VaultStorage';
import { MetricsReporter } from './metrics/MetricsReporter';

export default class LogographyPlugin extends Plugin {
  settings: LogographySettings;
  server: LogographyServer;
  vaultStorage: VaultStorage;
  metricsReporter: MetricsReporter;
  sessionListView: SessionListView | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Generate a stable user ID if not set
    if (!this.settings.userId) {
      this.settings.userId = `obsidian_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      await this.saveSettings();
    }

    // Initialize server client
    this.server = new LogographyServer(
      this.settings.serverUrl,
      this.settings.apiKey,
      this.settings.userId
    );

    // Initialize vault storage
    this.vaultStorage = new VaultStorage(this.app);
    await this.vaultStorage.ensureFolders();

    // Initialize metrics reporter
    this.metricsReporter = new MetricsReporter(this.server);

    // Register views
    this.registerView(VIEW_TYPE_LOGOGRAPHY, (leaf) => new LogographyView(leaf, this));
    this.registerView(VIEW_TYPE_SESSION_LIST, (leaf) => {
      const view = new SessionListView(leaf, this);
      this.sessionListView = view;
      return view;
    });

    // Ribbon icon — opens both chat + session list
    this.addRibbonIcon('brain', 'Open Logography', () => {
      this.activateView();
    });

    // Commands
    this.addCommand({
      id: 'open',
      name: 'Open Logography',
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: 'new-session',
      name: 'Logography: New Session',
      callback: () => {
        this.app.workspace.getLeavesOfType(VIEW_TYPE_LOGOGRAPHY).forEach(leaf => leaf.detach());
        this.activateView();
      },
    });

    this.addCommand({
      id: 'open-session-list',
      name: 'Logography: Open Session List',
      callback: () => this.activateSessionList(),
    });

    this.addCommand({
      id: 'quick-capture',
      name: 'Logography: Quick Capture',
      callback: () => this.quickCapture(),
    });

    // Settings tab
    this.addSettingTab(new LogographySettingTab(this.app, this));

    console.log('Logography loaded — Philosophical Midwifery for Obsidian');
  }

  async onunload(): Promise<void> {
    console.log('Logography unloaded');
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    if (this.server) {
      this.server.updateConfig(this.settings.serverUrl, this.settings.apiKey);
      this.server.updateUserId(this.settings.userId);
    }
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;

    // Open chat view in right sidebar
    let chatLeaf = workspace.getLeavesOfType(VIEW_TYPE_LOGOGRAPHY)[0];
    if (!chatLeaf) {
      chatLeaf = workspace.getRightLeaf(false) || workspace.getLeaf();
      await chatLeaf.setViewState({ type: VIEW_TYPE_LOGOGRAPHY, active: true });
    }
    workspace.revealLeaf(chatLeaf);

    // Also open session list in right sidebar (tab beside chat)
    await this.activateSessionList();
  }

  async activateSessionList(): Promise<void> {
    const { workspace } = this.app;

    let listLeaf = workspace.getLeavesOfType(VIEW_TYPE_SESSION_LIST)[0];
    if (!listLeaf) {
      // Open in same split as chat (tabbed)
      const chatLeaf = workspace.getLeavesOfType(VIEW_TYPE_LOGOGRAPHY)[0];
      if (chatLeaf) {
        listLeaf = workspace.createLeafBySplit(chatLeaf, 'vertical', false);
      } else {
        listLeaf = workspace.getRightLeaf(false) || workspace.getLeaf();
      }
      await listLeaf.setViewState({ type: VIEW_TYPE_SESSION_LIST, active: false });
    }
  }

  refreshSessionList(): void {
    if (this.sessionListView) {
      this.sessionListView.refresh();
    }
  }

  async quickCapture(): Promise<void> {
    await this.activateView();
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_LOGOGRAPHY);
    if (leaves.length > 0) {
      const view = leaves[0].view as LogographyView;
      view.focusInput();
    }
  }
}

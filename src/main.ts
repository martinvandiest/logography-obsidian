// Logography — Obsidian Plugin for AI Dream Analysis
// Based on Pierre Grimes' Philosophical Midwifery
// Architecture: Plugin is UI client. Server is the brain.
import { Plugin, WorkspaceLeaf } from "obsidian";
import { LogographySettings, DEFAULT_SETTINGS, LogographySettingTab } from "./settings";
import { LogographyView, VIEW_TYPE_LOGOGRAPHY } from "./views/LogographyView";
import { LogographyServer } from "./server/LogographyServer";
import { VaultStorage } from "./storage/VaultStorage";
import { AuthorMemory } from "./storage/AuthorMemory";

export default class LogographyPlugin extends Plugin {
  settings: LogographySettings;
  server: LogographyServer;
  vaultStorage: VaultStorage;
  authorMemory: AuthorMemory;

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

    // Initialize vault storage and author memory
    this.vaultStorage = new VaultStorage(this.app);
    this.authorMemory = new AuthorMemory(this.vaultStorage);

    // Ensure vault folders exist
    await this.vaultStorage.ensureFolders();

    // Load author memory
    if (this.settings.enableAuthorMemory) {
      await this.authorMemory.load();
    }

    // Register the chat view
    this.registerView(VIEW_TYPE_LOGOGRAPHY, (leaf) => new LogographyView(leaf, this));

    // Ribbon icon — opens the chat pane
    this.addRibbonIcon("brain", "Open Logography", () => {
      this.activateView();
    });

    // Command palette: open Logography
    this.addCommand({
      id: "open-logography",
      name: "Open Logography",
      callback: () => this.activateView(),
    });

    // Command palette: new session
    this.addCommand({
      id: "new-logography-session",
      name: "Logography: New Session",
      callback: () => {
        this.app.workspace.getLeavesOfType(VIEW_TYPE_LOGOGRAPHY).forEach(leaf => leaf.detach());
        this.activateView();
      },
    });

    // Settings tab
    this.addSettingTab(new LogographySettingTab(this.app, this));

    console.log("Logography loaded — Philosophical Midwifery for Obsidian");
  }

  async onunload(): Promise<void> {
    console.log("Logography unloaded");
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // Update server client with new settings
    if (this.server) {
      this.server.updateConfig(this.settings.serverUrl, this.settings.apiKey);
    }
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_LOGOGRAPHY)[0];
    if (!leaf) {
      // Open in right sidebar
      leaf = workspace.getRightLeaf(false) || workspace.getLeaf();
      await leaf.setViewState({ type: VIEW_TYPE_LOGOGRAPHY, active: true });
    }

    workspace.revealLeaf(leaf);
  }
}

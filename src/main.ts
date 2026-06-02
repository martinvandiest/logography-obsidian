// Logography — Obsidian Plugin for AI Dream Analysis
// Based on Pierre Grimes' Philosophical Midwifery
import { Plugin, WorkspaceLeaf } from "obsidian";
import { LogographySettings, DEFAULT_SETTINGS, LogographySettingTab } from "./settings";
import { LogographyView, VIEW_TYPE_LOGOGRAPHY } from "./views/LogographyView";
import { LLMClient } from "./llm/OpenRouterClient";
import { VaultStorage } from "./storage/VaultStorage";
import { AuthorMemory } from "./storage/AuthorMemory";

export default class LogographyPlugin extends Plugin {
  settings: LogographySettings;
  llm: LLMClient;
  vaultStorage: VaultStorage;
  authorMemory: AuthorMemory;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Initialize components
    this.llm = new LLMClient(
      this.settings.apiEndpoint,
      this.settings.apiKey,
      this.settings.model,
      this.settings.maxTokens
    );
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
        // Close existing and reopen
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
    // Update LLM client with new settings
    if (this.llm) {
      this.llm.updateConfig(
        this.settings.apiEndpoint,
        this.settings.apiKey,
        this.settings.model,
        this.settings.maxTokens
      );
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

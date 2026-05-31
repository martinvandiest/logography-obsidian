// Dreamaster — Obsidian Plugin for AI Dream Analysis
// Based on Pierre Grimes' Philosophical Midwifery
import { Plugin, WorkspaceLeaf } from "obsidian";
import { DreamasterSettings, DEFAULT_SETTINGS, DreamasterSettingTab } from "./settings";
import { DreamasterView, VIEW_TYPE_DREAMASTER } from "./views/DreamasterView";
import { LLMClient } from "./llm/OpenRouterClient";
import { VaultStorage } from "./storage/VaultStorage";
import { AuthorMemory } from "./storage/AuthorMemory";

export default class DreamasterPlugin extends Plugin {
  settings: DreamasterSettings;
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
    this.registerView(VIEW_TYPE_DREAMASTER, (leaf) => new DreamasterView(leaf, this));

    // Ribbon icon — opens the chat pane
    this.addRibbonIcon("brain", "Open Dreamaster", () => {
      this.activateView();
    });

    // Command palette: open Dreamaster
    this.addCommand({
      id: "open-dreamaster",
      name: "Open Dreamaster",
      callback: () => this.activateView(),
    });

    // Command palette: new session
    this.addCommand({
      id: "new-dreamaster-session",
      name: "Dreamaster: New Session",
      callback: () => {
        // Close existing and reopen
        this.app.workspace.getLeavesOfType(VIEW_TYPE_DREAMASTER).forEach(leaf => leaf.detach());
        this.activateView();
      },
    });

    // Settings tab
    this.addSettingTab(new DreamasterSettingTab(this.app, this));

    console.log("Dreamaster loaded — Philosophical Midwifery for Obsidian");
  }

  async onunload(): Promise<void> {
    console.log("Dreamaster unloaded");
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

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_DREAMASTER)[0];
    if (!leaf) {
      // Open in right sidebar
      leaf = workspace.getRightLeaf(false) || workspace.getLeaf();
      await leaf.setViewState({ type: VIEW_TYPE_DREAMASTER, active: true });
    }

    workspace.revealLeaf(leaf);
  }
}

export interface LogographySettings {
  // LLM Configuration
  apiEndpoint: string;
  apiKey: string;
  model: string;
  
  // Privacy
  enableAuthorMemory: boolean;
  shareMemoryWithAI: boolean;
  redactSensitiveData: boolean;
  
  // Session
  userName: string;
  maxTokens: number;
}

export const DEFAULT_SETTINGS: LogographySettings = {
  apiEndpoint: "https://openrouter.ai/api/v1/chat/completions",
  apiKey: "",
  model: "anthropic/claude-sonnet-4",
  enableAuthorMemory: true,
  shareMemoryWithAI: true,
  redactSensitiveData: true,
  userName: "",
  maxTokens: 1024,
};

import { App, PluginSettingTab, Setting } from "obsidian";
import type LogographyPlugin from "./main";

export class LogographySettingTab extends PluginSettingTab {
  plugin: LogographyPlugin;

  constructor(app: App, plugin: LogographyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Logography Settings" });

    // API Configuration
    containerEl.createEl("h3", { text: "API Configuration" });

    new Setting(containerEl)
      .setName("API Endpoint")
      .setDesc("OpenRouter or compatible API endpoint")
      .addText((text) =>
        text
          .setPlaceholder("https://openrouter.ai/api/v1/chat/completions")
          .setValue(this.plugin.settings.apiEndpoint)
          .onChange(async (value) => {
            this.plugin.settings.apiEndpoint = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("Your API key (stored securely in Obsidian secrets)")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Model")
      .setDesc("LLM model identifier")
      .addText((text) =>
        text
          .setPlaceholder("anthropic/claude-sonnet-4")
          .setValue(this.plugin.settings.model)
          .onChange(async (value) => {
            this.plugin.settings.model = value;
            await this.plugin.saveSettings();
          })
      );

    // User
    containerEl.createEl("h3", { text: "Session" });

    new Setting(containerEl)
      .setName("Your Name")
      .setDesc("How the guide addresses you (optional)")
      .addText((text) =>
        text
          .setPlaceholder("Enter your name")
          .setValue(this.plugin.settings.userName)
          .onChange(async (value) => {
            this.plugin.settings.userName = value;
            await this.plugin.saveSettings();
          })
      );

    // Privacy
    containerEl.createEl("h3", { text: "Privacy" });

    new Setting(containerEl)
      .setName("Enable Author Memory")
      .setDesc("Track patterns across sessions (stored locally only)")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableAuthorMemory).onChange(async (value) => {
          this.plugin.settings.enableAuthorMemory = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Share Memory with AI")
      .setDesc("Include cross-session memory in AI prompts")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.shareMemoryWithAI).onChange(async (value) => {
          this.plugin.settings.shareMemoryWithAI = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Redact Sensitive Data")
      .setDesc("Strip emails, phones, URLs, and addresses before sending to AI")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.redactSensitiveData).onChange(async (value) => {
          this.plugin.settings.redactSensitiveData = value;
          await this.plugin.saveSettings();
        })
      );
  }
}

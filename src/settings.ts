export interface LogographySettings {
  // Server Configuration
  serverUrl: string;
  apiKey: string;
  userId: string;

  // Privacy
  enableAuthorMemory: boolean;
  shareMemoryWithAI: boolean;

  // Display
  userName: string;
}

export const DEFAULT_SETTINGS: LogographySettings = {
  serverUrl: "https://logographyapp.com",
  apiKey: "",
  userId: "",
  enableAuthorMemory: true,
  shareMemoryWithAI: true,
  userName: "",
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

    // Server Configuration
    containerEl.createEl("h3", { text: "Server" });

    new Setting(containerEl)
      .setName("Server URL")
      .setDesc("Your Logography server address")
      .addText((text) =>
        text
          .setPlaceholder("https://logographyapp.com")
          .setValue(this.plugin.settings.serverUrl)
          .onChange(async (value) => {
            this.plugin.settings.serverUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("Your Logography API key (stored in plugin settings)")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("logography-...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("User ID")
      .setDesc("Your Logography account ID (auto-assigned on signup)")
      .addText((text) =>
        text
          .setPlaceholder("obsidian_user_abc123")
          .setValue(this.plugin.settings.userId)
          .onChange(async (value) => {
            this.plugin.settings.userId = value;
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

    // Status
    containerEl.createEl("h3", { text: "Status" });
    const statusEl = containerEl.createDiv();
    statusEl.createEl("p", {
      text: `Server: ${this.plugin.settings.serverUrl || "Not configured"}`,
    });
    statusEl.createEl("p", {
      text: `User ID: ${this.plugin.settings.userId || "Not configured"}`,
    });
  }
}

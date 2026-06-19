// Logography Settings — faith tradition, model selection, server config

import { App, PluginSettingTab, Setting } from 'obsidian';
import type LogographyPlugin from './main';

export interface LogographySettings {
  // Server
  serverUrl: string;
  apiKey: string;
  userId: string;

  // Session
  userName: string;
  faithTradition: string;
  recoveryMode: boolean;

  // Model
  model: string;
}

export const FAITH_TRADITIONS = [
  { value: '', label: 'None' },
  { value: 'buddhist', label: 'Buddhist' },
  { value: 'christian.catholic', label: 'Christian — Catholic' },
  { value: 'christian.protestant', label: 'Christian — Protestant' },
  { value: 'christian.orthodox', label: 'Christian — Orthodox' },
  { value: 'hindu', label: 'Hindu' },
  { value: 'jewish', label: 'Jewish' },
  { value: 'muslim', label: 'Muslim' },
  { value: 'shinto', label: 'Shinto' },
  { value: 'taoist', label: 'Taoist' },
  { value: 'sikh', label: 'Sikh' },
  { value: 'indigenous', label: 'Indigenous / First Nations' },
  { value: 'pagan', label: 'Pagan / Wiccan' },
  { value: 'bahai', label: "Bahá'í" },
  { value: 'jain', label: 'Jain' },
  { value: 'zoroastrian', label: 'Zoroastrian' },
  { value: 'secular', label: 'Secular / Non-religious' },
  { value: 'philosophical', label: 'Philosophical (Platonic, Stoic, etc.)' },
  { value: 'syncretic', label: 'Syncretic / Multiple traditions' },
];

export const MODELS = [
  { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet (default)' },
  { value: 'anthropic/claude-haiku', label: 'Claude Haiku (faster)' },
  { value: 'openai/gpt-4o', label: 'GPT-4o' },
];

export const DEFAULT_SETTINGS: LogographySettings = {
  serverUrl: 'https://logographyapp.com',
  apiKey: '',
  userId: '',
  userName: '',
  faithTradition: '',
  recoveryMode: false,
  model: 'anthropic/claude-sonnet-4',
};

export class LogographySettingTab extends PluginSettingTab {
  plugin: LogographyPlugin;

  constructor(app: App, plugin: LogographyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Logography Settings' });

    // --- Account ---
    containerEl.createEl('h3', { text: 'Account' });

    new Setting(containerEl)
      .setName('Server URL')
      .setDesc('Your Logography server address')
      .addText((text) =>
        text
          .setPlaceholder('https://logographyapp.com')
          .setValue(this.plugin.settings.serverUrl)
          .onChange(async (value) => {
            this.plugin.settings.serverUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('API key')
      .setDesc('Your Logography API key (stored securely)')
      .addText((text) => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder('logography-...')
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          });
      });

    // --- Session ---
    containerEl.createEl('h3', { text: 'Session' });

    new Setting(containerEl)
      .setName('Your name')
      .setDesc('How the guide addresses you (optional)')
      .addText((text) =>
        text
          .setPlaceholder('Enter your name')
          .setValue(this.plugin.settings.userName)
          .onChange(async (value) => {
            this.plugin.settings.userName = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Faith tradition')
      .setDesc('Informs the AI\'s language and framing (optional)')
      .addDropdown((dropdown) => {
        for (const tradition of FAITH_TRADITIONS) {
          dropdown.addOption(tradition.value, tradition.label);
        }
        dropdown.setValue(this.plugin.settings.faithTradition);
        dropdown.onChange(async (value) => {
          this.plugin.settings.faithTradition = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Recovery support')
      .setDesc('12-step recovery framework (stacks with faith tradition)')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.recoveryMode).onChange(async (value) => {
          this.plugin.settings.recoveryMode = value;
          await this.plugin.saveSettings();
        })
      );

    // --- Model ---
    containerEl.createEl('h3', { text: 'AI Model' });

    new Setting(containerEl)
      .setName('Model')
      .setDesc('Which AI model to use for analysis')
      .addDropdown((dropdown) => {
        for (const model of MODELS) {
          dropdown.addOption(model.value, model.label);
        }
        dropdown.setValue(this.plugin.settings.model);
        dropdown.onChange(async (value) => {
          this.plugin.settings.model = value;
          await this.plugin.saveSettings();
        });
      });

    // --- Status ---
    containerEl.createEl('h3', { text: 'Status' });
    const statusEl = containerEl.createDiv();
    statusEl.createEl('p', {
      text: `Server: ${this.plugin.settings.serverUrl || 'Not configured'}`,
    });
    statusEl.createEl('p', {
      text: `User ID: ${this.plugin.settings.userId || 'Not configured'}`,
    });
    statusEl.createEl('p', {
      text: `Data: Stored in your Obsidian vault (Logography/ folder)`,
    });
  }
}

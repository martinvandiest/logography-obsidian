// Logography Settings — login flow, faith tradition, model selection

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type LogographyPlugin from './main';
import type { AuthResponse } from './server/LogographyServer';

export interface LogographySettings {
  // Auth (populated by login flow)
  serverUrl: string;
  apiKey: string;       // JWT token — set by login, not manually
  userId: string;
  userEmail: string;
  userDisplayName: string;

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
  userEmail: '',
  userDisplayName: '',
  userName: '',
  faithTradition: '',
  recoveryMode: false,
  model: 'anthropic/claude-sonnet-4',
};

export class LogographySettingTab extends PluginSettingTab {
  plugin: LogographyPlugin;
  private loginEmail = '';
  private loginPassword = '';
  private mfaUserId = '';
  private mfaCode = '';
  private showMfa = false;
  private statusEl: HTMLElement | null = null;

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

    const isLoggedIn = !!this.plugin.settings.apiKey;

    if (isLoggedIn) {
      this.renderLoggedIn(containerEl);
    } else if (this.showMfa) {
      this.renderMfa(containerEl);
    } else {
      this.renderLogin(containerEl);
    }

    // --- Session (only when logged in) ---
    if (isLoggedIn) {
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
    }

    // --- Status ---
    containerEl.createEl('h3', { text: 'Status' });
    this.statusEl = containerEl.createDiv();
    this.renderStatus();
  }

  private renderLogin(containerEl: HTMLElement): void {
    const loginDiv = containerEl.createDiv('logography-login-form');
    loginDiv.createEl('p', {
      text: 'Sign in to your Logography account.',
      cls: 'logography-login-desc',
    });

    new Setting(loginDiv)
      .setName('Email')
      .addText((text) => {
        text.inputEl.type = 'email';
        text
          .setPlaceholder('you@example.com')
          .onChange((value) => { this.loginEmail = value; });
      });

    new Setting(loginDiv)
      .setName('Password')
      .addText((text) => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder('Password')
          .onChange((value) => { this.loginPassword = value; });
      });

    const btnRow = loginDiv.createDiv('logography-login-buttons');
    const loginBtn = btnRow.createEl('button', {
      text: 'Sign in',
      cls: 'mod-cta',
    });
    loginBtn.addEventListener('click', () => this.handleLogin());

    const signupLink = btnRow.createEl('a', {
      text: 'Create account',
      href: 'https://logographyapp.com',
    });
    signupLink.style.marginLeft = '16px';
    signupLink.style.fontSize = '13px';
  }

  private renderMfa(containerEl: HTMLElement): void {
    const mfaDiv = containerEl.createDiv('logography-mfa-form');
    mfaDiv.createEl('p', {
      text: 'Enter the code from your authenticator app.',
    });

    new Setting(mfaDiv)
      .setName('Verification code')
      .addText((text) => {
        text
          .setPlaceholder('000000')
          .onChange((value) => { this.mfaCode = value; });
      });

    const btnRow = mfaDiv.createDiv('logography-login-buttons');
    const verifyBtn = btnRow.createEl('button', {
      text: 'Verify',
      cls: 'mod-cta',
    });
    verifyBtn.addEventListener('click', () => this.handleMfaVerify());

    const backBtn = btnRow.createEl('button', { text: 'Back' });
    backBtn.style.marginLeft = '8px';
    backBtn.addEventListener('click', () => {
      this.showMfa = false;
      this.mfaUserId = '';
      this.display();
    });
  }

  private renderLoggedIn(containerEl: HTMLElement): void {
    const infoDiv = containerEl.createDiv('logography-account-info');
    infoDiv.createEl('p', {
      text: `Signed in as ${this.plugin.settings.userEmail}`,
    });
    if (this.plugin.settings.userDisplayName) {
      infoDiv.createEl('p', {
        text: this.plugin.settings.userDisplayName,
        cls: 'logography-display-name',
      });
    }

    const logoutBtn = infoDiv.createEl('button', { text: 'Sign out' });
    logoutBtn.addEventListener('click', async () => {
      this.plugin.settings.apiKey = '';
      this.plugin.settings.userId = '';
      this.plugin.settings.userEmail = '';
      this.plugin.settings.userDisplayName = '';
      this.plugin.server.updateConfig(this.plugin.settings.serverUrl, '');
      await this.plugin.saveSettings();
      new Notice('Signed out');
      this.display();
    });
  }

  private renderStatus(): void {
    if (!this.statusEl) return;
    this.statusEl.empty();

    const items: string[] = [];
    items.push(`Server: ${this.plugin.settings.serverUrl || 'Not configured'}`);

    if (this.plugin.settings.apiKey) {
      items.push(`Account: ${this.plugin.settings.userEmail}`);
      items.push(`Data: Stored in your Obsidian vault (Logography/ folder)`);
    } else {
      items.push('Account: Not signed in');
    }

    for (const item of items) {
      this.statusEl.createEl('p', { text: item });
    }
  }

  private async handleLogin(): Promise<void> {
    if (!this.loginEmail || !this.loginPassword) {
      new Notice('Email and password required');
      return;
    }

    try {
      const response = await this.plugin.server.login(this.loginEmail, this.loginPassword);

      // Check if MFA is required
      if (response.mfa_required) {
        this.mfaUserId = response.user_id;
        this.showMfa = true;
        this.display();
        return;
      }

      // Store auth
      await this.onLoginSuccess(response);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Login failed';
      new Notice(`Login failed: ${msg}`);
    }
  }

  private async handleMfaVerify(): Promise<void> {
    if (!this.mfaCode) {
      new Notice('Enter your verification code');
      return;
    }

    try {
      const response = await this.plugin.server.verifyMfa(
        this.loginEmail,
        this.mfaCode,
        this.mfaUserId
      );
      await this.onLoginSuccess(response);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'MFA verification failed';
      new Notice(`MFA failed: ${msg}`);
    }
  }

  private async onLoginSuccess(response: AuthResponse): Promise<void> {
    if (!response.token) {
      new Notice('Login succeeded but no token received');
      return;
    }
    this.plugin.settings.apiKey = response.token;
    this.plugin.settings.userId = response.user_id;
    this.plugin.settings.userEmail = response.email;
    this.plugin.settings.userDisplayName = response.display_name || '';
    this.plugin.server.updateConfig(this.plugin.settings.serverUrl, response.token);
    this.plugin.server.updateUserId(response.user_id);
    await this.plugin.saveSettings();

    this.showMfa = false;
    this.mfaUserId = '';
    this.loginEmail = '';
    this.loginPassword = '';

    new Notice(`Signed in as ${response.email}`);
    this.display();
  }
}

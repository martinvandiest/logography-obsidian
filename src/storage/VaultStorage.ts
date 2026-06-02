// Vault Storage — local backup of sessions as markdown
// Server owns the session state. Plugin just saves transcripts locally.

import { App, TFile, Vault } from "obsidian";

const SESSIONS_FOLDER = "Logography/Sessions";
const PATTERNS_FOLDER = "Logography/Patterns";

export class VaultStorage {
  private vault: Vault;

  constructor(app: App) {
    this.vault = app.vault;
  }

  getVault(): Vault {
    return this.vault;
  }

  async ensureFolders(): Promise<void> {
    await this.ensureFolder(SESSIONS_FOLDER);
    await this.ensureFolder(PATTERNS_FOLDER);
  }

  private async ensureFolder(path: string): Promise<void> {
    const existing = this.vault.getAbstractFileByPath(path);
    if (!existing) {
      await this.vault.createFolder(path);
    }
  }

  // Save author memory summary to patterns folder
  async saveAuthorMemory(summary: string): Promise<void> {
    const filepath = `${PATTERNS_FOLDER}/author-memory.md`;
    const content = `# Logography — Author Memory\n\n*Auto-generated cross-session pattern summary. Updated after each session.*\n\n${summary}\n\n---\n*Last updated: ${new Date().toISOString()}*\n`;

    const existing = this.vault.getAbstractFileByPath(filepath);
    if (existing instanceof TFile) {
      await this.vault.modify(existing, content);
    } else {
      await this.vault.create(filepath, content);
    }
  }

  // Load existing author memory
  async loadAuthorMemory(): Promise<string> {
    const filepath = `${PATTERNS_FOLDER}/author-memory.md`;
    const file = this.vault.getAbstractFileByPath(filepath);
    if (file instanceof TFile) {
      const content = await this.vault.read(file);
      const match = content.match(/\*Auto-generated.*?\*[\s\S]*?(?=\n\n---)/);
      return match ? match[0].replace(/\*Auto-generated.*?\*\n\n/, "").trim() : "";
    }
    return "";
  }
}

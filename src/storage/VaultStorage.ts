// Vault Storage — sessions as markdown with YAML frontmatter
// Vault is the source of truth. Server stores nothing.

import { App, TFile, TFolder, Vault } from 'obsidian';
import {
  SessionState,
  stateToDict,
  dictToState,
  ConversationMessage,
} from '../engine/types';

const SESSIONS_FOLDER = 'Logography/Sessions';
const JOURNAL_FOLDER = 'Logography/Journal';

export class VaultStorage {
  private app: App;
  private vault: Vault;

  constructor(app: App) {
    this.app = app;
    this.vault = app.vault;
  }

  getVault(): Vault {
    return this.vault;
  }

  async ensureFolders(): Promise<void> {
    await this.ensureFolder('Logography');
    await this.ensureFolder(SESSIONS_FOLDER);
    await this.ensureFolder(JOURNAL_FOLDER);
  }

  private async ensureFolder(path: string): Promise<void> {
    const existing = this.vault.getAbstractFileByPath(path);
    if (!existing) {
      await this.vault.createFolder(path);
    }
  }

  // --- Session I/O ---

  /**
   * Save session state + conversation to vault as markdown with YAML frontmatter.
   * Creates or updates the session file.
   */
  async saveSession(state: SessionState): Promise<void> {
    const filepath = this.sessionFilePath(state);
    const content = this.sessionToMarkdown(state);

    const existing = this.vault.getAbstractFileByPath(filepath);
    if (existing instanceof TFile) {
      await this.vault.modify(existing, content);
    } else {
      // Ensure parent folder exists
      const parts = filepath.split('/');
      parts.pop();
      await this.ensureFolder(parts.join('/'));
      await this.vault.create(filepath, content);
    }
  }

  /**
   * Load a session from vault by session ID.
   * Scans the sessions folder for matching frontmatter.
   */
  async loadSession(sessionId: string): Promise<SessionState | null> {
    const folder = this.vault.getAbstractFileByPath(SESSIONS_FOLDER);
    if (!(folder instanceof TFolder)) return null;

    for (const file of folder.children) {
      if (file instanceof TFile && file.extension === 'md') {
        const content = await this.vault.read(file);
        const frontmatter = this.parseFrontmatter(content);
        if (frontmatter && frontmatter.session_id === sessionId) {
          return this.parseSessionFile(content);
        }
      }
    }
    return null;
  }

  /**
   * Load the most recent incomplete session (for resume).
   */
  async loadLatestSession(): Promise<SessionState | null> {
    const sessions = await this.listSessions();
    const incomplete = sessions.filter(s => !s.completed);
    if (incomplete.length === 0) return null;
    return this.loadSession(incomplete[0].sessionId);
  }

  /**
   * List all sessions from vault (sorted by date, newest first).
   * Returns lightweight summaries — does NOT load full conversation.
   */
  async listSessions(): Promise<SessionState[]> {
    const folder = this.vault.getAbstractFileByPath(SESSIONS_FOLDER);
    if (!(folder instanceof TFolder)) return [];

    const sessions: SessionState[] = [];
    for (const file of folder.children) {
      if (file instanceof TFile && file.extension === 'md') {
        const content = await this.vault.read(file);
        const state = this.parseSessionFile(content);
        if (state) sessions.push(state);
      }
    }

    // Sort newest first
    sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    return sessions;
  }

  /**
   * Append a single message exchange to the session file.
   * More efficient than rewriting the whole file on every turn.
   */
  async appendToSession(state: SessionState, userMsg: string, aiMsg: string): Promise<void> {
    const filepath = this.sessionFilePath(state);
    const existing = this.vault.getAbstractFileByPath(filepath);

    if (existing instanceof TFile) {
      await this.vault.process(existing, (data) => {
        // Append before the closing --- if it exists, or just at the end
        const entry = `\n\n**You:** ${userMsg}\n\n**Logography:** ${aiMsg}\n`;
        return data + entry;
      });
    }
  }

  /**
   * Delete a session file from vault.
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const folder = this.vault.getAbstractFileByPath(SESSIONS_FOLDER);
    if (!(folder instanceof TFolder)) return false;

    for (const file of folder.children) {
      if (file instanceof TFile && file.extension === 'md') {
        const content = await this.vault.read(file);
        const frontmatter = this.parseFrontmatter(content);
        if (frontmatter && frontmatter.session_id === sessionId) {
          await this.app.fileManager.trashFile(file);
          return true;
        }
      }
    }
    return false;
  }

  // --- Serialization ---

  private sessionFilePath(state: SessionState): string {
    const date = state.startedAt.slice(0, 10);
    return `${SESSIONS_FOLDER}/${date}-${state.sessionId}.md`;
  }

  private sessionToMarkdown(state: SessionState): string {
    const dict = stateToDict(state);
    const frontmatter = this.dictToYaml(dict);
    const conversation = this.conversationToMarkdown(state.conversation);

    return `---\n${frontmatter}---\n\n# Logography Session — ${new Date(state.startedAt).toLocaleDateString()}\n\n${conversation}`;
  }

  private conversationToMarkdown(messages: ConversationMessage[]): string {
    if (messages.length === 0) return '*Session in progress...*\n';

    return messages.map(m => {
      const label = m.role === 'user' ? 'You' : 'Logography';
      return `**${label}:** ${m.content}\n`;
    }).join('\n');
  }

  /**
   * Minimal YAML serializer for frontmatter.
   * Handles strings, numbers, booleans, arrays of primitives, arrays of objects.
   */
  private dictToYaml(dict: Record<string, unknown>, indent = 0): string {
    let yaml = '';
    const pad = '  '.repeat(indent);

    for (const [key, value] of Object.entries(dict)) {
      if (value === undefined || value === null) continue;

      if (Array.isArray(value)) {
        if (value.length === 0) {
          yaml += `${pad}${key}: []\n`;
        } else if (typeof value[0] === 'object') {
          yaml += `${pad}${key}:\n`;
          for (const item of value) {
            yaml += `${pad}  -\n`;
            for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
              if (v === undefined || v === null) continue;
              yaml += `${pad}    ${k}: ${this.yamlValue(v)}\n`;
            }
          }
        } else {
          yaml += `${pad}${key}:\n`;
          for (const item of value) {
            yaml += `${pad}  - ${this.yamlValue(item)}\n`;
          }
        }
      } else if (typeof value === 'object') {
        yaml += `${pad}${key}:\n`;
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          if (v === undefined || v === null) continue;
          yaml += `${pad}  ${k}: ${this.yamlValue(v)}\n`;
        }
      } else {
        yaml += `${pad}${key}: ${this.yamlValue(value)}\n`;
      }
    }

    return yaml;
  }

  private yamlValue(value: unknown): string {
    if (typeof value === 'string') {
      // Quote strings that could be misinterpreted
      if (value.includes(':') || value.includes('#') || value.includes('"') || value === '' || /^\d/.test(value)) {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return value;
    }
    return String(value);
  }

  // --- Frontmatter Parsing ---

  /**
   * Parse YAML frontmatter from a markdown file.
   * Simple parser — handles the subset of YAML we generate.
   */
  parseFrontmatter(content: string): Record<string, unknown> | null {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;

    const yaml = match[1];
    return this.parseYamlSimple(yaml);
  }

  /**
   * Parse a session file into a SessionState object.
   */
  parseSessionFile(content: string): SessionState | null {
    const frontmatter = this.parseFrontmatter(content);
    if (!frontmatter || !frontmatter.session_id) return null;

    const state = dictToState(frontmatter);

    // Parse conversation from the markdown body
    const body = content.replace(/^---\n[\s\S]*?\n---\n*/, '');
    state.conversation = this.parseConversation(body);

    return state;
  }

  private parseConversation(body: string): ConversationMessage[] {
    const messages: ConversationMessage[] = [];
    const regex = /\*\*(You|Logography):\*\*\s*([\s\S]*?)(?=\n\*\*(?:You|Logography):\*\*|$)/g;
    let match;

    while ((match = regex.exec(body)) !== null) {
      messages.push({
        role: match[1] === 'You' ? 'user' : 'assistant',
        content: match[2].trim(),
        timestamp: '', // Not preserved in markdown format
      });
    }

    return messages;
  }

  /**
   * Minimal YAML parser for frontmatter.
   * Handles: scalars, arrays of scalars, arrays of objects, nested objects.
   */
  private parseYamlSimple(yaml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yaml.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const keyMatch = line.match(/^(\w+):\s*(.*)/);
      if (!keyMatch) { i++; continue; }

      const key = keyMatch[1];
      const val = keyMatch[2].trim();

      if (val === '' || val === '[]') {
        // Could be array or object
        const nextLine = lines[i + 1];
        if (nextLine && nextLine.trim().startsWith('-')) {
          // Array
          const arr: unknown[] = [];
          i++;
          while (i < lines.length && lines[i].trim().startsWith('-')) {
            const itemLine = lines[i].trim().slice(2).trim();
            if (itemLine === '' || itemLine.includes(':')) {
              // Object item
              const obj: Record<string, unknown> = {};
              i++;
              while (i < lines.length && lines[i].startsWith('    ')) {
                const propMatch = lines[i].trim().match(/^(\w+):\s*(.*)/);
                if (propMatch) {
                  obj[propMatch[1]] = this.parseYamlScalar(propMatch[2].trim());
                }
                i++;
              }
              arr.push(obj);
            } else {
              arr.push(this.parseYamlScalar(itemLine));
              i++;
            }
          }
          result[key] = arr;
          continue;
        } else if (nextLine && nextLine.startsWith('  ') && !nextLine.trim().startsWith('-')) {
          // Nested object
          const obj: Record<string, unknown> = {};
          i++;
          while (i < lines.length && lines[i].startsWith('  ') && !lines[i].trim().startsWith('-')) {
            const propMatch = lines[i].trim().match(/^(\w+):\s*(.*)/);
            if (propMatch) {
              obj[propMatch[1]] = this.parseYamlScalar(propMatch[2].trim());
            }
            i++;
          }
          result[key] = obj;
          continue;
        } else {
          result[key] = val === '[]' ? [] : '';
          i++;
          continue;
        }
      }

      result[key] = this.parseYamlScalar(val);
      i++;
    }

    return result;
  }

  private parseYamlScalar(val: string): unknown {
    if (val === '' || val === 'null') return null;
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (/^-?\d+$/.test(val)) return parseInt(val, 10);
    if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);
    // Remove quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      return val.slice(1, -1);
    }
    return val;
  }
}

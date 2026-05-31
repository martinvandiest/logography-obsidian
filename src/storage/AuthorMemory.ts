// Author Memory — cross-session pattern tracking
// Single evolving text string updated by the LLM after each session
// Inspired by Deleometer's approach but structured for Pierre's method

import { VaultStorage } from "./VaultStorage";

export class AuthorMemory {
  private storage: VaultStorage;
  private summary: string = "";
  private updateQueue: Promise<void> = Promise.resolve();

  constructor(storage: VaultStorage) {
    this.storage = storage;
  }

  async load(): Promise<void> {
    this.summary = await this.storage.loadAuthorMemory();
  }

  getSummary(): string {
    return this.summary;
  }

  // Queue an update to prevent race conditions
  queueUpdate(newSummary: string): void {
    this.updateQueue = this.updateQueue.catch(() => {}).then(async () => {
      if (newSummary && newSummary !== this.summary) {
        this.summary = newSummary;
        await this.storage.saveAuthorMemory(newSummary);
      }
    });
  }

  // Build context string for prompt injection
  getContextForPrompt(enabled: boolean, shared: boolean): string {
    if (!enabled) {
      return "Cross-session memory: disabled by user settings.";
    }
    if (!shared) {
      return "Cross-session memory: stored locally but not shared with AI.";
    }
    if (!this.summary.trim()) {
      return "Cross-session memory: none yet (first session).";
    }
    return `Cross-session memory (patterns from previous sessions):\n${this.summary.trim()}`;
  }

  // Build the prompt instruction for updating memory
  getUpdateInstruction(): string {
    return `Based on this session, update the author memory summary. 
Capture enduring patterns, recurring beliefs, progress made, and areas still under exploration. 
Keep it under 200 words. Focus on what would be useful context for future sessions.

Previous memory summary:
${this.summary || "(none yet)"}

Provide ONLY the updated summary text, no preamble.`;
  }
}

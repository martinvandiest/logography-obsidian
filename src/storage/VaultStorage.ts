// Vault Storage — sessions as markdown files in the user's Obsidian vault
// ALL data stays local. Nothing leaves the device except LLM prompts.

import { App, TFile, TFolder, Vault } from "obsidian";
import { SessionState } from "../state/PhaseMachine";

const SESSIONS_FOLDER = "Dreamaster/Sessions";
const PATTERNS_FOLDER = "Dreamaster/Patterns";

export class VaultStorage {
  private vault: Vault;

  constructor(app: App) {
    this.vault = app.vault;
  }

  // Ensure folders exist
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

  // Save a completed session as a markdown note
  async saveSession(state: SessionState): Promise<string> {
    const date = new Date().toISOString().split("T")[0];
    const title = this.getSessionTitle(state);
    const filename = `${SESSIONS_FOLDER}/${date}-${title}.md`;

    const content = this.formatSessionAsMarkdown(state);
    
    const existing = this.vault.getAbstractFileByPath(filename);
    if (existing instanceof TFile) {
      await this.vault.modify(existing, content);
    } else {
      await this.vault.create(filename, content);
    }

    return filename;
  }

  // Append a chat exchange to an existing session note
  async appendChatToSession(
    filePath: string,
    userMessage: string,
    aiResponse: string,
    phase: string,
    step: string
  ): Promise<void> {
    const file = this.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return;

    const existing = await this.vault.read(file);
    const chatBlock = `\n\n---\n\n### Chat (${new Date().toLocaleTimeString()})\n**Phase ${phase} — ${step}**\n\n**You:** ${userMessage}\n\n**Guide:** ${aiResponse}\n`;

    await this.vault.modify(file, existing + chatBlock);
  }

  // Save author memory summary to patterns folder
  async saveAuthorMemory(summary: string): Promise<void> {
    const filepath = `${PATTERNS_FOLDER}/author-memory.md`;
    const content = `# Dreamaster — Author Memory\n\n*Auto-generated cross-session pattern summary. Updated after each session.*\n\n${summary}\n\n---\n*Last updated: ${new Date().toISOString()}*\n`;

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
      // Extract just the summary section (between first heading and last line)
      const match = content.match(/\*Auto-generated.*?\*[\s\S]*?(?=\n\n---)/);
      return match ? match[0].replace(/\*Auto-generated.*?\*\n\n/, "").trim() : "";
    }
    return "";
  }

  // Get recent sessions for context
  async getRecentSessions(limit: number = 5): Promise<{ path: string; summary: string }[]> {
    const files = this.vault.getMarkdownFiles()
      .filter(f => f.path.startsWith(SESSIONS_FOLDER))
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, limit);

    const sessions: { path: string; summary: string }[] = [];
    for (const file of files) {
      const content = await this.vault.read(file);
      // Extract summary from the Session Summary section
      const summaryMatch = content.match(/## Session Summary\n([\s\S]*?)(?=\n##|$)/);
      sessions.push({
        path: file.path,
        summary: summaryMatch ? summaryMatch[1].trim().slice(0, 200) : file.basename,
      });
    }
    return sessions;
  }

  private getSessionTitle(state: SessionState): string {
    // Create a meaningful title from the dream/problem content
    const words = state.rawNarration.split(" ").slice(0, 5).join("-");
    const clean = words.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase();
    return clean || "session";
  }

  private formatSessionAsMarkdown(state: SessionState): string {
    const lines: string[] = [
      `# Dreamaster Session`,
      ``,
      `**Date:** ${new Date().toLocaleDateString()}`,
      `**Type:** ${state.entryType || "unknown"}`,
      `**Final Phase:** ${state.currentPhase} — ${state.currentStep}`,
      ``,
      `---`,
      ``,
      `## Dream / Problem`,
      ``,
      state.rawNarration,
      ``,
    ];

    // Dream elements
    if (state.dreamElements.characters.length > 0) {
      lines.push(`## Dream Elements`, ``);
      if (state.dreamElements.characters.length > 0) {
        lines.push(`**Characters:** ${state.dreamElements.characters.map(c => c.name).join(", ")}`);
      }
      if (state.dreamElements.emotions.length > 0) {
        lines.push(`**Emotions:** ${state.dreamElements.emotions.map((e: any) => e.emotion).join(", ")}`);
      }
      if (state.dreamElements.recurring.length > 0) {
        lines.push(`**Recurring:** ${state.dreamElements.recurring.join(", ")}`);
      }
      lines.push(``);
    }

    // Scenes
    if (state.scenes.length > 0) {
      lines.push(`## Scenes`, ``);
      state.scenes.forEach(s => {
        const marker = s.selected ? " ⭐" : "";
        lines.push(`- ${s.description} [charge: ${s.emotionalCharge}]${marker}`);
        if (s.negativeState) lines.push(`  Negative state: *${s.negativeState}*`);
      });
      lines.push(``);
    }

    // Beliefs
    if (state.beliefs.length > 0) {
      lines.push(`## Beliefs Discovered`, ``);
      state.beliefs.forEach(b => {
        const depth = b.deeperThanBelief ? ` (deeper layer)` : "";
        lines.push(`- **"${b.statement}"**${depth}`);
        lines.push(`  Status: ${b.status} | Deflation: ${b.deflationLevel}`);
        if (b.originScene) lines.push(`  Origin: ${b.originScene}`);
      });
      lines.push(``);
    }

    // Insights
    if (state.insights.length > 0) {
      lines.push(`## Insights`, ``);
      state.insights.forEach(i => lines.push(`- ${i.text}`));
      lines.push(``);
    }

    // Goals
    if (state.goals.length > 0) {
      lines.push(`## Goals`, ``);
      state.goals.forEach(g => lines.push(`- ${g}`));
      lines.push(``);
    }

    // Session Summary
    lines.push(`## Session Summary`, ``);
    lines.push(this.generateSummary(state));
    lines.push(``);

    return lines.join("\n");
  }

  private generateSummary(state: SessionState): string {
    const parts: string[] = [];
    parts.push(`Phase ${state.currentPhase} session.`);
    
    if (state.entryType === "dream") {
      parts.push(`Explored dream: "${state.rawNarration.slice(0, 80)}..."`);
    }

    if (state.beliefs.length > 0) {
      const mainBelief = state.beliefs[0];
      parts.push(`Identified belief: "${mainBelief.statement}".`);
      parts.push(`Status: ${mainBelief.deflationLevel === "full" ? "deflated" : "under examination"}.`);
    }

    if (state.insights.length > 0) {
      parts.push(`Key insight: ${state.insights[0].text}`);
    }

    return parts.join(" ");
  }
}

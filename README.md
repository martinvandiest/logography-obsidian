# Logography

Analyze dreams and explore personal beliefs through guided Socratic dialogue. Sessions stay in your vault as Markdown.

## What it does

Logography guides you through a structured self-examination process based on Socratic questioning — the same method used in philosophical counseling. You bring a dream, a problem, or a question, and the AI walks you through five phases:

1. **Terrain** — Set the scene. What's on your mind?
2. **Scenes** — Identify specific moments and their emotional weight.
3. **Diagram** — Surface beliefs and assumptions.
4. **Cross-Examination** — Test those beliefs against reality.
5. **Integration** — What holds up? What doesn't?

Sessions are saved as Markdown files in your vault with YAML frontmatter — fully readable, searchable, and yours.

## Features

- **Guided dialogue** — Not a chatbot. A structured method with phase transitions.
- **Cross-session memory** — The AI remembers your previous sessions from your vault.
- **Faith traditions** — Optional. Select a faith lens (Christian, Buddhist, Islamic, Jewish, secular, and more) to frame the dialogue.
- **Recovery mode** — Optional. 12-step sponsor voice for recovery-focused work.
- **Crisis detection** — Automatic handoff to 988 Suicide & Crisis Lifeline if crisis language is detected.
- **Data sovereignty** — Your vault is the database. By default, the server does inference only and stores nothing.

## Network and account requirements

This plugin requires a network connection and a Logography account:

- **Account required:** A Logography account is needed to use the AI features. Sign up at [logographyapp.com](https://logographyapp.com).
- **Network use:** The plugin connects to `logographyapp.com` to send your message and session context for AI inference. The server returns a response and stores nothing by default.
- **No telemetry:** The plugin does not include client-side telemetry, analytics, or tracking.
- **No self-update:** The plugin does not include a self-update mechanism.

## Optional session sync

By default, sessions are stored only in your vault. If you enable **Sync sessions to server** in plugin settings, the plugin will push a copy of each session to the server after every save. This allows:

- **Cross-device access** — Import your sessions on any device using the Import button.
- **Backup** — Sessions are retained on the server according to your account's retention policy (default: never auto-delete).

When sync is enabled:
- Full session content (conversation, beliefs, scenes, phase) is stored encrypted on the server.
- Your vault remains the source of truth — the server holds a copy.
- Synced sessions can be imported on other devices via Settings → Import.
- You can disable sync at any time. Existing synced sessions remain on the server until you delete them or your retention policy expires.

When sync is disabled (default):
- The server receives your message for inference only. No session content is stored.
- Sessions exist only in your local vault.

## Privacy

- Sessions are stored only in your vault as local Markdown files by default.
- Cross-session memory reads from your vault files — nothing is stored server-side.
- If sync is enabled, a copy of each session is stored on the server for cross-device access.
- No analytics, no tracking, no training on your data.

## Getting started

1. Enable the plugin in Settings → Community Plugins.
2. Click the brain icon in the ribbon to open Logography.
3. Share a dream, a problem, or a question.

## Commands

- **Logography: Open** — Open the chat pane.
- **Logography: New Session** — Start a fresh session.
- **Logography: Open Session List** — Browse past sessions.
- **Logography: Quick Capture** — Open and focus the input.

## Support

- [GitHub Issues](https://github.com/martinvandiest/logography-obsidian/issues)

## License

[Apache-2.0](LICENSE)

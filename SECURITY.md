# Security

## Reporting a vulnerability

Open a [private security advisory](https://github.com/DBB-FC/why-graph/security/advisories/new)
on this repository. Please do not open a public issue for a vulnerability.

Expect a first answer within a week. There is no bounty programme.

## Why it reads every note in the vault

The directory's automated review flags this plugin for **vault enumeration**, and the flag
is correct: the map asks Obsidian for the list of every markdown file and for the links
between them. A map of your notes cannot be drawn from a subset.

What that access is used for, and nothing else:

- the note's path, to place it in a layer and colour it by topic;
- its links, to draw the lines;
- its text, read on demand, to find the sentence where a link was written.

Everything stays in the vault. The plugin has no server and makes no network request for
any of it. Folders you exclude in the settings are never drawn, and notes are sent to an
AI provider only when you press the suggest button, one or two notes at a time.

## What the plugin does with your data

- Your notes are read from the vault and stay there. The plugin has no server and no
  telemetry, and it makes no network request unless you ask for an AI suggestion.
- When you do, the two notes involved are sent to the AI provider **you** configured, with
  **your** key. That exchange is between you and that provider.
- API keys are stored in Obsidian's per-device local storage, never in `data.json`, so
  they do not travel through Obsidian Sync, git or a backup.
- External links declared in the frontmatter are opened only if they use `http` or
  `https`; a `javascript:`, `file:` or `data:` URL in a note is ignored.
- The plugin writes to a note only after you press Approve, and only as an appended line.

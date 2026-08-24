# Slash commands for the Claude VS Code extension

These four files are project slash commands. Copy them into `.claude/commands/`
in this repository and they become `/verify`, `/migration`, `/a11y` and
`/brand-check` inside the Claude extension.

From the repo root, in PowerShell:

```powershell
New-Item -ItemType Directory -Force .claude\commands | Out-Null
Copy-Item docs\claude-commands\*.md .claude\commands\ -Exclude README.md
```

or in Git Bash:

```bash
mkdir -p .claude/commands
cp docs/claude-commands/{verify,migration,a11y,brand-check}.md .claude/commands/
```

They live here rather than directly in `.claude/` because remote tooling is not
allowed to write into that folder — it holds your personal tool permissions
(`settings.local.json`), which nothing automated should touch.

| Command | What it does |
|---|---|
| `/verify` | The full quality gate: typecheck, lint, unit + integration, E2E, in order, stopping at the first failure. |
| `/migration <description>` | Creates the next numbered migration correctly and regenerates the database types. |
| `/a11y` | Runs the accessibility gate and fixes what it finds — the right way, not by lowering the threshold. |
| `/brand-check [path]` | Audits a change against the brand and content rules: tokens, logo integrity, invented facts, template shapes. |

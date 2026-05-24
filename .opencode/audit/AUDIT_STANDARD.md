# Agent Audit Log Standard

All agents (lead agents, microagents) must log their actions and decisions step-by-step during execution.

## Log file location
```
.opencode/audit/YYYY-MM-DD-HHMMSS-agentname-NNN.md
```
Where `NNN` is a sequence number (001, 002, etc.) if multiple runs occur in the same second.

## Log format
Each log file starts with a header, followed by a chronological list of entries.

```markdown
# Audit: {agent-name}
**Task**: {brief description of what was requested}
**Delegated by**: {supervisor | user | parent-agent}
**Started**: {ISO datetime}
**Files**: {list of files read as context}

## Log

### 1. {action description}
- **Action**: {what was done — read, write, search, think, decide}
- **Target**: {file path, function, config, etc.}
- **Rationale**: {why this action was taken}
- **Outcome**: {result — success, failure, found X lines, etc.}

### 2. {next action}
- **Action**: ...
- **Target**: ...
- **Rationale**: ...
- **Outcome**: ...

## Summary
- **Total actions**: {N}
- **Files created**: {list}
- **Files modified**: {list}
- **Decisions made**: {key decisions with rationale}
- **Problems encountered**: {any issues, blockers, workarounds}
- **Completed**: {ISO datetime}
```

## Rules
1. Every read, write, search, edit, bash command, or decision must be logged as a step
2. Rationale must explain WHY, not just WHAT
3. Errors and failures must be logged explicitly
4. Each agent run produces one log file
5. The supervisor collects these logs after agent runs finish and writes them to the audit directory
6. When an agent delegates to a sub-agent, the sub-agent creates its own audit log

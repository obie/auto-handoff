---
name: handoff
description: Write a handoff document so a fresh session can pick up this work. Use when a session is about to end or go cold, before switching tasks, or when the user asks for a handoff.
allowed-tools: Write(docs/handoffs/**), Edit(docs/handoffs/**), Bash(date *), Bash(git status *), Bash(mkdir -p docs/handoffs*)
---

# Handoff

Write one markdown file that lets a new session continue this work. Its reader starts with none of this conversation.

This skill often runs unattended, after the session has sat idle with nobody at the keyboard. Ask no questions and wait for no confirmation. Write the file from what you already know.

The steps below are pre-approved. Any other command or file write may raise a permission prompt that nobody is there to answer, and the handoff would never be written. Stay inside the steps.

## Steps

1. Run this one command, exactly as written: `date +%Y-%m-%d-%H%M; git status --short --branch`. Outside a git repository its second half fails, and that is fine. Skip any other investigation, because every extra tool call rereads the whole conversation.
2. Write the file with the Write tool to `docs/handoffs/<timestamp>-<slug>.md` under the project root. `<slug>` is two to five lowercase words naming the work, joined by hyphens. Write creates the directory when it is missing, so run no `mkdir`.
3. Reply with the file's path and one sentence on what it covers. Leave the file uncommitted.

When the conversation holds no work worth resuming, say so in one sentence and write nothing.

## What goes in the file

Use these headings in this order, and drop any that would be empty.

- **Goal**: what the person is trying to get done, in their own terms.
- **Status**: what is finished, what is half done, and what has not been started.
- **Decisions**: each choice made and the reason for it, including options the person ruled out.
- **Dead ends**: what was tried and failed, so the next session skips it.
- **Files**: the paths that matter, each with a phrase on why.
- **Verification**: the commands that show whether the work is working, with their last known result.
- **Next steps**: an ordered list whose first item is specific enough to start on at once.
- **Open questions**: what only the person can answer.

Use exact paths, command lines, identifiers and error text. Record any standing instructions the person gave about how to work, since the next session will not have heard them.

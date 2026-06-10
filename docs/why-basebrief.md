# Why BaseBrief?

AI coding sessions lose context.

When a chat window gets long, a model changes, or a project moves to another AI tool, the next assistant often starts by rediscovering the same facts: what the repo is, what already changed, what must not be touched, and what the next narrow task is.

BaseBrief keeps that handoff small and reviewable.

## Why Not Just Paste Chat History?

Chat history is noisy. It mixes confirmed facts, guesses, old plans, mistakes, tool output, and casual discussion. The next AI has to infer what still matters.

BaseBrief turns the useful parts into a cleaner continuation package:

- current project state
- confirmed facts and decisions
- risk boundaries
- open questions
- a copyable next-window starter
- a check summary that says whether the package needs review

## What BaseBrief Gives You

BaseBrief gives you a local handoff artifact that can be read before the next AI acts. It is designed to be checked, copied, and corrected by a human.

The default CLI path is:

```text
node scripts/basebrief.js continue --repo . --output-dir tests/outputs/private/continue
```

The main file to copy into the next AI window is:

```text
NEXT_WINDOW_STARTER.md
```

## When You Do Not Need BaseBrief

You probably do not need BaseBrief for:

- one-off questions
- tiny scripts with no lasting context
- simple concept explanations
- tasks where the next AI can understand everything from one file
- situations where you do not need a new window or handoff

## The Boundary

BaseBrief does not call providers, write code automatically, push changes, manage cloud state, or replace a spec framework. It only prepares a local continuation package so the next AI can start from reviewed context instead of guesswork.

# Contributing

Thanks for your interest in contributing. This project optimizes for maintainer time.
That means we accept fewer PRs, with higher expectations for quality and context.

## Before You Start
- Read the relevant code and docs to understand the larger design
- If you are not comfortable explaining the change and its trade offs, please do not
  open a PR
- We welcome AI assisted code, but you are responsible for reviewing and understanding
  every line you submit

## When to Open a Discussion First
These PRs will be closed if a discussion did not happen first:
- Breaking API changes
- Any new or changed dependencies (runtime or dev)

Use the Discussions area for proposals, trade offs, and context. We prefer to align on
direction before code is written (This is the hard part)

## Basic Workflow
1) Clone and install:
```
git clone https://github.com/withfabricxyz/spandex.git
cd spandex
bun install
```

2) Make changes on a branch:
```
git checkout -b <branch-name>
```

3) Build and test:
```
bun run build
bun test
```

4) Fork and push:
```
git remote add fork https://github.com/<you>/<repo>.git
git push fork <branch-name>
```

5) Open a PR from your fork.

## Writing Docs
We use Vocs for documentation. The docs site lives in `site/`.

1) Start the docs dev server:
```
cd site
bun dev
```

2) Edit files any relevant files
3) If you touch docs in a PR, keep changes scoped and include any relevant updates
to examples or API references.

## Changesets

This project uses [changesets](https://github.com/changesets/changesets) to rev versions and release packages. If your changes
should increment the version (they impact api surface area), then run `bun changeset`
and include release notes describing the change prior to opening a PR.


## PR Requirements
- Scope is focused and justifiable
- Tests are updated or added where applicable
- Docs are updated where applicable
- No breaking API changes without prior discussion
- No dependency changes without prior discussion
- You can explain the change, reasoning, and alternatives in the PR description
- Included changeset file if the changes impact released artifacts

If you cannot meet these requirements, please use Discussions instead of a PR.

## Reviewer Perspective
Every PR costs maintainer time: reading, testing, context-building, and follow-up.
PRs that shift the burden to reviewers will be closed. High-quality PRs that show
clear understanding and responsible ownership are welcome. We aim to provide the
highest quality project, over time.

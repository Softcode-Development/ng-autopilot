# <Product name>

<!-- guide: the human entry point to the repo. Say what the project is and how it works, then point into the docs. Each fact lives once (autopilot ai-first-docs rule): no commands, versions, conventions or setup steps copied from the docs below — link them. Content the README already had that no doc holds (badges, deploy notes) stays, as its own section, and is listed in the install coverage map. -->

<What it is, who uses it and what it must do well — two sentences: the product, its users, the markets or tenants it serves.>

## How it works

<One paragraph on the shape of the system: the apps or builds in this repo, what each talks to (backend API, auth provider, third-party services), what differs per market, tenant or environment, and where it runs. Name the parts; the details stay in the doc that owns them.>

## Start here

| Need | Where |
|---|---|
__START_HERE__

<!-- guide: add a row for each project doc outside the set (ADRs in docs/adr/, upgrade records, runbooks). -->

## How work happens

Development is AI-driven on the ng-autopilot workspace. [CLAUDE.md](CLAUDE.md) is the index agents start from, and the project's hard rules live in [.claude/rules/project.md](.claude/rules/project.md). Every change goes through `/deliver`: a plan the owner approves, implementation, tests, gates and review, then a pushed branch and a PR whose merge the owner approves. Git hooks check every commit and push; [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) has the commands to run them by hand.

# The Room Protocol: Shared-State Coordination for Multi-Agent Software Development

> Condensed problem statement and contributions. The full treatment,
> including the terminology that separates **the Room Protocol** (the design) from
> **roomd** (the implementation), is in [`the-room-protocol-whitepaper.md`](the-room-protocol-whitepaper.md).
>
> **Status:** superseded as a drafting note. Open questions below are resolved in the whitepaper (July 2026 revision). Kept for provenance.

## Working title
The Room Protocol: Shared-State Coordination for Multi-Agent Software Development

> The protocol is named for its central abstraction: a **room**. A room is a single
> `roomId` that namespaces all coordination state (plan, context, events, presence,
> locks, plus minor shared variables) and is also the unit of ownership and tenancy. Agents do not message each
> other; they join a room and read and write its shared state. roomd is the
> reference implementation of this protocol, layered on the Model Context Protocol
> and backed by a single key-value store.
>
> Alternate names considered: ACP (Agent Coordination Protocol), SSCP (Shared-State
> Coordination Protocol).

---

## 1. Problem statement

LLM coding agents are good at working alone. A single agent can hold a task, read a codebase, edit files, and report back. The moment a second agent joins the same project, that strength stops being enough.

Two or more agents working on one system have to agree on things they cannot each invent alone: the shape of an API one builds and the other consumes, which task each is doing, whether work is finished, and what was decided. Today that usually happens in one of three ways.

1. **A human relays it.** The operator copies an API contract from one agent's chat into another's. That puts a person on every handoff.
2. **The agents talk in natural language.** One agent describes what it needs. Conversation is lossy and order-dependent. There is no durable record to query later, no receipt that a message was seen, and nothing stopping two agents from editing the same plan at once.
3. **They share a filesystem or repo.** This works for code but not for intent. A git history does not tell agent B that agent A is mid-way through the auth service right now, or that a contract it depends on changed five minutes ago.

The underlying issue is that these approaches treat coordination as **message-passing** when the thing agents actually need is **shared state**. Messages are transient and have to be interpreted. State is durable and can be queried. An agent that boots cold should be able to ask "what is the current plan, what is mine, what changed since I last looked, who else is here" and get a structured answer, not replay a transcript.

Making this work for **more than one team at once, safely** is a separate problem. A coordination layer that any agent can read is a single-tenant demo. A real one has to isolate teams, let a team own its workspace, hand out scoped guest access, survive restarts without losing state, and resist a misbehaving client. Those are ordinary systems problems; many agent-coordination experiments skip them.

## 2. Thesis statement

A small set of **structured, persistent, queryable state primitives** (plan, typed context, events, presence, locks, plus minor shared vars), exposed over MCP and backed by one key-value store, coordinates multi-agent software work more reliably than conversational message-passing. Statelessness, one store, and explicit ownership are also what make it multi-tenant without extra machinery.

roomd is the reference implementation: a stateless MCP server on Upstash Redis, used with Claude Code on real projects. It deploys as a container (e.g. Railway) with the dashboard on Vercel; nothing in the design depends on a particular host.

## 3. Contributions

This whitepaper makes the following contributions.

1. **A primitive set for agent coordination.** It identifies five core state primitives (plan, context, events, presence, locks) and a minor shared-variables adjunct, and argues they are sufficient to coordinate independent coding agents, with the reasoning for each and the tools that expose them (25 in total).

2. **A structured-context model.** Rather than free text, context entries are typed (`api_contract`, `arch_decision`, `task`, `change_request`, `note`) with per-type payload schemas, so a consuming agent can rely on shape rather than parse prose. Durable change requests are context entries; the event log carries notifications such as `context_available`.

3. **A stateless, single-store architecture.** It shows that a fully stateless MCP server (fresh transport and server per request) backed by one Redis instance is enough to provide durable, restartable coordination, and documents the complete key schema that makes this work in roomd.

4. **A layered multi-tenancy and access model.** Three secret types (static team keys, dynamic team keys, room-scoped invite tokens) resolve to a team identity; first-touch room ownership via an atomic set-if-absent claim isolates workspaces; per-team fixed-window rate limiting that fails open protects the service. None of this requires a relational database or a separate auth service.

5. **A concurrency mechanism for shared plans.** It shows how a distributed lock (atomic set-with-expiry plus bounded backoff retry) prevents two agents from corrupting a read-modify-write on the shared plan, and how presence and per-agent read cursors give each agent a once-per-agent view of events without coordination between agents.

6. **A reflection on what was deliberately left out** (semantic search, push notification, deep context versioning) and why polling and structured pull were sufficient for the first production version, plus an evaluation methodology and illustrative session cost model.

## 4. Scope and non-goals

- This is not a general multi-agent framework or an agent runtime. It coordinates agents; it does not run or schedule them.
- It is not a chat system. There is no conversational channel as a first-class feature; the event log is structured and typed.
- It does not address agent reasoning quality, prompt design, or model selection. It assumes capable agents and asks only how they should share state.
- The controlled A/B evaluation is future work; the whitepaper includes methodology and an illustrative handoff cost model.

---

## Resolved drafting questions

- Related-work section: included (MCP, blackboard systems, A2A/FIPA, CRDTs, orchestrators).
- Evaluation concreteness: methodology + illustrative canonical-handoff tool-call counts; full A/B study still future work.
- roomd-web: framed as supporting tooling, not a first-class contribution.

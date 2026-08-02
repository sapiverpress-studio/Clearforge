# How to adopt AI tools that work inside the apps your team already uses

AI tools are increasingly embedded directly into the software platforms teams use daily, such as project management boards, design suites, messaging apps, and accounting software. Rather than treating AI as a separate destination, organizations are shifting toward integrating AI features into existing workflows to reduce context switching and improve data continuity.

## What it means

Adopting AI inside existing apps means using features that operate within your current security and data perimeter. Instead of moving sensitive information to external browser windows or public AI models, teams use integrated tools—such as AI-powered document summarization in project boards or automated data entry in accounting software—to handle routine tasks. This approach treats AI as a functional layer within established business processes rather than a standalone experiment.

## How it works in practice

Successful adoption focuses on three operational pillars: containment, handoffs, and human review.

1. **Containment:** Use tools that operate within your existing security boundaries. For example, using AI features inside enterprise-managed platforms like Notion, Salesforce, or Xero allows teams to maintain access controls and audit logs.
2. **Handoffs:** Design workflows where AI handles the initial draft or data triage, then passes the output to a human for verification. For instance, an AI agent might capture invoice data, but a human must approve the final posting to the ledger.
3. **Review:** Establish explicit checkpoints. If an AI tool drafts a response or summarizes a meeting, a human must verify the accuracy and tone before the output reaches a client or is finalized in a system of record.

## Why organisations are adopting it

Organizations are moving toward integrated AI to solve the "shadow AI" problem, where employees use unapproved personal accounts to process company data. By providing easy-to-use, governed AI features within standard tools, companies can:

* **Reduce data leakage:** Keep information within the company's security perimeter.
* **Improve productivity:** Eliminate the time lost to copying and pasting between apps.
* **Standardize quality:** Ensure that AI-assisted outputs follow company-defined templates and review standards.

## What changes for people and workflows

For employees, the shift is from "prompting" to "workflow management." Instead of spending time crafting complex prompts, staff focus on setting up the environment—such as repository instructions or project templates—that guides the AI. The role of the manager shifts to defining the "harness": the boundaries, permission inheritance, and mandatory review gates that ensure AI-generated work meets quality standards.

## Limits, risks and what remains uncertain

* **Discovery vs. Remediation:** Automated discovery of issues (like software bugs or data anomalies) can outpace human capacity to fix them. If your AI identifies 90 critical bugs in a month, but your team can only patch 10, you have created a bottleneck.
* **Autonomous Risk:** As AI agents gain the ability to interact with external systems, traditional prompt-based guardrails may be insufficient. Network-level isolation and zero-trust authorization are required to prevent unauthorized system access.
* **Transparency:** As regulatory requirements like the EU AI Act take effect, organizations must ensure that AI-assisted content is properly labeled and that provenance is traceable.

## Practical questions to ask before using it

* **Where is the human checkpoint?** Can we identify the exact step where a person must review the AI output before it is sent or published?
* **What is the triage queue?** If the AI finds 100 issues, do we have an automated system to prioritize them for human review?
* **Who owns the data?** Does the tool keep our data within our security perimeter, or is it used to train public models?
* **What is the fallback?** If the AI fails or produces an error, how do we revert to a manual process without stopping the entire workflow?

## Current examples

* **Finance:** Xero's JAX platform automates document capture and workflow tasks for small businesses, reducing manual entry while keeping the human in the loop for final approval.
* **Project Management:** Notion 3.6 allows teams to assign tasks to external agents from a shared board, keeping the brief, the agent's work, and the human review in one place.
* **Support:** Salesforce's Agentforce provides prepackaged help agents that route complex cases to humans, using a pay-per-resolution model that aligns costs with actual work completed.
* **Design:** Canva AI 2.0 integrates research, design, and scheduling into one loop, allowing creators to manage the full campaign lifecycle within a single workspace.

## Sources and further reading

* [Xero Announces New AI Innovations at Xerocon London](https://www.xero.com/uk/media-releases/xero-announces-new-ai-innovations-xerocon-london/)
* [Notion 3.6: External Agents, HTML blocks, and more](https://www.notion.com/releases/2026-07-01)
* [Salesforce Announces Prepackaged Agentforce Help Agent](https://www.salesforce.com/uk/news/stories/agentforce-help-agent-announcement/?bc=OTH)
* [Introducing Canva AI 2.0: Reimagining how the world creates](https://www.canva.com/newsroom/news/canva-create-2026-ai/)
* [Anthropic: UST is bringing Claude to physical AI](https://www.anthropic.com/news/ust-claude)

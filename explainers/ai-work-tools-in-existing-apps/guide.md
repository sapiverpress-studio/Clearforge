# How to adopt AI tools that work inside the apps your team already uses

AI tools are increasingly embedded directly into the software platforms teams use daily, such as project management boards, document editors, and communication channels. Adopting these tools effectively requires shifting from a mindset of "using a chatbot" to "redesigning a workflow." The most successful implementations focus on automating repetitive data-handling tasks while maintaining clear human-in-the-loop checkpoints for quality, compliance, and final approval.

## What it means

Adopting AI inside existing apps means moving away from isolated, browser-based chat interfaces and toward integrated agentic platforms. These tools connect to your company's data, such as inventory systems, project tickets, or document repositories. The goal is to reduce context switching—the time lost moving information between different apps—by allowing AI to perform tasks like summarizing meeting notes, drafting responses, or updating project statuses within the environment where the work already lives.

## How it works in practice

Integration typically follows a pattern of triage, drafting, and review. For example, in a project management tool like Notion or Jira, an AI agent might be assigned to monitor a thread, draft a technical specification based on previous documentation, or flag missing information in a ticket. The AI does not replace the human; it acts as a participant that prepares the work for human verification. 

Practical steps include:
1. **Mapping the workflow:** Identify a repetitive task, such as invoice processing or meeting follow-ups.
2. **Defining the boundary:** Clearly state what the AI can draft (e.g., a summary) and what it cannot do (e.g., send an email to a client without a human signature).
3. **Establishing the review gate:** Require a human to verify the output against source material before it is published or sent.

## Why organisations are adopting it

Organisations are moving toward integrated AI to improve operational efficiency and data consistency. By using platforms like QwenWork or integrated agentic tools in Jira and Salesforce, companies can ensure that AI operates within established security perimeters. This approach reduces the risk of "shadow AI," where employees use unapproved personal accounts to process sensitive company data. Furthermore, as inference costs for models like GPT-5.6 Luna drop, it becomes economically viable to route routine tasks to low-cost models while reserving more capable models for complex reasoning.

## What changes for people and workflows

For employees, the role shifts from "doing the task" to "governing the agent." This requires new skills in workflow design and verification. Instead of writing simple prompts, workers must learn to manage the "harness"—the repository instructions, permission boundaries, and review gates that keep AI output reliable. For managers, the focus shifts to defining clear security boundaries and permission inheritance, ensuring that team members can innovate within safe, pre-approved limits.

## Limits, risks and what remains uncertain

- **Discovery vs. Remediation:** A significant risk is that AI can identify issues (such as software bugs or contract errors) faster than human teams can fix them. Without an automated triage system, this creates a bottleneck rather than a solution.
- **Security and Egress:** As agents gain the ability to browse the web or execute shell commands, they require strict network-level zero-trust controls. Prompt-based guardrails are insufficient to prevent unauthorized system access.
- **Compliance:** With the EU AI Act transparency rules now in effect, organisations must ensure that AI-generated content is properly labeled and that metadata is preserved. The long-term impact of these regulations on software design is still evolving.

## Practical questions to ask before using it

- **Where does the data live?** Does the AI tool process data within our existing security perimeter, or does it send information to an external vendor?
- **What is the human checkpoint?** At what point in this workflow does a human review the output, and what happens if the AI makes a mistake?
- **Who owns the failure?** If the AI agent performs an incorrect action, is there a clear log of the decision-making process that we can audit?
- **Is there an automated triage queue?** If we are automating discovery, do we have a system to prioritize findings for human remediation?

## Current examples

- **Integrated Workspaces:** Platforms like Notion 3.6 allow teams to assign tasks to external agents directly from shared boards, keeping the context of the work attached to the project record.
- **Finance Automation:** Tools like Xero's JAX platform automate document capture and workflow steps for bookkeeping, reducing manual data entry while keeping the accountant in control of the final posting.
- **Customer Support:** Salesforce's Agentforce provides prepackaged help agents with pay-per-resolution pricing, allowing support teams to scale capacity without building custom AI infrastructure.
- **Video Production:** Google Vids integrates Gemini Omni to allow users to generate and edit clips with built-in SynthID watermarking, ensuring that provenance is tracked from the draft stage.

## Sources and further reading

- [OpenAI: A scorecard for the AI age](https://openai.com/index/a-scorecard-for-the-ai-age/)
- [Atlassian: How we’re evolving Jira for AI-native software development](https://www.atlassian.com/blog/company-news/ai-sdlc)
- [European Commission: Commission starts enforcing AI Act rules and new transparency requirements](https://digital-strategy.ec.europa.eu/en/news/commission-starts-enforcing-ai-act-rules-and-new-transparency-requirements-2-august)
- [Anthropic: Investigating three real-world incidents in our cybersecurity evaluations](https://www.anthropic.com/news/investigating-three-real-world-incidents-in-our-cybersecurity-evaluations)

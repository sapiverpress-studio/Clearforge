# Source notes — 2026-07-29

Podcast focused on: GitHub Copilot architecture analysis shifts focus from prompts to the agent harness

## Sources supplied to the script generator

- 1. AWS Machine Learning Blog: How AgentCore Gateway supports the MCP 2026-07-28 spec
  - URL: https://aws.amazon.com/blogs/machine-learning/how-agentcore-gateway-supports-the-mcp-2026-07-28-spec/
  - Published/date field: 2026-07-28
  - Confirmed fact: On July 28, 2026, the Model Context Protocol (MCP) team published its 2026-07-28 specification, converting MCP into a stateless protocol running over standard HTTP infrastructure, adding OAuth 2.0/OpenID Connect enterprise authorization, and establishing lifecycle guarantees. AWS announced immediate opt-in support for the spec in Amazon Bedrock AgentCore Gateway via a single UpdateGateway API call.
  - Interpretation: Transitioning MCP to stateless requests removes persistent session management bottlenecks, enabling enterprise engineering teams to secure and scale AI agent traffic using standard web load balancers, firewalls, and identity providers rather than bespoke agent middleware.
- 2. The GitHub Blog: The harness is all you need (mostly)
  - URL: https://github.blog/ai-and-ml/github-copilot/the-harness-is-all-you-need-mostly/
  - Published/date field: 2026-07-27
  - Confirmed fact: GitHub published technical architecture guidance on July 27, 2026, demonstrating that developer productivity gains from AI depend on the agent harness—repository context, issue tracking, terminal permission boundaries, and review gates—rather than prompt engineering hacks. Separately, GitHub detailed how re-architecting Copilot code review around pull request evidence reduced review costs by 20% while preserving review accuracy.
  - Interpretation: Software automation is shifting focus from prompt optimization to workflow containment, ensuring AI agents operate within defined repositories, explicit instruction files, and strict human pull request review gates.
- 3. ProPublica: Anthropic's New AI Model Can Identify More Software Bugs Than Ever. Microsoft Is Struggling to Fix Them Fast Enough.
  - URL: https://www.propublica.org/article/anthropic-claude-mythos-microsoft-bugs-vulnerabilities
  - Published/date field: 2026-07-29
  - Confirmed fact: Internal Microsoft meeting recordings reveal that Anthropic's pre-release Claude Mythos model discovered 90 critical bugs and 141 important vulnerabilities in Microsoft SharePoint during April 2026 alone. Microsoft engineering managers confirmed that the AI model identified software flaws faster than human development teams could write, test, and release patches, triggering an internal "mad dash" to remediate code.
  - Interpretation: Unchecked AI automation in vulnerability discovery creates severe operational bottlenecks when human remediation and patch verification pipelines cannot keep pace, demonstrating that automated analysis tools require structured triage queues and human testing fallbacks.
- 4. Anthropic Newsroom: Cognizant and Anthropic expand their partnership to bring Claude to enterprise clients
  - URL: https://www.anthropic.com/news/cognizant-anthropic-expansion
  - Published/date field: 2026-07-27
  - Confirmed fact: Anthropic and Cognizant announced an expanded enterprise partnership on July 27, 2026, embedding Claude into Cognizant's Flowsource engineering platform and Neuro platforms. Over 30,000 Cognizant associates completed Claude training, and Cognizant introduced a "Frontier Certified" workforce model. Cognizant reported an initial deployment where an agentic contract-intelligence system for a biopharma client reduced contract review duration by up to 40% with over 88% extraction accuracy.
  - Interpretation: Enterprise adoption of complex AI agents relies on specialized systems integrators to enforce domain-specific governance, spec-driven development standards, and human-in-the-loop validation before agent outputs reach production environments.

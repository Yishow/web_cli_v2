export function createAgentMarkdownChunks(prompt: string): string[] {
  const safePrompt = prompt.trim() || "Untitled prompt";

  return [
    "# Agent stream response\n\n",
    `You asked the agent terminal to think about: **${safePrompt}**.\n\n`,
    "## Suggested next actions\n\n- Inspect the current shell state\n- Compare transport boundaries\n- Validate the final UX in-browser\n\n",
    "## Example command\n\n```bash\npnpm lint && pnpm typecheck && pnpm build\n```\n\n",
    "## Notes\n\nThis endpoint is intentionally mock-driven so the terminal streaming contract stays testable without a model backend.\n",
  ];
}

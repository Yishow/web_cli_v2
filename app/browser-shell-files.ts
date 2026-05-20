export const BROWSER_SHELL_FILES: Record<string, string> = {
  "/home/user/README.md": `# web_cli_v2 demo shell

This fallback shell runs entirely in the browser.

- No backend transport
- No persistence
- Safe for quick product demos
`,
  "/home/user/package.json": `{
  "name": "web_cli_v2-demo-shell",
  "private": true,
  "description": "Browser-only fallback shell for web_cli_v2"
}
`,
  "/home/user/examples/hello.sh": `#!/bin/bash
echo "Hello from the web_cli_v2 demo shell"
echo "This shell runs entirely in your browser"
echo "Try: ls, cat README.md, cat SSH_NOTES.md"
`,
  "/home/user/SSH_NOTES.md": `# SSH mode

Use the main SSH mode when you need a real remote shell with:

- password auth
- private key auth
- resize handling
- explicit remote connection status

This demo shell is browser-only and does not replace SSH mode.
`,
};

export const BROWSER_SHELL_GREETING = [
  "web_cli_v2 demo shell",
  "Browser-only fallback powered by just-bash",
  "No backend · no persistence · resets on refresh",
  "",
  "Try: ls, cat README.md, bash examples/hello.sh",
  "",
];

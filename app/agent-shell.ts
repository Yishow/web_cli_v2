import { MarkdownRenderer } from "@wterm/markdown";

export type AgentStreamStatus = "idle" | "loading" | "streaming" | "error";

export interface AgentStreamState {
  status: AgentStreamStatus;
  errorMessage: string | null;
  lastPrompt: string | null;
}

type AgentStreamFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface AgentStreamShellOptions {
  fetcher?: AgentStreamFetcher;
  onStateChange?: (state: AgentStreamState) => void;
}

export class AgentStreamShell {
  readonly state: AgentStreamState = {
    status: "idle",
    errorMessage: null,
    lastPrompt: null,
  };

  private readonly _fetcher: AgentStreamFetcher;
  private readonly _onStateChange?: (state: AgentStreamState) => void;
  private _write: ((data: string) => void) | null = null;
  private _abortController: AbortController | null = null;

  constructor(options: AgentStreamShellOptions = {}) {
    this._fetcher = options.fetcher ?? fetch;
    this._onStateChange = options.onStateChange;
  }

  attach(write: (data: string) => void) {
    this._write = write;
    write("\x1b[1;35mAgent Output Terminal\x1b[0m\r\n");
    write("\x1b[2mStreams Markdown from /api/agent-stream.\x1b[0m\r\n");
    write("\x1b[2mUse the prompt box above to start, or Ctrl+C to abort.\x1b[0m\r\n\r\n");
  }

  handleInput(data: string) {
    if (data === "\x03" && this.state.status !== "idle") {
      this.abort();
    }
  }

  async start(prompt: string) {
    const nextPrompt = prompt.trim();

    if (!nextPrompt || !this._write) {
      return;
    }

    this.state.lastPrompt = nextPrompt;
    this._setState({ status: "loading", errorMessage: null });
    this._write(`\x1b[1;36m> ${nextPrompt}\x1b[0m\r\n\r\n`);

    let fullText = "";
    const renderer = new MarkdownRenderer();

    try {
      this._abortController = new AbortController();
      const response = await this._fetcher("/api/agent-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: nextPrompt }),
        signal: this._abortController.signal,
      });

      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ error: "Request failed" }));
        const message =
          payload && typeof payload.error === "string" ? payload.error : "Request failed";
        this._write(`\x1b[31m${message}\x1b[0m\r\n`);
        this._setState({ status: "error", errorMessage: message });
        return;
      }

      this._setState({ status: "streaming", errorMessage: null });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        this._write("\x1b[31mMissing response stream\x1b[0m\r\n");
        this._setState({ status: "error", errorMessage: "Missing response stream" });
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        const rendered = renderer.push(chunk);
        if (rendered) {
          this._write(rendered);
        }
      }

      const remaining = renderer.flush();
      if (remaining) {
        this._write(remaining);
      }

      this._write("\r\n");
      this._setState({ status: "idle", errorMessage: null });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        if (fullText) {
          const remaining = renderer.flush();
          if (remaining) {
            this._write(remaining);
          }
        }

        this._write("\r\n\x1b[33m[stream aborted]\x1b[0m\r\n");
        this._setState({ status: "idle", errorMessage: null });
        return;
      }

      const message = error instanceof Error ? error.message : "Unknown error";
      this._write(`\x1b[31m${message}\x1b[0m\r\n`);
      this._setState({ status: "error", errorMessage: message });
    } finally {
      this._abortController = null;
    }
  }

  async retry() {
    if (!this.state.lastPrompt) {
      return;
    }

    await this.start(this.state.lastPrompt);
  }

  abort() {
    this._abortController?.abort();
  }

  private _setState(next: Partial<AgentStreamState>) {
    Object.assign(this.state, next);
    this._onStateChange?.({ ...this.state });
  }
}

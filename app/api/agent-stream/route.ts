import { createAgentMarkdownChunks } from "../../agent-stream-script";

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const prompt =
    payload && typeof payload.prompt === "string" ? payload.prompt.trim() : "";

  if (!prompt) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const chunks = createAgentMarkdownChunks(prompt);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
          await wait(40);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

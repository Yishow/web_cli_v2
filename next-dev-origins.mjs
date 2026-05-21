import os from "node:os";

function normalizeOrigin(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("://")) {
    try {
      return new URL(trimmed).hostname;
    } catch {
      return null;
    }
  }

  const withoutPath = trimmed.split("/")[0];
  const ipv4WithPort = withoutPath.match(/^(\d+\.\d+\.\d+\.\d+):\d+$/);
  if (ipv4WithPort) {
    return ipv4WithPort[1];
  }

  const hostnameWithPort = withoutPath.match(/^([a-z0-9.-]+):\d+$/i);
  if (hostnameWithPort) {
    return hostnameWithPort[1];
  }

  return withoutPath;
}

export function buildAllowedDevOrigins({
  networkInterfaces = os.networkInterfaces(),
  extraOrigins = process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "",
} = {}) {
  const origins = new Set(["localhost", "127.0.0.1"]);

  for (const entries of Object.values(networkInterfaces)) {
    for (const entry of entries ?? []) {
      if (entry.internal || entry.family !== "IPv4") {
        continue;
      }

      origins.add(entry.address);
    }
  }

  for (const rawOrigin of extraOrigins.split(/[\s,]+/)) {
    const normalized = normalizeOrigin(rawOrigin);
    if (normalized) {
      origins.add(normalized);
    }
  }

  return [...origins];
}

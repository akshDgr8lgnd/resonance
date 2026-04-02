import process from "node:process";

type JsonRpcId = string | number | null;
type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: any;
};

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const serverInfo = {
  name: "resonance-mcp",
  version: "0.1.0"
};

const baseUrl = process.env.RESONANCE_BASE_URL ?? "http://127.0.0.1:3939";
const apiToken = process.env.RESONANCE_API_TOKEN ?? process.env.RESONANCE_TOKEN ?? "";

const toolDefinitions: ToolDefinition[] = [
  {
    name: "resonance_health",
    description: "Check whether the local Resonance control server is reachable.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "resonance_library_summary",
    description: "Return a compact summary of the local Resonance library, including a small sample of tracks and playlists.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "resonance_search",
    description: "Search for songs through Resonance and return candidate track/video ids that can be downloaded or played.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1 },
        limit: { type: "integer", minimum: 1, maximum: 20 }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: "resonance_play_track",
    description: "Ask the running Resonance desktop app to start a local track by its library track id.",
    inputSchema: {
      type: "object",
      properties: {
        trackId: { type: "string", minLength: 1 }
      },
      required: ["trackId"],
      additionalProperties: false
    }
  },
  {
    name: "resonance_playback_command",
    description: "Send a transport command to the running Resonance desktop app.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", enum: ["toggle-play", "next", "previous", "show-main"] }
      },
      required: ["command"],
      additionalProperties: false
    }
  },
  {
    name: "resonance_playback_state",
    description: "Read the current playback state from the running Resonance desktop app.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "resonance_download",
    description: "Download a song into Resonance either by library track id, or by searching for a query and taking the top result.",
    inputSchema: {
      type: "object",
      properties: {
        trackId: { type: "string", minLength: 1 },
        query: { type: "string", minLength: 1 }
      },
      additionalProperties: false
    }
  },
  {
    name: "resonance_start_radio",
    description: "Build and start a radio queue from a library track id.",
    inputSchema: {
      type: "object",
      properties: {
        trackId: { type: "string", minLength: 1 },
        profile: { type: "string", enum: ["balanced", "bollywood", "discovery", "comfort"] },
        limit: { type: "integer", minimum: 1, maximum: 50 }
      },
      required: ["trackId"],
      additionalProperties: false
    }
  }
];

const writeMessage = (payload: unknown) => {
  const json = JSON.stringify(payload);
  const header = `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n`;
  process.stdout.write(header + json);
};

const makeTextResult = (text: string, structuredContent?: unknown) => ({
  content: [{ type: "text", text }],
  structuredContent
});

const makeError = (id: JsonRpcId, code: number, message: string) => ({
  jsonrpc: "2.0",
  id,
  error: { code, message }
});

const requireToken = () => {
  if (!apiToken) {
    throw new Error("Missing RESONANCE_API_TOKEN (or RESONANCE_TOKEN). Read it from Resonance Settings -> Pairing or /settings/pairing.");
  }
};

const apiFetch = async (pathname: string, init?: RequestInit) => {
  requireToken();
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = typeof data?.error === "string" ? data.error : `${response.status} ${response.statusText}`;
    throw new Error(detail);
  }
  return data;
};

const handleToolCall = async (name: string, args: any) => {
  if (name === "resonance_health") {
    const response = await fetch(`${baseUrl}/health`);
    if (!response.ok) throw new Error(`Health check failed with ${response.status}`);
    const data = await response.json();
    return makeTextResult(`Resonance is reachable at ${baseUrl}.`, data);
  }

  if (name === "resonance_library_summary") {
    const data = await apiFetch("/library");
    const tracks = Array.isArray(data?.tracks) ? data.tracks : [];
    const playlists = Array.isArray(data?.playlists) ? data.playlists : [];
    const sample = tracks.slice(0, 10).map((track: any) => ({
      id: track.id,
      title: track.title,
      artists: track.artists,
      album: track.album
    }));
    return makeTextResult(
      `Library has ${tracks.length} tracks and ${playlists.length} playlists. Returned a 10-track sample for browsing.`,
      { trackCount: tracks.length, playlistCount: playlists.length, sampleTracks: sample, playlists }
    );
  }

  if (name === "resonance_search") {
    const query = String(args?.query ?? "").trim();
    const limit = Math.max(1, Math.min(20, Number(args?.limit ?? 5)));
    if (!query) throw new Error("query is required");
    const data = await apiFetch("/search", { method: "POST", body: JSON.stringify({ query }) });
    const results = Array.isArray(data?.results) ? data.results.slice(0, limit) : [];
    return makeTextResult(`Found ${results.length} search results for "${query}".`, { query, results });
  }

  if (name === "resonance_play_track") {
    const trackId = String(args?.trackId ?? "").trim();
    if (!trackId) throw new Error("trackId is required");
    const data = await apiFetch("/playback/play", { method: "POST", body: JSON.stringify({ trackId }) });
    return makeTextResult(`Asked Resonance to play track ${trackId}.`, data);
  }

  if (name === "resonance_playback_command") {
    const command = String(args?.command ?? "").trim();
    if (!command) throw new Error("command is required");
    const data = await apiFetch("/playback/command", { method: "POST", body: JSON.stringify({ command }) });
    return makeTextResult(`Sent playback command "${command}".`, data);
  }

  if (name === "resonance_playback_state") {
    const data = await apiFetch("/playback/state");
    return makeTextResult("Fetched current playback state.", data);
  }

  if (name === "resonance_download") {
    const trackId = typeof args?.trackId === "string" ? args.trackId.trim() : "";
    const query = typeof args?.query === "string" ? args.query.trim() : "";
    if (!trackId && !query) throw new Error("Provide either trackId or query.");

    if (trackId) {
      const library = await apiFetch("/library");
      const existing = Array.isArray(library?.tracks) ? library.tracks.find((track: any) => track.id === trackId) : null;
      if (!existing) throw new Error(`Track ${trackId} is not present in the local library.`);
      return makeTextResult(`Track ${trackId} is already present in the Resonance library.`, { track: existing, alreadyDownloaded: true });
    }

    const search = await apiFetch("/search", { method: "POST", body: JSON.stringify({ query }) });
    const first = Array.isArray(search?.results) ? search.results[0] : null;
    if (!first) throw new Error(`No search results found for \"${query}\".`);
    const data = await apiFetch("/download", {
      method: "POST",
      body: JSON.stringify({
        videoId: first.videoId ?? first.id,
        title: first.title,
        artists: first.artists ?? [],
        duration: Number(first.duration ?? 0),
        thumbnail: first.thumbnail ?? null
      })
    });
    return makeTextResult(`Downloaded top search result for "${query}": ${first.title}.`, { selectedResult: first, download: data });
  }

  if (name === "resonance_start_radio") {
    const trackId = String(args?.trackId ?? "").trim();
    if (!trackId) throw new Error("trackId is required");
    const data = await apiFetch("/playback/radio", {
      method: "POST",
      body: JSON.stringify({
        trackId,
        profile: args?.profile ?? "balanced",
        limit: Number(args?.limit ?? 25)
      })
    });
    return makeTextResult(`Started radio for track ${trackId}.`, data);
  }

  throw new Error(`Unknown tool: ${name}`);
};

const handleRequest = async (request: JsonRpcRequest) => {
  const id = request.id ?? null;
  const method = request.method ?? "";

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo
      }
    };
  }

  if (method === "notifications/initialized") {
    return null;
  }

  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: toolDefinitions
      }
    };
  }

  if (method === "tools/call") {
    const name = request.params?.name;
    const args = request.params?.arguments ?? {};
    if (typeof name !== "string" || !name) {
      return makeError(id, -32602, "Tool name is required");
    }
    try {
      const result = await handleToolCall(name, args);
      return { jsonrpc: "2.0", id, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return makeError(id, -32000, message);
    }
  }

  if (id !== null) {
    return makeError(id, -32601, `Method not found: ${method}`);
  }

  return null;
};

let buffer = Buffer.alloc(0);

const tryParseMessages = async () => {
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;

    const headerText = buffer.slice(0, headerEnd).toString("utf8");
    const lengthHeader = headerText.split("\r\n").find((line) => line.toLowerCase().startsWith("content-length:"));
    if (!lengthHeader) {
      buffer = Buffer.alloc(0);
      return;
    }
    const contentLength = Number(lengthHeader.split(":")[1]?.trim() ?? "0");
    const totalLength = headerEnd + 4 + contentLength;
    if (buffer.length < totalLength) return;

    const body = buffer.slice(headerEnd + 4, totalLength).toString("utf8");
    buffer = buffer.slice(totalLength);

    let parsed: JsonRpcRequest;
    try {
      parsed = JSON.parse(body);
    } catch {
      writeMessage(makeError(null, -32700, "Parse error"));
      continue;
    }

    const response = await handleRequest(parsed);
    if (response) {
      writeMessage(response);
    }
  }
};

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
  void tryParseMessages();
});

process.stdin.on("end", () => {
  process.exit(0);
});

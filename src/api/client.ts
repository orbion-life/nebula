/**
 * Typed client for the Nebula Discover FastAPI service.
 *
 * All shapes come from the generated OpenAPI contracts (`src/contracts/api.ts`) —
 * the Python Pydantic models are the single source of truth, so this client can
 * never drift from the server. The React app calls `/api/*`; Vite proxies to the
 * discovery service (see vite.config.ts).
 */
import type { components } from "../contracts/api";

export type ObjectiveSpec = components["schemas"]["ObjectiveSpec"];
export type RunState = components["schemas"]["RunState"];
export type RunCreated = components["schemas"]["RunCreated"];
export type RunEvent = components["schemas"]["RunEvent"];
export type CandidateRecord = components["schemas"]["CandidateRecord"];
export type CandidateDossier = components["schemas"]["CandidateDossier"];
export type DiscoveryScore = components["schemas"]["DiscoveryScore"];
export type FrontierExperiment = components["schemas"]["FrontierExperiment"];
export type PhysicsEligibility = components["schemas"]["PhysicsEligibility"];
export type StructureResponse = components["schemas"]["StructureResponse"];
export type Health = components["schemas"]["Health"];

export type UserMode = "novice" | "expert";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body?.detail === "string" ? body.detail : JSON.stringify(body?.detail ?? body);
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export async function getHealth(): Promise<Health> {
  return json<Health>(await fetch("/api/health"));
}

export async function compileObjective(
  objective_text: string,
  user_mode: UserMode,
  instrument_id?: string | null,
  seed = 1337,
): Promise<ObjectiveSpec> {
  return json<ObjectiveSpec>(
    await fetch("/api/objectives/compile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ objective_text, user_mode, instrument_id: instrument_id ?? null, seed }),
    }),
  );
}

/** Start a run from either a raw free-text objective or a full edited ObjectiveSpec. */
export async function createRun(
  body: ObjectiveSpec | { objective_text: string; user_mode: UserMode; instrument_id?: string | null; seed?: number },
): Promise<RunCreated> {
  return json<RunCreated>(
    await fetch("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function getRun(runId: string): Promise<RunState> {
  return json<RunState>(await fetch(`/api/runs/${encodeURIComponent(runId)}`));
}

export async function cancelRun(runId: string): Promise<RunState> {
  return json<RunState>(await fetch(`/api/runs/${encodeURIComponent(runId)}/cancel`, { method: "POST" }));
}

export async function getDossier(candidateId: string): Promise<CandidateDossier> {
  return json<CandidateDossier>(await fetch(`/api/candidates/${encodeURIComponent(candidateId)}/dossier`));
}

export async function getStructure(candidateId: string): Promise<StructureResponse> {
  return json<StructureResponse>(await fetch(`/api/candidates/${encodeURIComponent(candidateId)}/structure`));
}

/**
 * Subscribe to the run's Server-Sent Events. Returns a cleanup function.
 * Falls back to polling if EventSource errors (e.g. proxy buffering) so progress
 * still advances. `onState` fires on every observed state change.
 */
export function streamRun(
  runId: string,
  handlers: { onEvent?: (e: RunEvent) => void; onState?: (s: RunState) => void; onDone?: (s: RunState) => void; onError?: (err: Error) => void },
): () => void {
  let closed = false;
  let es: EventSource | null = null;
  let pollTimer: number | null = null;

  const finish = async () => {
    try {
      const s = await getRun(runId);
      handlers.onState?.(s);
      if (isTerminal(s.status)) handlers.onDone?.(s);
    } catch (err) {
      handlers.onError?.(err as Error);
    }
  };

  const poll = () => {
    if (closed) return;
    getRun(runId)
      .then((s) => {
        handlers.onState?.(s);
        if (isTerminal(s.status)) {
          handlers.onDone?.(s);
          cleanup();
        } else {
          pollTimer = window.setTimeout(poll, 700);
        }
      })
      .catch((err) => {
        handlers.onError?.(err as Error);
        pollTimer = window.setTimeout(poll, 1200);
      });
  };

  try {
    es = new EventSource(`/api/runs/${encodeURIComponent(runId)}/events`);
    es.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data) as RunEvent;
        handlers.onEvent?.(ev);
      } catch {
        /* ignore keep-alives */
      }
    };
    es.addEventListener("end", () => {
      cleanup();
      void finish();
    });
    es.onerror = () => {
      // SSE unavailable/interrupted — degrade to polling rather than stalling.
      es?.close();
      es = null;
      if (!closed && pollTimer === null) poll();
    };
  } catch {
    poll();
  }

  function cleanup() {
    closed = true;
    es?.close();
    if (pollTimer !== null) window.clearTimeout(pollTimer);
  }
  return cleanup;
}

const TERMINAL = new Set(["completed", "failed", "cancelled"]);
export function isTerminal(status: string): boolean {
  return TERMINAL.has(status);
}

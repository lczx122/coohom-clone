import type { CoohomConfig } from "./config.js";
import { buildSignedParams } from "./sign.js";

/**
 * Thin HTTP client for the Coohom Open API.
 *
 * ── ENDPOINT PATHS ─────────────────────────────────────────────────────────
 * The exact paths below are behind Coohom's logged-in developer portal, so
 * they are collected here as a single editable map with the best-known values
 * and marked (unverified). Once you can read the portal, correct any path in
 * this one object — the tool layer and signing never need to change.
 * ───────────────────────────────────────────────────────────────────────────
 */
export const ENDPOINTS = {
  // Single Sign-On: mint a redirect/login URL or user token for an end user.
  ssoToken: { method: "POST", path: "/api/global/i18n/openapi/sso/token" }, // (unverified)
  // Projects
  createProject: { method: "POST", path: "/api/global/i18n/openapi/v2/project/create" }, // (unverified)
  copyProject: { method: "POST", path: "/api/global/i18n/openapi/v2/project/copy" }, // (unverified)
  listProjects: { method: "GET", path: "/api/global/i18n/openapi/v2/project/list" }, // (unverified)
  getProject: { method: "GET", path: "/api/global/i18n/openapi/v2/project/info" }, // (unverified)
  // Rendering
  triggerRender: { method: "POST", path: "/api/global/i18n/openapi/v2/render/submit" }, // (unverified)
  getRenderResult: { method: "GET", path: "/api/global/i18n/openapi/v2/render/result" }, // (unverified)
  // Bill of materials
  getBom: { method: "GET", path: "/api/global/i18n/openapi/v2/bom/get" }, // (unverified)
} as const;

export type EndpointKey = keyof typeof ENDPOINTS;

/** Coohom's documented unified response envelope. */
export interface CoohomEnvelope<T = unknown> {
  c?: string; // code, e.g. "0" for success
  m?: string; // message
  d?: T; // data
  // Some deployments use { code, message, data } — normalized below.
  code?: string | number;
  message?: string;
  data?: T;
}

export class CoohomApiError extends Error {
  constructor(
    message: string,
    readonly code: string | number | undefined,
    readonly httpStatus: number,
    readonly raw: unknown
  ) {
    super(message);
    this.name = "CoohomApiError";
  }
}

export class CoohomClient {
  constructor(private readonly cfg: CoohomConfig) {}

  private nowMs(): string {
    return String(Date.now());
  }

  private normalize<T>(env: CoohomEnvelope<T>): { code: string; message: string; data: T | undefined } {
    const code = String(env.c ?? env.code ?? "");
    const message = env.m ?? env.message ?? "";
    const data = (env.d ?? env.data) as T | undefined;
    return { code, message, data };
  }

  /**
   * Perform a signed request. Business params go in the query string for GET
   * and in the JSON body for POST; the signed fields (appkey/timestamp/sign)
   * always ride in the query string, which is the common Coohom convention.
   */
  async call<T = unknown>(
    endpoint: EndpointKey,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    const { method, path } = ENDPOINTS[endpoint];
    const timestamp = this.nowMs();

    // Stringify business params for signing (sorted-params scheme needs strings).
    const businessStr: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      businessStr[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
    }

    const signed = buildSignedParams(
      this.cfg.signScheme,
      this.cfg.appKey,
      this.cfg.appSecret,
      timestamp,
      businessStr
    );

    const url = new URL(this.cfg.baseUrl + path);
    url.searchParams.set("appkey", signed.appkey);
    url.searchParams.set("timestamp", signed.timestamp);
    url.searchParams.set("sign", signed.sign);

    const init: RequestInit = { method, headers: { Accept: "application/json" } };

    if (method === "GET") {
      for (const [k, v] of Object.entries(businessStr)) url.searchParams.set(k, v);
    } else {
      (init.headers as Record<string, string>)["Content-Type"] = "application/json";
      init.body = JSON.stringify(params);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    init.signal = controller.signal;

    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      throw new CoohomApiError(
        `Network error calling Coohom ${endpoint}: ${(err as Error).message}`,
        undefined,
        0,
        err
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let json: CoohomEnvelope<T>;
    try {
      json = text ? (JSON.parse(text) as CoohomEnvelope<T>) : {};
    } catch {
      throw new CoohomApiError(
        `Coohom ${endpoint} returned non-JSON (HTTP ${res.status}): ${text.slice(0, 300)}`,
        undefined,
        res.status,
        text
      );
    }

    const { code, message, data } = this.normalize(json);
    const ok = res.ok && (code === "" || code === "0" || code === "200");
    if (!ok) {
      throw new CoohomApiError(
        `Coohom ${endpoint} failed: code=${code || res.status} message=${message || res.statusText}`,
        code || res.status,
        res.status,
        json
      );
    }
    return data as T;
  }

  // ── High-level helpers ────────────────────────────────────────────────────
  // Param names below follow Coohom's documented conventions where known and
  // are otherwise best-effort; adjust field names against your portal docs.

  ssoToken(appuid: string) {
    return this.call("ssoToken", { appuid });
  }

  createProject(input: { name: string; appuid?: string; floorplanId?: string }) {
    return this.call("createProject", input);
  }

  copyProject(input: { sourceProjectId: string; name?: string; appuid?: string }) {
    return this.call("copyProject", input);
  }

  listProjects(input: { appuid?: string; page?: number; pageSize?: number } = {}) {
    return this.call("listProjects", input);
  }

  getProject(input: { projectId: string }) {
    return this.call("getProject", input);
  }

  triggerRender(input: { projectId: string; type?: string; width?: number; height?: number }) {
    return this.call("triggerRender", input);
  }

  getRenderResult(input: { renderId: string }) {
    return this.call("getRenderResult", input);
  }

  getBom(input: { projectId: string }) {
    return this.call("getBom", input);
  }
}

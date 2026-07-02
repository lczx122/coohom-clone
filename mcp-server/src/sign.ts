import { createHash } from "node:crypto";
import type { SignScheme } from "./config.js";

/**
 * Request signing for the Coohom Open API.
 *
 * ── IMPORTANT ─────────────────────────────────────────────────────────────
 * The EXACT signing formula is defined in Coohom's Open Platform docs, which
 * are only reachable once you have a business account and are logged in
 * (open.coohom.com / developer.coohom.com). This module implements the two
 * most common Coohom/Manycore variants; pick the one your account's docs
 * specify via COOHOM_SIGN_SCHEME. If neither matches verbatim, the change is
 * confined to `computeSignature` below — nothing else needs to move.
 *
 * Both variants share the same public request fields:
 *   - appkey     : your App Key
 *   - timestamp  : current time in milliseconds
 *   - sign       : MD5 hex digest (see below)
 * and the App Secret is NEVER sent over the wire — only mixed into the hash.
 * ───────────────────────────────────────────────────────────────────────────
 */

export interface SignedParams {
  appkey: string;
  timestamp: string;
  sign: string;
}

function md5Hex(input: string): string {
  return createHash("md5").update(input, "utf8").digest("hex");
}

/**
 * Compute the signature for a set of request parameters.
 *
 * @param scheme     which documented formula to use
 * @param appKey     App Key
 * @param appSecret  App Secret (kept local; folded into the hash only)
 * @param timestamp  millisecond timestamp string
 * @param params     the request's business params (query for GET, body for
 *                   POST) — used by the "sorted-params" scheme, ignored by
 *                   "md5-concat".
 */
export function computeSignature(
  scheme: SignScheme,
  appKey: string,
  appSecret: string,
  timestamp: string,
  params: Record<string, string> = {}
): string {
  switch (scheme) {
    // Variant A — the simplest and most commonly documented Coohom form:
    //   sign = MD5(appSecret + appKey + timestamp)
    case "md5-concat":
      return md5Hex(appSecret + appKey + timestamp);

    // Variant B — sign includes all business params, sorted by key:
    //   base = appSecret + key1value1 + key2value2 + ... + timestamp
    //   sign = MD5(base)
    // Some Coohom endpoints that take query params use this stronger form so
    // the signature also covers the payload.
    case "md5-sorted-params": {
      const sortedKeys = Object.keys(params).sort();
      let base = appSecret;
      for (const k of sortedKeys) base += k + params[k];
      base += "appkey" + appKey + "timestamp" + timestamp;
      return md5Hex(base);
    }
  }
}

export function buildSignedParams(
  scheme: SignScheme,
  appKey: string,
  appSecret: string,
  timestamp: string,
  params: Record<string, string> = {}
): SignedParams {
  return {
    appkey: appKey,
    timestamp,
    sign: computeSignature(scheme, appKey, appSecret, timestamp, params),
  };
}

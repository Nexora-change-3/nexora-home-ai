/**
 * Constraint resolver for NEXORA.
 * User instructions outrank verified measurements; verified measurements outrank
 * vision hypotheses. Vision alone never grants permission to alter an element.
 */

const PRIORITY = Object.freeze({ vision: 1, verified_measurement: 2, user: 3 });
const DISPOSITIONS = new Set(["fixed", "preserve", "replaceable", "unknown"]);

function normalize(record, source) {
  if (!record || typeof record.element !== "string" || !record.element.trim()) {
    throw new TypeError("Every constraint record needs a non-empty element.");
  }
  const disposition = record.disposition || "unknown";
  if (!DISPOSITIONS.has(disposition)) throw new TypeError("Unsupported constraint disposition.");
  const confidence = record.confidence ?? (source === "user" ? 1 : 0.5);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new TypeError("Constraint confidence must be between 0 and 1.");
  }
  return {
    element: record.element.trim(),
    disposition,
    reason: typeof record.reason === "string" ? record.reason : "",
    source,
    confidence,
    ...(record.measurement !== undefined ? { measurement: record.measurement } : {})
  };
}

/**
 * @param {{
 *   user?: object[],
 *   verifiedMeasurements?: object[],
 *   vision?: object[]
 * }} sources
 */
export function resolveConstraintLedger(sources = {}) {
  const records = [
    ...((sources.vision || []).map(item => normalize(item, "vision"))),
    ...((sources.verifiedMeasurements || []).map(item => normalize(item, "verified_measurement"))),
    ...((sources.user || []).map(item => normalize(item, "user")))
  ];

  const byElement = new Map();
  for (const record of records) {
    const key = record.element.toLocaleLowerCase();
    if (!byElement.has(key)) byElement.set(key, []);
    byElement.get(key).push(record);
  }

  const resolved = [];
  const conflicts = [];
  for (const [key, candidates] of byElement.entries()) {
    candidates.sort((a, b) => PRIORITY[b.source] - PRIORITY[a.source]);
    const winner = candidates[0];
    const losing = candidates.filter(item => item.disposition !== winner.disposition);
    if (losing.length) {
      conflicts.push({
        element: winner.element,
        chosen_source: winner.source,
        chosen_disposition: winner.disposition,
        overridden: losing.map(item => ({
          source: item.source,
          disposition: item.disposition,
          reason: item.reason
        }))
      });
    }
    resolved.push(winner);
  }

  const groups = { fixed: [], preserve: [], replaceable: [], unknown: [] };
  for (const item of resolved) groups[item.disposition].push(item);

  return {
    constraints: groups,
    conflicts,
    requires_review: conflicts.length > 0 || groups.unknown.length > 0,
    policy: "user > verified_measurement > vision; vision-only observations never authorize a redesign"
  };
}

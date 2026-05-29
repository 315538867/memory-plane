const { nextId } = require("../engine/id");

function normalizeSignals(rawSignals) {
  return rawSignals.map((signal) => ({
    signal_id: signal.signal_id || nextId("signal"),
    kind: signal.kind,
    scope: signal.scope,
    content: signal.content || {},
    source: signal.source || { origin: "unknown", ref: "unknown" },
    timestamp: signal.timestamp || new Date().toISOString(),
    metadata: signal.metadata || {}
  }));
}

module.exports = {
  normalizeSignals
};


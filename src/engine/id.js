let counters = {
  signal: 0,
  evidence: 0,
  candidate: 0,
  decision: 0
};

function nextId(prefix) {
  counters[prefix] += 1;
  return `${prefix}_${String(counters[prefix]).padStart(3, "0")}`;
}

function resetIds() {
  counters = {
    signal: 0,
    evidence: 0,
    candidate: 0,
    decision: 0
  };
}

module.exports = {
  nextId,
  resetIds
};


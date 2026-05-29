function matchCandidate(candidate, registry) {
  const matchedMemory = registry.memories.find(
    (memory) =>
      memory.memory_type === candidate.memory_type &&
      memory.claim === candidate.claim &&
      memory.scope.project === candidate.scope.project &&
      memory.scope.repo === candidate.scope.repo &&
      memory.scope.user_id === candidate.scope.user_id
  );

  if (matchedMemory) {
    return {
      kind: "reinforce_memory",
      matchedMemory
    };
  }

  return {
    kind: "new_candidate"
  };
}

module.exports = {
  matchCandidate
};


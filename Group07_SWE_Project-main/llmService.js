function generateLLMResponse(prompt) {
  const lower = prompt.toLowerCase();

  if (lower.includes("study") || lower.includes("exam")) {
    return `To study effectively for "${prompt}", break the material into smaller topics, review key concepts, and practice problems related to each concept. Active recall and spaced repetition are useful strategies.`;
  }

  if (lower.includes("code") || lower.includes("debug")) {
    return `When approaching "${prompt}", start by isolating the issue, checking logs or outputs, and testing smaller sections of the code individually. Debugging tools and careful inspection often help locate the root cause.`;
  }

  if (lower.includes("recommend")) {
    return `For "${prompt}", a good recommendation would depend on your preferences. Typically systems like this would analyze user intent and suggest items accordingly.`;
  }

  return `This is a generated response to your prompt: "${prompt}". In the final system, this response would come from an LLM API. For this prototype we simulate the behavior of an AI response generator.`;
}

module.exports = generateLLMResponse;
// Increase the default Jasmine timeout for async tests that call Ollama.
// generateResponseFromModel / generateMultiLLMResponses test the error-handling
// path when Ollama is unreachable — the connection-refused error arrives quickly
// on localhost, but we give 15 s of headroom for slower CI environments.
jasmine.DEFAULT_TIMEOUT_INTERVAL = 15000;

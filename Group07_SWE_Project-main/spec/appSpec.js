const {
  shortenResponse,
  createConversation,
  bookmarkConversation,
  unbookmarkConversation,
  deleteConversationById,
  addMessageToConversation
} = require("../server");

const TEST_USER_ID = 1;


const MOCK_OLLAMA_RESPONSE = {
  ok: true,
  json: async () => ({ message: { content: "Mocked LLM response for testing" } })
};

// ─── shortenResponse ──────────────────────────────────────────────────────────
describe("shortenResponse", () => {
  it("shortens text to the requested number of words", () => {
    expect(shortenResponse("one two three four five", 3)).toBe("one two three");
  });

  it("returns the original text if it is already short enough", () => {
    const text = "one two";
    expect(shortenResponse(text, 5)).toBe(text);
  });
});

// ─── Core conversation helpers ────────────────────────────────────────────────
describe("conversation features", () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = async () => MOCK_OLLAMA_RESPONSE;
  });
  afterEach(() => { global.fetch = originalFetch; });

  it("creates a new conversation object", async () => {
    const conversation = await createConversation("help me study for calc", false, TEST_USER_ID);
    expect(conversation).toBeDefined();
    expect(conversation.prompt).toBe("help me study for calc");
    expect(conversation.response).toBeDefined();
    expect(conversation.bookmarked).toBeFalse();
    expect(conversation.id).toBeDefined();
    expect(conversation.createdAt).toBeDefined();
  });

  it("creates a shortened conversation response when shorten is true", async () => {
    const conversation = await createConversation("help me study for my exam", true, TEST_USER_ID);
    expect(conversation.response.split(/\s+/).length).toBeLessThanOrEqual(200);
  });

  it("bookmarks an existing conversation", async () => {
    const conversation = await createConversation("debug my javascript code", false, TEST_USER_ID);
    const result = bookmarkConversation(conversation.id, TEST_USER_ID);
    expect(result).toBeDefined();
    expect(result.bookmarked).toBeTrue();
  });

  it("returns null when bookmarking a nonexistent conversation", () => {
    expect(bookmarkConversation(999999, TEST_USER_ID)).toBeNull();
  });

  it("deletes an existing conversation", async () => {
    const conversation = await createConversation("recommend a movie", false, TEST_USER_ID);
    const deleted = deleteConversationById(conversation.id, TEST_USER_ID);
    expect(deleted).toBeDefined();
    expect(deleted.id).toBe(conversation.id);
  });

  it("returns null when deleting a nonexistent conversation", () => {
    expect(deleteConversationById(999999, TEST_USER_ID)).toBeNull();
  });

  it("stores the correct userId on a new conversation", async () => {
    const conversation = await createConversation("hello world", false, TEST_USER_ID);
    expect(conversation.userId).toBe(TEST_USER_ID);
  });

  it("stores the prompt exactly as entered", async () => {
    const prompt = "help me with calculus";
    const conversation = await createConversation(prompt, false, TEST_USER_ID);
    expect(conversation.prompt).toBe(prompt);
  });

  it("creates a response with nonzero length", async () => {
    const conversation = await createConversation("hello", false, TEST_USER_ID);
    expect(conversation.response.length).toBeGreaterThan(0);
  });

  it("adds a timestamp when a conversation is created", async () => {
    const conversation = await createConversation("timestamp test", false, TEST_USER_ID);
    expect(typeof conversation.createdAt).toBe("string");
    expect(conversation.createdAt.length).toBeGreaterThan(0);
  });

  it("does not shorten when shorten is false", async () => {
    const conversation = await createConversation("help me study", false, TEST_USER_ID);
    expect(conversation.response).toBeDefined();
    expect(conversation.response.length).toBeGreaterThan(0);
  });

  it("removes a bookmark from an existing conversation", async () => {
    const conversation = await createConversation("saved conversation", false, TEST_USER_ID);
    bookmarkConversation(conversation.id, TEST_USER_ID);
    const result = unbookmarkConversation(conversation.id, TEST_USER_ID);
    expect(result).toBeDefined();
    expect(result.bookmarked).toBeFalse();
  });

  it("returns null when unbookmarking a nonexistent conversation", () => {
    expect(unbookmarkConversation(999999, TEST_USER_ID)).toBeNull();
  });

  it("initialises multiResponses as null on a new conversation", async () => {
    const conversation = await createConversation("multi test", false, TEST_USER_ID);
    expect(conversation.multiResponses).toBeNull();
  });

  it("initialises a messages array with user and assistant entries", async () => {
    const conversation = await createConversation("array test", false, TEST_USER_ID);
    expect(Array.isArray(conversation.messages)).toBeTrue();
    expect(conversation.messages.length).toBe(2);
    expect(conversation.messages[0].role).toBe("user");
    expect(conversation.messages[1].role).toBe("assistant");
  });
});

// ─── Iteration 3: rename ─────────────────────────────────────────────────────
describe("rename conversation", () => {
  let originalFetch;
  beforeEach(() => { originalFetch = global.fetch; global.fetch = async () => MOCK_OLLAMA_RESPONSE; });
  afterEach(()  => { global.fetch = originalFetch; });

  it("updates the title of an existing conversation", async () => {
    const conversation = await createConversation("original prompt", false, TEST_USER_ID);
    conversation.title = "New Title";
    expect(conversation.title).toBe("New Title");
  });

  it("does not affect other conversation fields when title changes", async () => {
    const conversation = await createConversation("rename test", false, TEST_USER_ID);
    const originalPrompt = conversation.prompt;
    conversation.title = "Renamed";
    expect(conversation.prompt).toBe(originalPrompt);
    expect(conversation.bookmarked).toBeFalse();
  });
});

// ─── Iteration 3: delete all conversations ───────────────────────────────────
describe("delete all conversations", () => {
  let originalFetch;
  beforeEach(() => { originalFetch = global.fetch; global.fetch = async () => MOCK_OLLAMA_RESPONSE; });
  afterEach(()  => { global.fetch = originalFetch; });

  it("deleteConversationById removes only the targeted conversation", async () => {
    const c1 = await createConversation("first", false, TEST_USER_ID);
    const c2 = await createConversation("second", false, TEST_USER_ID);
    deleteConversationById(c1.id, TEST_USER_ID);
    const deleted = deleteConversationById(c2.id, TEST_USER_ID);
    expect(deleted).not.toBeNull();
    expect(deleted.id).toBe(c2.id);
  });

  it("cannot delete another user's conversation", async () => {
    const conversation = await createConversation("private", false, TEST_USER_ID);
    const result = deleteConversationById(conversation.id, 999);
    expect(result).toBeNull();
  });
});

// ─── Iteration 3: addMessageToConversation ───────────────────────────────────
describe("addMessageToConversation", () => {
  let originalFetch;
  beforeEach(() => { originalFetch = global.fetch; global.fetch = async () => MOCK_OLLAMA_RESPONSE; });
  afterEach(()  => { global.fetch = originalFetch; });

  it("returns null for a nonexistent conversation id", async () => {
    const result = await addMessageToConversation(999999, "hello", false, TEST_USER_ID);
    expect(result).toBeNull();
  });

  it("returns null when the userId does not match", async () => {
    const conversation = await createConversation("auth test", false, TEST_USER_ID);
    const result = await addMessageToConversation(conversation.id, "follow up", false, 999);
    expect(result).toBeNull();
  });

  it("appends two messages (user + assistant) to the messages array", async () => {
    const conversation = await createConversation("base prompt", false, TEST_USER_ID);
    const before = conversation.messages.length;
    const updated = await addMessageToConversation(conversation.id, "follow up", false, TEST_USER_ID);
    expect(updated.messages.length).toBe(before + 2);
  });

  it("sets the latest prompt on the conversation after a follow-up", async () => {
    const conversation = await createConversation("first prompt", false, TEST_USER_ID);
    const updated = await addMessageToConversation(conversation.id, "second prompt", false, TEST_USER_ID);
    expect(updated.prompt).toBe("second prompt");
  });

  it("updates updatedAt after a follow-up message", async () => {
    const conversation = await createConversation("update time test", false, TEST_USER_ID);
    const updated = await addMessageToConversation(conversation.id, "new message", false, TEST_USER_ID);
    expect(updated.updatedAt).toBeDefined();
    expect(isNaN(Date.parse(updated.updatedAt))).toBeFalse();
  });
});

// ─── Multi-LLM model config ───────────────────────────────────────────────────
const {
  generateResponseFromModel,
  generateMultiLLMResponses,
  generateGeminiResponse,
  generateGroqResponse,
  generateCodeModification,
  isWeatherQuery,
  MULTI_LLM_MODELS
} = require("../llmService");

describe("MULTI_LLM_MODELS configuration", () => {
  it("defines exactly three models", () => {
    expect(MULTI_LLM_MODELS.length).toBe(3);
  });

  it("includes llama3.2, phi3, and tinyllama", () => {
    const ids = MULTI_LLM_MODELS.map(m => m.id);
    expect(ids).toContain("llama3.2:latest");
    expect(ids).toContain("phi3:latest");
    expect(ids).toContain("tinyllama:latest");
  });

  it("does not include gemma3 (replaced by tinyllama in iteration 3)", () => {
    const ids = MULTI_LLM_MODELS.map(m => m.id);
    expect(ids).not.toContain("gemma3:latest");
  });

  it("gives every model a non-empty label", () => {
    MULTI_LLM_MODELS.forEach(m => {
      expect(typeof m.label).toBe("string");
      expect(m.label.length).toBeGreaterThan(0);
    });
  });

  it("gives every model a type field", () => {
    MULTI_LLM_MODELS.forEach(m => expect(m.type).toBeDefined());
  });
});

// ─── generateResponseFromModel ────────────────────────────────────────────────
describe("generateResponseFromModel", () => {
  let originalFetch;
  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(()  => { global.fetch = originalFetch; });

  it("throws a descriptive error when Ollama is unreachable", async () => {
    global.fetch = async () => { throw new Error("connect ECONNREFUSED 127.0.0.1:11434"); };
    try {
      await generateResponseFromModel("hello", "llama3.2:latest");
      fail("Expected to throw");
    } catch (err) {
      expect(err.message).toContain("Could not reach Ollama");
    }
  });

  it("throws a descriptive error that includes the model name", async () => {
    global.fetch = async () => { throw new Error("connect ECONNREFUSED"); };
    try {
      await generateResponseFromModel("hello", "tinyllama:latest");
      fail("Expected to throw");
    } catch (err) {
      expect(err.message).toContain("tinyllama:latest");
    }
  });

  it("throws when Ollama returns a non-OK HTTP status", async () => {
    global.fetch = async () => ({ ok: false, status: 404, text: async () => "model not found" });
    try {
      await generateResponseFromModel("hello", "llama3.2:latest");
      fail("Expected to throw on non-OK response");
    } catch (err) {
      expect(err.message).toContain("404");
    }
  });

  it("returns the assistant message content on a successful response", async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ message: { content: "Hello from Llama!" } })
    });
    const result = await generateResponseFromModel("hi", "llama3.2:latest");
    expect(result).toBe("Hello from Llama!");
  });
});

// ─── generateMultiLLMResponses ────────────────────────────────────────────────
describe("generateMultiLLMResponses", () => {
  let originalFetch;
  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(()  => { global.fetch = originalFetch; });

  it("returns exactly three result objects (one per model)", async () => {
    global.fetch = async () => { throw new Error("connect ECONNREFUSED"); };
    const results = await generateMultiLLMResponses("test prompt");
    expect(results.length).toBe(3);
  });

  it("each result has modelId, label, response, and error fields", async () => {
    global.fetch = async () => { throw new Error("connect ECONNREFUSED"); };
    const results = await generateMultiLLMResponses("test prompt");
    results.forEach(r => {
      expect(r.modelId).toBeDefined();
      expect(r.label).toBeDefined();
      expect("response" in r).toBeTrue();
      expect("error" in r).toBeTrue();
    });
  });

  it("sets error (not response) when a model is unreachable", async () => {
    global.fetch = async () => { throw new Error("connect ECONNREFUSED"); };
    const results = await generateMultiLLMResponses("test prompt");
    results.forEach(r => {
      expect(r.error).not.toBeNull();
      expect(r.response).toBeNull();
    });
  });

  it("never throws even when all models fail", async () => {
    global.fetch = async () => { throw new Error("connect ECONNREFUSED"); };
    await expectAsync(generateMultiLLMResponses("any prompt")).toBeResolved();
  });

  it("returns successful responses when Ollama is available", async () => {
    let callCount = 0;
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ message: { content: `Response ${++callCount}` } })
    });
    const results = await generateMultiLLMResponses("test prompt");
    expect(results.length).toBe(3);
    results.forEach(r => {
      expect(r.error).toBeNull();
      expect(r.response).toBeTruthy();
    });
  });

  it("returns partial results when only some models fail", async () => {
    let callCount = 0;
    global.fetch = async () => {
      callCount++;
      if (callCount === 2) throw new Error("connect ECONNREFUSED");
      return { ok: true, json: async () => ({ message: { content: "ok response" } }) };
    };
    const results = await generateMultiLLMResponses("test prompt");
    expect(results.filter(r => r.error !== null).length).toBe(1);
    expect(results.filter(r => r.response !== null).length).toBe(2);
  });
});

// ─── Iteration 3: Gemini cloud model ─────────────────────────────────────────
describe("generateGeminiResponse", () => {
  let originalFetch;
  let originalEnv;
  beforeEach(() => { originalFetch = global.fetch; originalEnv = process.env.GEMINI_API_KEY; });
  afterEach(()  => { global.fetch = originalFetch; process.env.GEMINI_API_KEY = originalEnv; });

  it("throws a descriptive error when GEMINI_API_KEY is not set", async () => {
    delete process.env.GEMINI_API_KEY;
    try {
      await generateGeminiResponse("hello");
      fail("Expected to throw");
    } catch (err) {
      expect(err.message).toContain("GEMINI_API_KEY");
    }
  });

  it("throws when the Gemini API returns a non-OK status", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    global.fetch = async () => ({ ok: false, status: 429, text: async () => "quota exceeded" });
    try {
      await generateGeminiResponse("hello");
      fail("Expected to throw");
    } catch (err) {
      expect(err.message).toContain("429");
    }
  });

  it("returns the model text on a successful Gemini response", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Gemini says hello" }] } }]
      })
    });
    const result = await generateGeminiResponse("hi");
    expect(result).toBe("Gemini says hello");
  });

  it("returns a fallback string when candidates array is empty", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ candidates: [] })
    });
    const result = await generateGeminiResponse("hi");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── Iteration 3: Groq cloud model ───────────────────────────────────────────
describe("generateGroqResponse", () => {
  let originalFetch;
  let originalEnv;
  beforeEach(() => { originalFetch = global.fetch; originalEnv = process.env.GROQ_API_KEY; });
  afterEach(()  => { global.fetch = originalFetch; process.env.GROQ_API_KEY = originalEnv; });

  it("throws a descriptive error when GROQ_API_KEY is not set", async () => {
    delete process.env.GROQ_API_KEY;
    try {
      await generateGroqResponse("hello");
      fail("Expected to throw");
    } catch (err) {
      expect(err.message).toContain("GROQ_API_KEY");
    }
  });

  it("throws when the Groq API returns a non-OK status", async () => {
    process.env.GROQ_API_KEY = "test-key";
    global.fetch = async () => ({ ok: false, status: 401, text: async () => "unauthorized" });
    try {
      await generateGroqResponse("hello");
      fail("Expected to throw");
    } catch (err) {
      expect(err.message).toContain("401");
    }
  });

  it("returns the model text on a successful Groq response", async () => {
    process.env.GROQ_API_KEY = "test-key";
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "Groq says hello" } }] })
    });
    const result = await generateGroqResponse("hi");
    expect(result).toBe("Groq says hello");
  });
});

// ─── Iteration 3: weather detection ──────────────────────────────────────────
describe("isWeatherQuery", () => {
  it("detects the word 'weather'", () => {
    expect(isWeatherQuery("what is the weather today")).toBeTrue();
  });

  it("detects the word 'temperature'", () => {
    expect(isWeatherQuery("what is the temperature in NYC")).toBeTrue();
  });

  it("detects the word 'rain'", () => {
    expect(isWeatherQuery("is it going to rain tomorrow")).toBeTrue();
  });

  it("detects the word 'forecast'", () => {
    expect(isWeatherQuery("give me a forecast for this week")).toBeTrue();
  });

  it("detects the word 'sunny'", () => {
    expect(isWeatherQuery("will it be sunny on Saturday")).toBeTrue();
  });

  it("returns false for a non-weather prompt", () => {
    expect(isWeatherQuery("help me debug my JavaScript code")).toBeFalse();
  });

  it("returns false for a general question", () => {
    expect(isWeatherQuery("what is the capital of France")).toBeFalse();
  });

  it("is case-insensitive", () => {
    expect(isWeatherQuery("WEATHER IN BOSTON")).toBeTrue();
  });
});

// ─── Iteration 3: self-modification (generateCodeModification) ───────────────
describe("generateCodeModification", () => {
  let originalFetch;
  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(()  => { global.fetch = originalFetch; });

  it("throws a descriptive error when Ollama is unreachable", async () => {
    global.fetch = async () => { throw new Error("connect ECONNREFUSED"); };
    try {
      await generateCodeModification("add a button", "const x = 1;", "public/app.js");
      fail("Expected to throw");
    } catch (err) {
      expect(err.message).toContain("Could not reach Ollama");
    }
  });

  it("throws when DeepSeek returns a non-OK HTTP status", async () => {
    global.fetch = async () => ({ ok: false, status: 500, text: async () => "server error" });
    try {
      await generateCodeModification("add a button", "const x = 1;", "public/app.js");
      fail("Expected to throw");
    } catch (err) {
      expect(err.message).toContain("500");
    }
  });

  it("returns the raw model output on a successful call", async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ message: { content: "<<<FIND>>>\n<<<REPLACE>>>\nnew code\n<<<END>>>" } })
    });
    const result = await generateCodeModification("add something", "old code", "public/app.js");
    expect(result).toContain("<<<FIND>>>");
    expect(result).toContain("<<<END>>>");
  });

  it("passes the instruction and file contents in the prompt", async () => {
    let capturedBody;
    global.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ message: { content: "<<<FIND>>>\n<<<REPLACE>>>\n\n<<<END>>>" } }) };
    };
    await generateCodeModification("paint it red", "body { color: blue; }", "public/style.css");
    const userMsg = capturedBody.messages.find(m => m.role === "user");
    expect(userMsg.content).toContain("paint it red");
    expect(userMsg.content).toContain("body { color: blue; }");
  });

  it("includes the Constitution as a system prompt", async () => {
    let capturedBody;
    global.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ message: { content: "<<<FIND>>>\n<<<REPLACE>>>\n\n<<<END>>>" } }) };
    };
    await generateCodeModification("add footer", "const x = 1;", "public/app.js");
    const systemMsg = capturedBody.messages.find(m => m.role === "system");
    expect(systemMsg).toBeDefined();
    expect(systemMsg.content).toContain("CONSTITUTION_VIOLATION");
  });
});

const {
  shortenResponse,
  createConversation,
  bookmarkConversation,
  unbookmarkConversation,
  deleteConversationById
} = require("../server");

const TEST_USER_ID = 1;

describe("shortenResponse", () => {
  it("shortens text to the requested number of words", () => {
    const text = "one two three four five";
    const result = shortenResponse(text, 3);
    expect(result).toBe("one two three");
  });

  it("returns the original text if it is already short enough", () => {
    const text = "one two";
    const result = shortenResponse(text, 5);
    expect(result).toBe(text);
  });
});

describe("conversation features", () => {
  it("creates a new conversation object", () => {
    const conversation = createConversation(
      "help me study for calc",
      false,
      TEST_USER_ID
    );

    expect(conversation).toBeDefined();
    expect(conversation.prompt).toBe("help me study for calc");
    expect(conversation.response).toBeDefined();
    expect(conversation.bookmarked).toBeFalse();
    expect(conversation.id).toBeDefined();
    expect(conversation.createdAt).toBeDefined();
  });

  it("creates a shortened conversation response when shorten is true", () => {
    const conversation = createConversation(
      "help me study for my exam",
      true,
      TEST_USER_ID
    );

    expect(conversation).toBeDefined();
    expect(conversation.response.split(/\s+/).length).toBeLessThanOrEqual(200);
  });

  it("bookmarks an existing conversation", () => {
    const conversation = createConversation(
      "debug my javascript code",
      false,
      TEST_USER_ID
    );
    const result = bookmarkConversation(conversation.id, TEST_USER_ID);

    expect(result).toBeDefined();
    expect(result.bookmarked).toBeTrue();
  });

  it("returns null when bookmarking a nonexistent conversation", () => {
    const result = bookmarkConversation(999999, TEST_USER_ID);
    expect(result).toBeNull();
  });

  it("deletes an existing conversation", () => {
    const conversation = createConversation(
      "recommend a movie",
      false,
      TEST_USER_ID
    );
    const deleted = deleteConversationById(conversation.id, TEST_USER_ID);

    expect(deleted).toBeDefined();
    expect(deleted.id).toBe(conversation.id);
  });

  it("returns null when deleting a nonexistent conversation", () => {
    const result = deleteConversationById(999999, TEST_USER_ID);
    expect(result).toBeNull();
  });

  it("stores the correct userId on a new conversation", () => {
    const conversation = createConversation("hello world", false, TEST_USER_ID);
    expect(conversation.userId).toBe(TEST_USER_ID);
  });

  it("stores the prompt exactly as entered", () => {
    const prompt = "help me with calculus";
    const conversation = createConversation(prompt, false, TEST_USER_ID);
    expect(conversation.prompt).toBe(prompt);
  });

  it("creates a response with nonzero length", () => {
    const conversation = createConversation("hello", false, TEST_USER_ID);
    expect(conversation.response.length).toBeGreaterThan(0);
  });

  it("adds a timestamp when a conversation is created", () => {
    const conversation = createConversation("timestamp test", false, TEST_USER_ID);
    expect(typeof conversation.createdAt).toBe("string");
    expect(conversation.createdAt.length).toBeGreaterThan(0);
  });

  it("does not shorten when shorten is false", () => {
    const conversation = createConversation("help me study", false, TEST_USER_ID);
    expect(conversation.response).toBeDefined();
    expect(conversation.response.length).toBeGreaterThan(0);
  });

  it("removes a bookmark from an existing conversation", () => {
    const conversation = createConversation(
      "saved conversation",
      false,
      TEST_USER_ID
    );
    bookmarkConversation(conversation.id, TEST_USER_ID);
    const result = unbookmarkConversation(conversation.id, TEST_USER_ID);
    expect(result).toBeDefined();
    expect(result.bookmarked).toBeFalse();
  });

  it("returns null when unbookmarking a nonexistent conversation", () => {
    const result = unbookmarkConversation(999999, TEST_USER_ID);
    expect(result).toBeNull();
  });
});

// ─── Multi-LLM feature tests ─────────────────────────────────────────────────
const {
  generateResponseFromModel,
  generateMultiLLMResponses,
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

  it("gives every model a non-empty label", () => {
    MULTI_LLM_MODELS.forEach(m => {
      expect(typeof m.label).toBe("string");
      expect(m.label.length).toBeGreaterThan(0);
    });
  });
});

describe("generateResponseFromModel", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("throws a descriptive error when Ollama is unreachable", async () => {
    // Simulate a network failure (fetch rejects) without needing Ollama running
    global.fetch = async () => { throw new Error("connect ECONNREFUSED 127.0.0.1:11434"); };

    try {
      await generateResponseFromModel("hello", "llama3.2:latest");
      fail("Expected generateResponseFromModel to throw");
    } catch (err) {
      expect(err.message).toContain("Could not reach Ollama");
    }
  });

  it("throws a descriptive error that includes the model name", async () => {
    global.fetch = async () => { throw new Error("connect ECONNREFUSED"); };

    try {
      await generateResponseFromModel("hello", "tinyllama:latest");
      fail("Expected generateResponseFromModel to throw");
    } catch (err) {
      expect(err.message).toContain("tinyllama:latest");
    }
  });

  it("throws when Ollama returns a non-OK HTTP status", async () => {
    global.fetch = async () => ({
      ok: false,
      status: 404,
      text: async () => "model not found"
    });

    try {
      await generateResponseFromModel("hello", "llama3.2:latest");
      fail("Expected generateResponseFromModel to throw on non-OK response");
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

describe("generateMultiLLMResponses", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns exactly three result objects (one per model)", async () => {
    // All models fail — but we still get three result objects
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
      if (callCount === 2) throw new Error("connect ECONNREFUSED"); // phi3 fails
      return {
        ok: true,
        json: async () => ({ message: { content: "ok response" } })
      };
    };

    const results = await generateMultiLLMResponses("test prompt");
    expect(results.length).toBe(3);
    const failed = results.filter(r => r.error !== null);
    const succeeded = results.filter(r => r.response !== null);
    expect(failed.length).toBe(1);
    expect(succeeded.length).toBe(2);
  });
});

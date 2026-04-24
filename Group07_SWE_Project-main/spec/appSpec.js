// ============================================================
// spec/appSpec.js — Jasmine unit tests
//
// Covers:
//   • shortenResponse
//   • createConversation  (single-LLM, synchronous stub)
//   • createMultiConversation (multi-LLM, async)
//   • addMultiMessageToConversation (async)
//   • bookmarkConversation / unbookmarkConversation
//   • deleteConversationById
//
// Run with:  npm test
// ============================================================

const {
  shortenResponse,
  createConversation,
  createMultiConversation,
  addMultiMessageToConversation,
  bookmarkConversation,
  unbookmarkConversation,
  deleteConversationById
} = require("../server");

const TEST_USER_ID = 1;

// ─── shortenResponse ──────────────────────────────────────────────────────────

describe("shortenResponse", () => {
  it("shortens text to the requested number of words", () => {
    expect(shortenResponse("one two three four five", 3)).toBe("one two three");
  });

  it("returns the original text if it is already short enough", () => {
    expect(shortenResponse("one two", 5)).toBe("one two");
  });

  it("returns the original text when word count exactly equals the limit", () => {
    expect(shortenResponse("one two three", 3)).toBe("one two three");
  });

  it("handles a single-word string", () => {
    expect(shortenResponse("hello", 1)).toBe("hello");
  });
});

// ─── createConversation (single-LLM) ─────────────────────────────────────────

describe("createConversation", () => {
  it("creates a new conversation object", () => {
    const conv = createConversation("help me study for calc", false, TEST_USER_ID);
    expect(conv).toBeDefined();
    expect(conv.prompt).toBe("help me study for calc");
    expect(conv.response).toBeDefined();
    expect(conv.bookmarked).toBeFalse();
    expect(conv.id).toBeDefined();
    expect(conv.createdAt).toBeDefined();
  });

  it("stores the correct userId on the conversation", () => {
    const conv = createConversation("hello world", false, TEST_USER_ID);
    expect(conv.userId).toBe(TEST_USER_ID);
  });

  it("stores the prompt exactly as entered", () => {
    const prompt = "help me with calculus";
    const conv = createConversation(prompt, false, TEST_USER_ID);
    expect(conv.prompt).toBe(prompt);
  });

  it("generates a non-empty response", () => {
    const conv = createConversation("hello", false, TEST_USER_ID);
    expect(conv.response.length).toBeGreaterThan(0);
  });

  it("assigns a numeric id", () => {
    const conv = createConversation("numeric id test", false, TEST_USER_ID);
    expect(typeof conv.id).toBe("number");
  });

  it("assigns incrementing ids across successive calls", () => {
    const a = createConversation("first prompt", false, TEST_USER_ID);
    const b = createConversation("second prompt", false, TEST_USER_ID);
    expect(b.id).toBeGreaterThan(a.id);
  });

  it("adds a createdAt timestamp string", () => {
    const conv = createConversation("timestamp test", false, TEST_USER_ID);
    expect(typeof conv.createdAt).toBe("string");
    expect(conv.createdAt.length).toBeGreaterThan(0);
  });

  it("shortens the response when shorten=true", () => {
    const conv = createConversation("help me study for my exam", true, TEST_USER_ID);
    expect(conv.response.split(/\s+/).length).toBeLessThanOrEqual(200);
  });

  it("does not shorten the response when shorten=false", () => {
    const conv = createConversation("help me study", false, TEST_USER_ID);
    expect(conv.response).toBeDefined();
    expect(conv.response.length).toBeGreaterThan(0);
  });

  it("sets bookmarked to false by default", () => {
    const conv = createConversation("bookmark default test", false, TEST_USER_ID);
    expect(conv.bookmarked).toBeFalse();
  });

  it("initialises llmResults as null for single-LLM conversations", () => {
    const conv = createConversation("single llm test", false, TEST_USER_ID);
    expect(conv.llmResults).toBeNull();
  });
});

// ─── createMultiConversation ──────────────────────────────────────────────────

describe("createMultiConversation", () => {
  it("returns a conversation object", async () => {
    const conv = await createMultiConversation("what is 2+2?", false, TEST_USER_ID);
    expect(conv).toBeDefined();
    expect(typeof conv).toBe("object");
  });

  it("stores the original prompt", async () => {
    const prompt = "explain gravity briefly";
    const conv = await createMultiConversation(prompt, false, TEST_USER_ID);
    expect(conv.prompt).toBe(prompt);
  });

  it("stores the correct userId", async () => {
    const conv = await createMultiConversation("user id check", false, TEST_USER_ID);
    expect(conv.userId).toBe(TEST_USER_ID);
  });

  it("assigns a numeric id", async () => {
    const conv = await createMultiConversation("id type check", false, TEST_USER_ID);
    expect(typeof conv.id).toBe("number");
  });

  it("assigns a createdAt timestamp", async () => {
    const conv = await createMultiConversation("timestamp multi", false, TEST_USER_ID);
    expect(typeof conv.createdAt).toBe("string");
    expect(conv.createdAt.length).toBeGreaterThan(0);
  });

  it("sets bookmarked to false by default", async () => {
    const conv = await createMultiConversation("bookmark multi default", false, TEST_USER_ID);
    expect(conv.bookmarked).toBeFalse();
  });

  it("populates llmResults with an object keyed by model id", async () => {
    const conv = await createMultiConversation("multi llm test", false, TEST_USER_ID);
    expect(conv.llmResults).toBeDefined();
    expect(typeof conv.llmResults).toBe("object");

    // All three expected model keys must be present
    expect(conv.llmResults["llama3.2"]).toBeDefined();
    expect(conv.llmResults["deepseek-r1"]).toBeDefined();
    expect(conv.llmResults["gemma3"]).toBeDefined();
  });

  it("each llmResult entry has a status field", async () => {
    const conv = await createMultiConversation("status check", false, TEST_USER_ID);
    Object.values(conv.llmResults).forEach(r => {
      expect(r.status).toBeDefined();
      expect(["fulfilled", "rejected"]).toContain(r.status);
    });
  });

  it("fulfilled llmResult entries have a non-empty response string", async () => {
    const conv = await createMultiConversation("response check", false, TEST_USER_ID);
    const fulfilled = Object.values(conv.llmResults).filter(r => r.status === "fulfilled");
    fulfilled.forEach(r => {
      expect(typeof r.response).toBe("string");
      expect(r.response.length).toBeGreaterThan(0);
    });
  });

  it("stores a non-empty primary response on the conversation", async () => {
    const conv = await createMultiConversation("primary response check", false, TEST_USER_ID);
    expect(typeof conv.response).toBe("string");
    expect(conv.response.length).toBeGreaterThan(0);
  });

  it("includes the user message in the messages array", async () => {
    const prompt = "messages array check";
    const conv = await createMultiConversation(prompt, false, TEST_USER_ID);
    const userMsg = conv.messages.find(m => m.role === "user");
    expect(userMsg).toBeDefined();
    expect(userMsg.content).toBe(prompt);
  });

  it("shortens fulfilled responses when shorten=true", async () => {
    const conv = await createMultiConversation("shorten multi test", true, TEST_USER_ID);
    const fulfilled = Object.values(conv.llmResults).filter(r => r.status === "fulfilled");
    fulfilled.forEach(r => {
      expect(r.response.split(/\s+/).length).toBeLessThanOrEqual(200);
    });
  });

  it("assigns incrementing ids across successive multi calls", async () => {
    const a = await createMultiConversation("multi id a", false, TEST_USER_ID);
    const b = await createMultiConversation("multi id b", false, TEST_USER_ID);
    expect(b.id).toBeGreaterThan(a.id);
  });
});

// ─── addMultiMessageToConversation ────────────────────────────────────────────

describe("addMultiMessageToConversation", () => {
  it("returns null when the conversation does not exist", async () => {
    const result = await addMultiMessageToConversation(999999, "hello", false, TEST_USER_ID);
    expect(result).toBeNull();
  });

  it("returns null when the userId does not match", async () => {
    const conv = await createMultiConversation("ownership test", false, TEST_USER_ID);
    const result = await addMultiMessageToConversation(conv.id, "follow up", false, 9999);
    expect(result).toBeNull();
  });

  it("returns the updated conversation object on success", async () => {
    const conv = await createMultiConversation("base message", false, TEST_USER_ID);
    const updated = await addMultiMessageToConversation(conv.id, "follow up question", false, TEST_USER_ID);
    expect(updated).toBeDefined();
    expect(updated.id).toBe(conv.id);
  });

  it("appends the new user message to the messages array", async () => {
    const conv = await createMultiConversation("base for append", false, TEST_USER_ID);
    const updated = await addMultiMessageToConversation(conv.id, "second user message", false, TEST_USER_ID);
    const userMessages = updated.messages.filter(m => m.role === "user");
    expect(userMessages.length).toBeGreaterThanOrEqual(2);
  });

  it("updates llmResults on the conversation after a follow-up", async () => {
    const conv = await createMultiConversation("initial prompt", false, TEST_USER_ID);
    const updated = await addMultiMessageToConversation(conv.id, "follow-up prompt", false, TEST_USER_ID);
    expect(updated.llmResults).toBeDefined();
    expect(updated.llmResults["llama3.2"]).toBeDefined();
    expect(updated.llmResults["deepseek-r1"]).toBeDefined();
    expect(updated.llmResults["gemma3"]).toBeDefined();
  });

  it("updates the updatedAt timestamp", async () => {
    const conv = await createMultiConversation("timestamp update test", false, TEST_USER_ID);
    const before = conv.updatedAt;
    await new Promise(r => setTimeout(r, 10));
    const updated = await addMultiMessageToConversation(conv.id, "next message", false, TEST_USER_ID);
    expect(updated.updatedAt).not.toBe(before);
  });
});

// ─── bookmarkConversation ─────────────────────────────────────────────────────

describe("bookmarkConversation", () => {
  it("sets bookmarked to true on an existing conversation", () => {
    const conv = createConversation("debug my javascript code", false, TEST_USER_ID);
    const result = bookmarkConversation(conv.id, TEST_USER_ID);
    expect(result).toBeDefined();
    expect(result.bookmarked).toBeTrue();
  });

  it("returns the full conversation object after bookmarking", () => {
    const conv = createConversation("recommend a book", false, TEST_USER_ID);
    const result = bookmarkConversation(conv.id, TEST_USER_ID);
    expect(result.id).toBe(conv.id);
    expect(result.prompt).toBe(conv.prompt);
  });

  it("returns null when the conversation id does not exist", () => {
    expect(bookmarkConversation(999999, TEST_USER_ID)).toBeNull();
  });

  it("returns null when the userId does not match", () => {
    const conv = createConversation("private prompt", false, TEST_USER_ID);
    expect(bookmarkConversation(conv.id, 9999)).toBeNull();
  });
});

// ─── unbookmarkConversation ───────────────────────────────────────────────────

describe("unbookmarkConversation", () => {
  it("removes a bookmark from an existing conversation", () => {
    const conv = createConversation("saved conversation", false, TEST_USER_ID);
    bookmarkConversation(conv.id, TEST_USER_ID);
    const result = unbookmarkConversation(conv.id, TEST_USER_ID);
    expect(result).toBeDefined();
    expect(result.bookmarked).toBeFalse();
  });

  it("returns the full conversation object after unbookmarking", () => {
    const conv = createConversation("unbookmark object check", false, TEST_USER_ID);
    bookmarkConversation(conv.id, TEST_USER_ID);
    const result = unbookmarkConversation(conv.id, TEST_USER_ID);
    expect(result.id).toBe(conv.id);
  });

  it("returns null when the conversation id does not exist", () => {
    expect(unbookmarkConversation(999999, TEST_USER_ID)).toBeNull();
  });

  it("returns null when the userId does not match", () => {
    const conv = createConversation("ownership unbookmark", false, TEST_USER_ID);
    bookmarkConversation(conv.id, TEST_USER_ID);
    expect(unbookmarkConversation(conv.id, 9999)).toBeNull();
  });
});

// ─── deleteConversationById ───────────────────────────────────────────────────

describe("deleteConversationById", () => {
  it("removes an existing conversation and returns it", () => {
    const conv = createConversation("recommend a movie", false, TEST_USER_ID);
    const deleted = deleteConversationById(conv.id, TEST_USER_ID);
    expect(deleted).toBeDefined();
    expect(deleted.id).toBe(conv.id);
  });

  it("returns null when attempting to delete a nonexistent conversation", () => {
    expect(deleteConversationById(999999, TEST_USER_ID)).toBeNull();
  });

  it("returns null when the userId does not match", () => {
    const conv = createConversation("owner-only prompt", false, TEST_USER_ID);
    expect(deleteConversationById(conv.id, 9999)).toBeNull();
  });

  it("makes the conversation unfindable after deletion", () => {
    const conv = createConversation("delete me", false, TEST_USER_ID);
    deleteConversationById(conv.id, TEST_USER_ID);
    expect(deleteConversationById(conv.id, TEST_USER_ID)).toBeNull();
  });
});

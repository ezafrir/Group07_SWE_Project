const {
  shortenResponse,
  createConversation,
  addMessageToConversation,
  bookmarkConversation,
  unbookmarkConversation,
  deleteConversationById,
  fetchAllResponses,
  setLLMServiceForTesting
} = require("../server");

const TEST_USER_ID = 1;

// Mock LLM service — returns a deterministic response without needing Ollama running
const MOCK_RESPONSE = "This is a mock AI response used for unit testing purposes.";
function mockLLMService() {
  return Promise.resolve(MOCK_RESPONSE);
}

beforeAll(() => {
  setLLMServiceForTesting(mockLLMService);
});

afterAll(() => {
  setLLMServiceForTesting(null); // restore real service
});

// ─── shortenResponse ──────────────────────────────────────────────────────────
describe("shortenResponse", () => {
  it("shortens text to the requested number of words", () => {
    const text = "one two three four five";
    const result = shortenResponse(text, 3);
    expect(result).toBe("one two three");
  });

  it("returns the original text if it is already short enough", () => {
    const text = "one two";
    const result = shortenResponse(text, 5);
    expect(result).toBe("one two");
  });
});

// ─── createConversation ───────────────────────────────────────────────────────
describe("conversation features", () => {
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
    expect(conversation).toBeDefined();
    expect(conversation.response.split(/\s+/).length).toBeLessThanOrEqual(200);
  });

  it("bookmarks an existing conversation", async () => {
    const conversation = await createConversation("debug my javascript code", false, TEST_USER_ID);
    const result = bookmarkConversation(conversation.id, TEST_USER_ID);
    expect(result).toBeDefined();
    expect(result.bookmarked).toBeTrue();
  });

  it("returns null when bookmarking a nonexistent conversation", () => {
    const result = bookmarkConversation(999999, TEST_USER_ID);
    expect(result).toBeNull();
  });

  it("deletes an existing conversation", async () => {
    const conversation = await createConversation("recommend a movie", false, TEST_USER_ID);
    const deleted = deleteConversationById(conversation.id, TEST_USER_ID);
    expect(deleted).toBeDefined();
    expect(deleted.id).toBe(conversation.id);
  });

  it("returns null when deleting a nonexistent conversation", () => {
    const result = deleteConversationById(999999, TEST_USER_ID);
    expect(result).toBeNull();
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
    const result = unbookmarkConversation(999999, TEST_USER_ID);
    expect(result).toBeNull();
  });
});

// ─── Multi-LLM response features ─────────────────────────────────────────────
describe("multi-LLM response features", () => {
  it("fetchAllResponses returns exactly 3 responses", async () => {
    const responses = await fetchAllResponses("what is AI?", false);
    expect(responses.length).toBe(3);
  });

  it("each response has a non-empty model name and content", async () => {
    const responses = await fetchAllResponses("explain gravity", false);
    responses.forEach(r => {
      expect(r.model).toBeDefined();
      expect(r.model.length).toBeGreaterThan(0);
      expect(r.content).toBeDefined();
      expect(r.content.length).toBeGreaterThan(0);
    });
  });

  it("response model names are Llama 3.2, TinyLlama, and Phi 3 in order", async () => {
    const responses = await fetchAllResponses("test prompt", false);
    expect(responses[0].model).toBe("Llama 3.2");
    expect(responses[1].model).toBe("TinyLlama");
    expect(responses[2].model).toBe("Phi 3");
  });

  it("conversation messages include an assistant entry with a responses array", async () => {
    const conversation = await createConversation("test multi-llm", false, TEST_USER_ID);
    const assistantMsg = conversation.messages.find(m => m.role === "assistant");
    expect(assistantMsg).toBeDefined();
    expect(Array.isArray(assistantMsg.responses)).toBeTrue();
    expect(assistantMsg.responses.length).toBe(3);
  });

  it("shortens all 3 responses when shorten is true", async () => {
    const responses = await fetchAllResponses("test shortening", true);
    responses.forEach(r => {
      expect(r.content.split(/\s+/).length).toBeLessThanOrEqual(200);
    });
  });

  it("addMessageToConversation appends a multi-LLM assistant message", async () => {
    const conversation = await createConversation("initial message", false, TEST_USER_ID);
    const updated = await addMessageToConversation(
      conversation.id, "follow-up message", false, TEST_USER_ID
    );
    expect(updated).toBeDefined();
    const messages = updated.messages;
    const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");
    expect(Array.isArray(lastAssistant.responses)).toBeTrue();
    expect(lastAssistant.responses.length).toBe(3);
  });
});

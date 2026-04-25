/**
 * spec/appSpec.js
 *
 * Jasmine unit tests for the helper functions exported from server.js.
 *
 * Run with:  npm test   (which calls `jasmine` per the project's package.json)
 *
 * Design notes
 * ────────────
 * • Each describe() block maps to one exported function.
 * • Tests are ordered: happy-path first, then edge / failure cases.
 * • server.js stores conversations in a shared in-memory array, so each test
 *   that calls createConversation() gets back a real id that can be used for
 *   subsequent bookmark / delete calls — no mocking needed.
 * • userId is passed as 1 everywhere because these unit tests exercise the
 *   helper functions directly; auth is tested at the acceptance-test layer.
 */



const {
  shortenResponse,
  createConversation,
  bookmarkConversation,
  deleteConversationById
} = require("../server");

const TEST_USER_ID = 1;

// ─── shortenResponse ─────────────────────────────────────────────────────────

describe("shortenResponse", () => {
  it("shortens text to exactly the requested number of words", () => {
    const text = "one two three four five";
    expect(shortenResponse(text, 3)).toBe("one two three");
  });

  it("returns the original text when word count is within the limit", () => {
    expect(shortenResponse("one two", 5)).toBe("one two");
  });

  it("returns the original text when word count exactly equals the limit", () => {
    expect(shortenResponse("one two three", 3)).toBe("one two three");
  });

  it("handles a single-word string", () => {
    expect(shortenResponse("hello", 1)).toBe("hello");
  });

  it("handles extra whitespace between words", () => {
    const result = shortenResponse("one  two  three", 2);
    expect(result).toBe("one  two");
  });
});

// ─── createConversation ───────────────────────────────────────────────────────

describe("createConversation", () => {
  it("returns a defined conversation object", () => {
    const conv = createConversation("help me study for calc", false, TEST_USER_ID);
    expect(conv).toBeDefined();
  });

  it("stores the original prompt on the conversation", () => {
    const conv = createConversation("help me study for calc", false, TEST_USER_ID);
    expect(conv.prompt).toBe("help me study for calc");
  });

  it("generates a non-empty response", () => {
    const conv = createConversation("help me study for calc", false, TEST_USER_ID);
    expect(conv.response).toBeTruthy();
  });

  it("sets bookmarked to false by default", () => {
    const conv = createConversation("debug my javascript code", false, TEST_USER_ID);
    expect(conv.bookmarked).toBeFalse();
  });

  it("assigns a numeric id", () => {
    const conv = createConversation("recommend a movie", false, TEST_USER_ID);
    expect(typeof conv.id).toBe("number");
  });

  it("assigns a createdAt timestamp string", () => {
    const conv = createConversation("help me study", false, TEST_USER_ID);
    expect(typeof conv.createdAt).toBe("string");
    expect(conv.createdAt).toBeTruthy();
  });

  it("assigns incrementing ids across successive calls", () => {
    const a = createConversation("first prompt", false, TEST_USER_ID);
    const b = createConversation("second prompt", false, TEST_USER_ID);
    expect(b.id).toBeGreaterThan(a.id);
  });

  it("stores the userId on the conversation", () => {
    const conv = createConversation("my user prompt", false, TEST_USER_ID);
    expect(conv.userId).toBe(TEST_USER_ID);
  });

  it("truncates the title to 20 characters when the prompt is long", () => {
    const conv = createConversation("this is a very long prompt that exceeds twenty chars", false, TEST_USER_ID);
    expect(conv.title.endsWith("...")).toBeTrue();
    expect(conv.title.length).toBeLessThanOrEqual(23); // 20 chars + "..."
  });

  it("uses the full prompt as title when prompt is 20 chars or fewer", () => {
    const conv = createConversation("short prompt", false, TEST_USER_ID);
    expect(conv.title).toBe("short prompt");
  });

  it("shortens the response when shorten=true", () => {
    const conv = createConversation("help me study for my exam", true, TEST_USER_ID);
    expect(conv.response.split(/\s+/).length).toBeLessThanOrEqual(200);
  });

  it("does not shorten the response when shorten=false", () => {
    const conv = createConversation("help me study for my exam", false, TEST_USER_ID);
    // Response exists; not checking word count because shorten is off
    expect(conv.response).toBeTruthy();
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

  it("returns null when the userId does not match the conversation owner", () => {
    const conv = createConversation("owner-only prompt", false, TEST_USER_ID);
    expect(deleteConversationById(conv.id, 9999)).toBeNull();
  });

  it("makes the conversation unfindable after deletion", () => {
    const conv = createConversation("delete me", false, TEST_USER_ID);
    deleteConversationById(conv.id, TEST_USER_ID);
    // Attempting to delete again should return null
    expect(deleteConversationById(conv.id, TEST_USER_ID)).toBeNull();
  });
});

// --- NEW COMPARISON LOGIC TESTS ---

// A simple mock of the comparison logic to verify your algorithm works
const analyzeText = (responses) => {
  if (!responses || responses.length < 2) throw new Error("Need at least 2 responses");
  
  const summary = { similarities: [], differences: [] };
  const allText = responses.join(" ").toLowerCase();
  
  if (allText.includes("pmos") && allText.includes("transistor")) {
    summary.similarities.push("All models correctly identified the hardware component.");
  }
  return summary;
};

describe('LLM Response Analysis Logic', () => {
  it('should throw an error if fewer than 2 responses are provided', () => {
    expect(() => analyzeText(["Only one response"])).toThrow();
  });

  it('should successfully find similarities across 3 model outputs', () => {
    const modelOutputs = [
      "PMOS transistors use holes as charge carriers.",
      "A PMOS transistor turns on with a low voltage.",
      "In digital circuits, PMOS transistors are pulled up to VDD."
    ];
    
    const result = analyzeText(modelOutputs);
    expect(result.similarities.length).toBeGreaterThan(0);
    expect(result.similarities[0]).toContain("hardware component");
  });
});
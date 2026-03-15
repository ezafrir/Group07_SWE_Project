const {
  shortenResponse,
  createConversation,
  bookmarkConversation,
  deleteConversationById
} = require("../server");

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

describe("conversation features", () => {
  it("creates a new conversation object", () => {
    const conversation = createConversation("help me study for calc", false);

    expect(conversation).toBeDefined();
    expect(conversation.prompt).toBe("help me study for calc");
    expect(conversation.response).toBeDefined();
    expect(conversation.bookmarked).toBeFalse();
    expect(conversation.id).toBeDefined();
    expect(conversation.createdAt).toBeDefined();
  });

  it("creates a shortened conversation response when shorten is true", () => {
    const conversation = createConversation("help me study for my exam", true);

    expect(conversation).toBeDefined();
    expect(conversation.response.split(/\s+/).length).toBeLessThanOrEqual(200);
  });

  it("bookmarks an existing conversation", () => {
    const conversation = createConversation("debug my javascript code", false);
    const result = bookmarkConversation(conversation.id);

    expect(result).toBeDefined();
    expect(result.bookmarked).toBeTrue();
  });

  it("returns null when bookmarking a nonexistent conversation", () => {
    const result = bookmarkConversation(999999);
    expect(result).toBeNull();
  });

  it("deletes an existing conversation", () => {
    const conversation = createConversation("recommend a movie", false);
    const deleted = deleteConversationById(conversation.id);

    expect(deleted).toBeDefined();
    expect(deleted.id).toBe(conversation.id);
  });

  it("returns null when deleting a nonexistent conversation", () => {
    const result = deleteConversationById(999999);
    expect(result).toBeNull();
  });
});
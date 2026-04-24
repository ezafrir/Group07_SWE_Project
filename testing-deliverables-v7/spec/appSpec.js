// /**
//  * spec/appSpec.js
//  *
//  * Jasmine unit tests for the helper functions exported from server.js.
//  *
//  * Run with:  npm test   (which calls `jasmine` per the project's package.json)
//  *
//  * Design notes
//  * ────────────
//  * • Each describe() block maps to one exported function.
//  * • Tests are ordered: happy-path first, then edge / failure cases.
//  * • server.js stores conversations in a shared in-memory array, so each test
//  *   that calls createConversation() gets back a real id that can be used for
//  *   subsequent bookmark / delete calls — no mocking needed.
//  * • userId is passed as 1 everywhere because these unit tests exercise the
//  *   helper functions directly; auth is tested at the acceptance-test layer.
//  */

// const {
//   shortenResponse,
//   createConversation,
//   bookmarkConversation,
//   deleteConversationById
// } = require("../server");

// const TEST_USER_ID = 1;

// // ─── shortenResponse ─────────────────────────────────────────────────────────

// describe("shortenResponse", () => {
//   it("shortens text to exactly the requested number of words", () => {
//     const text = "one two three four five";
//     expect(shortenResponse(text, 3)).toBe("one two three");
//   });

//   it("returns the original text when word count is within the limit", () => {
//     expect(shortenResponse("one two", 5)).toBe("one two");
//   });

//   it("returns the original text when word count exactly equals the limit", () => {
//     expect(shortenResponse("one two three", 3)).toBe("one two three");
//   });

//   it("handles a single-word string", () => {
//     expect(shortenResponse("hello", 1)).toBe("hello");
//   });

//   it("handles extra whitespace between words", () => {
//     const result = shortenResponse("one  two  three", 2);
//     expect(result).toBe("one  two");
//   });
// });

// // ─── createConversation ───────────────────────────────────────────────────────

// describe("createConversation", () => {
//   it("returns a defined conversation object", () => {
//     const conv = createConversation("help me study for calc", false, TEST_USER_ID);
//     expect(conv).toBeDefined();
//   });

//   it("stores the original prompt on the conversation", () => {
//     const conv = createConversation("help me study for calc", false, TEST_USER_ID);
//     expect(conv.prompt).toBe("help me study for calc");
//   });

//   it("generates a non-empty response", () => {
//     const conv = createConversation("help me study for calc", false, TEST_USER_ID);
//     expect(conv.response).toBeTruthy();
//   });

//   it("sets bookmarked to false by default", () => {
//     const conv = createConversation("debug my javascript code", false, TEST_USER_ID);
//     expect(conv.bookmarked).toBeFalse();
//   });

//   it("assigns a numeric id", () => {
//     const conv = createConversation("recommend a movie", false, TEST_USER_ID);
//     expect(typeof conv.id).toBe("number");
//   });

//   it("assigns a createdAt timestamp string", () => {
//     const conv = createConversation("help me study", false, TEST_USER_ID);
//     expect(typeof conv.createdAt).toBe("string");
//     expect(conv.createdAt).toBeTruthy();
//   });

//   it("assigns incrementing ids across successive calls", () => {
//     const a = createConversation("first prompt", false, TEST_USER_ID);
//     const b = createConversation("second prompt", false, TEST_USER_ID);
//     expect(b.id).toBeGreaterThan(a.id);
//   });

//   it("stores the userId on the conversation", () => {
//     const conv = createConversation("my user prompt", false, TEST_USER_ID);
//     expect(conv.userId).toBe(TEST_USER_ID);
//   });

//   it("truncates the title to 20 characters when the prompt is long", () => {
//     const conv = createConversation("this is a very long prompt that exceeds twenty chars", false, TEST_USER_ID);
//     expect(conv.title.endsWith("...")).toBeTrue();
//     expect(conv.title.length).toBeLessThanOrEqual(23); // 20 chars + "..."
//   });

//   it("uses the full prompt as title when prompt is 20 chars or fewer", () => {
//     const conv = createConversation("short prompt", false, TEST_USER_ID);
//     expect(conv.title).toBe("short prompt");
//   });

//   it("shortens the response when shorten=true", () => {
//     const conv = createConversation("help me study for my exam", true, TEST_USER_ID);
//     expect(conv.response.split(/\s+/).length).toBeLessThanOrEqual(200);
//   });

//   it("does not shorten the response when shorten=false", () => {
//     const conv = createConversation("help me study for my exam", false, TEST_USER_ID);
//     // Response exists; not checking word count because shorten is off
//     expect(conv.response).toBeTruthy();
//   });
// });

// // ─── bookmarkConversation ─────────────────────────────────────────────────────

// describe("bookmarkConversation", () => {
//   it("sets bookmarked to true on an existing conversation", () => {
//     const conv = createConversation("debug my javascript code", false, TEST_USER_ID);
//     const result = bookmarkConversation(conv.id, TEST_USER_ID);
//     expect(result).toBeDefined();
//     expect(result.bookmarked).toBeTrue();
//   });

//   it("returns the full conversation object after bookmarking", () => {
//     const conv = createConversation("recommend a book", false, TEST_USER_ID);
//     const result = bookmarkConversation(conv.id, TEST_USER_ID);
//     expect(result.id).toBe(conv.id);
//     expect(result.prompt).toBe(conv.prompt);
//   });

//   it("returns null when the conversation id does not exist", () => {
//     expect(bookmarkConversation(999999, TEST_USER_ID)).toBeNull();
//   });

//   it("returns null when the userId does not match", () => {
//     const conv = createConversation("private prompt", false, TEST_USER_ID);
//     expect(bookmarkConversation(conv.id, 9999)).toBeNull();
//   });
// });

// // ─── deleteConversationById ───────────────────────────────────────────────────

// describe("deleteConversationById", () => {
//   it("removes an existing conversation and returns it", () => {
//     const conv = createConversation("recommend a movie", false, TEST_USER_ID);
//     const deleted = deleteConversationById(conv.id, TEST_USER_ID);
//     expect(deleted).toBeDefined();
//     expect(deleted.id).toBe(conv.id);
//   });

//   it("returns null when attempting to delete a nonexistent conversation", () => {
//     expect(deleteConversationById(999999, TEST_USER_ID)).toBeNull();
//   });

//   it("returns null when the userId does not match the conversation owner", () => {
//     const conv = createConversation("owner-only prompt", false, TEST_USER_ID);
//     expect(deleteConversationById(conv.id, 9999)).toBeNull();
//   });

//   it("makes the conversation unfindable after deletion", () => {
//     const conv = createConversation("delete me", false, TEST_USER_ID);
//     deleteConversationById(conv.id, TEST_USER_ID);
//     // Attempting to delete again should return null
//     expect(deleteConversationById(conv.id, TEST_USER_ID)).toBeNull();
//   });
// });


// // ─── multi-model responses ───────────────────────────────────────────────────

// describe("multi-model response structure", () => {
//   it("stores multiple model responses if available", () => {
//     const conv = createConversation("explain recursion", false, TEST_USER_ID);

//     // Depending on your implementation, responses may be stored differently.
//     // Adjust this based on your actual server.js structure.

//     expect(conv).toBeDefined();

//     // Example: if you store responses in an object like:
//     // conv.responses = { llama3.2: "...", phi3: "...", tinyllama: "..." }

//     if (conv.responses) {
//       expect(conv.responses["llama3.2"]).toBeTruthy();
//       expect(conv.responses["phi3"]).toBeTruthy();
//       expect(conv.responses["tinyllama"]).toBeTruthy();
//     } else {
//       // fallback if only one response exists (still valid)
//       expect(conv.response).toBeTruthy();
//     }
//   });

//   it("keeps all responses tied to a single conversation id", () => {
//     const conv = createConversation("what is debugging", false, TEST_USER_ID);

//     expect(conv.id).toBeDefined();

//     if (conv.responses) {
//       const keys = Object.keys(conv.responses);
//       expect(keys.length).toBeGreaterThanOrEqual(1);
//     }
//   });
// });

// // ─── multi-model responses ───────────────────────────────────────────────────

// describe("multi-model response support", () => {
//   it("stores model responses on the conversation", async () => {
//     const conv = await createConversation("explain recursion", false, TEST_USER_ID);

//     expect(conv).toBeDefined();
//     expect(conv.modelResponses).toBeDefined();
//     expect(typeof conv.modelResponses).toBe("object");
//   });

//   it("stores llama3.2, phi3, and tinyllama responses when available", async () => {
//     const conv = await createConversation("what is debugging", false, TEST_USER_ID);

//     expect(conv.modelResponses["llama3.2"]).toBeTruthy();
//     expect(conv.modelResponses["phi3"]).toBeTruthy();
//     expect(conv.modelResponses["tinyllama"]).toBeTruthy();
//   });

//   it("keeps multi-model responses tied to a single conversation", async () => {
//     const conv = await createConversation("define abstraction", false, TEST_USER_ID);

//     expect(conv.id).toBeDefined();
//     expect(conv.messages.length).toBeGreaterThanOrEqual(2);
//     expect(conv.messages[1].kind).toBe("multi");
//     expect(conv.messages[1].responses).toBeDefined();
//   });
// });

/**
 * spec/appSpec.js
 *
 * Jasmine unit tests for backend helper functions exported from server.js.
 * Run with: npm test
 */

const llmServicePath = require.resolve("../llmService");

require.cache[llmServicePath] = {
  id: llmServicePath,
  filename: llmServicePath,
  loaded: true,
  exports: {
    MODELS: ["llama3.2", "phi3", "tinyllama"],
    MODEL_LABELS: {
      "llama3.2": "Llama 3.2",
      phi3: "Phi-3",
      tinyllama: "TinyLlama"
    },
    generateLLMResponse: async prompt => {
      return `Mock title or response for: ${prompt}`;
    },
    generateAllLLMResponses: async prompt => {
      return {
        "llama3.2": `Llama response for: ${prompt}`,
        phi3: `Phi response for: ${prompt}`,
        tinyllama: `TinyLlama response for: ${prompt}`
      };
    },
    summarizeResponses: async () => {
      return "Mock summary response";
    }
  }
};

const {
  shortenResponse,
  createConversation,
  addMessageToConversation,
  bookmarkConversation,
  unbookmarkConversation,
  deleteConversationById
} = require("../server");

const TEST_USER_ID = 1;

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
    expect(result).toBe("one two");
  });
});

describe("createConversation", () => {
  it("returns a defined conversation object", async () => {
    const conv = await createConversation("help me study for calc", false, TEST_USER_ID);
    expect(conv).toBeDefined();
  });

  it("stores the original prompt on the conversation", async () => {
    const conv = await createConversation("help me study for calc", false, TEST_USER_ID);
    expect(conv.prompt).toBe("help me study for calc");
  });

  it("generates a non-empty response", async () => {
    const conv = await createConversation("help me study for calc", false, TEST_USER_ID);
    expect(conv.response).toBeTruthy();
  });

  it("stores multi-model responses", async () => {
    const conv = await createConversation("explain recursion", false, TEST_USER_ID);

    expect(conv.modelResponses).toBeDefined();
    expect(conv.modelResponses["llama3.2"]).toBeTruthy();
    expect(conv.modelResponses.phi3).toBeTruthy();
    expect(conv.modelResponses.tinyllama).toBeTruthy();
  });

  it("sets bookmarked to false by default", async () => {
    const conv = await createConversation("debug my javascript code", false, TEST_USER_ID);
    expect(conv.bookmarked).toBeFalse();
  });

  it("assigns a numeric id", async () => {
    const conv = await createConversation("recommend a movie", false, TEST_USER_ID);
    expect(typeof conv.id).toBe("number");
  });

  it("assigns timestamps", async () => {
    const conv = await createConversation("help me study", false, TEST_USER_ID);
    expect(typeof conv.createdAt).toBe("string");
    expect(typeof conv.updatedAt).toBe("string");
  });

  it("assigns incrementing ids across successive calls", async () => {
    const a = await createConversation("first prompt", false, TEST_USER_ID);
    const b = await createConversation("second prompt", false, TEST_USER_ID);
    expect(b.id).toBeGreaterThan(a.id);
  });

  it("stores the userId on the conversation", async () => {
    const conv = await createConversation("my user prompt", false, TEST_USER_ID);
    expect(conv.userId).toBe(TEST_USER_ID);
  });

  it("creates a messages array with user and assistant messages", async () => {
    const conv = await createConversation("what is abstraction", false, TEST_USER_ID);

    expect(conv.messages.length).toBe(2);
    expect(conv.messages[0].role).toBe("user");
    expect(conv.messages[1].role).toBe("assistant");
    expect(conv.messages[1].kind).toBe("multi");
  });
});

describe("addMessageToConversation", () => {
  it("adds a new user message and assistant response to an existing conversation", async () => {
    const conv = await createConversation("first prompt", false, TEST_USER_ID);
    const updated = await addMessageToConversation(conv.id, "second prompt", false, TEST_USER_ID);

    expect(updated).toBeDefined();
    expect(updated.messages.length).toBe(4);
    expect(updated.prompt).toBe("second prompt");
  });

  it("returns null when the conversation does not exist", async () => {
    const result = await addMessageToConversation(999999, "test prompt", false, TEST_USER_ID);
    expect(result).toBeNull();
  });

  it("returns null when the userId does not match", async () => {
    const conv = await createConversation("private prompt", false, TEST_USER_ID);
    const result = await addMessageToConversation(conv.id, "bad access", false, 9999);
    expect(result).toBeNull();
  });
});

describe("bookmarkConversation", () => {
  it("sets bookmarked to true on an existing conversation", async () => {
    const conv = await createConversation("debug my javascript code", false, TEST_USER_ID);
    const result = bookmarkConversation(conv.id, TEST_USER_ID);

    expect(result).toBeDefined();
    expect(result.bookmarked).toBeTrue();
  });

  it("returns the full conversation object after bookmarking", async () => {
    const conv = await createConversation("recommend a book", false, TEST_USER_ID);
    const result = bookmarkConversation(conv.id, TEST_USER_ID);

    expect(result.id).toBe(conv.id);
    expect(result.prompt).toBe(conv.prompt);
  });

  it("returns null when the conversation id does not exist", () => {
    expect(bookmarkConversation(999999, TEST_USER_ID)).toBeNull();
  });

  it("returns null when the userId does not match", async () => {
    const conv = await createConversation("private prompt", false, TEST_USER_ID);
    expect(bookmarkConversation(conv.id, 9999)).toBeNull();
  });
});

describe("unbookmarkConversation", () => {
  it("sets bookmarked to false", async () => {
    const conv = await createConversation("bookmark then unbookmark", false, TEST_USER_ID);
    bookmarkConversation(conv.id, TEST_USER_ID);

    const result = unbookmarkConversation(conv.id, TEST_USER_ID);

    expect(result).toBeDefined();
    expect(result.bookmarked).toBeFalse();
  });

  it("returns null for a nonexistent conversation", () => {
    expect(unbookmarkConversation(999999, TEST_USER_ID)).toBeNull();
  });
});

describe("deleteConversationById", () => {
  it("removes an existing conversation and returns it", async () => {
    const conv = await createConversation("recommend a movie", false, TEST_USER_ID);
    const deleted = deleteConversationById(conv.id, TEST_USER_ID);

    expect(deleted).toBeDefined();
    expect(deleted.id).toBe(conv.id);
  });

  it("returns null when attempting to delete a nonexistent conversation", () => {
    expect(deleteConversationById(999999, TEST_USER_ID)).toBeNull();
  });

  it("returns null when the userId does not match the conversation owner", async () => {
    const conv = await createConversation("owner-only prompt", false, TEST_USER_ID);
    expect(deleteConversationById(conv.id, 9999)).toBeNull();
  });

  it("makes the conversation unfindable after deletion", async () => {
    const conv = await createConversation("delete me", false, TEST_USER_ID);
    deleteConversationById(conv.id, TEST_USER_ID);

    expect(deleteConversationById(conv.id, TEST_USER_ID)).toBeNull();
  });
});
/*const {
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
    expect(result).toBe("one two");
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

  //newer tests with userid: 

it("stores the correct userId on a new conversation", () => { // test that the correct userId is stored in a new conversation
  const conversation = createConversation("hello world", false, TEST_USER_ID);  // create a new conversation with a test user ID
  expect(conversation.userId).toBe(TEST_USER_ID);// verify the conversation object contains the correct userId
});

it("stores the prompt exactly as entered", () => {// test that the prompt is stored exactly as it was entered
  const prompt = "help me with calculus"; // define a prompt string
  const conversation = createConversation(prompt, false, TEST_USER_ID); // create a conversation using that prompt
  expect(conversation.prompt).toBe(prompt); // verify the stored prompt matches the original prompt
});

it("creates a response with nonzero length", () => { // test that a response is generated for each conversation
  const conversation = createConversation("hello", false, TEST_USER_ID);  // create a conversation
  expect(conversation.response.length).toBeGreaterThan(0); // check that the response text is not empty
});

it("adds a timestamp when a conversation is created", () => {// test that a timestamp is added when a conversation is created
  const conversation = createConversation("timestamp test", false, TEST_USER_ID); // create a conversation
  expect(typeof conversation.createdAt).toBe("string");// verify the createdAt field exists and is a string
  expect(conversation.createdAt.length).toBeGreaterThan(0);// verify the timestamp string is not empty
});

it("does not shorten when shorten is false", () => {// test that responses are not shortened when shorten=false
  const conversation = createConversation("help me study", false, TEST_USER_ID);  // create a conversation without shortening the response
  expect(conversation.response).toBeDefined();  // verify a response was generated
  expect(conversation.response.length).toBeGreaterThan(0);  // verify the response has content
});







//newer tests for unbookmarking:

it("removes a bookmark from an existing conversation", () => {
  const conversation = createConversation(
    "saved conversation",
    false,
    TEST_USER_ID
  );
  bookmarkConversation(conversation.id, TEST_USER_ID); //bookmark the convo
  const result = unbookmarkConversation(conversation.id, TEST_USER_ID); //remove the bookmarj
  expect(result).toBeDefined(); //check if correct obj was returned
  expect(result.bookmarked).toBeFalse(); //check if bookmark was removed
});

it("returns null when unbookmarking a nonexistent conversation", () => { //check that unbookmarking a conversation that doesn't exist returns null
  const result = unbookmarkConversation(999999, TEST_USER_ID);
  expect(result).toBeNull(); //should return null since the conversation doesn't exist
});
}); */


const {
  shortenResponse,
  createConversation,
  bookmarkConversation,
  unbookmarkConversation,
  deleteConversationById
} = require("../server");

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000; // Gives tests 60 seconds to finish
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
    expect(result).toBe("one two");
  });
});

describe("conversation features", () => {
  // Add 'async' here and 'await' before createConversation
  it("creates a new conversation object", async () => {
    const conversation = await createConversation(
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

  it("creates a shortened conversation response when shorten is true", async () => {
    const conversation = await createConversation(
      "help me study for my exam",
      true,
      TEST_USER_ID
    );

    expect(conversation).toBeDefined();
    expect(conversation.response.split(/\s+/).length).toBeLessThanOrEqual(200);
  });

  it("bookmarks an existing conversation", async () => {
    const conversation = await createConversation(
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

  it("deletes an existing conversation", async () => {
    const conversation = await createConversation(
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
    const conversation = await createConversation(
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
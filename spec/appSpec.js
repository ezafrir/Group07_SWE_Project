const { shortenResponse } = require("../server");

describe("shortenResponse", () => {
  it("should shorten text to the requested number of words", () => {
    const text = "one two three four five";
    const result = shortenResponse(text, 3);
    expect(result).toBe("one two three");
  });

  it("should return the original text if it is already short enough", () => {
    const text = "one two";
    const result = shortenResponse(text, 5);
    expect(result).toBe("one two");
  });
});
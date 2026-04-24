Feature: Save Conversation History
  As a user, I want my conversations to be automatically saved
  so I can visit them again later.

  Scenario: Conversation is saved after a message is sent
    Given the user is on the PistachioAI chat page
    When the user types "Hello!" into the prompt box
    And the user clicks the send button
    And the response has finished loading
    Then the conversation should appear in the chat history sidebar

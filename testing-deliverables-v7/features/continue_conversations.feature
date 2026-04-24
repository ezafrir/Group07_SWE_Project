Feature: Continuing Conversations
  As a user, I want to continue previous conversations
  so that I can build on earlier responses without starting over.

  Scenario: User sends a new message in an existing conversation
    Given the user is on the PistachioAI chat page
    And the user has opened an existing conversation from the sidebar
    When the user types "Can you elaborate on that?" into the prompt box
    And the user clicks the send button
    Then the new message should be appended to the existing conversation
    And a new conversation should not be created

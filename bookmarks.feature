Feature: Bookmark and Delete Conversations
  As a logged-in user
  I want to bookmark and delete conversations
  So that I can organise my chat history

  Scenario: Bookmark a conversation
    Given I am logged in with an existing conversation
    When I click the Bookmark button on the response card
    Then the conversation should appear in the Bookmarked Chats sidebar

  Scenario: Delete a conversation and confirm
    Given I am logged in with an existing conversation
    When I click the Delete button for that conversation
    And I confirm the confirmation dialog
    Then the conversation should no longer appear in the Chats sidebar

  Scenario: Cancel a conversation deletion
    Given I am logged in with an existing conversation
    When I click the Delete button for that conversation
    And I dismiss the confirmation dialog
    Then the conversation should still appear in the Chats sidebar

  Scenario: Open a bookmarked conversation
    Given I am logged in and have a bookmarked conversation
    When I click Open next to it in the Bookmarked Chats sidebar
    Then the response card should display the prompt and response

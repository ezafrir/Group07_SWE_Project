Feature: Viewing Past Conversations
  As a user, I want to view my past conversations
  so that I can easily access previous discussions.

  Scenario: User opens a past conversation from the sidebar
    Given the user is on the PistachioAI chat page
    And at least one past conversation exists in the sidebar
    When the user clicks on a conversation in the sidebar
    Then that conversation's messages should be loaded and displayed

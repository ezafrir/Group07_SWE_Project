Feature: Searching Conversations
  As a user, I want to search my conversations
  so I can quickly find specific discussions.

  Scenario: User searches for a conversation by keyword
    Given the user is on the PistachioAI chat page
    And multiple conversations exist in the sidebar
    When the user types "France" into the search bar
    Then only conversations containing "France" should be displayed in the sidebar

  Scenario: User opens a conversation from search results
    Given the user has searched for "France" in the search bar
    And matching conversations are displayed
    When the user clicks on one of the search results
    Then that conversation should be loaded and displayed

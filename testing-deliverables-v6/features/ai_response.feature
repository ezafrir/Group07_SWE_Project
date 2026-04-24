Feature: AI Response Generation
  As a user, I want to receive AI-generated responses to my prompts
  so that I can get answers to my questions.

  Scenario: User sends a prompt and receives a response
    Given the user is on the PistachioAI chat page
    When the user types "What is the capital of France?" into the prompt box
    And the user clicks the send button
    Then a loading icon should be visible
    And a response should be displayed on the screen

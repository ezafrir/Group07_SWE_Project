Feature: LLM Prompt Submission
  As a logged-in user
  I want to submit prompts and receive responses
  So that I can interact with the LLM

  Scenario: Submit a valid prompt
    Given I am logged in and on the app page
    When I type "How do I study for an exam?" into the prompt box
    And I click the Send button
    Then a response card should appear on the page
    And the response card should contain study-related content

  Scenario: Submit an empty prompt does nothing
    Given I am logged in and on the app page
    When I leave the prompt box empty
    And I click the Send button
    Then no response card should appear

  Scenario: Submitted prompt appears in the chat sidebar
    Given I am logged in and on the app page
    When I type "What is debugging?" into the prompt box
    And I click the Send button
    Then the Chats sidebar should contain a new entry

  Scenario: Shorten response toggle limits word count
    Given I am logged in and on the app page
    When I enable the Shorten response toggle
    And I set max words to "10"
    And I click Save Settings
    And I type "Explain studying techniques in detail" into the prompt box
    And I click the Send button
    Then the response on the card should contain no more than 10 words

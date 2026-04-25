Feature: Multi-LLM Response Comparison
  As a logged-in user
  I want to receive responses from three different AI models (Llama 3.2, TinyLlama, Phi 3)
  So that I can compare perspectives and request a synthesized summary

  Scenario: Three labeled model responses appear after submitting a prompt
    Given I am logged in and on the app page
    When I type "What is machine learning?" into the prompt box
    And I click the Send button
    Then three labeled response bubbles should appear in the thread

  Scenario: Responses are labeled with the correct model names
    Given I am logged in and have received multi-LLM responses
    Then the thread should contain a bubble labeled "Llama 3.2"
    And the thread should contain a bubble labeled "TinyLlama"
    And the thread should contain a bubble labeled "Phi 3"

  Scenario: User can request a summary of the three responses
    Given I am logged in and have received multi-LLM responses
    When I click the Summarize button
    Then a summary section should appear at the bottom of the thread

  Scenario: Summary section displays a Summary heading
    Given I am logged in and have received multi-LLM responses
    When I click the Summarize button
    Then the summary section should contain a "Summary" heading

Feature: Multi-Model Dropdown
  As a logged-in user
  I want to see responses from all three AI models after submitting a prompt
  So that I can compare answers and choose the one I prefer

  Background:
    Given I am logged in and on the app page

  Scenario: Dropdown appears after submitting a prompt
    When I type "What is 1 + 1?" into the prompt box
    And I click the Send button
    Then the model dropdown should be visible in the response
    And the dropdown should contain all three model options

  Scenario: Default model response is shown on load
    When I type "What is 1 + 1?" into the prompt box
    And I click the Send button
    Then the model dropdown should be visible in the response
    And the default model response should be non-empty

  Scenario: Switching to Phi3 updates the displayed response
    When I type "What is 1 + 1?" into the prompt box
    And I click the Send button
    Then the model dropdown should be visible in the response
    When I select "phi3" from the model dropdown
    Then the displayed response should update to the Phi3 answer

  Scenario: Switching to TinyLlama updates the displayed response
    When I type "What is 1 + 1?" into the prompt box
    And I click the Send button
    Then the model dropdown should be visible in the response
    When I select "tinyllama" from the model dropdown
    Then the displayed response should update to the TinyLlama answer

  Scenario: Switching back to Llama restores its original response
    When I type "What is 1 + 1?" into the prompt box
    And I click the Send button
    Then the model dropdown should be visible in the response
    When I select "phi3" from the model dropdown
    And I select "llama3.2" from the model dropdown
    Then the displayed response should match the original Llama response

  Scenario: All three model responses are stored and non-empty
    When I type "What is 1 + 1?" into the prompt box
    And I click the Send button
    Then the model dropdown should be visible in the response
    And all three model responses should be stored and non-empty

  Scenario: Summary button is present alongside the dropdown
    When I type "What is 1 + 1?" into the prompt box
    And I click the Send button
    Then the model dropdown should be visible in the response
    And the Summary button should be visible in the response bubble

  Scenario: Model responses persist when opening a saved conversation
    When I type "What is 1 + 1?" into the prompt box
    And I click the Send button
    Then the model dropdown should be visible in the response
    When I click the New Chat button
    And I open the most recent conversation from the sidebar
    Then the model dropdown should be visible in the response
    And all three model responses should be stored and non-empty

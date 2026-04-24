Feature: Multi-LLM Model Selection
  As a logged-in user
  I want to compare responses from different AI models
  So that I can choose the answer that best suits my needs

  Scenario: Model selector appears after sending a prompt
    Given I am logged in and on the app page
    When I type "What is a binary search tree?" into the prompt box
    And I click the Send button
    Then a model selector row should be visible
    And the model selector dropdown should contain "Llama 3.2"
    And the model selector dropdown should contain "Phi-3"
    And the model selector dropdown should contain "TinyLlama"

  Scenario: Default model shown is Llama 3.2
    Given I am logged in and on the app page
    When I type "Explain recursion" into the prompt box
    And I click the Send button
    Then the model selector dropdown should have "llama3.2:latest" selected by default

  Scenario: Switching the dropdown changes the selected model value
    Given I am logged in and on the app page
    When I type "What is a variable?" into the prompt box
    And I click the Send button
    And I select "phi3:latest" from the model dropdown
    Then the model dropdown value should be "phi3:latest"

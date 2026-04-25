Feature: LLM Response Comparison
  As a user
  I want to compare responses from 3 different LLMs
  So that I can see their similarities and differences

  Scenario: User requests comparison of multiple outputs
    Given the user is on the chat interface
    When the user enters "Explain PMOS transistors" in the prompt box
    And the user clicks the "Compare 3 LLMs" button
    Then the system should generate 3 distinct model responses
    And the system should display a "Similarities & Differences" summary box
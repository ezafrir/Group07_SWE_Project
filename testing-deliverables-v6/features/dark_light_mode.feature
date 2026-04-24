Feature: Dark/Light Mode Toggle
  As a user, I want to switch between light and dark mode
  to choose a comfortable viewing experience.

  Scenario: User switches to dark mode
    Given the user is on the PistachioAI chat page
    And the UI is currently in light mode
    When the user clicks the dark/light mode toggle button
    Then the UI theme should change to dark mode

  Scenario: User switches back to light mode
    Given the user is on the PistachioAI chat page
    And the UI is currently in dark mode
    When the user clicks the dark/light mode toggle button
    Then the UI theme should change to light mode

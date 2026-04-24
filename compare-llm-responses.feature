Feature: Compare Multiple LLM Responses
  As a user
  I want to compare responses from multiple LLMs
  So that I can understand their differences and similarities

  Background:
    Given I am on the Compare LLMs page
    And the LLM selection form is visible
    And at least 5 LLMs are available for selection

  # Feature: Submit Prompt to Multiple LLMs
  Scenario: User selects 3 LLMs and submits prompt for comparison
    Given I have selected "GPT-4", "Claude-3", and "Gemini" from the LLM list
    When I enter "What is artificial intelligence?" in the prompt field
    And I click the "Submit for Comparison" button
    Then a loading indicator should appear
    And the system should send the prompt to all 3 selected LLMs
    And I should see responses loading from each LLM

  Scenario: User can select between 2 and 5 LLMs
    Given the LLM selection checkboxes are displayed
    When I select 2 LLMs
    Then the "Submit" button should be enabled
    When I select 5 LLMs
    Then the "Submit" button should still be enabled
    When I try to select a 6th LLM
    Then it should be disabled with message "Maximum 5 LLMs allowed"

  Scenario: User cannot submit with only 1 LLM selected
    Given I have selected only "GPT-4"
    When I click the "Submit for Comparison" button
    Then an error message should appear: "Please select at least 2 LLMs to compare"
    And no requests should be sent to any LLM

  Scenario: Responses display as they arrive
    Given I have submitted a prompt to 5 LLMs
    When the first LLM response arrives
    Then that LLM's response should appear immediately in a column
    When the second response arrives
    Then it should appear in the next column without hiding the first
    And the comparison analysis should update in real-time

  Scenario: Handle timeout for slow LLM responses
    Given I have submitted a prompt to 3 LLMs
    And one LLM is responding slowly (>30 seconds)
    When 30 seconds have passed
    Then a timeout message should appear for that LLM
    And the comparison should continue with the 2 available responses
    And the analysis should be based on 2 responses, not 3

  # Feature: Display Side-by-Side Comparison
  Scenario: All responses displayed in columns side-by-side
    Given I have received responses from 3 LLMs
    When the comparison page loads
    Then each response should be displayed in a separate column
    And each column should have a clear header with the LLM name
    And each column should show the word count
    And each column should show the response timestamp
    And all three responses should be visible without scrolling (on desktop)

  Scenario: Responses are color-coded for easy identification
    Given the comparison results are displayed
    When I view the responses
    Then "GPT-4" response column should have a distinct color
    And "Claude-3" response column should have a different color
    And "Gemini" response column should have another distinct color
    And the colors should be consistent throughout the page

  Scenario: Scrolling for more than 3 LLMs
    Given I have submitted a prompt to 5 LLMs
    When all responses have arrived
    And the screen width is limited
    Then horizontal scroll should be enabled
    And I should be able to scroll right to see all 5 responses
    And each response should remain fully visible when scrolled to

  Scenario: Export comparison results
    Given comparison results are displayed with 3 responses
    When I click the "Export" button
    Then options should appear for exporting as:
      | Format |
      | JSON   |
      | CSV    |
      | PDF    |
    And when I select JSON, a JSON file should download
    And when I select CSV, a CSV file should download
    And when I select PDF, a formatted PDF should download

  # Feature: Highlight Similarities and Differences
  Scenario: Common phrases are highlighted in green
    Given comparison results with responses from 3 LLMs
    And the similarity highlighting is enabled
    When I view the responses
    Then phrases that appear in 2 or more responses should be highlighted in green
    And hovering over a green highlight should show "Common" and which LLMs have it
    And the highlighting should persist when I scroll

  Scenario: Unique phrases are highlighted in red
    Given comparison results with responses from 3 LLMs
    When I view the responses
    Then phrases unique to one response should be highlighted in red
    And hovering over a red highlight should show which LLM it's unique to
    And phrases appearing in all responses should NOT be highlighted in red

  Scenario: Similarity score shows between 0-100%
    Given I have received responses from 2 LLMs
    When the comparison analysis completes
    Then a similarity score should appear between the responses
    And the score should be a number between 0 and 100
    And a "Similarity" label should be shown
    And scores closer to 100 should indicate more similar responses

  Scenario: Pairwise similarity matrix displays
    Given I have received responses from 3 LLMs
    When the analysis completes
    Then a similarity matrix should appear showing:
      | Pair              | Similarity |
      | GPT-4 vs Claude   | 82%        |
      | GPT-4 vs Gemini   | 75%        |
      | Claude vs Gemini  | 78%        |
    And the matrix should be easy to read and understand

  Scenario: Toggle highlighting on and off
    Given comparison results are displayed with highlighting enabled
    When I click the "Disable Highlighting" button
    Then all highlights should disappear
    And the responses should show plain text
    When I click "Enable Highlighting" button
    Then the highlights should reappear in the same positions

  Scenario: Search across all responses
    Given comparison results from 3 LLMs are displayed
    When I enter "algorithm" in the search box
    Then all instances of "algorithm" should be highlighted in yellow
    And a count should show "Found 5 instances across responses"
    And I should see which LLMs have the search term and how many times
    And navigation buttons should allow jumping between instances

  Scenario: Key differences summary
    Given I have received responses from 3 LLMs
    When the comparison analysis completes
    Then a "Key Differences" section should appear
    And it should list the main points where responses differ
    And it should be formatted as bullet points for easy scanning
    And it should specifically highlight unique contributions from each LLM

  # Feature: Save and View Comparison History
  Scenario: Save comparison to history
    Given comparison results are displayed
    When I click the "Save Comparison" button
    Then a dialog should appear asking for a title
    When I enter "AI Definition Comparison" and click Save
    Then a success message should appear
    And the comparison should be saved to my history
    And I should be able to find it later in the history view

  Scenario: View saved comparisons
    Given I have saved 3 previous comparisons
    When I navigate to the "History" page
    Then all 3 saved comparisons should be listed
    And each should show the prompt, LLMs used, date, and similarity score
    And I should be able to click on any comparison to view it again
    And I should be able to delete comparisons I no longer need

  Scenario: Create new comparison from existing
    Given I am viewing a previous comparison
    When I click the "Use This Prompt Again" button
    Then I should return to the comparison page
    And the prompt from the previous comparison should be pre-filled
    And I can modify the selected LLMs and submit again

Feature: Landing Page
  As a visitor
  I want to see a landing page when I first arrive
  So that I can understand the product and choose to sign up or log in

  Scenario: Visitor sees the landing page
    Given I navigate to the home page
    Then I should see the heading "LLM Web Interface"
    And I should see a signup form
    And I should see a login form

  Scenario: Authenticated user is redirected away from landing page
    Given I am already logged in
    When I navigate to the home page
    Then I should be on the app page

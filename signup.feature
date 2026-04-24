Feature: User Account Creation
  As a new visitor
  I want to create an account
  So that I can access the LLM chat interface

  Scenario: Successful account creation
    Given I am on the landing page
    When I fill in signup username with "testuser"
    And I fill in signup email with "testuser@example.com"
    And I fill in signup password with "password123"
    And I click the Sign Up button
    Then I should be on the app page
    And I should see "Logged in as testuser"

  Scenario: Missing fields on signup
    Given I am on the landing page
    When I fill in signup email with "incomplete@example.com"
    And I click the Sign Up button
    Then I should see the auth error "All fields are required."

  Scenario: Signup with a duplicate email
    Given a user already exists with email "existing@example.com"
    When I am on the landing page
    And I fill in signup username with "newuser"
    And I fill in signup email with "existing@example.com"
    And I fill in signup password with "password123"
    And I click the Sign Up button
    Then I should see the auth error "Account already exists."

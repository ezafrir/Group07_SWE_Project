Feature: User Login and Logout
  As a registered user
  I want to log in and log out
  So that I can securely access and leave my account

  Scenario: Successful login with valid credentials
    Given a registered user exists with email "user@example.com" and password "pass123"
    When I am on the landing page
    And I fill in login email with "user@example.com"
    And I fill in login password with "pass123"
    And I click the Log In button
    Then I should be on the app page

  Scenario: Login with wrong password
    Given a registered user exists with email "user2@example.com" and password "correct"
    When I am on the landing page
    And I fill in login email with "user2@example.com"
    And I fill in login password with "wrong"
    And I click the Log In button
    Then I should see the auth error "Invalid email or password."

  Scenario: Logout redirects to landing page
    Given I am already logged in
    When I am on the app page
    And I click the Log Out button
    Then I should be on the landing page

  Scenario: Unauthenticated user cannot access the app page
    Given I am not logged in
    When I navigate to "/app"
    Then I should be on the landing page

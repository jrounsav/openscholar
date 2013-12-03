Feature:
  Testing the aliases of a node.

  @api @nofar
  Scenario: Verify that the pathauto alias is properly created in terms.
    Given I am logging in as "john"
      And I visit "cp/build/taxonomy/science_personal1/add"
      And I fill in "Name" with "Energy"
     When I press "edit-submit"
     Then I verify the alias of term "Energy" is "john/science/energy"

  @api @nofar
  Scenario: Verify that the custom alias is properly created in nodes.
    Given I am logging in as "john"
      And I visit "cp/build/taxonomy/science_personal1/add"
      And I fill in "Name" with "Atom"
      And I uncheck the box "Generate automatic URL alias"
      And I fill in "edit-path-alias" with "atom-custom-path"
     When I press "edit-submit"
     Then I verify the alias of term "Atom" is "john/atom-custom-path"

  @api @nofar
  Scenario: Verify that aliases are displayed without purl in node edit form.
    Given I am logging in as "john"
     When I edit the term "Energy"
     Then I verify the "URL alias" value is "science/energy"

  @api @nofar
  Scenario: Verify it is possible to use the purl as a term custom path.
    Given I am logging in as "john"
      And I visit "obama/cp/build/taxonomy/family_personal2/add"
      And I fill in "Name" with "Obama Custom Alias Term"
      And I uncheck the box "Generate automatic URL alias"
      And I fill in "edit-path-alias" with "obama"
     When I press "edit-submit"
     Then I verify the alias of term "Obama Custom Alias Term" is "obama/obama"

  @api @nofar
  Scenario: Verify it is impossible to use a duplicate purl as term custom path.
    Given I am logging in as "john"
      And I visit "obama/cp/build/taxonomy/family_personal2/add"
      And I fill in "Name" with "Obama Second Custom Alias Term"
      And I uncheck the box "Generate automatic URL alias"
      And I fill in "edit-path-alias" with "obama/obama/four-more-duplicate-terms"
     When I press "edit-submit"
     Then I verify the alias of term "Obama Second Custom Alias Term" is "four-more-duplicate-terms"

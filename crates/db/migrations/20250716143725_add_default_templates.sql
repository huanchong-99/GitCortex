-- NOTE: SonarCloud flags "illegal character with code point 10" (newlines) in string literals below.
-- This is intentional - template content contains multi-line markdown text that requires embedded newlines.
-- NOTE: SonarCloud flags duplicate string literals in this migration.
-- This is acceptable for SQL DDL migrations where repeated INSERT patterns share common column names.

-- Add default global templates

-- 1. Bug Analysis template
INSERT INTO task_templates (
    id,
    project_id,
    title,
    description,
    template_name,
    created_at,
    updated_at
) VALUES (
    randomblob(16),
    NULL, -- Global template
    'Analyze codebase for potential bugs and issues',
    'Perform a comprehensive analysis of the project codebase to identify potential bugs, code smells, and areas of improvement.' || char(10) || char(10) ||
    '## Analysis Checklist:' || char(10) || char(10) ||
    '### 1. Static Code Analysis' || char(10) ||
    '- [ ] Run linting tools to identify syntax and style issues' || char(10) ||
    '- [ ] Check for unused variables, imports, and dead code' || char(10) ||
    '- [ ] Identify potential type errors or mismatches' || char(10) ||
    '- [ ] Look for deprecated API usage' || char(10) || char(10) ||
    '### 2. Common Bug Patterns' || char(10) ||
    '- [ ] Check for null/undefined reference errors' || char(10) ||
    '- [ ] Identify potential race conditions' || char(10) ||
    '- [ ] Look for improper error handling' || char(10) ||
    '- [ ] Check for resource leaks (memory, file handles, connections)' || char(10) ||
    '- [ ] Identify potential security vulnerabilities (XSS, SQL injection, etc.)' || char(10) || char(10) ||
    '### 3. Code Quality Issues' || char(10) ||
    '- [ ] Identify overly complex functions (high cyclomatic complexity)' || char(10) ||
    '- [ ] Look for code duplication' || char(10) ||
    '- [ ] Check for missing or inadequate input validation' || char(10) ||
    '- [ ] Identify hardcoded values that should be configurable' || char(10) || char(10) ||
    '### 4. Testing Gaps' || char(10) ||
    '- [ ] Identify untested code paths' || char(10) ||
    '- [ ] Check for missing edge case tests' || char(10) ||
    '- [ ] Look for inadequate error scenario testing' || char(10) || char(10) ||
    '### 5. Performance Concerns' || char(10) ||
    '- [ ] Identify potential performance bottlenecks' || char(10) ||
    '- [ ] Check for inefficient algorithms or data structures' || char(10) ||
    '- [ ] Look for unnecessary database queries or API calls' || char(10) || char(10) ||
    '## Deliverables:' || char(10) ||
    '1. Prioritized list of identified issues' || char(10) ||
    '2. Recommendations for fixes' || char(10) ||
    '3. Estimated effort for addressing each issue',
    'Bug Analysis',
    datetime('now', 'subsec'), -- NOSONAR: Reused timestamp literal is intentional for deterministic migration inserts.
    datetime('now', 'subsec')
);

-- 2. Unit Test template
INSERT INTO task_templates (
    id,
    project_id,
    title,
    description,
    template_name,
    created_at,
    updated_at
) VALUES (
    randomblob(16),
    NULL, -- Global template
    'Add unit tests for [component/function]',
    'Write unit tests to improve code coverage and ensure reliability.' || char(10) || char(10) ||
    '## Unit Testing Checklist' || char(10) || char(10) ||
    '### 1. Identify What to Test' || char(10) ||
    '- [ ] Run coverage report to find untested functions' || char(10) ||
    '- [ ] List the specific functions/methods to test' || char(10) ||
    '- [ ] Note current coverage percentage' || char(10) || char(10) ||
    '### 2. Write Tests' || char(10) ||
    '- [ ] Test the happy path (expected behavior)' || char(10) ||
    '- [ ] Test edge cases (empty inputs, boundaries)' || char(10) ||
    '- [ ] Test error cases (invalid inputs, exceptions)' || char(10) ||
    '- [ ] Mock external dependencies' || char(10) ||
    '- [ ] Use descriptive test names' || char(10) || char(10) ||
    '### 3. Test Quality' || char(10) ||
    '- [ ] Each test focuses on one behavior' || char(10) ||
    '- [ ] Tests can run independently' || char(10) ||
    '- [ ] No hardcoded values that might change' || char(10) ||
    '- [ ] Clear assertions that verify the behavior' || char(10) || char(10) ||
    '## Examples to Cover:' || char(10) ||
    '- Normal inputs → Expected outputs' || char(10) ||
    '- Empty/null inputs → Proper handling' || char(10) ||
    '- Invalid inputs → Error cases' || char(10) ||
    '- Boundary values → Edge case behavior' || char(10) || char(10) ||
    '## Goal' || char(10) ||
    'Achieve at least 80% coverage for the target component' || char(10) || char(10) ||
    '## Deliverables' || char(10) ||
    '1. New test file(s) with comprehensive unit tests' || char(10) ||
    '2. Updated coverage report' || char(10) ||
    '3. All tests passing',
    'Add Unit Tests',
    datetime('now', 'subsec'),
    datetime('now', 'subsec')
);

-- 3. Code Refactoring template
INSERT INTO task_templates (
    id,
    project_id,
    title,
    description,
    template_name,
    created_at,
    updated_at
) VALUES (
    randomblob(16),
    NULL, -- Global template
    'Refactor [component/module] for better maintainability',
    'Improve code structure and maintainability without changing functionality.' || char(10) || char(10) ||
    '## Refactoring Checklist' || char(10) || char(10) ||
    '### 1. Identify Refactoring Targets' || char(10) ||
    '- [ ] Run code analysis tools (linters, complexity analyzers)' || char(10) ||
    '- [ ] Identify code smells (long methods, duplicate code, large classes)' || char(10) ||
    '- [ ] Check for outdated patterns or deprecated approaches' || char(10) ||
    '- [ ] Review areas with frequent bugs or changes' || char(10) || char(10) ||
    '### 2. Plan the Refactoring' || char(10) ||
    '- [ ] Define clear goals (what to improve and why)' || char(10) ||
    '- [ ] Ensure tests exist for current functionality' || char(10) ||
    '- [ ] Create a backup branch' || char(10) ||
    '- [ ] Break down into small, safe steps' || char(10) || char(10) ||
    '### 3. Common Refactoring Actions' || char(10) ||
    '- [ ] Extract methods from long functions' || char(10) ||
    '- [ ] Remove duplicate code (DRY principle)' || char(10) ||
    '- [ ] Rename variables/functions for clarity' || char(10) ||
    '- [ ] Simplify complex conditionals' || char(10) ||
    '- [ ] Extract constants from magic numbers/strings' || char(10) ||
    '- [ ] Group related functionality into modules' || char(10) ||
    '- [ ] Remove dead code' || char(10) || char(10) ||
    '### 4. Maintain Functionality' || char(10) ||
    '- [ ] Run tests after each change' || char(10) ||
    '- [ ] Keep changes small and incremental' || char(10) ||
    '- [ ] Commit frequently with clear messages' || char(10) ||
    '- [ ] Verify no behavior has changed' || char(10) || char(10) ||
    '### 5. Code Quality Improvements' || char(10) ||
    '- [ ] Apply consistent formatting' || char(10) ||
    '- [ ] Update to modern syntax/features' || char(10) ||
    '- [ ] Improve error handling' || char(10) ||
    '- [ ] Add type annotations (if applicable)' || char(10) || char(10) ||
    '## Success Criteria' || char(10) ||
    '- All tests still pass' || char(10) ||
    '- Code is more readable and maintainable' || char(10) ||
    '- No new bugs introduced' || char(10) ||
    '- Performance not degraded' || char(10) || char(10) ||
    '## Deliverables' || char(10) ||
    '1. Refactored code with improved structure' || char(10) ||
    '2. All tests passing' || char(10) ||
    '3. Brief summary of changes made',
    'Code Refactoring',
    datetime('now', 'subsec'),
    datetime('now', 'subsec')
);

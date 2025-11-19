# Week 4: Testing Phase - Implementation Plan

**Dates**: Nov 13-14, 2024
**Focus**: Comprehensive test coverage for v3.0 restructuring
**Goal**: 95%+ test pass rate, ≥80% code coverage, all critical bugs fixed

---

## 🎯 Objectives

1. **Validate all components** through comprehensive unit and integration tests
2. **Ensure reliability** via golden conversation E2E tests
3. **Catch bugs early** before Week 5 production deployment
4. **Build confidence** in the v3.0 restructuring

---

## 📋 Test Plan Overview

### Test Categories

1. **Intent Parser Unit Tests** (50 tests)
   - 14 positive cases (one per primitive)
   - 20 negative/edge cases
   - 10 disambiguation scenarios
   - 6 confidence scoring tests

2. **Router Unit Tests** (30 tests)
   - 10 routing logic tests
   - 10 error handling tests
   - 10 edge case tests

3. **Golden Conversation E2E Tests** (10-15 tests)
   - Real-world multi-turn workflows
   - Thread persistence validation
   - Progress tracking verification

4. **Integration & Async Tests** (5-10 tests)
   - Full system integration
   - Async execution validation
   - Registry persistence

**Total**: ~100 tests

---

## 📝 Test 1: Intent Parser Unit Tests (50 tests)

### File: `test/intent-parser.test.ts`

#### Positive Cases (14 tests - one per primitive)

Test that each primitive is correctly identified from natural language:

1. `_codex_local_run`
   - "Analyze main.ts for bugs"
   - "Run the test suite"
   - "Check code quality in utils.ts"

2. `_codex_local_status`
   - "What's currently running?"
   - "Show me local task status"
   - "Check the queue"

3. `_codex_local_exec`
   - "Start analyzing the codebase"
   - "Begin refactoring auth.ts with progress tracking"

4. `_codex_local_resume`
   - "Continue the previous analysis"
   - "Resume thread abc123"
   - "Keep working on that refactoring"

5. `_codex_local_results`
   - "Get results for task T-local-abc123"
   - "Show me what completed"

6. `_codex_local_wait`
   - "Wait for task T-local-abc123 to finish"
   - "Poll until the analysis completes"

7. `_codex_local_cancel`
   - "Cancel task T-local-abc123"
   - "Stop the running analysis"

8. `_codex_cloud_submit`
   - "Run the full test suite in the cloud"
   - "Create a PR for this feature"

9. `_codex_cloud_status`
   - "Check cloud task status"
   - "What's running in Codex Cloud?"

10. `_codex_cloud_results`
    - "Get results for cloud task T-cloud-def456"
    - "Show me the PR that was created"

11. `_codex_cloud_wait`
    - "Wait for cloud task to complete"
    - "Poll until the PR is ready"

12. `_codex_cloud_cancel`
    - "Cancel cloud task T-cloud-def456"
    - "Stop the cloud execution"

13. `_codex_cloud_list_environments`
    - "List my Codex environments"
    - "Show available environments"

14. `_codex_cloud_github_setup`
    - "Set up GitHub integration for my-repo"
    - "Generate GitHub setup guide"

#### Negative Cases (20 tests)

1. **Empty input**: `""`
2. **Gibberish**: `"asdfghjkl"`
3. **Too vague**: `"do something"`
4. **Unrelated**: `"What's the weather?"`
5. **Mixed signals**: `"run tests and also cancel them"`
6. **Missing required info**: `"submit to cloud"` (no task description)
7. **Invalid task ID format**: `"get results for abc"`
8. **Contradictory**: `"wait but don't wait"`
9. **Incomplete**: `"analyze"`
10. **Non-English**: `"analyser le code"` (French)
    11-20. Additional edge cases

#### Disambiguation Scenarios (10 tests)

Test when input could map to multiple primitives:

1. "Run something"
   - Could be: `_codex_local_run` OR `_codex_cloud_submit`
   - Expected: Ask for clarification

2. "Check status"
   - Could be: `_codex_local_status` OR `_codex_cloud_status`
   - Expected: Ask for clarification

3. "Get results"
   - Could be: `_codex_local_results` OR `_codex_cloud_results`
   - Expected: Ask for task ID format to determine

4-10. Additional disambiguation cases

#### Confidence Scoring (6 tests)

Test that confidence scores are accurate:

1. High confidence (90-100): "Analyze main.ts for bugs" → `_codex_local_run`
2. Medium confidence (60-89): "Look at the code" → `_codex_local_run`
3. Low confidence (30-59): "Do something with files" → Ambiguous
4. Very low confidence (0-29): "Help" → Too vague
5. Edge case: Multiple matches with similar scores
6. Edge case: No matches above threshold

---

## 📝 Test 2: Router Unit Tests (30 tests)

### File: `test/router.test.ts`

#### Routing Logic (10 tests)

1. **Basic routing**: Intent → Correct primitive
2. **Parameter extraction**: Extract task ID from "get results for T-local-abc123"
3. **Context preservation**: Multi-turn conversation maintains context
4. **Fallback**: When intent parser fails, router suggests alternatives
5. **Override**: Explicit primitive selection bypasses intent parser
6. **Chain routing**: Sequential primitives (analyze → fix → test)
7. **Parallel routing**: Multiple primitives at once
8. **Conditional routing**: "If tests pass, create PR"
9. **Loop routing**: "Keep retrying until success"
10. **Error recovery**: Graceful handling of routing failures

#### Error Handling (10 tests)

1. **Invalid primitive name**: `_codex_invalid_tool`
2. **Missing required params**: Call primitive without task description
3. **Invalid param types**: Pass string where number expected
4. **Timeout**: Routing takes too long
5. **Circular dependencies**: A → B → A loop
6. **Resource exhaustion**: Too many concurrent routes
7. **Authentication failure**: Codex auth not available
8. **Network error**: Cannot reach Codex Cloud
9. **Database error**: Task registry unavailable
10. **Unknown error**: Catch-all handling

#### Edge Cases (10 tests)

1. **Very long input**: 10,000+ character task description
2. **Special characters**: Input with emojis, unicode, etc.
3. **Malformed JSON**: Invalid parameter format
4. **Concurrent requests**: Multiple routes at same time
5. **State persistence**: Router state survives restarts
6. **Memory limits**: Handle large context histories
7. **Rate limiting**: Throttle excessive requests
8. **Duplicate requests**: Idempotency guarantees
9. **Stale data**: Old task registry entries
10. **Version mismatch**: v2.1.1 tools called from v3.0 router

---

## 📝 Test 3: Golden Conversation E2E Tests (10-15 tests)

### File: `test/e2e-golden-conversations.test.ts`

End-to-end workflows that real users would execute:

### Test 1: "Analyze then Fix" Workflow

```
User: "Analyze main.ts for bugs"
System: [Executes _codex_local_exec]
System: "Found 3 bugs. Would you like me to fix them?"
User: "Yes, fix them"
System: [Executes _codex_local_resume with threadId]
System: "All bugs fixed. Run tests?"
User: "Yes"
System: [Executes _codex_local_resume]
System: "All tests passing!"
```

### Test 2: "Run Tests and Create PR if Passing"

```
User: "Run full test suite and create PR if all pass"
System: [Executes _codex_cloud_submit]
System: "Task T-cloud-abc123 submitted"
User: "Wait for it to complete"
System: [Executes _codex_cloud_wait]
System: "Task completed! PR #42 created"
User: "Show me the results"
System: [Executes _codex_cloud_results]
System: [Returns PR link, test results, file changes]
```

### Test 3: "Check What's Running"

```
User: "What's currently running?"
System: [Executes _codex_local_status]
System: "2 local tasks: T-local-abc123 (analyzing), T-local-def456 (testing)"
User: "Cancel the first one"
System: [Executes _codex_local_cancel]
System: "Task T-local-abc123 canceled"
```

### Test 4: "Resume Previous Work"

```
User: "Continue my previous analysis"
System: [Looks up recent threads, finds thread_abc123]
System: [Executes _codex_local_resume]
System: "Resumed analysis. Found 5 more issues..."
```

### Test 5: "Setup New Project"

```
User: "Set up GitHub integration for https://github.com/myorg/myrepo"
System: [Executes _codex_cloud_github_setup]
System: [Returns custom setup guide with repo-specific scripts]
User: "List my environments"
System: [Executes _codex_cloud_list_environments]
System: "You have 3 environments: env1, env2, env3"
```

### Additional E2E Tests (5-10)

6. Multi-step refactoring with progress tracking
7. Error recovery (task fails → retry → success)
8. Concurrent operations (local + cloud at same time)
9. Long-running cloud task with periodic status checks
10. Thread persistence across Claude Code restarts
    11-15. Additional real-world scenarios

---

## 📝 Test 4: Integration & Async Tests

### File: `test/integration.test.ts`

#### System Integration (3 tests)

1. **Full stack test**: User input → Intent → Router → Primitive → Result
2. **Registry persistence**: Tasks persist across process restarts
3. **MCP protocol**: Tool calls conform to MCP specification

#### Async Validation (3 tests)

1. **Local async execution**: `_codex_local_run` with async mode
2. **Cloud submission**: `_codex_cloud_submit` returns immediately
3. **Wait primitives**: Server-side polling works correctly

#### Progress Tracking (2 tests)

1. **JSONL event parsing**: Real Codex output → ProgressSummary
2. **Progress display**: Wait tools show formatted progress

#### Performance (2 tests)

1. **MCP startup time**: Server starts in <300ms
2. **Tool call latency**: Primitives respond in <100ms

---

## 🛠️ Test Infrastructure

### Setup Required

1. **Test framework**: Use Node.js built-in test runner (`node:test`)
2. **Assertions**: Use `node:assert`
3. **Mocking**: Mock Codex CLI calls for deterministic tests
4. **Fixtures**: Sample JSONL events, task data, etc.
5. **Test database**: Separate SQLite DB for tests

### File Structure

```
test/
├── fixtures/
│   ├── jsonl-events.json       # Sample Codex events
│   ├── task-data.json          # Sample task registry data
│   └── nl-inputs.json          # Natural language test cases
├── mocks/
│   ├── codex-cli.ts            # Mock Codex CLI subprocess
│   ├── task-registry.ts        # Mock task registry
│   └── progress-inference.ts   # Mock progress tracking
├── intent-parser.test.ts       # 50 tests
├── router.test.ts              # 30 tests
├── e2e-golden-conversations.test.ts  # 10-15 tests
├── integration.test.ts         # 5-10 tests
└── test-helpers.ts             # Shared utilities
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- test/intent-parser.test.ts

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

---

## 📊 Success Criteria

### Quantitative

- [ ] ≥95 tests written (out of ~100 planned)
- [ ] ≥90% test pass rate
- [ ] ≥80% code coverage for:
  - Intent parser
  - Router
  - Progress inference
  - Task registry
- [ ] <5 critical bugs found
- [ ] All critical bugs fixed within Week 4

### Qualitative

- [ ] E2E tests cover real user workflows
- [ ] Edge cases are well-documented
- [ ] Test code is maintainable and clear
- [ ] CI/CD integration ready (if applicable)
- [ ] Team confidence in v3.0 stability

---

## 🐛 Bug Tracking

Bugs found during testing will be tracked here:

### Critical (Blocks launch)

- [ ] TBD

### High (Should fix before launch)

- [ ] TBD

### Medium (Nice to have)

- [ ] TBD

### Low (Future improvement)

- [ ] TBD

---

## 📅 Timeline

**Day 1 (Nov 13)**:

- Morning: Test infrastructure setup
- Afternoon: Intent parser tests (25/50)
- Evening: Intent parser tests (50/50 complete)

**Day 2 (Nov 14)**:

- Morning: Router tests (30/30 complete)
- Afternoon: E2E golden conversations (10-15 complete)
- Evening: Integration tests + coverage report

**Contingency**: If bugs found, extend by 0.5-1 day for fixes

---

## 🎯 Week 4 Deliverables

1. **Test Suite**:
   - `test/intent-parser.test.ts` (50 tests)
   - `test/router.test.ts` (30 tests)
   - `test/e2e-golden-conversations.test.ts` (10-15 tests)
   - `test/integration.test.ts` (5-10 tests)

2. **Test Infrastructure**:
   - Fixtures and mocks
   - Test helpers
   - CI/CD configuration

3. **Documentation**:
   - `WEEK-4-COMPLETION.md` - Test results and bug fixes
   - `TEST-COVERAGE-REPORT.md` - Coverage analysis
   - Updated `WEEKLY-PROGRESS-SUMMARY.md`

4. **Bug Fixes**:
   - All critical bugs resolved
   - High-priority bugs resolved or documented

---

**Status**: Ready to start
**Next Step**: Create test infrastructure and begin intent parser tests

# Codex Control MCP v3.0.0 - Final Test Plan

**Date**: 2025-11-14
**Purpose**: Comprehensive validation before production certification

---

## Test Categories

### 1. Core Routing (Natural Language → Primitives)

- [ ] Local execution (simple tasks)
- [ ] Threading (progress updates)
- [ ] Cloud execution (long tasks)
- [ ] Task management (status, wait, cancel)
- [ ] Configuration (list envs, github setup)

### 2. Result Data Flow

- [ ] Analysis results shown completely
- [ ] Error messages preserved
- [ ] Threading results with thread IDs
- [ ] Task status information complete

### 3. Thread Persistence

- [x] Thread resumption works (VERIFIED)
- [x] Context preservation (96.8% cache rate)
- [x] Session storage (JSONL format)

### 4. Edge Cases

- [ ] Invalid task IDs
- [ ] Malformed requests
- [ ] Missing required parameters
- [ ] Concurrent requests

### 5. Integration

- [ ] SQLite registry tracking
- [ ] MCP protocol compliance
- [ ] Error handling throughout

---

## Test Execution

### Test 1: Simple Local Execution

**Request**: `"analyze files"`
**Expected**: Routes to `_codex_local_run`, shows full analysis

### Test 2: Threading with Progress

**Request**: `"analyze with progress updates"`
**Expected**: Routes to `_codex_local_exec`, returns thread ID

### Test 3: Cloud Submission

**Request**: `"run comprehensive tests in the cloud"`
**Expected**: Routes to `_codex_cloud_submit`, returns task ID

### Test 4: Task Status Check

**Request**: `"check status of T-local-{id}"`
**Expected**: Routes to `_codex_local_status`, shows status

### Test 5: Invalid Task ID

**Request**: `"check status of invalid-id"`
**Expected**: Error message, graceful handling

### Test 6: Dry Run Mode

**Request**: `"analyze files"` with `dry_run: true`
**Expected**: Shows routing decision without execution

### Test 7: Result Data Completeness

**Request**: `"analyze all files"`
**Expected**: Full file listings, counts, metrics shown

### Test 8: Error Handling

**Request**: `"do something impossible"`
**Expected**: Clear error message, no crash

---

## Success Criteria

- ✅ All routing paths work correctly
- ✅ Results shown completely (no data loss)
- ✅ Thread persistence verified
- ✅ Edge cases handled gracefully
- ✅ No regressions from v2.x
- ✅ Documentation accurate

---

## Test Results

_To be filled during test execution_

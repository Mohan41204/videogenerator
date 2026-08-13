/**
 * ElementResolver.test.js
 *
 * Unit tests for the filtering pipeline and scoring logic.
 * Tests the two known bugs:
 *   1. "Name tag auto-generation" type action → should resolve to <input>, not <div> label
 *   2. "IAM" click action → should resolve to <a>, not <input value="IAM">
 *
 * Run: node renderer/aws/automation/ElementResolver.test.js
 */

const ConfidenceScorer = require('./ConfidenceScorer');
const { isValidCandidateForAction, passesVisibilityFilter } = require('./ElementResolver');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✖ FAIL: ${testName}`);
    failed++;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Test 1: isValidCandidateForAction — type action filtering
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n═══ Test: isValidCandidateForAction ═══');

console.log('\n  --- "type" action ---');
assert(
  isValidCandidateForAction({ tagName: 'input', role: '', inputType: 'text' }, 'type') === true,
  'input[type=text] is valid for type'
);
assert(
  isValidCandidateForAction({ tagName: 'textarea', role: '' }, 'type') === true,
  'textarea is valid for type'
);
assert(
  isValidCandidateForAction({ tagName: 'div', role: 'textbox', contentEditable: '' }, 'type') === true,
  'div[role=textbox] is valid for type'
);
assert(
  isValidCandidateForAction({ tagName: 'div', role: '', contentEditable: '' }, 'type') === false,
  'plain div is NOT valid for type'
);
assert(
  isValidCandidateForAction({ tagName: 'span', role: '' }, 'type') === false,
  'span is NOT valid for type'
);
assert(
  isValidCandidateForAction({ tagName: 'button', role: 'button' }, 'type') === false,
  'button is NOT valid for type'
);

console.log('\n  --- "click" action ---');
assert(
  isValidCandidateForAction({ tagName: 'a', role: 'link' }, 'click') === true,
  'a[role=link] is valid for click'
);
assert(
  isValidCandidateForAction({ tagName: 'button', role: 'button' }, 'click') === true,
  'button is valid for click'
);
assert(
  isValidCandidateForAction({ tagName: 'span', role: '' }, 'click') === true,
  'span is valid for click (text nodes are clickable)'
);
assert(
  isValidCandidateForAction({ tagName: 'input', role: '' }, 'click') === false,
  'bare input is NOT valid for click'
);
assert(
  isValidCandidateForAction({ tagName: 'input', role: '' }, 'click', { type: 'textbox' }) === true,
  'input IS valid for click when target.type=textbox'
);
assert(
  isValidCandidateForAction({ tagName: 'input', role: 'button' }, 'click') === false,
  'input[role=button] is NOT valid for click (role doesnt override tag filter)'
);

console.log('\n  --- "select" action ---');
assert(
  isValidCandidateForAction({ tagName: 'select', role: '' }, 'select') === true,
  'native select is valid for select'
);
assert(
  isValidCandidateForAction({ tagName: 'div', role: 'combobox' }, 'select') === true,
  'div[role=combobox] is valid for select (Cloudscape)'
);
assert(
  isValidCandidateForAction({ tagName: 'span', role: '' }, 'select') === false,
  'plain span is NOT valid for select'
);

console.log('\n  --- "check" action ---');
assert(
  isValidCandidateForAction({ tagName: 'input', role: '', inputType: 'checkbox' }, 'check') === true,
  'input[type=checkbox] is valid for check'
);
assert(
  isValidCandidateForAction({ tagName: 'div', role: 'checkbox' }, 'check') === true,
  'div[role=checkbox] is valid for check'
);
assert(
  isValidCandidateForAction({ tagName: 'input', role: '', inputType: 'text' }, 'check') === false,
  'input[type=text] is NOT valid for check'
);


// ═══════════════════════════════════════════════════════════════════════════
// Test 2: passesVisibilityFilter
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n═══ Test: passesVisibilityFilter ═══');

assert(
  passesVisibilityFilter({ isHidden: false, isDisabled: false, rect: { width: 100, height: 30 } }) === true,
  'Visible, enabled, sized element passes'
);
assert(
  passesVisibilityFilter({ isHidden: true, isDisabled: false, rect: { width: 100, height: 30 } }) === false,
  'Hidden element is filtered out'
);
assert(
  passesVisibilityFilter({ isHidden: false, isDisabled: true, rect: { width: 100, height: 30 } }) === false,
  'Disabled element is filtered out'
);
assert(
  passesVisibilityFilter({ isHidden: false, isDisabled: false, rect: { width: 0, height: 0 } }) === false,
  'Zero-dimension element is filtered out'
);
assert(
  passesVisibilityFilter({ isHidden: false, isDisabled: false, rect: { width: 100, height: 0 } }) === true,
  'Element with width>0 but height=0 passes (partial zero allowed)'
);
assert(
  passesVisibilityFilter(null) === false,
  'null info is filtered out'
);


// ═══════════════════════════════════════════════════════════════════════════
// Test 3: ConfidenceScorer — Hard Disqualifiers
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n═══ Test: ConfidenceScorer — Hard Disqualifiers ═══');

assert(
  ConfidenceScorer.score({ isHidden: true, rect: { width: 100, height: 30 }, tagName: 'button', textContent: 'Create', role: 'button' }, 'Create') === 0,
  'Hidden element scores 0 regardless of text match'
);
assert(
  ConfidenceScorer.score({ isDisabled: true, isHidden: false, rect: { width: 100, height: 30 }, tagName: 'button', textContent: 'Create', role: 'button' }, 'Create') === 0,
  'Disabled element scores 0'
);
assert(
  ConfidenceScorer.score({ isHidden: false, isDisabled: false, rect: { width: 0, height: 0 }, tagName: 'span', textContent: 'Test', role: '' }, 'Test') === 0,
  'Zero-dimension element scores 0'
);


// ═══════════════════════════════════════════════════════════════════════════
// Test 4: BUG FIX — "Name tag auto-generation" type action
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n═══ Test: Bug Fix — "Name tag auto-generation" type action ═══');

// Simulates the real scenario:
// - A <div> with text "Name tag auto-generation" (the label)
// - An <input> nearby (the actual text field to type into)

const divLabel = {
  tagName: 'div',
  textContent: 'Name tag auto-generation',
  inputValue: '',
  inputType: '',
  placeholder: '',
  ariaLabel: '',
  ariaHasPopup: '',
  contentEditable: '',
  role: '',
  rect: { width: 300, height: 30, top: 100, left: 50 },
  isHidden: false,
  isDisabled: false,
  isInNav: false,
  isInViewport: true,
  isInSearchDropdown: false,
  cursorPointer: false
};

const inputField = {
  tagName: 'input',
  textContent: '',
  inputValue: '',
  inputType: 'text',
  placeholder: '',
  ariaLabel: '',
  ariaHasPopup: '',
  contentEditable: '',
  role: '',
  rect: { width: 300, height: 30, top: 130, left: 50 },
  isHidden: false,
  isDisabled: false,
  isInNav: false,
  isInViewport: true,
  isInSearchDropdown: false,
  cursorPointer: false
};

// The div label should NOT be a valid candidate for "type"
assert(
  isValidCandidateForAction(divLabel, 'type') === false,
  'div "Name tag auto-generation" is filtered out for type action'
);

// The input should be a valid candidate for "type"
assert(
  isValidCandidateForAction(inputField, 'type') === true,
  'input element passes type filter'
);

// Even if we score both, the div should not score higher than the input for "type"
const divScore = ConfidenceScorer.score(divLabel, 'Name tag auto-generation', 'type');
const inputScoreWithRemap = ConfidenceScorer.score(inputField, 'Name tag auto-generation', 'type') + 30; // remap bonus

console.log(`    div label score (type action): ${divScore}`);
console.log(`    input score + remap bonus: ${inputScoreWithRemap}`);

// The key assertion: the filtering pipeline prevents the div from ever competing.
// But if it somehow got through, the input with remap bonus should still win.
assert(
  divScore < 70,
  'div label alone does NOT meet threshold (70) even if scored'
);


// ═══════════════════════════════════════════════════════════════════════════
// Test 5: BUG FIX — "IAM" click vs input disambiguation
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n═══ Test: Bug Fix — "IAM" click vs input disambiguation ═══');

// Simulates the real scenario:
// - An <a> link with text "IAM" in the service list
// - An <input value="IAM"> (e.g., a search box that has "IAM" typed in)

const iamLink = {
  tagName: 'a',
  textContent: 'IAM',
  inputValue: '',
  inputType: '',
  placeholder: '',
  ariaLabel: '',
  ariaHasPopup: '',
  contentEditable: '',
  role: 'link',
  rect: { width: 200, height: 24, top: 300, left: 50 },
  isHidden: false,
  isDisabled: false,
  isInNav: false,
  isInViewport: true,
  isInSearchDropdown: true,
  cursorPointer: true
};

const iamInput = {
  tagName: 'input',
  textContent: '',
  inputValue: 'IAM',
  inputType: 'text',
  placeholder: 'Search...',
  ariaLabel: '',
  ariaHasPopup: '',
  contentEditable: '',
  role: '',
  rect: { width: 300, height: 34, top: 50, left: 50 },
  isHidden: false,
  isDisabled: false,
  isInNav: false,
  isInViewport: true,
  isInSearchDropdown: false,
  cursorPointer: false
};

// For a "click" action, the input should be filtered out
assert(
  isValidCandidateForAction(iamInput, 'click') === false,
  'input[value="IAM"] is filtered out for click action'
);
assert(
  isValidCandidateForAction(iamLink, 'click') === true,
  '<a>IAM</a> passes click filter'
);

// Score comparison — link should win decisively
const linkScore = ConfidenceScorer.score(iamLink, 'IAM', 'click');
const inputScore = ConfidenceScorer.score(iamInput, 'IAM', 'click');

console.log(`    <a>IAM</a> link score (click): ${linkScore}`);
console.log(`    <input value="IAM"> score (click): ${inputScore}`);

assert(
  linkScore > inputScore,
  '<a>IAM</a> scores higher than <input value="IAM"> for click action'
);
assert(
  linkScore >= 70,
  '<a>IAM</a> meets threshold (70) for click action'
);


// ═══════════════════════════════════════════════════════════════════════════
// Test 6: Additive scoring — multiple signals stack
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n═══ Test: Additive scoring — multiple signals ═══');

const buttonWithMultipleSignals = {
  tagName: 'button',
  textContent: 'Create bucket',
  inputValue: '',
  inputType: '',
  placeholder: '',
  ariaLabel: 'Create bucket',
  ariaHasPopup: '',
  contentEditable: '',
  role: 'button',
  rect: { width: 150, height: 36, top: 200, left: 600 },
  isHidden: false,
  isDisabled: false,
  isInNav: false,
  isInViewport: true,
  isInSearchDropdown: false,
  cursorPointer: true
};

const multiScore = ConfidenceScorer.score(buttonWithMultipleSignals, 'Create bucket', 'click');
console.log(`    Button with text + ariaLabel + role + viewport: ${multiScore}`);

assert(
  multiScore > 100,
  'Button with multiple matching signals scores well above threshold'
);

// A plain div with just text should score much lower
const plainDiv = {
  tagName: 'div',
  textContent: 'Create bucket',
  inputValue: '',
  inputType: '',
  placeholder: '',
  ariaLabel: '',
  ariaHasPopup: '',
  contentEditable: '',
  role: '',
  rect: { width: 800, height: 400, top: 0, left: 0 },
  isHidden: false,
  isDisabled: false,
  isInNav: false,
  isInViewport: true,
  isInSearchDropdown: false,
  cursorPointer: false
};

const divOnlyScore = ConfidenceScorer.score(plainDiv, 'Create bucket', 'click');
console.log(`    Plain div with just text: ${divOnlyScore}`);

assert(
  multiScore > divOnlyScore,
  'Button with multiple signals scores higher than plain div'
);


// ═══════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════\n');

if (failed > 0) {
  process.exit(1);
}

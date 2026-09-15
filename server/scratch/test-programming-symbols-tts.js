const { cleanProgrammingSymbolsForTTS } = require('../services/translation.service');

function runSymbolTests() {
  console.log('=== STARTING PROGRAMMING SYMBOL TTS CLEANUP TESTS ===\n');

  const testCases = [
    {
      input: "function open bracket amount close bracket open brace return amount asterisk ten semicolon close brace",
      description: "Literal spoken bracket phrases",
      expectedNotContain: ["open bracket", "close bracket", "open brace", "close brace", "semicolon", "asterisk"]
    },
    {
      input: "user_name stores the user's name.",
      description: "Underscores in variable names",
      expectedNotContain: ["user_name"],
      expectedContain: ["user name"]
    },
    {
      input: "The calculate function (amount) returns the total.",
      description: "Parentheses around argument",
      expectedNotContain: ["(", ")"]
    },
    {
      input: "if age >= 18 && hasLicense",
      description: "Comparison and logical operators",
      expectedContain: ["greater than or equal to", "and"],
      expectedNotContain: [">=", "&&"]
    },
    {
      input: "const add = (a, b) => a + b;",
      description: "Arrow function syntax",
      expectedNotContain: ["=>", ";", "("]
    }
  ];

  let passed = 0;
  testCases.forEach((tc, idx) => {
    console.log(`--- Test ${idx + 1}: ${tc.description} ---`);
    console.log(`Input: "${tc.input}"`);
    const output = cleanProgrammingSymbolsForTTS(tc.input);
    console.log(`Output: "${output}"`);

    let ok = true;
    if (tc.expectedNotContain) {
      for (const item of tc.expectedNotContain) {
        if (output.includes(item)) {
          console.error(`❌ Output contains forbidden string: "${item}"`);
          ok = false;
        }
      }
    }
    if (tc.expectedContain) {
      for (const item of tc.expectedContain) {
        if (!output.includes(item)) {
          console.error(`❌ Output missing expected string: "${item}"`);
          ok = false;
        }
      }
    }

    if (ok) {
      console.log(`✅ [PASS]\n`);
      passed++;
    } else {
      console.log(`❌ [FAIL]\n`);
    }
  });

  console.log(`=== SUMMARY: ${passed}/${testCases.length} TESTS PASSED ===`);
}

runSymbolTests();

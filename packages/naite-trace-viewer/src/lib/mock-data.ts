import type { NaiteMessagingTypes } from "naite-types";

export const mockTestResults: NaiteMessagingTypes.TestResult[] = [
  {
    suiteName: "MathService",
    testName: "add 함수 테스트",
    testFilePath: "/src/services/math.test.ts",
    testLine: 10,
    status: "passed",
    duration: 123,
    receivedAt: new Date().toISOString(),
    traces: [
      {
        key: "add:params",
        value: { a: 1, b: 2 },
        filePath: "/src/services/math.ts",
        lineNumber: 10,
        at: "math.ts:10",
      },
      {
        key: "add:result",
        value: 3,
        filePath: "/src/services/math.ts",
        lineNumber: 15,
        at: "math.ts:15",
      },
    ],
  },
  {
    suiteName: "MathService",
    testName: "subtract 함수 테스트",
    testFilePath: "/src/services/math.test.ts",
    testLine: 20,
    status: "passed",
    duration: 45,
    receivedAt: new Date().toISOString(),
    traces: [
      {
        key: "subtract:params",
        value: { a: 5, b: 3 },
        filePath: "/src/services/math.ts",
        lineNumber: 20,
        at: "math.ts:20",
      },
      {
        key: "subtract:result",
        value: 2,
        filePath: "/src/services/math.ts",
        lineNumber: 25,
        at: "math.ts:25",
      },
    ],
  },
  {
    suiteName: "UserService",
    testName: "getUser 테스트",
    testFilePath: "/src/services/user.test.ts",
    testLine: 5,
    status: "failed",
    duration: 250,
    receivedAt: new Date().toISOString(),
    error: {
      message: "Expected user to be defined",
      stack: "Error: Expected user to be defined\n    at Object.<anonymous>",
    },
    traces: [
      {
        key: "getUser:params",
        value: { id: 123 },
        filePath: "/src/services/user.ts",
        lineNumber: 10,
        at: "user.ts:10",
      },
      {
        key: "getUser:dbQuery",
        value: { query: "SELECT * FROM users WHERE id = ?", params: [123] },
        filePath: "/src/services/user.ts",
        lineNumber: 15,
        at: "user.ts:15",
      },
      {
        key: "getUser:result",
        value: null,
        filePath: "/src/services/user.ts",
        lineNumber: 20,
        at: "user.ts:20",
      },
    ],
  },
];

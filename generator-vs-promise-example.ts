/**
 * Generator의 yield vs Promise의 resolve 비교 예시
 */

// ============================================
// 1. 일반 Generator (동기)
// ============================================
function* numberGenerator() {
  console.log("Generator 시작");
  yield 1; // 여기서 일시정지, 호출자에게 1 반환
  console.log("첫 번째 yield 이후");
  yield 2; // 다시 일시정지, 호출자에게 2 반환
  console.log("두 번째 yield 이후");
  yield 3;
  console.log("Generator 끝");
}

// 사용:
const gen = numberGenerator();
console.log(gen.next()); // { value: 1, done: false } - 여기서 일시정지
console.log(gen.next()); // { value: 2, done: false } - 다시 일시정지
console.log(gen.next()); // { value: 3, done: false }
console.log(gen.next()); // { value: undefined, done: true }

// for...of로 사용하면 자동으로 next() 호출
for (const num of numberGenerator()) {
  console.log(num); // 1, 2, 3 순서대로 출력
}

// ============================================
// 2. Promise (비동기)
// ============================================
function promiseExample(): Promise<number> {
  return new Promise((resolve) => {
    console.log("Promise 시작");
    setTimeout(() => {
      resolve(1); // 값을 resolve하고 Promise 완료
      // resolve 이후 코드는 실행되지 않음 (이미 완료됨)
    }, 1000);
  });
}

// 사용:
promiseExample().then((value) => {
  console.log(value); // 1초 후 1 출력
});

// ============================================
// 3. Async Generator (비동기 + Generator)
// ============================================
async function* asyncNumberGenerator() {
  console.log("Async Generator 시작");
  yield 1; // Promise<{value: 1, done: false}> 반환
  await new Promise((resolve) => setTimeout(resolve, 1000)); // 1초 대기
  yield 2; // Promise<{value: 2, done: false}> 반환
  await new Promise((resolve) => setTimeout(resolve, 1000)); // 1초 대기
  yield 3;
  console.log("Async Generator 끝");
}

// 사용:
async function useAsyncGenerator() {
  for await (const num of asyncNumberGenerator()) {
    console.log(num); // 1, (1초 대기), 2, (1초 대기), 3
  }
}

// ============================================
// 핵심 차이점:
// ============================================
/*
1. Generator의 yield:
   - 동기적으로 작동 (즉시 실행)
   - 일시정지 후 재개 가능 (양방향 통신)
   - 여러 번 yield 가능
   - 호출자가 next()를 호출할 때까지 대기

2. Promise의 resolve:
   - 비동기적으로 작동
   - 한 번만 resolve 가능 (단방향 통신)
   - resolve 후 Promise는 완료됨
   - then()이나 await로 결과를 받음

3. Async Generator의 yield:
   - 비동기적으로 작동
   - 각 yield가 Promise를 반환
   - 여러 번 yield 가능
   - for await로 순차적으로 처리
*/

// ============================================
// AST 파싱에서의 실제 사용 예시:
// ============================================

import ts from "typescript";

// Generator 버전 - 즉시 모든 노드를 순회
function* searchNodes(sourceFile: ts.SourceFile) {
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      // 매칭되는 노드를 찾으면 즉시 yield (일시정지)
      yield node; // 호출자가 next()를 호출할 때까지 여기서 대기
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

// 사용:
for (const node of searchNodes(sourceFile)) {
  // 각 노드를 즉시 처리
  console.log(node);
}

// Async Generator 버전 - 각 노드 처리 시 비동기 작업 가능
async function* searchNodesAsync(sourceFile: ts.SourceFile) {
  const matches: ts.CallExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      matches.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  // 각 노드를 비동기적으로 yield
  for (const node of matches) {
    await someAsyncOperation(node); // 비동기 작업 가능
    yield node; // Promise를 반환하고 일시정지
  }
}

async function someAsyncOperation(node: ts.Node): Promise<void> {
  // 예: 외부 API 호출, 파일 읽기 등
}

// 사용:
for await (const node of searchNodesAsync(sourceFile)) {
  // 각 노드를 비동기적으로 처리
  console.log(node);
}

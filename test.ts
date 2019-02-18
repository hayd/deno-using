import {
  using,
  usingSync,
  Timeout,
  Open,
  ChDir,
  TempDir,
  Using
} from "./mod.ts";
import * as Deno from "deno";
import { assert, runTests, test } from "https://deno.land/x/testing/mod.ts";

test(async function open() {
  await using(new Open("testdata/foo.ts"), async f => {
    assert(f.rid > 2);
  });
});

test(async function tempDir() {
  await using(new TempDir(), async d => {
    // OSX temp dir inside /var/... symlinks to /private/var/...
    // so can't assert.equal here.
    assert(Deno.cwd().includes(d));
  });
});

test(async function chdir() {
  const dir = Deno.cwd();
  await using(new ChDir("testdata"), async () => {
    assert(Deno.cwd().endsWith("testdata"));
    assert(Deno.cwd().includes(dir));
    assert(dir !== Deno.cwd());
  });
});

test(function chdirSync() {
  usingSync(new ChDir("testdata"), _ => {
    assert(Deno.cwd().endsWith("testdata"));
  });
});

test(async function timeoutSuccess() {
  let count = 0;
  await using(new Timeout(100), async _ => {
    count += 1;
  });
  assert.equal(count, 1);
});

test(async function timeoutFailure() {
  let count = 0;
  await using(new Timeout(100), async _ => {
    await new Promise(res => setTimeout(res, 200));
    assert(false);
  }).catch(err => {
    count += 1;
    assert(err);
  });
  assert.equal(count, 1);
});

let count;
export class Custom<T> implements Using<T> {
  constructor(custom: T, catchError: Boolean = false) {
    this.custom = custom;
    this.catchError = catchError;
  }
  public async _aenter() {
    count += 1;
    return this.custom;
  }
  public async _aexit(e) {
    count += 1;
    return this.catchError;
  }
  private catchError: Boolean;
  private custom: T;
}

test(async function custom() {
  count = 0;
  await using(new Custom("x"), async (x: string) => {
    assert.equal(x, "x");
    assert.equal(count, 1);
  });
  assert.equal(count, 2);
});

test(async function customThrow() {
  count = 0;
  await using(new Custom(123, true), async (x: number) => {
    assert.equal(x, 123);
    assert.equal(count, 1);
    throw "should be caught";
  });
  assert.equal(count, 2);
});

runTests();

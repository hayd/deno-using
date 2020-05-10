import {
  using,
  usingSync,
  ChDir,
  Open,
  TempDir,
  Timeout,
  TimeoutError,
  Using,
} from "./mod.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@v0.50.0/testing/asserts.ts";

const { test } = Deno;

test({
  name: "open",
  async fn() {
    await using(new Open("testdata/foo.ts"), async (f) => {
      assert(f.rid > 2);
    });
  },
});

test({
  name: "tempDir",
  async fn() {
    await using(new TempDir(), async (d) => {
      // OSX temp dir inside /var/... symlinks to /private/var/...
      // so can't assertEquals here.
      assert(Deno.cwd().includes(d));
    });
  },
});

test({
  name: "chdir",
  async fn() {
    const dir = Deno.cwd();
    await using(new ChDir("testdata"), async () => {
      assert(Deno.cwd().endsWith("testdata"));
      assert(Deno.cwd().includes(dir));
      assert(dir !== Deno.cwd());
    });
  },
});

test({
  name: "chdirSync",
  fn() {
    usingSync(new ChDir("testdata"), (_) => {
      assert(Deno.cwd().endsWith("testdata"));
    });
  },
});

test({
  name: "timeoutSuccess",
  async fn() {
    let count = 0;
    await using(new Timeout(100), async (_) => {
      count += 1;
    });
    assertEquals(count, 1);
  },
});

test({
  name: "timeoutFailure",
  async fn() {
    let count = 0;
    const p = new Promise((res) => setTimeout(res, 200));
    await using(new Timeout(100), async (_) => {
      await p;
      assert(false); // should not reach
    }).catch((err) => {
      count += 1;
      assert(err);
      assertEquals(err.name, "TimeoutError");
    });
    await p;
    assertEquals(count, 1);
  },
});

let count: number;
export class Custom<T> implements Using<T> {
  constructor(custom: T, catchError: Boolean = false) {
    this.custom = custom;
    this.catchError = catchError;
  }
  public async _aenter() {
    count += 1;
    return this.custom;
  }
  public async _aexit(e: any) {
    count += 1;
    return this.catchError;
  }
  private catchError: Boolean;
  private custom: T;
}

test({
  name: "custom",
  async fn() {
    count = 0;
    await using(new Custom("x"), async (x: string) => {
      assertEquals(x, "x");
      assertEquals(count, 1);
    });
    assertEquals(count, 2);
  },
});

test({
  name: "customThrow",
  async fn() {
    count = 0;
    await using(new Custom(123, true), async (x: number) => {
      assertEquals(x, 123);
      assertEquals(count, 1);
      throw "should be caught";
    });
    assertEquals(count, 2);
  },
});

export interface Using<T> {
  _aenter: () => Promise<T>;
  _aexit: ((any: any) => Promise<Boolean>) | ((any: any) => Promise<void>);
  _timeout?: Promise<void>;
}

export interface UsingSync<T> {
  _enter: () => T;
  _exit: ((any: any) => Boolean) | ((any: any) => void);
}

export async function using<T>(
  w: Using<T>,
  f: (t: T) => Promise<void>,
): Promise<void> {
  const item = await w._aenter();
  let e;
  try {
    w._timeout === undefined
      ? await f(item)
      : await Promise.race([f(item), w._timeout]);
  } catch (err) {
    e = err;
  } finally {
    if (!(await w._aexit(e)) && e !== undefined) {
      // throw e;
      return Promise.reject(e);
    }
  }
}

export function usingSync<T>(w: UsingSync<T>, f: (t: T) => void): void {
  const item = w._enter();
  let e;
  try {
    f(item);
  } catch (err) {
    e = err;
  } finally {
    if (!w._exit(e) && e !== undefined) {
      throw e;
    }
  }
}

export class Open implements Using<Deno.File> {
  constructor(filename: string, mode?: Deno.OpenOptions) {
    this.filename = filename;
    this.mode = mode;
  }
  public async _aenter() {
    this.file = await Deno.open(this.filename, this.mode);
    return this.file;
  }
  public async _aexit(e: any) {
    this.file.close();
  }
  // @ts-ignore property 'file' has no initializer and is not definitely assigned in the constructor
  private file: Deno.File;
  private filename: string;
  private mode: Deno.OpenOptions | undefined;
}

// TODO use the actual deno interface
// Also make whether to chdir optional
export interface MakeTempDirOptions {
  dir?: string;
  prefix?: string;
  suffix?: string;
}

export class TempDir implements Using<string>, UsingSync<string> {
  constructor(options: MakeTempDirOptions = {}) {
    this.options = options;
    this.cwd = "";
    this.dir = "";
  }
  public async _aenter() {
    this.dir = await Deno.makeTempDir(this.options);
    this.cwd = Deno.cwd();
    Deno.chdir(this.dir);
    return this.dir;
  }
  public async _aexit(e: any) {
    Deno.chdir(this.cwd);
    await Deno.remove(this.dir);
  }
  public _enter() {
    this.dir = Deno.makeTempDirSync(this.options);
    this.cwd = Deno.cwd();
    Deno.chdir(this.dir);
    return this.dir;
  }
  public _exit(e: any) {
    Deno.chdir(this.cwd);
    Deno.remove(this.dir);
  }

  private cwd: string;

  private dir: string;
  private options: MakeTempDirOptions;
}

export class ChDir implements Using<void>, UsingSync<void> {
  constructor(dir: string) {
    this.dir = dir;
    this.cwd = "";
  }
  public async _aenter() {
    this.cwd = Deno.cwd();
    Deno.chdir(this.dir);
  }
  public async _aexit(e: any) {
    Deno.chdir(this.cwd);
  }
  public _enter() {
    this.cwd = Deno.cwd();
    Deno.chdir(this.dir);
  }
  public _exit(e: any) {
    Deno.chdir(this.cwd);
  }

  private cwd: string;
  private dir: string;
}

export class TimeoutError extends Error {
  constructor(ms: number) {
    const message = `Timeout after ${ms}ms`;
    super(message);
    this.name = "TimeoutError";
  }
}

export class Timeout implements Using<void> {
  constructor(ms: number) {
    this.ms = ms;
    this.id = 0;
    this._timeout = Promise.resolve();
  }
  public async _aenter() {
    this._timeout = new Promise((resolve, reject) => {
      this.id = setTimeout(() => {
        reject(new TimeoutError(this.ms));
      }, this.ms);
    });
  }
  public async _aexit(e: any) {
    clearTimeout(this.id);
  }
  private id: number;
  private ms: number;
  _timeout: Promise<void>;
}

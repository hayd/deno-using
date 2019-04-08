export interface Using<T> {
  _aenter: () => Promise<T>;
  _aexit: ((any) => Promise<Boolean>) | ((any) => Promise<void>);
  _timeout?: Promise<void>;
}

export interface UsingSync<T> {
  _enter: () => T;
  _exit: ((any) => Boolean) | ((any) => void);
}

export async function using<T>(
  w: Using<T>,
  f: (T) => Promise<void>
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

export function usingSync<T>(w: UsingSync<T>, f: (T) => void): void {
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
  constructor(filename: string, mode?: Deno.OpenMode) {
    this.filename = filename;
    this.mode = mode;
  }
  public async _aenter() {
    this.file = await Deno.open(this.filename, this.mode);
    return this.file;
  }
  public async _aexit(e) {
    this.file.close();
  }
  private file: Deno.File;
  private filename: string;
  private mode: Deno.OpenMode;
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
  }
  public async _aenter() {
    this.dir = await Deno.makeTempDir(this.options);
    this.cwd = Deno.cwd();
    Deno.chdir(this.dir);
    return this.dir;
  }
  public async _aexit(e) {
    Deno.chdir(this.cwd);
    Deno.remove(this.dir);
  }
  public _enter() {
    this.dir = Deno.makeTempDirSync(this.options);
    this.cwd = Deno.cwd();
    Deno.chdir(this.dir);
    return this.dir;
  }
  public _exit(e) {
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
  }
  public async _aenter() {
    this.cwd = Deno.cwd();
    Deno.chdir(this.dir);
  }
  public async _aexit(e) {
    Deno.chdir(this.cwd);
  }
  public _enter() {
    this.cwd = Deno.cwd();
    Deno.chdir(this.dir);
  }
  public _exit(e) {
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
  }
  public async _aenter() {
    this._timeout = new Promise((resolve, reject) => {
      this.id = setTimeout(() => {
        reject(new TimeoutError(this.ms));
      }, this.ms);
    });
  }
  public async _aexit(e) {
    clearTimeout(this.id);
  }
  private id: number;
  private ms: number;
  _timeout: Promise<void>;
}

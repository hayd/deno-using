# deno-using

A python-style with statement for deno.

Comes with some `Using` types, e.g. `Open`, `ChDir`, `TempDir`, and `Timeout`.

## Example:

```ts
import { using, Open } from "htps://deno.land/x/using/mod.ts";

const enc = new TextEncoder();
const dec = new TextDecoder();

await using(new Open("file", "w"), async (f: Deno.File) => {
  const data = enc.encode("Hello world!\n");
  await f.write(data);
});
await using(new Open("file", "r"), async (f: Deno.File) => {
  const data = new Uint8Array(20);
  await f.read(data);
  const text = dec.decode(data);
  console.log(text);
});
```

There is also a corresponding sync version `UsingSync`.

## Custom types

You can define your own `Using` types by creating a class which implements `Using`:

```ts
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
```

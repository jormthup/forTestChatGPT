import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("entry point loads assets inside GitHub Pages repository path", async () => {
  const html = await readFile(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  for (const path of ["style.css", "app.js"]) {
    assert.ok(html.includes(`"./${path}"`));
    assert.equal(
      new URL(`./${path}`, "https://jormthup.github.io/forTestChatGPT/")
        .pathname,
      `/forTestChatGPT/${path}`,
    );
  }
  const js = await readFile(new URL("../app.js", import.meta.url), "utf8");
  for (const name of ["logic.js", "data.js", "media.js"]) {
    const imports = [...js.matchAll(/from\s+["'](\.\/[^"']+)["']/g)].map(
      (match) => match[1],
    );
    assert.ok(imports.includes(`./${name}`));
    await readFile(new URL("../" + name, import.meta.url));
  }
});

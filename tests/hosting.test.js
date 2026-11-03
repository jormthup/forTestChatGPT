import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('entry point loads assets inside GitHub Pages repository path',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  for(const path of ['style.css','app.js']){
    assert.ok(html.includes(`"./${path}"`));
    assert.equal(new URL(`./${path}`,'https://jormthup.github.io/forTestChatGPT/').pathname,`/forTestChatGPT/${path}`);
  }
  const js=await readFile(new URL('../app.js',import.meta.url),'utf8');
  assert.ok(js.includes("from './logic.js'"));
});

const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const root=process.env.APP_ROOT||path.join(__dirname,'..');
const htmlFile=process.env.APP_HTML||'index.html';
const htmlPath=path.isAbsolute(htmlFile)?htmlFile:path.join(root,htmlFile);
const html=fs.readFileSync(htmlPath,'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
assert.equal(scripts.length,1,'Expected one application script');
assert.doesNotThrow(()=>new Function(scripts[0][1]),'Application JavaScript must parse');

const script=scripts[0][1];
const dataStart=script.indexOf('function moves(');
const dataEnd=script.indexOf('/* =========================================================================\n   SCOREBOARD');
assert.ok(dataStart>=0&&dataEnd>dataStart,'Question data block must be discoverable');
const sandbox={};
vm.createContext(sandbox);
vm.runInContext(script.slice(dataStart,dataEnd)+`;globalThis.auditData={CHEM_S1,CHEM_S2,CHEM_S3,FACES_S1,FACES_S2,FACES_S3,SECTIONS};`,sandbox);
const d=sandbox.auditData;

assert.deepEqual([d.CHEM_S1.length,d.CHEM_S2.length,d.CHEM_S3.length],[5,5,5],'Each round must have five chemistry questions');
assert.deepEqual([d.FACES_S1.length,d.FACES_S2.length,d.FACES_S3.length],[5,5,5],'Each round must have five face breaks');
assert.ok(d.SECTIONS.every(s=>s.items.length===10),'Each round must contain ten items');
assert.ok(d.SECTIONS.every(s=>s.items.every((item,i)=>item.type===(i%2===0?'chem':'face'))),'Chemistry and face items must alternate');

for(const q of [...d.CHEM_S1,...d.CHEM_S2,...d.CHEM_S3]){
  assert.equal(q.choices.length,4,`${q.skill}: expected four choices`);
  assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<4,`${q.skill}: answer index must be valid`);
  assert.ok(q.q&&q.solution,`${q.skill}: question and solution are required`);
}
for(const face of [...d.FACES_S1,...d.FACES_S2,...d.FACES_S3]){
  assert.ok(fs.existsSync(path.join(root,'faces',`${face.img}.jpg`)),`${face.name}: missing image`);
  assert.ok(face.prompt&&face.fact&&face.credit,`${face.name}: prompt, fact, and credit are required`);
  assert.equal(face.s.length,3,`${face.name}: sliver framing must have three values`);
  assert.equal(face.r.length,3,`${face.name}: reveal framing must have three values`);
}

assert.match(html,/function selectChoice\(i\)/,'Choices must be selectable');
assert.match(html,/aria-pressed=/,'Choices must expose selected state');
assert.match(html,/prefers-reduced-motion/,'Reduced motion must be supported');
assert.match(html,/button:focus-visible/,'Keyboard focus must be visible');
assert.doesNotMatch(html,/[✅❌🔥⚡🧪📝]/u,'UI must not use emoji icons');
assert.doesNotMatch(html,/[—–]/,'Student-facing copy must not use em or en dashes');

console.log('audit.cjs: all review-game checks passed');

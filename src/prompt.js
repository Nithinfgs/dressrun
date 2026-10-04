import readline from 'node:readline';

export function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      rl.close();
      resolve(value);
    };
    rl.on('line', (line) => finish(line.trim().toLowerCase()));
    rl.on('close', () => finish(''));
    rl.setPrompt(question);
    rl.prompt();
  });
}

/** Parse "1,3-5" into [1,3,4,5]. */
export function parseSelection(text) {
  const ids = new Set();
  for (const part of text.split(/[,\s]+/).filter(Boolean)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!m) return null;
    const lo = Number(m[1]);
    const hi = m[2] ? Number(m[2]) : lo;
    for (let i = lo; i <= hi && i - lo < 10000; i++) ids.add(i);
  }
  return [...ids];
}

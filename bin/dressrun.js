#!/usr/bin/env node
import { main } from '../src/cli.js';

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`dressrun: ${err.message}\n`);
    process.exit(err.name === 'UsageError' ? 64 : 70);
  },
);

#!/usr/bin/env node

import { runCli } from '../src/cli.mjs';

process.exitCode = await runCli(process.argv.slice(2), { interactive: Boolean(process.stdin.isTTY) });

import { createInterface } from 'node:readline/promises';
import { stdin, stdout as processStdout, stderr as processStderr } from 'node:process';
import { resolve } from 'node:path';
import { buildProposal, createProposal, saveProposal } from './lib/proposals.mjs';

const repositoryRoot = resolve(new URL('../', import.meta.url).pathname);

function printHelp(write) {
  write(`Usage:
  grounded-engineering adopt
  grounded-engineering adopt preview --profile baseline
  grounded-engineering adopt preview --cards GE-RC-001,inspect-repository-first
  grounded-engineering adopt create --profile baseline
  grounded-engineering adopt apply 20260826-143000-a1b2c3d4 --confirm
  grounded-engineering check
  grounded-engineering update propose --release v0.3.0
`);
}

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help') return { help: true };
    if (argument === '--profile' || argument === '--cards') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
      if (options[argument.slice(2)]) throw new Error(`Duplicate ${argument} selector`);
      options[argument.slice(2)] = argument === '--cards' ? value.split(',').filter(Boolean) : value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${argument}`);
  }
  return options;
}

function validateSelection(options) {
  if (options.help) return;
  if (options.profile && options.cards) throw new Error('Choose --profile or --cards, not both');
  if (options.profile && options.profile !== 'baseline') throw new Error(`Profile ${options.profile} is reserved for fast-follow work`);
}

function reportProposal(proposal, write) {
  write(`Profile: ${proposal.profile}`);
  write(`Cards: ${proposal.cards.map((card) => `${card.id} (${card.title})`).join(', ')}`);
  write(`Target: ${proposal.targets[0].path}`);
  write('No repository files were changed.');
}

async function runInteractiveAdopt(root, sourceRoot, write, read) {
  const profile = (await read('Choose profile [baseline]: ')).trim() || 'baseline';
  const options = { sourceRoot, profile, packId: profile };
  validateSelection(options);
  const proposal = buildProposal(root, options);
  reportProposal(proposal, write);
  const save = (await read('Save this proposal? [y/N]: ')).trim().toLowerCase();
  if (save === 'y' || save === 'yes') {
    saveProposal(root, proposal);
    write(`Proposal created: ${proposal.proposal_id}`);
  }
  return 0;
}

export async function runCli(argv, context = {}) {
  const root = context.cwd ?? process.cwd();
  const sourceRoot = context.sourceRoot ?? repositoryRoot;
  const write = context.write ?? ((message) => processStdout.write(`${message}\n`));
  const error = context.error ?? ((message) => processStderr.write(`${message}\n`));

  if (argv.length === 0 || (argv.length === 1 && argv[0] === '--help')) {
    if (argv.length === 0 && !context.interactive) {
      error('Interactive adoption requires a terminal. Use adopt preview or adopt create for non-interactive use.');
      return 2;
    }
    printHelp(write);
    return 0;
  }

  if (argv[0] === 'check' || argv[0] === 'update') {
    error(`${argv[0]} is a reserved fast-follow command in this release.`);
    return 2;
  }
  if (argv[0] !== 'adopt') {
    error(`Unknown command: ${argv[0]}`);
    printHelp(error);
    return 2;
  }

  if (argv.length === 1) {
    if (!context.interactive) {
      error('Interactive adoption requires a terminal. Use adopt preview or adopt create for non-interactive use.');
      return 2;
    }
    const readline = createInterface({ input: stdin, output: processStdout });
    try {
      return await runInteractiveAdopt(root, sourceRoot, write, (question) => readline.question(question));
    } finally {
      readline.close();
    }
  }

  const action = argv[1];
  if (action === 'apply') {
    error('adopt apply requires --confirm in non-interactive mode; apply support is being completed in this release.');
    return 2;
  }
  if (!['preview', 'create'].includes(action)) {
    error(`Unknown adopt action: ${action}`);
    printHelp(error);
    return 2;
  }

  try {
    const options = parseOptions(argv.slice(2));
    if (options.help) {
      printHelp(write);
      return 0;
    }
    validateSelection(options);
    const proposalOptions = {
      sourceRoot,
      profile: options.profile ?? 'baseline',
      packId: options.profile ?? 'baseline',
      cardReferences: options.cards,
    };
    if (action === 'preview') {
      reportProposal(buildProposal(root, proposalOptions), write);
      return 0;
    }
    const proposal = createProposal(root, proposalOptions);
    write(`Proposal created: ${proposal.proposal_id}`);
    write(`Review: .grounded-engineering/proposals/${proposal.proposal_id}/plan.md`);
    return 0;
  } catch (caught) {
    error(caught.message);
    printHelp(error);
    return 2;
  }
}

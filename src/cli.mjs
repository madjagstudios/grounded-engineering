import { createInterface } from 'node:readline/promises';
import { stdin, stdout as processStdout, stderr as processStderr } from 'node:process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAdapter } from './lib/adapters.mjs';
import { checkRepository } from './lib/check.mjs';
import { applyProposal, buildProposal, createProposal, loadProposal, proposalConflicts, saveProposal } from './lib/proposals.mjs';

const repositoryRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));

function printHelp(write) {
  write(`Usage:
  grounded-engineering adopt
  grounded-engineering adopt preview --profile baseline
  grounded-engineering adopt preview --profile baseline --adapter codex
  grounded-engineering adopt preview --cards GE-RC-001,inspect-repository-first
  grounded-engineering adopt create --profile baseline
  grounded-engineering adopt apply 20260826-143000-a1b2c3d4 --confirm
  grounded-engineering check
  grounded-engineering update propose --release v0.3.0
`);
}

function printCheckHelp(write) {
  write(`Usage:
  grounded-engineering check
`);
}

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help') return { help: true };
    if (argument === '--profile' || argument === '--cards' || argument === '--adapter') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
      if (options[argument.slice(2)]) throw new Error(`Duplicate ${argument} selector`);
      options[argument.slice(2)] = argument === '--cards' ? value.split(',').filter(Boolean) : value;
      index += 1;
      continue;
    }
    if (argument === '--confirm') {
      if (options.confirm) throw new Error('Duplicate --confirm flag');
      options.confirm = true;
      continue;
    }
    throw new Error(`Unknown option: ${argument}`);
  }
  return options;
}

function parseCheckOptions(args) {
  if (args.length === 0) return {};
  if (args.length === 1 && args[0] === '--help') return { help: true };
  throw new Error(`Unknown option: ${args[0]}`);
}

function validateSelection(options) {
  if (options.help) return;
  if (options.profile && options.cards) throw new Error('Choose --profile or --cards, not both');
  if (options.profile && !['baseline', 'ai-assisted'].includes(options.profile)) throw new Error(`Profile ${options.profile} is reserved for fast-follow work`);
  if (options.adapter) resolveAdapter(options.adapter);
}

function reportProposal(proposal, write) {
  write(`Profile: ${proposal.profile}`);
  write(`Adapter: ${proposal.adapter}`);
  write(`Cards: ${proposal.cards.map((card) => `${card.id} (${card.title})`).join(', ')}`);
  write(`Target: ${proposal.targets[0].path}`);
  write('No repository files were changed.');
}

async function runInteractiveAdopt(root, sourceRoot, write, read) {
  const profile = (await read('Choose profile [baseline]: ')).trim() || 'baseline';
  const options = { sourceRoot, profile, packId: profile, adapter: 'neutral' };
  validateSelection(options);
  const proposal = buildProposal(root, options);
  const conflicts = proposalConflicts(proposal);
  if (conflicts.length > 0) {
    write(`Conflicts prevent a proposal: ${conflicts.map((conflict) => conflict.message).join('; ')}`);
    return 2;
  }
  reportProposal(proposal, write);
  const save = (await read('Save this proposal? [y/N]: ')).trim().toLowerCase();
  if (save === 'y' || save === 'yes') {
    saveProposal(root, proposal);
    write(`Proposal created: ${proposal.proposal_id}`);
  }
  return 0;
}

async function runInteractiveApply(root, sourceRoot, proposalId, write, read) {
  const proposal = loadProposal(root, proposalId);
  write(`Proposal: ${proposal.proposal_id}`);
  write(`Cards: ${proposal.cards.map((card, index) => {
    const decision = proposal.local_decisions?.[index];
    return `${card.id} (${card.title}) public=${card.public_disposition} local=${decision?.local_applicability ?? 'missing'}${decision?.local_decision ? `/${decision.local_decision}` : ''}`;
  }).join(', ')}`);
  write(`Files: ${proposal.targets.map((target) => target.path).join(', ')}, .grounded-engineering/manifest.yaml`);
  const confirm = (await read('Apply this reviewed proposal? [y/N]: ')).trim().toLowerCase();
  if (!['y', 'yes'].includes(confirm)) {
    write('Apply cancelled.');
    return 0;
  }
  const result = applyProposal(root, proposalId, { sourceRoot, confirm: true });
  write(`Applied: ${result.committedPaths.join(', ')}`);
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

  if (argv[0] === 'check') {
    try {
      const options = parseCheckOptions(argv.slice(1));
      if (options.help) {
        printCheckHelp(write);
        return 0;
      }

      const result = checkRepository(root, { sourceRoot });
      if (!result.ok) {
        for (const diagnostic of result.diagnostics) error(`${diagnostic.code}: ${diagnostic.message}`);
        return 1;
      }

      write('Status: clean');
      return 0;
    } catch (caught) {
      error(caught.message);
      printCheckHelp(error);
      return 2;
    }
  }

  if (argv[0] === 'update') {
    error('update is a reserved fast-follow command in this release.');
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
    const proposalId = argv[2];
    if (!proposalId) {
      error('adopt apply requires a proposal ID.');
      printHelp(error);
      return 2;
    }
    if (context.interactive && argv.length === 3) {
      try {
        return await runInteractiveApply(root, sourceRoot, proposalId, write, (question) => {
          const readline = createInterface({ input: stdin, output: processStdout });
          return readline.question(question).finally(() => readline.close());
        });
      } catch (caught) {
        error(caught.message);
        return 2;
      }
    }
    if (!argv.slice(3).includes('--confirm')) {
      error('adopt apply requires --confirm in non-interactive mode.');
      return 2;
    }
  }
  if (action !== 'apply' && !['preview', 'create'].includes(action)) {
    error(`Unknown adopt action: ${action}`);
    printHelp(error);
    return 2;
  }

  try {
    const options = parseOptions(argv.slice(action === 'apply' ? 3 : 2));
    if (options.help) {
      printHelp(write);
      return 0;
    }
    validateSelection(options);
    if (action !== 'apply' && options.confirm) throw new Error('--confirm is only valid for adopt apply');
    if (action === 'create' && options.cards) throw new Error('--cards is supported for preview only until custom packs are released');
    if (action === 'apply' && options.cards) throw new Error('--cards is not valid for adopt apply');
    if (action === 'apply') {
      const proposalId = argv[2];
      const result = applyProposal(root, proposalId, { sourceRoot, confirm: options.confirm });
      write(`Applied: ${result.committedPaths.join(', ')}`);
      return 0;
    }
    const proposalOptions = {
      sourceRoot,
      profile: options.profile ?? 'baseline',
      packId: options.profile ?? 'baseline',
      cardReferences: options.cards,
      adapter: options.adapter ?? 'neutral',
    };
    if (action === 'preview') {
      const proposal = buildProposal(root, proposalOptions);
      const conflicts = proposalConflicts(proposal);
      if (conflicts.length > 0) throw new Error(`Cannot generate a clean proposal: ${conflicts.map((conflict) => conflict.message).join('; ')}`);
      reportProposal(proposal, write);
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

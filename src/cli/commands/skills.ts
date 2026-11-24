import { Command } from 'commander';
import { logger } from '../../core/logger';
import {
  InstallBundledSkillsResult,
  installBundledSkills
} from '../../core/skills-installer';
import { ExitCodes, KindleErrorCode, MachineOutput } from '../../types';

interface SkillsCommandOptions {
  target?: string[];
  json?: boolean;
  debug?: boolean;
}

function runSkillsInstall(options: SkillsCommandOptions, cmd: Command): void {
  const globalOpts = cmd.optsWithGlobals<SkillsCommandOptions>();
  const isJson = Boolean(globalOpts.json ?? options.json);
  const isDebug = Boolean(globalOpts.debug ?? options.debug);
  const extraTargets = options.target ?? globalOpts.target ?? [];

  logger.setJsonMode(isJson);
  logger.setDebug(isDebug);

  try {
    const result = installBundledSkills({ extraTargets });
    const message = `Installed ${result.skills.length} skills into ${result.installedRoots.length} root(s)`;

    if (isJson) {
      const output: MachineOutput<InstallBundledSkillsResult> = {
        ok: true,
        status: 'validated',
        message,
        data: result
      };
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    logger.info(message);
    for (const root of result.installedRoots) {
      logger.info(`  - ${root}`);
    }
    if (result.backups.length > 0) {
      logger.info(`Backed up ${result.backups.length} existing skill(s):`);
      for (const backup of result.backups) {
        logger.info(`  - ${backup}`);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (isJson) {
      const output: MachineOutput = {
        ok: false,
        status: 'failed',
        error: {
          code: KindleErrorCode.UNKNOWN,
          message: errorMessage
        }
      };
      console.log(JSON.stringify(output, null, 2));
    } else {
      logger.error(errorMessage);
    }
    process.exitCode = ExitCodes[KindleErrorCode.UNKNOWN];
  }
}

export function registerSkillsCommand(program: Command): void {
  const skillsCommand = program
    .command('skills')
    .description('Install and sync bundled Agent skills for supported AI hosts')
    .option('--target <dir...>', 'Additional target skill directories')
    .option('--json', 'Output machine-readable JSON')
    .option('--debug', 'Enable verbose debug logs')
    .action((options: SkillsCommandOptions, cmd: Command) => {
      runSkillsInstall(options, cmd);
    });

  skillsCommand
    .command('install')
    .description(
      'Install bundled skills to ~/.agents/skills and detected AI host directories'
    )
    .option('--target <dir...>', 'Additional target skill directories')
    .option('--json', 'Output machine-readable JSON')
    .option('--debug', 'Enable verbose debug logs')
    .action((options: SkillsCommandOptions, cmd: Command) => {
      runSkillsInstall(options, cmd);
    });
}

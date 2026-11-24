import { Command } from 'commander';
import { getCapabilityStatus } from '../../core/capability';
import { logger } from '../../core/logger';

export function registerCapabilityCommand(program: Command): void {
  program
    .command('capability')
    .description('查看 Kindle 投送能力是否已经完整部署')
    .option('--json', '以机器可读的 JSON 格式输出结果')
    .option('--debug', '开启调试模式输出详细脱敏日志')
    .action((_options: { json?: boolean; debug?: boolean }, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals<{ json?: boolean; debug?: boolean }>();
      const isJson = Boolean(globalOpts.json || program.opts().json);
      const isDebug = Boolean(globalOpts.debug || program.opts().debug);
      logger.setJsonMode(isJson);
      logger.setDebug(isDebug);

      const status = getCapabilityStatus();

      if (isJson) {
        console.log(JSON.stringify({ ok: true, data: status }, null, 2));
        return;
      }

      logger.info(`Kindle 投送能力: ${status.state}`);
      logger.info(`  可直接调用: ${status.ready ? '是' : '否'}`);
      logger.info(`  凭据可用: ${status.credentialsAvailable ? '是' : '否'}`);
      logger.info(`  设备验证: ${status.deviceVerified ? '已通过' : '未完成'}`);
      if (status.kindleAddressMasked) logger.info(`  Kindle 邮箱: ${status.kindleAddressMasked}`);
      if (status.nextAction) logger.info(`  下一步: ${status.nextAction}`);
    });
}

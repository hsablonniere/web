/* eslint-disable */
import fs from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import concurrently from 'concurrently';
import chalk from 'chalk';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const script = process.argv[process.argv.length - 1];

function findPackagesWithScript(directory) {
  const packages = [];

  for (const name of fs.readdirSync(directory)) {
    const pkgPath = join(directory, name);
    const pkgJsonPath = join(pkgPath, 'package.json');

    if (fs.existsSync(pkgJsonPath)) {
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));

      if (pkgJson && pkgJson.scripts && pkgJson.scripts[script]) {
        packages.push(pkgPath);
      }
    }
  }

  return packages;
}

const packagesDir = join(moduleDir, '..', 'packages');
const packagesWithScript = findPackagesWithScript(packagesDir);

const commands = packagesWithScript.map(pkgPath => ({
  name: basename(pkgPath),
  command: `cd ${pkgPath} && yarn ${script}`,
}));

concurrently(commands, { maxProcesses: 5 })
  .then(results => {
    console.log(
      chalk.green(
        `Successfully executed command ${chalk.yellow(script)} for packages: ${chalk.yellow(
          commands.map(c => c.name).join(', '),
        )}`,
      ),
    );
    console.log();
  })
  .catch(error => {
    if (error instanceof Error) {
      console.error(error);
    } else if (Array.isArray(error)) {
      const count = error.filter(error => error !== 0).length;
      console.log('');
      console.log(
        chalk.red(
          `Failed to execute command ${chalk.yellow(
            script,
          )} for ${count} packages. But we don't know which ones, because concurrently doesn't say.`,
        ),
      );
      console.log();
    }
    process.exit(1);
  });

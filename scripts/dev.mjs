import { spawn } from 'node:child_process';

const processes = [
  ['api', 'npm', ['--prefix', 'apps/api', 'run', 'start:dev']],
  ['web', 'npm', ['--prefix', 'apps/web', 'run', 'dev']],
];

const children = processes.map(([name, command, args]) => {
  const child = spawn(command, args, { stdio: 'inherit', env: process.env });
  child.on('exit', (code, signal) => {
    if (signal) console.log(`[${name}] stopped by ${signal}`);
    else if (code !== 0) console.log(`[${name}] exited with ${code}`);
  });
  return child;
});

const stop = () => children.forEach((child) => child.kill('SIGTERM'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('exit', stop);

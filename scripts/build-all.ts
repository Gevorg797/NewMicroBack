import { execSync } from 'child_process';

const projects = ['admin', 'api'];

for (const project of projects) {
  console.log(`🚀 Building ${project}`);
  execSync(`nest build ${project}`, { stdio: 'inherit' });
}

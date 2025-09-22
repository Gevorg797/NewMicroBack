import { execSync } from 'child_process';

const projects = ['admin', 'api', 'game-service'];

for (const project of projects) {
  console.log(`🚀 Building ${project}`);
  execSync(`nest build ${project}`, { stdio: 'inherit' });
}

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.join(__dirname, 'pack_sprite_atlas.py');
const forwardArgs = [scriptPath, ...process.argv.slice(2)];

const runCommand = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', (error) => reject(error));
    child.on('exit', (code) => resolve(code ?? 1));
  });

const runPython = async () => {
  try {
    const code = await runCommand('python', forwardArgs);
    process.exit(code);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') {
      console.error('打包失败:', error);
      process.exit(1);
    }
  }

  if (process.platform === 'win32') {
    try {
      const code = await runCommand('py', ['-3', ...forwardArgs]);
      process.exit(code);
    } catch (error) {
      console.error('未找到可用的 Python，请先安装并确保命令可用。');
      process.exit(1);
    }
  }

  console.error('未找到可用的 Python，请先安装并确保命令可用。');
  process.exit(1);
};

runPython();

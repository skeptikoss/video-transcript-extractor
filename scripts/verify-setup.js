#!/usr/bin/env node

/**
 * Setup Verification Script
 * Checks all prerequisites for the Video Transcript Extractor project
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const chalk = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
};

console.log(chalk.blue('\n🔍 Video Transcript Extractor - Setup Verification\n'));

let allChecksPassed = true;

// Check Node.js version
function checkNode() {
  try {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
    
    if (majorVersion >= 20) {
      console.log(chalk.green(`✓ Node.js ${nodeVersion} (requires v20+)`));
    } else {
      console.log(chalk.red(`✗ Node.js ${nodeVersion} (requires v20+)`));
      console.log(chalk.yellow('  → Install Node.js 20.x LTS from https://nodejs.org'));
      allChecksPassed = false;
    }
  } catch (error) {
    console.log(chalk.red('✗ Node.js not found'));
    allChecksPassed = false;
  }
}

// Check npm version
function checkNpm() {
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    const majorVersion = parseInt(npmVersion.split('.')[0]);
    
    if (majorVersion >= 10) {
      console.log(chalk.green(`✓ npm ${npmVersion} (requires v10+)`));
    } else {
      console.log(chalk.yellow(`⚠ npm ${npmVersion} (recommend v10+)`));
    }
  } catch (error) {
    console.log(chalk.red('✗ npm not found'));
    allChecksPassed = false;
  }
}

// Check Git
function checkGit() {
  try {
    const gitVersion = execSync('git --version', { encoding: 'utf8' }).trim();
    console.log(chalk.green(`✓ ${gitVersion}`));
  } catch (error) {
    console.log(chalk.red('✗ Git not found'));
    console.log(chalk.yellow('  → Install Git from https://git-scm.com'));
    allChecksPassed = false;
  }
}

// Check FFmpeg
function checkFFmpeg() {
  try {
    execSync('ffmpeg -version', { encoding: 'utf8' });
    console.log(chalk.green('✓ FFmpeg installed'));
  } catch (error) {
    console.log(chalk.red('✗ FFmpeg not found'));
    console.log(chalk.yellow('  → Install FFmpeg:'));
    console.log(chalk.yellow('    macOS: brew install ffmpeg'));
    console.log(chalk.yellow('    Windows: choco install ffmpeg'));
    console.log(chalk.yellow('    Linux: sudo apt install ffmpeg'));
    allChecksPassed = false;
  }
}

// Check environment file
function checkEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  
  if (fs.existsSync(envPath)) {
    console.log(chalk.green('✓ .env file exists'));
    
    // Check for required keys
    const envContent = fs.readFileSync(envPath, 'utf8');
    const requiredKeys = ['OPENAI_API_KEY', 'NOTION_API_KEY'];
    
    requiredKeys.forEach(key => {
      if (envContent.includes(`${key}=`) && !envContent.includes(`${key}=your-`)) {
        console.log(chalk.green(`  ✓ ${key} configured`));
      } else {
        console.log(chalk.yellow(`  ⚠ ${key} not configured`));
      }
    });
  } else {
    console.log(chalk.yellow('⚠ .env file not found'));
    console.log(chalk.yellow(`  → Copy ${envExamplePath} to ${envPath}`));
    console.log(chalk.yellow('  → Add your API keys'));
  }
}

// Check directories
function checkDirectories() {
  const dirs = ['uploads', 'data', 'logs'];
  
  console.log('\n📁 Checking directories:');
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(chalk.green(`  ✓ Created ${dir}/ directory`));
    } else {
      console.log(chalk.green(`  ✓ ${dir}/ directory exists`));
    }
  });
}

// Run all checks
console.log('📋 Checking prerequisites:\n');
checkNode();
checkNpm();
checkGit();
checkFFmpeg();
console.log();
checkEnvFile();
checkDirectories();

// Summary
console.log('\n' + '─'.repeat(50));
if (allChecksPassed) {
  console.log(chalk.green('\n✅ All checks passed! You\'re ready to start development.\n'));
  console.log('Next steps:');
  console.log('1. Run: npm install');
  console.log('2. Configure your .env file with API keys');
  console.log('3. Run: npm run dev');
} else {
  console.log(chalk.red('\n❌ Some checks failed. Please fix the issues above.\n'));
  process.exit(1);
}

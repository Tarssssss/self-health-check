/**
 * 🔧 配置文件检查
 * 检查必需的环境变量和配置文件是否存在
 */

const fs = require('fs').promises;
const path = require('path');
const { existsSync } = require('fs');

// 必需的环境变量（根据你的项目配置）
const REQUIRED_ENV_VARS = [
  'NOTION_API_KEY',
  'NOTION_DISCUSSION_DATABASE_ID',
  'NOTION_DAILY_REPORT_DATABASE_ID',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_DISCUSSION_GROUP_ID',
  'TELEGRAM_DAILY_REPORT_GROUP_ID'
];

// 可选但建议的环境变量
const OPTIONAL_ENV_VARS = [
  'TELEGRAM_GENERAL_GROUP_ID',
  'NOTION_MEETING_DATABASE_ID'
];

/**
 * 检查单个 .env 文件
 */
async function checkEnvFile(envPath) {
  const details = [];
  const issues = [];
  const fixes = [];

  try {
    // 检查文件是否存在
    if (!existsSync(envPath)) {
      return {
        status: 'fail',
        message: `.env file not found: ${envPath}`,
        details: [],
        fix: [`Create .env file at: ${envPath}`]
      };
    }

    // 读取并解析
    const content = await fs.readFile(envPath, 'utf-8');
    const lines = content.split('\n');

    const definedVars = [];
    const emptyVars = [];
    const missingVars = [];

    for (const varName of REQUIRED_ENV_VARS) {
      const line = lines.find(l => l.startsWith(`${varName}=`) || l.startsWith(`${varName} `));

      if (!line) {
        missingVars.push(varName);
        issues.push(`Missing required variable: ${varName}`);
        fixes.push(`Add ${varName}=your_value to .env`);
      } else if (line.split('=')[1].trim() === '') {
        emptyVars.push(varName);
        issues.push(`Empty value for: ${varName}`);
        fixes.push(`Set a value for ${varName} in .env`);
      } else {
        definedVars.push(varName);
      }
    }

    // 检查可选变量
    const missingOptional = [];
    for (const varName of OPTIONAL_ENV_VARS) {
      const line = lines.find(l => l.startsWith(`${varName}=`) || l.startsWith(`${varName} `));
      if (!line) {
        missingOptional.push(varName);
      }
    }

    // 构建详情
    details.push({ status: 'pass', message: `Found ${definedVars.length}/${REQUIRED_ENV_VARS.length} required variables` });

    if (definedVars.length > 0) {
      details.push({ status: 'pass', message: `Defined: ${definedVars.join(', ')}` });
    }

    if (missingVars.length > 0) {
      details.push({ status: 'fail', message: `Missing: ${missingVars.join(', ')}` });
    }

    if (emptyVars.length > 0) {
      details.push({ status: 'fail', message: `Empty values: ${emptyVars.join(', ')}` });
    }

    if (missingOptional.length > 0) {
      details.push({ status: 'warning', message: `Optional not set: ${missingOptional.join(', ')}` });
    }

    // 检查是否有可疑的配置
    const suspiciousPatterns = [
      { pattern: /your_token_here|your_api_key|replace_with/i, name: 'placeholder value' },
      { pattern: /secret|password|token|key/i, name: 'potential secret in env' }
    ];

    for (const { pattern, name } of suspiciousPatterns) {
      const match = content.match(pattern);
      if (match) {
        details.push({ status: 'warning', message: `Found ${name}: ${match[0]}` });
      }
    }

    // 确定状态
    let status = 'pass';
    if (missingVars.length > 0 || emptyVars.length > 0) {
      status = 'fail';
    } else if (missingOptional.length > 0) {
      status = 'warning';
    }

    return {
      status,
      message: `Config check: ${definedVars.length}/${REQUIRED_ENV_VARS.length} required vars set`,
      details,
      error: issues.length > 0 ? issues.join('; ') : undefined,
      fix: fixes
    };

  } catch (error) {
    return {
      status: 'error',
      message: `Failed to read .env file`,
      error: error.message
    };
  }
}

/**
 * 检查所有配置文件
 */
async function run(clawdRoot) {
  const details = [];
  const allIssues = [];
  const allFixes = [];

  // 主 .env 文件
  const mainEnv = path.join(clawdRoot, '.env');
  const mainResult = await checkEnvFile(mainEnv);
  details.push(...(mainResult.details || []));
  if (mainResult.error) allIssues.push(mainResult.error);
  if (mainResult.fix) allFixes.push(...mainResult.fix);

  // 检查各个 skill 的 .env
  const skillsDir = path.join(clawdRoot, 'skills');
  let skillsChecked = 0;
  let skillsWithIssues = 0;

  try {
    const skills = await fs.readdir(skillsDir);

    for (const skill of skills) {
      const skillEnv = path.join(skillsDir, skill, '.env');

      try {
        await fs.access(skillEnv);
        const skillResult = await checkEnvFile(skillEnv);

        skillsChecked++;

        if (skillResult.status !== 'pass') {
          skillsWithIssues++;
          details.push({ status: skillResult.status, message: `${skill}/.env: ${skillResult.message}` });
        }

        if (skillResult.details) {
          for (const d of skillResult.details) {
            details.push({ status: d.status, message: `${skill}: ${d.message}` });
          }
        }
      } catch {
        // .env 不存在，跳过
      }
    }

    if (skillsChecked > 0) {
      details.push({ status: 'pass', message: `Checked ${skillsChecked} skill .env files` });
      if (skillsWithIssues > 0) {
        details.push({ status: 'warning', message: `${skillsWithIssues} skills have config issues` });
      }
    }

  } catch (error) {
    details.push({ status: 'warning', message: `Could not check skills: ${error.message}` });
  }

  // 检查关键配置文件是否存在
  const keyFiles = [
    { path: path.join(clawdRoot, 'package.json'), name: 'Root package.json' },
    { path: path.join(clawdRoot, 'skills', 'notion-persistence-universal', 'SKILL.md'), name: 'Notion skill config' },
    { path: path.join(clawdRoot, 'skills', 'telegram-notification', 'SKILL.md'), name: 'Telegram skill config' }
  ];

  for (const { path: filePath, name } of keyFiles) {
    try {
      await fs.access(filePath);
      details.push({ status: 'pass', message: `${name} exists` });
    } catch {
      details.push({ status: 'fail', message: `${name} missing` });
      allFixes.push(`Restore or create ${filePath}`);
    }
  }

  // 确定总体状态
  let status = mainResult.status;
  if (skillsWithIssues > 0 && status === 'pass') {
    status = 'warning';
  }

  return {
    status,
    message: `Config check: ${REQUIRED_ENV_VARS.length} required vars checked across ${skillsChecked + 1} env files`,
    details,
    error: allIssues.length > 0 ? allIssues.join('; ') : undefined,
    fix: allFixes
  };
}

module.exports = { run };

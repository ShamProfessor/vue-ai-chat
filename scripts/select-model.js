import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';

const models = {
  "deepseek-ai/DeepSeek-V3": "DeepSeek V3",
  "deepseek-ai/DeepSeek-R1": "DeepSeek R1"
};

async function selectModel() {
  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'model',
      message: '请选择要使用的模型：',
      choices: Object.entries(models).map(([key, value]) => ({
        name: value,
        value: key
      }))
    }
  ]);

  // 将选择的模型写入环境变量文件
  const envContent = `VITE_SELECTED_MODEL=${answer.model}`;
  fs.writeFileSync('.env', envContent);
  
  console.log(`已选择模型: ${models[answer.model]}`);
}

selectModel();
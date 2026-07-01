const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createBrowserContext(extra = {}) {
  const context = {
    console,
    setTimeout,
    clearTimeout,
    ...extra
  };
  context.window = context.window || context;
  return vm.createContext(context);
}

function loadBrowserScript(context, relativePath) {
  const filePath = path.resolve(__dirname, '..', '..', relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  vm.runInContext(source, context, { filename: relativePath });
  return context.window;
}

module.exports = {
  createBrowserContext,
  loadBrowserScript
};

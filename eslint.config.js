const js = require("@eslint/js");
const globals = require("globals");
const json = require("@eslint/json");
const markdown = require("@eslint/markdown");
const { defineConfig } = require("eslint/config");

module.exports = defineConfig([
  { 
    files: ["./src/**/*.{js,mjs,cjs}"], 
    plugins: { js }, 
    extends: ["js/recommended"], 
    languageOptions: { 
      globals: {
        ...globals.browser,  // если код работает в браузере
        ...globals.node,     // если код работает в Node.js
        ...globals.jest,     // если есть тесты с Jest
        // свои глобальные переменные
        MY_APP_CONFIG: "readonly",
        API_URL: "readonly"
      }
    } 
  },
]);
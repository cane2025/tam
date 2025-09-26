/* eslint-env node */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "react-refresh", "react-hooks"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  settings: {
    react: { version: "detect" }
  },
  rules: {
    "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    // Stäng av inline-style varningar enligt .cursorrules - projektet använder medvetet inline-styles
    "react/forbid-dom-props": "off",
    "react/no-unknown-property": "off",
    "react/style-prop-object": "off"
  },
  ignorePatterns: ["dist", "node_modules"]
}

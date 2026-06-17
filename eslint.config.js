import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/next-env.d.ts",
      "coverage/**",
      "packages/database/src/generated/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        React: "readonly",
        URLSearchParams: "readonly",
        console: "readonly",
        document: "readonly",
        globalThis: "readonly",
        process: "readonly",
        window: "readonly"
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error"
    }
  }
);

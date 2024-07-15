module.exports = {
  root: true,
  extends: ["@horus.dev/eslint-config/react"],
  ignorePatterns: ["dist", ".eslintrc.cjs"],
  plugins: ["eslint-plugin-react-compiler"],
  rules: {
    "react-compiler/react-compiler": "error",
  },
};

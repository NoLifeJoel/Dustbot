module.exports = {
  "extends": "eslint:recommended",
  "rules": {
    "indent": [
      'error',
      2
    ],
    "no-unused-vars": [
      "error",
      {
        "args": 'none'
      }
    ]
  },
  "parserOptions": {
    "ecmaVersion": 6
  },
  "env": {
    "es6": true,
    "node": true
  }
};

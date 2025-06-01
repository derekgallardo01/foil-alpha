require('dotenv').config();
const express = require('express');
const qs = require('qs');

const app = express();
const port = 3000;

app.get('/auth/constantcontact/callback', (req, res) => {
  const { code, state } = req.query;
  
  if (!code) {
    return res.status(400).send('No authorization code provided');
  }
  
  // Store the code in a file or environment variable
  const fs = require('fs');
  fs.writeFileSync('authorization_code.txt', code);
  
  res.send(`Authorization code received! You can now close this window and return to the terminal.`);
});

app.listen(port, () => {
  console.log(`Callback server running at http://localhost:${port}`);
});

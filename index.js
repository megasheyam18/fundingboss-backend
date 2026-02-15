require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, 'debug.log');
const logStream = fs.createWriteStream(logPath, { flags: 'a' });

function logger(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  logStream.write(line);
}

const app = express();

app.use(cors());
app.use(express.json());

// Request Logging Middleware
app.use((req, res, next) => {
  logger(`${req.method} ${req.url}`);
  if (req.method === 'POST') {
    logger(`Body: ${JSON.stringify(req.body, null, 2)}`);
  }
  next();
});

// In-memory storage (demo only)
const captchas = {};
const submissions = [];

// Root route
app.get('/', (req, res) => {
  res.send('FundBoss API is running on Vercel 🚀');
});

// CAPTCHA Generation
app.get('/api/generate-captcha', (req, res) => {
  const id = crypto.randomBytes(8).toString('hex');
  const challenge = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiry = Date.now() + 5 * 60 * 1000;

  captchas[id] = { challenge, expiry };
  res.json({ success: true, id, challenge });
});

// CAPTCHA Verification
app.post('/api/verify-captcha', (req, res) => {
  const { id, userInput } = req.body;
  const stored = captchas[id];

  if (!stored || Date.now() > stored.expiry) {
    return res.status(400).json({ success: false, message: 'Expired or invalid' });
  }

  if (stored.challenge === userInput.toUpperCase()) {
    delete captchas[id];
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false });
  }
});

// Test Endpoint
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'Backend is reachable' });
});

// PAN Verification (Mock)
app.post('/api/verify-pan', async (req, res) => {
  const { panNumber } = req.body;
  await new Promise(r => setTimeout(r, 1000));

  if (panNumber === 'ABCDE1234F') {
    return res.json({ success: true, data: { fullName: 'MEGA SHYAM' } });
  }

  res.json({ success: true, data: { fullName: 'UNKNOWN USER' } });
});

// GET all loan submissions
app.get('/api/submit-loan', (req, res) => {
  res.json({
    success: true,
    count: submissions.length,
    data: submissions
  });
});

// POST loan submission (Sheety)
app.post('/api/submit-loan', async (req, res) => {
  try {
    const formData = req.body;
    const { loanType } = formData;

    submissions.push({ ...formData, timestamp: new Date() });

    let sheetyUrl = '';
    let sheetyBody = {};

    if (loanType === 'Salaried') {
      sheetyUrl = 'https://api.sheety.co/db04369c091c77f3a070a8771d34d148/sample1/salaried';
      sheetyBody = {
        salaried: {
          mobile: formData.mobile,
          pinCode: formData.pinCode,
          panNumber: formData.panNumber,
          salary: formData.salary,
          loanAmount: formData.loanAmount,
          hasPf: formData.hasPF,
          designation: formData.designation
        }
      };
    } else if (loanType === 'Business') {
      sheetyUrl = 'https://api.sheety.co/db04369c091c77f3a070a8771d34d148/sample1/business';
      sheetyBody = {
        business: {
          mobile: formData.mobile,
          pinCode: formData.pinCode,
          panNumber: formData.panNumber,
          loanAmount: formData.loanAmount,
          hasGst: formData.hasGST,
          businessRegistration: formData.businessRegistration
        }
      };
    } else {
      return res.status(400).json({ success: false, message: 'Invalid loan type' });
    }

    logger(`Posting to Sheety: ${sheetyUrl}`);
    logger(`Sheety Body: ${JSON.stringify(sheetyBody, null, 2)}`);

    const response = await axios.post(sheetyUrl, sheetyBody);

    logger(`Sheety success response: ${JSON.stringify(response.data, null, 2)}`);

    res.json({
      success: true,
      message: `Loan submitted & saved to Google Sheet (${loanType})`,
      sheetData: response.data
    });
  } catch (error) {
    const errorData = error.response?.data || error.message;
    logger(`CRITICAL: Sheety Submission Failed!`);
    logger(JSON.stringify(errorData, null, 2));

    res.status(500).json({
      success: false,
      error: error.message,
      details: errorData
    });
  }
});

// ✅ ADDED FOR LOCAL DEVELOPMENT
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`FundBoss API running locally on http://localhost:${PORT}`);
});

// ✅ REQUIRED FOR VERCEL
module.exports = app;

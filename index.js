require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');

const app = express();

app.use(cors());
app.use(express.json());

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

// PAN Verification (Mock)
app.post('/api/verify-pan', async (req, res) => {
  const { panNumber } = req.body;
  await new Promise(r => setTimeout(r, 1000));

  if (panNumber === 'ABCDE1234F') {
    return res.json({ success: true, data: { fullName: 'MEGA SHYAM' } });
  }

  res.json({ success: true, data: { fullName: 'TEST USER' } });
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

    submissions.push({ ...formData, timestamp: new Date() });

    const response = await axios.post(
      'https://api.sheety.co/8158302f4f8bfc807bc480429465b087/harishProject/sheet1',
      {
        sheet1: {
          mobile: formData.mobile,
          pinCode: formData.pinCode,
          panNumber: formData.panNumber,
          loanType: formData.loanType,
          salary: formData.salary,
          loanAmount: formData.loanAmount,
          hasPF: formData.hasPF,
          designation: formData.designation,
          hasGST: formData.hasGST,
          businessRegistration: formData.businessRegistration
        }
      }
    );

    res.json({
      success: true,
      message: 'Loan submitted & saved to Google Sheet',
    }); 
  } catch (error) {
    console.error('Sheety API Error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to submit not Sheety'
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// ✅ REQUIRED FOR VERCEL (NO app.listen)
module.exports = app;
    
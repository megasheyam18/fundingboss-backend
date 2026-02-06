require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// In-memory storage
const captchas = {};
const submissions = [];

app.get('/', (req, res) => {
    res.send('FundBoss Multi-Page API is running.');
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

// PAN Verification Mock
app.post('/api/verify-pan', async (req, res) => {
    const { panNumber } = req.body;
    await new Promise(r => setTimeout(r, 1000));
    
    // Demo: ABCDE1234F is valid
    if (panNumber === 'ABCDE1234F') {
        return res.json({ success: true, data: { fullName: 'MEGA SHYAM' } });
    }
    
    // Otherwise generic success for demo
    res.json({ success: true, data: { fullName: 'TEST USER' } });
});

// Final Submission
app.post('/api/submit-loan', (req, res) => {
    const data = req.body;
    submissions.push({ ...data, timestamp: new Date() });
    console.log('✅ New Loan Application Received:', data);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

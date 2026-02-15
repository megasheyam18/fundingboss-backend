require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function logger(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${msg}`);
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
const submissions = [];
const SECRET = process.env.CAPTCHA_SECRET || 'fundboss-default-secret';

function signCaptcha(challenge, expiry) {
  const data = `${challenge}:${expiry}`;
  const signature = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  return `${Buffer.from(data).toString('base64')}.${signature}`;
}

function verifyCaptchaSignature(token) {
  try {
    const [dataBase64, signature] = token.split('.');
    if (!dataBase64 || !signature) return null;

    const data = Buffer.from(dataBase64, 'base64').toString();
    const expectedSignature = crypto.createHmac('sha256', SECRET).update(data).digest('hex');

    if (signature !== expectedSignature) return null;

    const [challenge, expiry] = data.split(':');
    return { challenge, expiry: parseInt(expiry) };
  } catch (e) {
    return null;
  }
}

// Root route
app.get('/', (req, res) => {
  res.send('FundBoss API is running on Vercel 🚀');
});

// CAPTCHA Generation
app.get('/api/generate-captcha', (req, res) => {
  const challenge = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiry = Date.now() + 5 * 60 * 1000;
  const id = signCaptcha(challenge, expiry);

  res.json({ success: true, id, challenge });
});

// CAPTCHA Verification
app.post('/api/verify-captcha', (req, res) => {
  const { id, userInput } = req.body;
  const stored = verifyCaptchaSignature(id);

  if (!stored || Date.now() > stored.expiry) {
    return res.status(400).json({ success: false, message: 'Expired or invalid CAPTCHA' });
  }

  if (stored.challenge === userInput.toUpperCase()) {
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, message: 'Incorrect CAPTCHA' });
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

// POST create initial lead (Step 1)
app.post('/api/create-lead', async (req, res) => {
  try {
    const { mobile } = req.body;
    
    // Default to 'salaried' sheet for initial entry
    const sheetyUrl = 'https://api.sheety.co/8158302f4f8bfc807bc480429465b087/fundingBoss/salaried';
    const sheetyBody = {
      salaried: {
        mobile: mobile,
        timestamp: new Date().toISOString()
      }
    };

    logger(`Creating lead in Sheety (Salaried): ${mobile}`);
    const response = await axios.post(sheetyUrl, sheetyBody);

    res.json({
      success: true,
      sheet: 'salaried',
      rowId: response.data.salaried.id, // Sheety returns the created object with id
      data: response.data.salaried
    });
  } catch (error) {
    logger(`Error creating lead: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update lead (Subsequent steps)
app.put('/api/update-lead', async (req, res) => {
  try {
    const { rowId, currentSheet, data } = req.body;
    const { loanType } = data; // Check if we need to switch sheets

    // Determine target sheet
    let targetSheet = currentSheet;
    let newRowId = rowId;

    // Logic to switch sheets if loanType implies a different sheet than current
    // If current is 'salaried' and loanType becomes 'Business', we move.
    // If current is 'business' and loanType becomes 'Salaried', we move.
    // Note: 'salaried' sheet maps to 'salaried' property in Sheety, 'business' to 'business'.

    const needsSwitch = (currentSheet === 'salaried' && loanType === 'Business') ||
                        (currentSheet === 'business' && loanType === 'Salaried');

    if (needsSwitch) {
      logger(`Switching sheets from ${currentSheet} to ${loanType.toLowerCase()}`);
      
      // 1. Create new row in new sheet with all data
      const newSheetName = loanType.toLowerCase();
      const createUrl = `https://api.sheety.co/8158302f4f8bfc807bc480429465b087/fundingBoss/${newSheetName}`;
      
      // Map data to Sheety format
      // Note: We need to send ALL accumulated data. expecting 'data' to have everything.
      const payloadKey = newSheetName; // 'salaried' or 'business'
      const createBody = {
        [payloadKey]: {
          ...data,
          mobile: data.mobile // Ensure mobile is present
        }
      };

      const createResponse = await axios.post(createUrl, createBody);
      newRowId = createResponse.data[payloadKey].id;
      targetSheet = newSheetName;

      // 2. Delete old row from old sheet
      const deleteUrl = `https://api.sheety.co/8158302f4f8bfc807bc480429465b087/fundingBoss/${currentSheet}/${rowId}`;
      await axios.delete(deleteUrl);
      
      logger(`Moved row ${rowId} (${currentSheet}) to ${newRowId} (${targetSheet})`);

      return res.json({
        success: true,
        sheet: targetSheet,
        rowId: newRowId,
        data: createResponse.data[payloadKey]
      });

    } else {
      // Normal Update
      const updateUrl = `https://api.sheety.co/8158302f4f8bfc807bc480429465b087/fundingBoss/${currentSheet}/${rowId}`;
      
      const payloadKey = currentSheet; // 'salaried' or 'business'
      const updateBody = {
        [payloadKey]: data
      };

      logger(`Updating Sheety lead ${rowId} in ${currentSheet}`);
      const response = await axios.put(updateUrl, updateBody);

      return res.json({
        success: true,
        sheet: currentSheet,
        rowId: rowId, // ID remains same
        data: response.data[payloadKey]
      });
    }

  } catch (error) {
    logger(`Error updating lead: ${error.message}`);
    // console.error(error.response?.data || error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// POST final submission (Legacy/Backup - modified to just update if existing)
app.post('/api/submit-loan', async (req, res) => {
  // We can treat this as a final update call.
  // Frontend should pass the rowId if it has it.
  try {
    const formData = req.body;
    const { loanType, rowId, currentSheet } = formData;

    if (rowId && currentSheet) {
       // Delegate to logic similar to update-lead or just return success since it's already syncing?
       // Let's just do a final update to ensure everything is perfect.
       // Reuse the logic? Or simple update.
       
       // For now, let's assume the continuous sync handles data.
       // But Step 3 submit button expects a response to move to Step 4.
       
       // Let's just call the update logic internally or respond success.
       // Actually, let's allow a final "PUT" here to verify.
        const updateUrl = `https://api.sheety.co/8158302f4f8bfc807bc480429465b087/fundingBoss/${currentSheet}/${rowId}`;
        const payloadKey = currentSheet;
        
        // Filter out internal fields like rowId, currentSheet, currentStep etc if needed? 
        // Sheety ignores unknown fields usually, so sending ...formData is okay.
        
        const updateBody = {
            [payloadKey]: {
                ...formData,
                status: 'Submitted' // Mark as submitted
            }
        };
        
        await axios.put(updateUrl, updateBody);
        
        return res.json({
             success: true,
             message: 'Loan application finalized',
        });

    } else {
        // Fallback to old Create logic if no rowId (shouldn't happen with new flow)
        // Copying old logic...
        
        /* ... Old Logic ... */
        const submissions = []; // re-declare or use global if needed
        submissions.push({ ...formData, timestamp: new Date() });
    
        let sheetyUrl = '';
        let sheetyBody = {};
    
        if (loanType === 'Salaried') {
          sheetyUrl = 'https://api.sheety.co/8158302f4f8bfc807bc480429465b087/fundingBoss/salaried';
          sheetyBody = {
            salaried: {
              ...formData
            }
          };
        } else if (loanType === 'Business') {
          sheetyUrl = 'https://api.sheety.co/8158302f4f8bfc807bc480429465b087/fundingBoss/business';
          sheetyBody = {
            business: {
              ...formData
            }
          };
        } else {
          return res.status(400).json({ success: false, message: 'Invalid loan type' });
        }
    
        const response = await axios.post(sheetyUrl, sheetyBody);
        res.json({
          success: true,
          message: 'Loan submitted & saved to Google Sheet',
          sheetData: response.data
        });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// ✅ ONLY FOR LOCAL DEVELOPMENT
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`FundBoss API running locally on http://localhost:${PORT}`);
  });
}

// ✅ REQUIRED FOR VERCEL
module.exports = app;

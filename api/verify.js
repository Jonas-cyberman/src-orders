const https = require('https');

/**
 * SRC Pulse - Vercel Verification Gateway
 * This function securely verifies a transaction reference with Paystack.
 */
module.exports = async (req, res) => {
  const { reference } = req.query;

  if (!reference) {
    return res.status(400).json({ success: false, message: "Reference required" });
  }

  // 1. Get Secret Keys from Environment Variables
  const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL; // e.g. https://xyz.supabase.co
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!PAYSTACK_SECRET || !SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ 
      success: false, 
      message: "Server Configuration Error: Missing Environment Variables (PAYSTACK_SECRET_KEY or SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)" 
    });
  }

  try {
    // 2. Verify with Paystack
    const paystackResult = await fetchPaystack(reference, PAYSTACK_SECRET);

    if (paystackResult && paystackResult.data && paystackResult.data.status === 'success') {
      // 3. SUCCESS: Update Supabase Registry status to 'paid'
      const updateResult = await updateSupabase(reference, SUPABASE_URL, SUPABASE_KEY);
      
      return res.status(200).json({ 
        success: true, 
        status: 'success', 
        message: "Victory! Paystack confirms success. Registry updated.",
        data: paystackResult.data
      });
    } else {
      // 4. FAILED / PENDING
      return res.status(200).json({ 
        success: false, 
        status: paystackResult?.data?.status || 'failed',
        message: paystackResult?.message || "Transaction not confirmed as successful yet."
      });
    }
  } catch (error) {
    console.error("Verification error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// --- HELPER: Fetch from Paystack (No Dependencies) ---
function fetchPaystack(ref, key) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.paystack.co',
      path: `/transaction/verify/${encodeURIComponent(ref)}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });

    req.on('error', (e) => reject(e));
    req.end();
  });
}

// --- HELPER: Update Supabase via REST (No Dependencies) ---
function updateSupabase(ref, url, key) {
  return new Promise((resolve, reject) => {
    if (!url.startsWith('http')) url = `https://${url}`;
    const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    
    // We use the 'orders' table. We find by transaction_id and update payment_status.
    const body = JSON.stringify({ payment_status: 'paid' });
    const options = {
      hostname: cleanUrl.replace('https://', ''),
      path: `/rest/v1/orders?transaction_id=eq.${encodeURIComponent(ref)}`,
      method: 'PATCH',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', (e) => reject(e));
    req.write(body);
    req.end();
  });
}

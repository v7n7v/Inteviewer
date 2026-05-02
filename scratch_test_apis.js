(async () => {
  require('dotenv').config({ path: '.env.local' });
  
  try {
    const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` }
    });
    const data = await res.json();
    console.log('OpenRouter:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('OpenRouter Error:', e.message);
  }
})();

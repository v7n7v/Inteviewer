# 🔧 AI Assistant Troubleshooting Guide

## Issue: Chat Interface Not Working / LLM Not Connected

If you're seeing "I'm sorry, I encountered an error" messages, follow these steps:

---

## ✅ **Step 1: Verify API Key is Set**

Check your `.env.local` file has the Groq API key:

```bash
# Should contain:
NEXT_PUBLIC_GROQ_API_KEY=gsk_your_actual_api_key_here
```

**Important:** The key should start with `gsk_` and be your actual Groq API key.

---

## 🔄 **Step 2: Restart Dev Server**

**CRITICAL:** After adding/changing environment variables, you MUST restart the Next.js dev server:

1. **Stop the current server** (Ctrl+C or Cmd+C)
2. **Restart it:**
   ```bash
   npm run dev
   ```

Environment variables are loaded at server startup, so changes won't take effect until restart!

---

## 🔍 **Step 3: Check Browser Console**

Open your browser's Developer Tools (F12) and check the Console tab for error messages:

- Look for messages starting with `⚠️` or `Groq API error:`
- These will tell you the exact issue

---

## 🧪 **Step 4: Test API Key**

Your Groq API key should be:
- Format: `gsk_...` (starts with `gsk_`)
- From: [Groq Console](https://console.groq.com/keys)
- Valid and not expired

---

## 🐛 **Common Errors & Solutions**

### **Error: "GROQ_API_KEY not found"**
- **Solution:** Add `NEXT_PUBLIC_GROQ_API_KEY` to `.env.local`
- **Then:** Restart dev server

### **Error: "401 Unauthorized"**
- **Solution:** API key is invalid or expired
- **Fix:** Get a new key from [Groq Console](https://console.groq.com/keys)

### **Error: "429 Too Many Requests"**
- **Solution:** Rate limit exceeded
- **Fix:** Wait a few minutes and try again

### **Error: "Network Error" or "Failed to fetch"**
- **Solution:** Check your internet connection
- **Fix:** Verify you can access `https://api.groq.com`

---

## 📝 **Quick Fix Checklist**

- [ ] API key exists in `.env.local`
- [ ] API key starts with `gsk_`
- [ ] Dev server was restarted after adding key
- [ ] No typos in variable name (`NEXT_PUBLIC_GROQ_API_KEY`)
- [ ] Browser console shows no errors
- [ ] Internet connection is working

---

## 🚀 **After Fixing**

1. **Restart dev server:**
   ```bash
   npm run dev
   ```

2. **Hard refresh browser:**
   - Chrome/Edge: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Firefox: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)

3. **Test the chat:**
   - Type a message
   - Check browser console for any errors
   - Should get AI response in <1 second

---

## 💡 **Still Not Working?**

Check the browser console for the detailed error message. The improved error handling will now show:
- Exact API error details
- Whether API key is missing
- Network issues
- API response status codes

**Copy the error message** and it will help identify the exact issue!

---

## 📞 **Need Help?**

The error messages in the chat will now show more details. Check:
1. Browser console (F12 → Console tab)
2. Chat error message (now shows detailed error)
3. Server terminal (for any build/runtime errors)

---

**Most Common Fix:** Restart your dev server! 🔄

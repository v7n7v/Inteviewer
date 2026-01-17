# 🎯 Per-Question Co-Pilot — Complete Guide

## 🎉 What's New?

The Co-Pilot now has a **structured per-question workflow** where you can:
- ✅ **Record audio** for each question individually
- ✅ **Generate AI nudges** for each question
- ✅ **Track transcripts** per question
- ✅ **Detect keywords** per question
- ✅ **Mark questions** as completed
- ✅ **Track progress** visually

---

## 📊 How It Works

### **1. Generate Questions First**
Go to **Detective** tab → Upload CV & JD → Click "Generate Battle-Plan"

The Co-Pilot automatically imports all questions from the Detective.

---

### **2. Start Global Transcription**
At the top of Co-Pilot, click **"Start Transcribing"**

This starts continuous speech-to-text that runs throughout the interview.

**Key concept:** Transcription runs globally, but you assign it to specific questions by selecting them.

---

### **3. Select a Question**
Click the **"Select"** button on any question card.

When selected:
- ✅ Card highlights with cyan border
- ✅ Button changes to "Selected"
- ✅ Live transcript automatically saves to this question
- ✅ Keywords auto-detected for this question

**Only one question can be selected at a time.**

---

### **4. Record Audio for the Question**
Click **"🔴 Record"** on the selected question.

This records audio specifically for that question.

**What happens:**
- Audio recording starts
- Button changes to "Stop Recording"
- When you stop, audio is saved to that question
- You can play it back later with the "▶ Play" button

---

### **5. Generate AI Nudge**
After the candidate responds, click **"🧠 AI Nudge"** on that question.

The AI analyzes the transcript and generates 2 strategic follow-up questions.

**Requirements:**
- Question must have some transcript (either per-question or global)
- Uses GPT-OSS 120B for fast, accurate suggestions

---

### **6. Mark as Completed**
When done with a question, click **"✓ Complete"**.

This marks the question as completed and updates the progress bar.

---

### **7. Move to Next Question**
Click **"Select"** on the next question and repeat steps 4-6.

---

## 🎨 Visual Status Indicators

Each question has a **status badge** (top-left of card):

| Badge | Status | Meaning |
|-------|--------|---------|
| Gray number (1, 2, 3...) | Not Started | Question hasn't been touched yet |
| Yellow number | In Progress | Question is selected or has some data |
| Green ✓ | Completed | Question marked as done |

---

## 📋 Per-Question Data Display

Each question card shows:

### **Transcript Section** 📝
- Full transcript of candidate's response to this question
- Character count
- Scrollable if long

### **AI Follow-up Questions** 🧠
- 2 strategic deep-dive questions
- Based on candidate's actual response
- Use immediately to probe deeper

### **Audio Recording** 🎵
- Shows if audio was recorded
- Timestamp of recording
- "▶ Play" button to replay

### **Detected Keywords** 🏷️
- Technical terms mentioned by candidate
- Green badges for easy scanning
- Counter shows total keywords

---

## 🔄 Complete Workflow Example

### **Interviewing a Python Developer**

```
1. DETECTIVE TAB
   ✅ Upload CV and Job Description
   ✅ Click "Generate Battle-Plan"
   ✅ System creates 10 questions

2. CO-PILOT TAB
   ✅ Click "Start Transcribing" (top)
   
3. QUESTION 1: "Tell me about your Python experience"
   ✅ Click "Select" on Question 1
   ✅ Click "🔴 Record" (starts audio recording)
   ✅ Ask candidate the question
   ✅ Listen to response (transcript auto-saves)
   ✅ Click "Stop Recording" (audio saved)
   ✅ Click "🧠 AI Nudge" (get follow-up questions)
   
   AI suggests:
   "1. Can you explain how you optimized that data pipeline?"
   "2. What challenges did you face with the async implementation?"
   
   ✅ Ask those follow-up questions
   ✅ Click "✓ Complete"
   
   Result:
   - Transcript: "I have 5 years of Python experience..."
   - Audio: Saved (can replay)
   - Keywords: [Python, async, data]
   - AI Nudge: 2 follow-up questions
   
4. QUESTION 2: "Explain your Django project"
   ✅ Click "Select" on Question 2
   ✅ Click "🔴 Record"
   ✅ Ask question
   ✅ Listen to response
   ✅ Stop recording
   ✅ Generate AI nudge
   ✅ Mark complete
   
5. CONTINUE...
   ✅ Repeat for all 10 questions
   ✅ Progress bar fills up
   ✅ All data organized per question

6. END INTERVIEW
   ✅ Click "Stop Transcribing"
   ✅ Move to Calibration tab to grade
```

---

## 🎯 Benefits of Per-Question Structure

### **Before (Global)**
- ❌ One big transcript for entire interview
- ❌ Hard to find specific answers
- ❌ Audio recording had no structure
- ❌ Keywords mixed together
- ❌ Difficult to review

### **After (Per-Question)**
- ✅ Each question has its own transcript
- ✅ Easy to review specific answers
- ✅ Audio organized by question
- ✅ Keywords categorized per question
- ✅ AI nudges context-aware
- ✅ Progress tracking
- ✅ Export-ready data structure

---

## 💡 Pro Tips

### **Tip 1: Select Before You Ask**
Always click "Select" on a question **before** asking it. This ensures the transcript goes to the right place.

### **Tip 2: Record Important Questions**
You don't have to record every question. Only record:
- Critical technical questions
- Questions where tone matters
- Complex explanations
- Red-flag moments

### **Tip 3: Use AI Nudges Strategically**
Generate AI nudges after the candidate gives their initial response. The AI will analyze what they said and suggest deeper questions.

### **Tip 4: Mark as Complete**
Always mark questions as complete when done. This helps you:
- Track progress
- Know where you are
- Ensure you cover all questions

### **Tip 5: Keywords are Automatic**
You don't need to do anything for keywords. They're detected automatically as the candidate speaks.

### **Tip 6: Transcription Stays Running**
Keep transcription running the entire interview. Just switch which question is "Selected" to redirect the transcript.

---

## 📊 Progress Tracking

At the top, you'll see:

```
Interview Progress
3 / 10 completed

[████████░░░░░░░░░░░░] 30%
```

- Green bar fills as you complete questions
- Shows X / Y format
- Visual motivation to finish all questions

---

## 🔍 Data Structure

Each question stores:

```typescript
{
  questionIndex: 2,
  transcript: "I have worked with React for 3 years...",
  aiNudge: "1. How did you handle state management?\n2. Explain your component architecture.",
  audioUrl: "blob:http://localhost:3000/abc123",
  keywords: ["React", "state management", "components"],
  status: "completed",
  timestamp: "2026-01-15T10:30:00Z"
}
```

This structured data makes it easy to:
- Review later
- Export to reports
- Use in calibration
- Compare candidates

---

## 🚀 Export to Calibration

After completing the interview:

1. Click **"Stop Transcribing"**
2. Navigate to **Calibration** tab
3. All per-question data is preserved
4. Use transcripts for AI grading
5. Use keywords for evaluation
6. Use AI nudges for detailed notes

---

## 🎬 Video Conferencing Workaround

**Current Limitation:** Can't directly record from Zoom/Teams/Meet/Webex.

**Workaround Options:**

### **Option A: Virtual Audio Device**
1. Install **BlackHole** (Mac) or **VB-Cable** (Windows)
2. Route meeting audio to virtual device
3. Select virtual device as browser microphone
4. Works perfectly with Co-Pilot

### **Option B: Manual Import**
1. Use Zoom/Teams native recording
2. After interview, export transcript
3. Copy-paste into Co-Pilot
4. Still get AI nudges and structure

### **Option C: Phone + Computer**
1. Join meeting on phone
2. Use Co-Pilot on computer
3. Speak questions into computer mic (transcribed)
4. Hear candidate through phone

**We're working on native integration!**

---

## ❓ FAQ

### **Q: What if I forget to select a question?**
**A:** The transcript will still be captured globally, but won't be assigned to a specific question. Select a question retroactively if needed.

### **Q: Can I record without transcription?**
**A:** Yes! Recording and transcription are independent. You can record audio even if transcription is off.

### **Q: Can I edit transcripts?**
**A:** Not currently, but transcripts are stored in the database. You can access them in Calibration/Analytics tabs.

### **Q: What if AI nudge is irrelevant?**
**A:** Click "🧠 AI Nudge" again to regenerate. The AI will analyze the transcript again and give new suggestions.

### **Q: Can I go back to a previous question?**
**A:** Yes! Click "Select" on any previous question to review or add more data.

### **Q: Does audio sync with transcript?**
**A:** Not yet, but both are timestamped so you can correlate them manually.

---

## 🎉 Summary

The new per-question Co-Pilot gives you:

- ✅ **Structured interviews** (not chaotic)
- ✅ **Organized data** (per question, not global mess)
- ✅ **AI assistance** (context-aware nudges)
- ✅ **Progress tracking** (know where you are)
- ✅ **Easy review** (find any answer instantly)
- ✅ **Professional export** (ready for calibration)

---

**Start conducting world-class, AI-powered interviews today!** 🚀🎙️

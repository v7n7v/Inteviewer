# ✏️ Detective Tab — Edit & Custom Questions

## 🎉 New Features Added!

### **1. Edit Core Questions** ✅
- Click the **Edit** button (pencil icon) on any question
- Inline editing with text areas for:
  - Question text
  - Purpose
  - Expected Answer
- **Save** or **Cancel** buttons
- Changes persist immediately

### **2. Delete Questions** ✅
- Click the **Delete** button (trash icon) on any question
- Confirmation dialog before deletion
- Works for both AI-generated and custom questions

### **3. Add Custom Questions** ✅
- Click **"➕ Add Custom Question"** button at the top
- Modal form with fields:
  - Question (required)
  - Purpose (required)
  - Expected Answer (optional)
- Custom questions are marked with a **"Custom"** badge

---

## 🎯 How to Use

### **Editing a Question**

1. **Hover** over any question card
2. **Click** the pencil icon (Edit button)
3. **Edit** the fields in the form
4. **Click** "✓ Save" to save changes
5. **Click** "Cancel" to discard changes

### **Deleting a Question**

1. **Hover** over any question card
2. **Click** the trash icon (Delete button)
3. **Confirm** deletion in the dialog
4. Question is removed immediately

### **Adding a Custom Question**

1. **Click** "➕ Add Custom Question" button (top right of questions section)
2. **Fill in** the form:
   - Question: Your interview question
   - Purpose: Why this question is important
   - Expected Answer: What to look for (optional)
3. **Click** "✓ Add Question"
4. Question appears at the end of the list
5. Custom questions show a **"Custom"** badge

---

## 🎨 UI Features

### **Edit Mode**
- Inline editing form
- Text areas for all fields
- Save/Cancel buttons
- Smooth transitions

### **View Mode**
- Edit/Delete buttons appear on hover
- Custom badge for user-created questions
- Clean, organized layout

### **Add Modal**
- Full-screen modal overlay
- Glass card design
- Required field indicators (*)
- Cancel button to close

---

## 📋 Question Structure

Each question stores:
```typescript
{
  question: string;        // The interview question
  purpose: string;         // Why this question is important
  expectedAnswer?: string; // What to look for (optional)
  isCustom?: boolean;      // True for user-created questions
}
```

---

## ✅ Benefits

### **For Interviewers**
- ✅ **Customize** AI-generated questions
- ✅ **Add** your own questions
- ✅ **Remove** irrelevant questions
- ✅ **Edit** questions to match your style
- ✅ **Full control** over interview plan

### **For Flexibility**
- ✅ Mix AI-generated and custom questions
- ✅ Edit questions on the fly
- ✅ Adapt to specific needs
- ✅ Remove questions you don't need
- ✅ Add follow-up questions

---

## 🔄 Workflow Example

```
1. Generate Battle-Plan
   → AI creates 10 questions

2. Review Questions
   → Read through all questions

3. Edit Question 3
   → Click Edit → Modify → Save

4. Delete Question 7
   → Click Delete → Confirm

5. Add Custom Question
   → Click "Add Custom Question"
   → Fill form → Add

6. Save Battle Plan
   → All changes saved to database

7. Go to Co-Pilot
   → Use edited/custom questions
```

---

## 🎯 Use Cases

### **Scenario 1: Refine AI Questions**
- AI generates good questions, but wording needs adjustment
- Edit to match your interview style
- Keep the AI's strategic thinking

### **Scenario 2: Add Company-Specific Questions**
- AI generates technical questions
- Add custom questions about company culture
- Mix technical and cultural assessment

### **Scenario 3: Remove Irrelevant Questions**
- AI generates 10 questions
- 2 don't apply to this candidate
- Delete them to streamline interview

### **Scenario 4: Add Follow-up Questions**
- After generating battle-plan
- Add specific follow-ups based on CV
- Customize for this exact candidate

---

## 💡 Tips

### **Best Practices**
1. **Review First** — Read all AI questions before editing
2. **Edit Strategically** — Don't change the core purpose
3. **Add Thoughtfully** — Custom questions should add value
4. **Delete Sparingly** — AI questions are strategically generated
5. **Save Regularly** — Save battle plan after making changes

### **When to Edit**
- ✅ Wording needs adjustment
- ✅ Question is too vague
- ✅ Question is too specific
- ✅ Tone doesn't match your style

### **When to Add Custom**
- ✅ Company-specific questions
- ✅ Role-specific questions
- ✅ Follow-up questions
- ✅ Questions not covered by AI

### **When to Delete**
- ✅ Question doesn't apply
- ✅ Question is redundant
- ✅ Question is too advanced/basic
- ✅ Question is irrelevant to role

---

## 🎊 Summary

The Detective tab now gives you **complete control** over your interview questions:

- ✅ **Edit** any question (AI or custom)
- ✅ **Delete** questions you don't need
- ✅ **Add** your own custom questions
- ✅ **Mix** AI and custom questions
- ✅ **Full flexibility** in interview planning

**Create the perfect interview plan for every candidate!** 🎯✨

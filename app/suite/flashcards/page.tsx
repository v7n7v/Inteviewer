'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { showToast } from '@/components/Toast';
import { groqJSONCompletion } from '@/lib/ai/groq-client';

// ============================================
// TYPES & INTERFACES
// ============================================
interface FlashCard {
    id: string;
    front: string;
    back: string;
    category: string;
    difficulty: 'easy' | 'medium' | 'hard';
    nextReview: Date;
    interval: number; // days until next review
    easeFactor: number; // SM-2 algorithm factor
    repetitions: number;
    lastReviewed?: Date;
}

interface Deck {
    id: string;
    name: string;
    description: string;
    cards: FlashCard[];
    createdAt: Date;
    source: 'ai' | 'manual' | 'template';
    sourceData?: {
        resumeText?: string;
        jobDescription?: string;
    };
}

interface StudySession {
    cardsStudied: number;
    correctAnswers: number;
    startTime: Date;
    streak: number;
}

type StudyMode = 'interview-prep' | 'learning' | 'resume-gap';
type ViewMode = 'home' | 'create' | 'study' | 'review';

// ============================================
// HELPER: SM-2 SPACED REPETITION ALGORITHM
// ============================================
function calculateNextReview(card: FlashCard, quality: number): Partial<FlashCard> {
    // quality: 0 = complete failure, 5 = perfect recall
    // SM-2 Algorithm implementation
    let { easeFactor, repetitions, interval } = card;

    if (quality < 3) {
        // Failed recall - reset
        repetitions = 0;
        interval = 1;
    } else {
        // Successful recall
        if (repetitions === 0) {
            interval = 1;
        } else if (repetitions === 1) {
            interval = 6;
        } else {
            interval = Math.round(interval * easeFactor);
        }
        repetitions += 1;
    }

    // Update ease factor
    easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    return {
        easeFactor,
        repetitions,
        interval,
        nextReview,
        lastReviewed: new Date(),
    };
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function FlashCardsPage() {
    const { user } = useStore();
    const [viewMode, setViewMode] = useState<ViewMode>('home');
    const [studyMode, setStudyMode] = useState<StudyMode | null>(null);
    const [decks, setDecks] = useState<Deck[]>([]);
    const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [session, setSession] = useState<StudySession>({
        cardsStudied: 0,
        correctAnswers: 0,
        startTime: new Date(),
        streak: 0,
    });

    // Create deck form state
    const [createForm, setCreateForm] = useState({
        resumeText: '',
        jobDescription: '',
        topic: '',
        cardCount: 10,
    });

    // Load decks from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('flashcard-decks');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setDecks(parsed.map((d: any) => ({
                    ...d,
                    createdAt: new Date(d.createdAt),
                    cards: d.cards.map((c: any) => ({
                        ...c,
                        nextReview: new Date(c.nextReview),
                        lastReviewed: c.lastReviewed ? new Date(c.lastReviewed) : undefined,
                    })),
                })));
            } catch (e) {
                console.error('Failed to load decks:', e);
            }
        }
    }, []);

    // Save decks to localStorage
    useEffect(() => {
        if (decks.length > 0) {
            localStorage.setItem('flashcard-decks', JSON.stringify(decks));
        }
    }, [decks]);

    // Get cards due for review
    const getDueCards = useCallback((deck: Deck) => {
        const now = new Date();
        return deck.cards.filter(card => new Date(card.nextReview) <= now);
    }, []);

    // Generate cards with AI
    const generateCards = async () => {
        if (!studyMode) return;

        setIsLoading(true);
        try {
            let prompt = '';
            let deckName = '';
            let deckDescription = '';

            if (studyMode === 'resume-gap') {
                if (!createForm.resumeText || !createForm.jobDescription) {
                    showToast('Please provide both resume and job description', '❌');
                    setIsLoading(false);
                    return;
                }
                prompt = `Analyze this resume and job description. Generate ${createForm.cardCount} flashcards that focus on skills and concepts the candidate needs to learn to be better qualified for the job.

RESUME:
${createForm.resumeText}

JOB DESCRIPTION:
${createForm.jobDescription}

Generate cards for concepts, technologies, or skills mentioned in the JD but weak/missing in the resume.`;
                deckName = 'Gap Analysis Cards';
                deckDescription = 'AI-generated cards based on resume skill gaps';

            } else if (studyMode === 'interview-prep') {
                if (!createForm.jobDescription) {
                    showToast('Please provide a job description', '❌');
                    setIsLoading(false);
                    return;
                }
                prompt = `Generate ${createForm.cardCount} interview preparation flashcards for this job:

JOB DESCRIPTION:
${createForm.jobDescription}

Create cards covering:
- Technical concepts mentioned in the JD
- Behavioral interview questions (STAR format hints)
- Common interview questions for this role
- Key terminology and acronyms`;
                deckName = 'Interview Prep';
                deckDescription = 'Interview preparation cards for your target role';

            } else if (studyMode === 'learning') {
                if (!createForm.topic) {
                    showToast('Please enter a topic to study', '❌');
                    setIsLoading(false);
                    return;
                }
                prompt = `Generate ${createForm.cardCount} educational flashcards about: "${createForm.topic}"

Create comprehensive cards that cover:
- Key concepts and definitions
- Important details and examples
- Common misconceptions
- Practical applications`;
                deckName = createForm.topic;
                deckDescription = `Study cards for ${createForm.topic}`;
            }

            const systemPrompt = `You are an expert educator creating flashcards. Generate high-quality flashcards in JSON format.

Each card should have:
- A clear, concise question on the front
- A comprehensive but focused answer on the back
- A relevant category
- Difficulty rating (easy, medium, hard)

Return a JSON array:
[
  {
    "front": "Question text",
    "back": "Answer text",
    "category": "Category name",
    "difficulty": "easy|medium|hard"
  }
]`;

            const cards = await groqJSONCompletion<Array<{
                front: string;
                back: string;
                category: string;
                difficulty: 'easy' | 'medium' | 'hard';
            }>>(systemPrompt, prompt, { temperature: 0.7, maxTokens: 4000 });

            // Create new deck
            const newDeck: Deck = {
                id: crypto.randomUUID(),
                name: deckName,
                description: deckDescription,
                source: 'ai',
                createdAt: new Date(),
                sourceData: {
                    resumeText: createForm.resumeText,
                    jobDescription: createForm.jobDescription,
                },
                cards: cards.map(c => ({
                    id: crypto.randomUUID(),
                    front: c.front,
                    back: c.back,
                    category: c.category,
                    difficulty: c.difficulty,
                    nextReview: new Date(),
                    interval: 1,
                    easeFactor: 2.5,
                    repetitions: 0,
                })),
            };

            setDecks(prev => [...prev, newDeck]);
            setActiveDeck(newDeck);
            setViewMode('study');
            setCurrentCardIndex(0);
            setSession({
                cardsStudied: 0,
                correctAnswers: 0,
                startTime: new Date(),
                streak: 0,
            });
            showToast(`Created ${cards.length} flashcards!`, '✨');
        } catch (error) {
            console.error('Failed to generate cards:', error);
            showToast('Failed to generate flashcards', '❌');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle card rating (after reveal)
    const handleRating = (quality: number) => {
        if (!activeDeck) return;

        const currentCard = activeDeck.cards[currentCardIndex];
        const updates = calculateNextReview(currentCard, quality);

        // Update card in deck
        const updatedCards = [...activeDeck.cards];
        updatedCards[currentCardIndex] = { ...currentCard, ...updates };

        const updatedDeck = { ...activeDeck, cards: updatedCards };
        setActiveDeck(updatedDeck);
        setDecks(prev => prev.map(d => d.id === updatedDeck.id ? updatedDeck : d));

        // Update session
        setSession(prev => ({
            ...prev,
            cardsStudied: prev.cardsStudied + 1,
            correctAnswers: quality >= 3 ? prev.correctAnswers + 1 : prev.correctAnswers,
            streak: quality >= 3 ? prev.streak + 1 : 0,
        }));

        // Move to next card
        if (currentCardIndex < activeDeck.cards.length - 1) {
            setCurrentCardIndex(prev => prev + 1);
            setIsFlipped(false);
        } else {
            // Deck complete
            showToast('🎉 Deck complete!', '✅');
            setViewMode('review');
        }
    };

    // Delete deck
    const handleDeleteDeck = (deckId: string) => {
        setDecks(prev => prev.filter(d => d.id !== deckId));
        showToast('Deck deleted', '🗑️');
    };

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center p-8">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card p-12 text-center max-w-md"
                >
                    <span className="text-6xl mb-4 block">🔒</span>
                    <h2 className="text-2xl font-bold text-white mb-3">Sign In Required</h2>
                    <p className="text-silver">Please sign in to access Study Flash Cards</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6 lg:p-8">
            {/* ============================================ */}
            {/* HEADER */}
            {/* ============================================ */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-3xl bg-[#0A0A0A] border border-white/10 p-8 mb-8"
            >
                {/* Animated Background Orbs */}
                <div className="absolute inset-0 overflow-hidden">
                    <motion.div
                        animate={{
                            x: [0, 50, 0],
                            y: [0, -30, 0],
                            scale: [1, 1.2, 1],
                        }}
                        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl"
                    />
                    <motion.div
                        animate={{
                            x: [0, -30, 0],
                            y: [0, 50, 0],
                            scale: [1, 1.1, 1],
                        }}
                        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl"
                    />
                    <motion.div
                        animate={{
                            x: [0, 20, 0],
                            y: [0, 20, 0],
                        }}
                        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute top-1/2 left-1/2 w-48 h-48 bg-cyan-400/10 rounded-full blur-2xl"
                    />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 mb-4"
                        >
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="w-2 h-2 rounded-full bg-cyan-400"
                            />
                            <span className="text-xs font-medium text-cyan-400">AI-Powered Learning</span>
                        </motion.div>
                        <h1 className="text-4xl lg:text-5xl font-bold mb-3">
                            <span className="text-gradient">Study Flash Cards</span>
                        </h1>
                        <p className="text-silver text-lg max-w-xl">
                            Master concepts with AI-generated spaced repetition flash cards
                        </p>
                    </div>

                    {viewMode !== 'home' && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                setViewMode('home');
                                setStudyMode(null);
                                setActiveDeck(null);
                                setIsFlipped(false);
                            }}
                            className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all border border-white/10 hover:border-white/20"
                        >
                            ← Back to Home
                        </motion.button>
                    )}
                </div>
            </motion.div>

            <AnimatePresence mode="wait">
                {/* ============================================ */}
                {/* HOME VIEW - Mode Selection & Deck List */}
                {/* ============================================ */}
                {viewMode === 'home' && (
                    <motion.div
                        key="home"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="max-w-6xl mx-auto"
                    >
                        {/* Study Mode Selection */}
                        <div className="mb-12">
                            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                <span className="text-3xl">🎯</span>
                                Choose Your Study Mode
                            </h2>

                            <div className="grid md:grid-cols-3 gap-6">
                                {[
                                    {
                                        mode: 'interview-prep' as StudyMode,
                                        icon: '💼',
                                        title: 'Interview Prep',
                                        description: 'Generate cards from job descriptions to ace your interviews',
                                        gradient: 'from-blue-500/20 to-cyan-500/20',
                                        borderColor: 'hover:border-blue-500/50',
                                    },
                                    {
                                        mode: 'learning' as StudyMode,
                                        icon: '📚',
                                        title: 'Learn Any Topic',
                                        description: 'Create flashcards for any subject you want to master',
                                        gradient: 'from-cyan-500/20 to-teal-500/20',
                                        borderColor: 'hover:border-cyan-500/50',
                                    },
                                    {
                                        mode: 'resume-gap' as StudyMode,
                                        icon: '🎯',
                                        title: 'Resume Gap Analysis',
                                        description: 'Fill your skill gaps by comparing resume to job requirements',
                                        gradient: 'from-teal-500/20 to-blue-500/20',
                                        borderColor: 'hover:border-teal-500/50',
                                    },
                                ].map((item, index) => (
                                    <motion.button
                                        key={item.mode}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        whileHover={{ scale: 1.02, y: -4 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                            setStudyMode(item.mode);
                                            setViewMode('create');
                                        }}
                                        className={`group relative p-8 rounded-3xl bg-[#0A0A0A] border border-white/10 ${item.borderColor} text-left transition-all overflow-hidden`}
                                    >
                                        <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                                        <div className="relative">
                                            <motion.div
                                                whileHover={{ rotate: [0, -10, 10, 0] }}
                                                transition={{ duration: 0.5 }}
                                                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mb-6 border border-white/10"
                                            >
                                                <span className="text-3xl">{item.icon}</span>
                                            </motion.div>

                                            <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                                            <p className="text-silver text-sm">{item.description}</p>

                                            <div className="mt-4 flex items-center gap-2 text-cyan-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span>Get Started</span>
                                                <motion.span
                                                    animate={{ x: [0, 4, 0] }}
                                                    transition={{ duration: 1, repeat: Infinity }}
                                                >
                                                    →
                                                </motion.span>
                                            </div>
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        </div>

                        {/* Existing Decks */}
                        {decks.length > 0 && (
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                    <span className="text-3xl">📚</span>
                                    Your Decks
                                </h2>

                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {decks.map((deck, index) => {
                                        const dueCards = getDueCards(deck);
                                        const progress = deck.cards.length > 0
                                            ? Math.round((deck.cards.filter(c => c.repetitions > 0).length / deck.cards.length) * 100)
                                            : 0;

                                        return (
                                            <motion.div
                                                key={deck.id}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                whileHover={{ y: -4 }}
                                                className="group relative p-6 rounded-2xl bg-[#0A0A0A] border border-white/10 hover:border-cyan-500/30 transition-all overflow-hidden"
                                            >
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-colors" />

                                                <div className="relative">
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div className="flex-1">
                                                            <h3 className="text-lg font-bold text-white mb-1 truncate">{deck.name}</h3>
                                                            <p className="text-silver text-sm truncate">{deck.description}</p>
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteDeck(deck.id);
                                                            }}
                                                            className="p-2 rounded-lg hover:bg-red-500/20 text-silver hover:text-red-400 transition-colors"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>

                                                    {/* Progress bar */}
                                                    <div className="mb-4">
                                                        <div className="flex justify-between text-xs text-silver mb-1">
                                                            <span>{progress}% mastered</span>
                                                            <span>{deck.cards.length} cards</span>
                                                        </div>
                                                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${progress}%` }}
                                                                transition={{ duration: 1, delay: index * 0.1 }}
                                                                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Stats */}
                                                    <div className="flex items-center gap-4 mb-4 text-sm">
                                                        {dueCards.length > 0 && (
                                                            <span className="px-2 py-1 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                                                                {dueCards.length} due
                                                            </span>
                                                        )}
                                                        <span className="text-silver">
                                                            {deck.source === 'ai' ? '🤖 AI Generated' : '✏️ Manual'}
                                                        </span>
                                                    </div>

                                                    {/* Study button */}
                                                    <motion.button
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        onClick={() => {
                                                            setActiveDeck(deck);
                                                            setCurrentCardIndex(0);
                                                            setIsFlipped(false);
                                                            setViewMode('study');
                                                            setSession({
                                                                cardsStudied: 0,
                                                                correctAnswers: 0,
                                                                startTime: new Date(),
                                                                streak: 0,
                                                            });
                                                        }}
                                                        className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                                                    >
                                                        Study Now
                                                    </motion.button>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Empty state */}
                        {decks.length === 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="text-center py-16"
                            >
                                <motion.div
                                    animate={{ y: [0, -10, 0] }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                    className="text-7xl mb-6"
                                >
                                    🎴
                                </motion.div>
                                <h3 className="text-xl font-bold text-white mb-2">No decks yet</h3>
                                <p className="text-silver">Choose a study mode above to create your first flashcard deck!</p>
                            </motion.div>
                        )}
                    </motion.div>
                )}

                {/* ============================================ */}
                {/* CREATE VIEW - Generate Cards */}
                {/* ============================================ */}
                {viewMode === 'create' && studyMode && (
                    <motion.div
                        key="create"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="max-w-3xl mx-auto"
                    >
                        <div className="p-8 rounded-3xl bg-[#0A0A0A] border border-white/10">
                            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                {studyMode === 'interview-prep' && <><span className="text-3xl">💼</span> Interview Prep Cards</>}
                                {studyMode === 'learning' && <><span className="text-3xl">📚</span> Learn Any Topic</>}
                                {studyMode === 'resume-gap' && <><span className="text-3xl">🎯</span> Resume Gap Analysis</>}
                            </h2>

                            <div className="space-y-6">
                                {/* Resume input for resume-gap mode */}
                                {studyMode === 'resume-gap' && (
                                    <div>
                                        <label className="block text-white font-medium mb-2">Your Resume Text</label>
                                        <textarea
                                            value={createForm.resumeText}
                                            onChange={(e) => setCreateForm(prev => ({ ...prev, resumeText: e.target.value }))}
                                            placeholder="Paste your resume content here..."
                                            rows={6}
                                            className="w-full p-4 rounded-xl bg-[#111111] border border-white/10 focus:border-cyan-500/50 text-white placeholder-silver/50 resize-none transition-colors"
                                        />
                                    </div>
                                )}

                                {/* Job description for interview-prep and resume-gap */}
                                {(studyMode === 'interview-prep' || studyMode === 'resume-gap') && (
                                    <div>
                                        <label className="block text-white font-medium mb-2">Job Description</label>
                                        <textarea
                                            value={createForm.jobDescription}
                                            onChange={(e) => setCreateForm(prev => ({ ...prev, jobDescription: e.target.value }))}
                                            placeholder="Paste the job description here..."
                                            rows={6}
                                            className="w-full p-4 rounded-xl bg-[#111111] border border-white/10 focus:border-cyan-500/50 text-white placeholder-silver/50 resize-none transition-colors"
                                        />
                                    </div>
                                )}

                                {/* Topic input for learning mode */}
                                {studyMode === 'learning' && (
                                    <div>
                                        <label className="block text-white font-medium mb-2">Topic to Study</label>
                                        <input
                                            type="text"
                                            value={createForm.topic}
                                            onChange={(e) => setCreateForm(prev => ({ ...prev, topic: e.target.value }))}
                                            placeholder="e.g., React Hooks, Machine Learning, AWS Services..."
                                            className="w-full p-4 rounded-xl bg-[#111111] border border-white/10 focus:border-cyan-500/50 text-white placeholder-silver/50 transition-colors"
                                        />
                                    </div>
                                )}

                                {/* Card count slider */}
                                <div>
                                    <label className="block text-white font-medium mb-2">
                                        Number of Cards: <span className="text-cyan-400">{createForm.cardCount}</span>
                                    </label>
                                    <input
                                        type="range"
                                        min={5}
                                        max={25}
                                        value={createForm.cardCount}
                                        onChange={(e) => setCreateForm(prev => ({ ...prev, cardCount: parseInt(e.target.value) }))}
                                        className="w-full slider-enhanced"
                                    />
                                    <div className="flex justify-between text-xs text-silver mt-1">
                                        <span>5 cards</span>
                                        <span>25 cards</span>
                                    </div>
                                </div>

                                {/* Generate button */}
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={generateCards}
                                    disabled={isLoading}
                                    className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-lg hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                >
                                    {isLoading ? (
                                        <>
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                                className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full"
                                            />
                                            Generating Cards...
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-xl">✨</span>
                                            Generate Flash Cards
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ============================================ */}
                {/* STUDY VIEW - Card Flip Interface */}
                {/* ============================================ */}
                {viewMode === 'study' && activeDeck && (
                    <motion.div
                        key="study"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="max-w-4xl mx-auto"
                    >
                        {/* Progress Bar */}
                        <div className="mb-8">
                            <div className="flex items-center justify-between text-sm text-silver mb-2">
                                <span>Card {currentCardIndex + 1} of {activeDeck.cards.length}</span>
                                <span className="flex items-center gap-2">
                                    {session.streak > 0 && (
                                        <motion.span
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="px-2 py-1 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30"
                                        >
                                            🔥 {session.streak} streak
                                        </motion.span>
                                    )}
                                    <span>{session.correctAnswers}/{session.cardsStudied} correct</span>
                                </span>
                            </div>
                            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${((currentCardIndex + 1) / activeDeck.cards.length) * 100}%` }}
                                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                />
                            </div>
                        </div>

                        {/* 3D Flip Card */}
                        <FlipCard
                            card={activeDeck.cards[currentCardIndex]}
                            isFlipped={isFlipped}
                            onFlip={() => setIsFlipped(true)}
                        />

                        {/* Rating buttons (shown after flip) */}
                        <AnimatePresence>
                            {isFlipped && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    className="mt-8"
                                >
                                    <p className="text-center text-silver mb-4">How well did you know this?</p>
                                    <div className="flex justify-center gap-4">
                                        {[
                                            { quality: 1, label: 'Again', color: 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30' },
                                            { quality: 3, label: 'Hard', color: 'bg-orange-500/20 border-orange-500/30 text-orange-400 hover:bg-orange-500/30' },
                                            { quality: 4, label: 'Good', color: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30' },
                                            { quality: 5, label: 'Easy', color: 'bg-green-500/20 border-green-500/30 text-green-400 hover:bg-green-500/30' },
                                        ].map((btn) => (
                                            <motion.button
                                                key={btn.quality}
                                                whileHover={{ scale: 1.05, y: -2 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => handleRating(btn.quality)}
                                                className={`px-8 py-3 rounded-xl border font-medium transition-colors ${btn.color}`}
                                            >
                                                {btn.label}
                                            </motion.button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}

                {/* ============================================ */}
                {/* REVIEW VIEW - Session Summary */}
                {/* ============================================ */}
                {viewMode === 'review' && activeDeck && (
                    <motion.div
                        key="review"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="max-w-4xl mx-auto"
                    >
                        {/* Celebration Card */}
                        <motion.div
                            initial={{ y: 20 }}
                            animate={{ y: 0 }}
                            className="p-12 rounded-3xl bg-[#0A0A0A] border border-white/10 relative overflow-hidden mb-8"
                        >
                            {/* Background celebration */}
                            <div className="absolute inset-0 overflow-hidden">
                                {[...Array(20)].map((_, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ y: '100%', x: Math.random() * 100 + '%', opacity: 1 }}
                                        animate={{
                                            y: '-100%',
                                            opacity: [1, 1, 0],
                                            rotate: Math.random() * 360,
                                        }}
                                        transition={{
                                            duration: 3 + Math.random() * 2,
                                            delay: Math.random() * 2,
                                            repeat: Infinity,
                                        }}
                                        className="absolute"
                                    >
                                        {['✨', '🎉', '⭐', '🎊'][Math.floor(Math.random() * 4)]}
                                    </motion.div>
                                ))}
                            </div>

                            <div className="relative text-center">
                                <motion.div
                                    animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="text-8xl mb-6"
                                >
                                    🎉
                                </motion.div>

                                <h2 className="text-3xl font-bold text-white mb-2">Session Complete!</h2>
                                <p className="text-silver mb-6">Great job studying <span className="text-cyan-400 font-semibold">{activeDeck.name}</span></p>

                                <div className="grid grid-cols-3 gap-6 mb-8 max-w-lg mx-auto">
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                        <div className="text-3xl font-bold text-cyan-400">{session.cardsStudied}</div>
                                        <div className="text-silver text-sm">Cards Studied</div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                        <div className="text-3xl font-bold text-green-400">
                                            {session.cardsStudied > 0
                                                ? Math.round((session.correctAnswers / session.cardsStudied) * 100)
                                                : 0}%
                                        </div>
                                        <div className="text-silver text-sm">Accuracy</div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                        <div className="text-3xl font-bold text-orange-400">{session.streak}</div>
                                        <div className="text-silver text-sm">Best Streak</div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Action Cards Grid */}
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                            {/* Study Again */}
                            <motion.button
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    setCurrentCardIndex(0);
                                    setIsFlipped(false);
                                    setViewMode('study');
                                    setSession({
                                        cardsStudied: 0,
                                        correctAnswers: 0,
                                        startTime: new Date(),
                                        streak: 0,
                                    });
                                }}
                                className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 hover:border-cyan-500/50 text-left transition-all group"
                            >
                                <span className="text-3xl mb-3 block">🔄</span>
                                <h3 className="text-lg font-bold text-white mb-1">Study Again</h3>
                                <p className="text-silver text-sm">Review all {activeDeck.cards.length} cards from the beginning</p>
                            </motion.button>

                            {/* Review Missed Cards */}
                            {session.cardsStudied - session.correctAnswers > 0 && (
                                <motion.button
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.15 }}
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => {
                                        // Filter cards that were marked as hard/failed (low repetitions or recent failures)
                                        const missedCards = activeDeck.cards.filter(c => c.interval <= 1);
                                        if (missedCards.length > 0) {
                                            const reviewDeck = { ...activeDeck, cards: missedCards };
                                            setActiveDeck(reviewDeck);
                                            setCurrentCardIndex(0);
                                            setIsFlipped(false);
                                            setViewMode('study');
                                            setSession({
                                                cardsStudied: 0,
                                                correctAnswers: 0,
                                                startTime: new Date(),
                                                streak: 0,
                                            });
                                            showToast(`Reviewing ${missedCards.length} cards you missed`, '📚');
                                        }
                                    }}
                                    className="p-6 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 hover:border-orange-500/50 text-left transition-all group"
                                >
                                    <span className="text-3xl mb-3 block">🎯</span>
                                    <h3 className="text-lg font-bold text-white mb-1">Review Missed</h3>
                                    <p className="text-silver text-sm">Focus on {session.cardsStudied - session.correctAnswers} cards you struggled with</p>
                                </motion.button>
                            )}

                            {/* Generate New Deck */}
                            <motion.button
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    setViewMode('home');
                                    setActiveDeck(null);
                                    setStudyMode(null);
                                }}
                                className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 text-left transition-all group"
                            >
                                <span className="text-3xl mb-3 block">✨</span>
                                <h3 className="text-lg font-bold text-white mb-1">Create New Deck</h3>
                                <p className="text-silver text-sm">Generate a fresh set of flashcards</p>
                            </motion.button>

                            {/* Add More Cards */}
                            <motion.button
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.25 }}
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={async () => {
                                    if (!activeDeck.sourceData?.jobDescription && !activeDeck.name) {
                                        showToast('Cannot add cards - no source data', '❌');
                                        return;
                                    }
                                    setIsLoading(true);
                                    try {
                                        const prompt = activeDeck.sourceData?.jobDescription
                                            ? `Generate 5 MORE unique flashcards for this job (avoid repeating these topics: ${activeDeck.cards.map(c => c.front.substring(0, 50)).join(', ')})\n\nJOB DESCRIPTION:\n${activeDeck.sourceData.jobDescription}`
                                            : `Generate 5 MORE unique flashcards about "${activeDeck.name}" (avoid repeating these topics: ${activeDeck.cards.map(c => c.front.substring(0, 50)).join(', ')})`;

                                        const systemPrompt = `You are an expert educator. Generate 5 NEW unique flashcards that don't overlap with existing ones. Return JSON: [{ "front": "question", "back": "answer", "category": "cat", "difficulty": "easy|medium|hard" }]`;

                                        const newCards = await groqJSONCompletion<Array<{
                                            front: string;
                                            back: string;
                                            category: string;
                                            difficulty: 'easy' | 'medium' | 'hard';
                                        }>>(systemPrompt, prompt, { temperature: 0.8, maxTokens: 2000 });

                                        const formattedCards: FlashCard[] = newCards.map(c => ({
                                            id: crypto.randomUUID(),
                                            front: c.front,
                                            back: c.back,
                                            category: c.category,
                                            difficulty: c.difficulty,
                                            nextReview: new Date(),
                                            interval: 1,
                                            easeFactor: 2.5,
                                            repetitions: 0,
                                        }));

                                        const updatedDeck = { ...activeDeck, cards: [...activeDeck.cards, ...formattedCards] };
                                        setActiveDeck(updatedDeck);
                                        setDecks(prev => prev.map(d => d.id === updatedDeck.id ? updatedDeck : d));
                                        showToast(`Added ${newCards.length} new cards!`, '✨');
                                    } catch (e) {
                                        showToast('Failed to generate more cards', '❌');
                                    } finally {
                                        setIsLoading(false);
                                    }
                                }}
                                disabled={isLoading}
                                className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 text-left transition-all group disabled:opacity-50"
                            >
                                <span className="text-3xl mb-3 block">{isLoading ? '⏳' : '➕'}</span>
                                <h3 className="text-lg font-bold text-white mb-1">Add More Cards</h3>
                                <p className="text-silver text-sm">Generate 5 additional cards for this deck</p>
                            </motion.button>

                            {/* Export Deck */}
                            <motion.button
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    const exportData = {
                                        name: activeDeck.name,
                                        description: activeDeck.description,
                                        cards: activeDeck.cards.map(c => ({
                                            front: c.front,
                                            back: c.back,
                                            category: c.category,
                                            difficulty: c.difficulty,
                                        })),
                                        exportedAt: new Date().toISOString(),
                                    };
                                    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${activeDeck.name.replace(/\s+/g, '_')}_flashcards.json`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                    showToast('Deck exported!', '📥');
                                }}
                                className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 text-left transition-all group"
                            >
                                <span className="text-3xl mb-3 block">📥</span>
                                <h3 className="text-lg font-bold text-white mb-1">Export Deck</h3>
                                <p className="text-silver text-sm">Download as JSON file</p>
                            </motion.button>

                            {/* Back to All Decks */}
                            <motion.button
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.35 }}
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    setViewMode('home');
                                    setActiveDeck(null);
                                }}
                                className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 text-left transition-all group"
                            >
                                <span className="text-3xl mb-3 block">📚</span>
                                <h3 className="text-lg font-bold text-white mb-1">All Decks</h3>
                                <p className="text-silver text-sm">Return to your deck library</p>
                            </motion.button>
                        </div>

                        {/* Deck Info Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="p-6 rounded-2xl bg-[#0A0A0A] border border-white/10"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-white">Deck Details</h3>
                                <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs border border-cyan-500/30">
                                    {activeDeck.cards.length} cards
                                </span>
                            </div>
                            <div className="grid md:grid-cols-3 gap-4 text-sm">
                                <div>
                                    <span className="text-silver">Created</span>
                                    <p className="text-white font-medium">{new Date(activeDeck.createdAt).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <span className="text-silver">Source</span>
                                    <p className="text-white font-medium capitalize">{activeDeck.source === 'ai' ? '🤖 AI Generated' : '✏️ Manual'}</p>
                                </div>
                                <div>
                                    <span className="text-silver">Mastery</span>
                                    <p className="text-white font-medium">
                                        {Math.round((activeDeck.cards.filter(c => c.repetitions > 0).length / activeDeck.cards.length) * 100)}%
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ============================================
// FLIP CARD COMPONENT (Clean Flip Animation)
// ============================================
function FlipCard({
    card,
    isFlipped,
    onFlip,
}: {
    card: FlashCard;
    isFlipped: boolean;
    onFlip: () => void;
}) {
    return (
        <div
            className="cursor-pointer"
            style={{ perspective: '1000px' }}
            onClick={() => !isFlipped && onFlip()}
        >
            <motion.div
                style={{ transformStyle: 'preserve-3d' }}
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, type: 'spring', stiffness: 100, damping: 20 }}
                className="relative w-full aspect-[4/3] md:aspect-[16/9]"
            >
                {/* Front of card */}
                <motion.div
                    className="absolute inset-0 rounded-3xl p-8 md:p-12 flex flex-col items-center justify-center bg-gradient-to-br from-[#0A0A0A] to-[#111111] border border-white/10 shadow-2xl"
                    style={{ backfaceVisibility: 'hidden' }}
                    whileHover={{ scale: 1.01, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}
                    transition={{ duration: 0.2 }}
                >
                    {/* Decorative elements */}
                    <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-medium">
                        {card.category}
                    </div>
                    <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-silver text-xs">
                        {card.difficulty}
                    </div>

                    {/* Glow effect */}
                    <div className="absolute inset-0 rounded-3xl opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-br from-cyan-500/5 to-blue-500/5" />

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-2xl md:text-3xl font-bold text-white text-center max-w-2xl"
                    >
                        {card.front}
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="absolute bottom-6 text-silver text-sm flex items-center gap-2"
                    >
                        <span>Tap to reveal</span>
                        <motion.span
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                        >
                            👆
                        </motion.span>
                    </motion.div>
                </motion.div>

                {/* Back of card */}
                <motion.div
                    className="absolute inset-0 rounded-3xl p-8 md:p-12 flex flex-col items-center justify-center bg-gradient-to-br from-[#111111] to-[#0A0A0A] border border-cyan-500/20 shadow-2xl"
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                    {/* Decorative glow */}
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/5 to-blue-500/5" />

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: isFlipped ? 1 : 0, y: isFlipped ? 0 : 10 }}
                        transition={{ delay: 0.3 }}
                        className="text-xl md:text-2xl text-white text-center max-w-2xl leading-relaxed"
                    >
                        {card.back}
                    </motion.div>
                </motion.div>
            </motion.div>
        </div>
    );
}


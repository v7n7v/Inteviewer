'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { authFetch } from '@/lib/auth-fetch';
import { useTheme } from '@/components/ThemeProvider';
import { showToast } from '@/components/Toast';
import PageHelp from '@/components/PageHelp';
import ProGate from '@/components/ProGate';
import {
  saveStudyProgress,
  markDayComplete,
  unmarkDayComplete,
  markCourseComplete,
  markCourseIncomplete,
  getAllStudyProgress,
  toggleEmailReminders,
  type StudyProgress,
} from '@/lib/database-suite';

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════
interface StudyDay {
  day: number;
  focus: string;
  tasks: string[];
  resources: { title: string; url: string; type: 'video' | 'article' | 'practice' | 'project' }[];
  timeEstimate: string;
}

interface StudyPlan {
  schedule: StudyDay[];
  summary: string;
  interviewTips: string[];
}

interface SkillGap {
  skill: string;
  confidence: 'ai-added' | 'weak' | 'strong';
  category: 'technical' | 'soft' | 'domain';
  resources: LearningResource[];
}

interface LearningResource {
  title: string;
  platform: string;
  icon: string;
  url: string;
  duration: string;
  free: boolean;
}

// ═══════════════════════════════════════
// RESOURCE DATABASE
// ═══════════════════════════════════════
const RESOURCE_DATABASE: Record<string, LearningResource[]> = {
  'React': [
    { title: 'React Full Course 2025', platform: 'YouTube', icon: 'smart_display', url: 'https://youtube.com/results?search_query=react+full+course+2025', duration: '6h', free: true },
    { title: 'React Documentation', platform: 'React.dev', icon: 'menu_book', url: 'https://react.dev/learn', duration: 'Self-paced', free: true },
    { title: 'React Basics', platform: 'freeCodeCamp', icon: 'architecture', url: 'https://www.freecodecamp.org/learn/front-end-development-libraries/#react', duration: '10h', free: true },
  ],
  'TypeScript': [
    { title: 'TypeScript for Beginners', platform: 'YouTube', icon: 'smart_display', url: 'https://youtube.com/results?search_query=typescript+full+course', duration: '3h', free: true },
    { title: 'TypeScript Handbook', platform: 'TypeScript', icon: 'menu_book', url: 'https://www.typescriptlang.org/docs/handbook/', duration: 'Self-paced', free: true },
    { title: 'Execute Program', platform: 'Execute Program', icon: 'computer', url: 'https://www.executeprogram.com/courses/typescript', duration: '8h', free: false },
  ],
  'Next.js': [
    { title: 'Next.js 15 Full Course', platform: 'YouTube', icon: 'smart_display', url: 'https://youtube.com/results?search_query=next.js+full+course+2025', duration: '8h', free: true },
    { title: 'Learn Next.js', platform: 'Vercel', icon: '▲', url: 'https://nextjs.org/learn', duration: '12h', free: true },
  ],
  'Node.js': [
    { title: 'Node.js Complete Guide', platform: 'YouTube', icon: 'smart_display', url: 'https://youtube.com/results?search_query=node.js+complete+guide', duration: '8h', free: true },
    { title: 'Introduction to Node.js', platform: 'Node.dev', icon: 'menu_book', url: 'https://nodejs.org/en/learn/getting-started/introduction-to-nodejs', duration: 'Self-paced', free: true },
  ],
  'Python': [
    { title: 'Python for Everybody', platform: 'Coursera', icon: 'school', url: 'https://www.coursera.org/specializations/python', duration: '8mo', free: true },
    { title: 'Automate the Boring Stuff', platform: 'YouTube', icon: 'smart_display', url: 'https://youtube.com/results?search_query=automate+the+boring+stuff+python', duration: '10h', free: true },
    { title: 'Python Certification', platform: 'freeCodeCamp', icon: 'architecture', url: 'https://www.freecodecamp.org/learn/scientific-computing-with-python/', duration: '40h', free: true },
  ],
  'AWS': [
    { title: 'AWS Cloud Practitioner', platform: 'AWS Skill Builder', icon: 'cloud', url: 'https://skillbuilder.aws/exam-prep/cloud-practitioner', duration: '12h', free: true },
    { title: 'AWS Certified Solutions Architect', platform: 'YouTube', icon: 'smart_display', url: 'https://youtube.com/results?search_query=aws+solutions+architect+2025', duration: '15h', free: true },
    { title: 'AWS re/Start', platform: 'Amazon', icon: 'inventory_2', url: 'https://aws.amazon.com/training/restart/', duration: '12wk', free: true },
  ],
  'Docker': [
    { title: 'Docker in 2 Hours', platform: 'YouTube', icon: 'smart_display', url: 'https://youtube.com/results?search_query=docker+full+course', duration: '2h', free: true },
    { title: 'Docker Get Started', platform: 'Docker', icon: '🐳', url: 'https://docs.docker.com/get-started/', duration: '3h', free: true },
  ],
  'Kubernetes': [
    { title: 'Kubernetes Course', platform: 'YouTube (KodeKloud)', icon: 'smart_display', url: 'https://youtube.com/results?search_query=kubernetes+full+course+kodekloud', duration: '6h', free: true },
    { title: 'EKS Workshop', platform: 'AWS', icon: 'cloud', url: 'https://www.eksworkshop.com/', duration: '8h', free: true },
    { title: 'Kubernetes Basics', platform: 'Google Cloud', icon: 'school', url: 'https://cloud.google.com/kubernetes-engine/docs/tutorials', duration: '4h', free: true },
  ],
  'SQL': [
    { title: 'SQL Full Course', platform: 'YouTube', icon: 'smart_display', url: 'https://youtube.com/results?search_query=sql+full+course+2025', duration: '4h', free: true },
    { title: 'SQL Course', platform: 'freeCodeCamp', icon: 'architecture', url: 'https://www.freecodecamp.org/learn/relational-database/', duration: '20h', free: true },
    { title: 'SQLBolt Interactive', platform: 'SQLBolt', icon: 'bolt', url: 'https://sqlbolt.com/', duration: '2h', free: true },
  ],
  'GraphQL': [
    { title: 'GraphQL Full Course', platform: 'YouTube', icon: 'smart_display', url: 'https://youtube.com/results?search_query=graphql+full+course', duration: '4h', free: true },
    { title: 'How to GraphQL', platform: 'Prisma', icon: 'menu_book', url: 'https://www.howtographql.com/', duration: '6h', free: true },
  ],
  'CI/CD': [
    { title: 'GitHub Actions Tutorial', platform: 'YouTube', icon: 'smart_display', url: 'https://youtube.com/results?search_query=github+actions+complete+guide', duration: '3h', free: true },
    { title: 'CI/CD with GitHub Actions', platform: 'GitHub', icon: '🐙', url: 'https://docs.github.com/en/actions/learn-github-actions', duration: '4h', free: true },
  ],
  'Machine Learning': [
    { title: 'Machine Learning Crash Course', platform: 'Google', icon: 'school', url: 'https://developers.google.com/machine-learning/crash-course', duration: '15h', free: true },
    { title: 'Practical Deep Learning', platform: 'fast.ai', icon: 'psychology', url: 'https://course.fast.ai/', duration: '40h', free: true },
    { title: 'ML Specialization', platform: 'Coursera', icon: 'school', url: 'https://www.coursera.org/specializations/machine-learning-introduction', duration: '3mo', free: true },
  ],
  'Data Analysis': [
    { title: 'Google Data Analytics', platform: 'Coursera', icon: 'school', url: 'https://www.coursera.org/professional-certificates/google-data-analytics', duration: '6mo', free: true },
    { title: 'Data Analysis with Python', platform: 'freeCodeCamp', icon: 'architecture', url: 'https://www.freecodecamp.org/learn/data-analysis-with-python/', duration: '20h', free: true },
  ],
  'Leadership': [
    { title: 'Leadership & Management', platform: 'LinkedIn Learning', icon: 'work', url: 'https://www.linkedin.com/learning/topics/leadership-and-management', duration: '4h', free: false },
    { title: 'Team Leadership', platform: 'Coursera', icon: 'school', url: 'https://www.coursera.org/learn/leading-teams', duration: '8h', free: true },
  ],
  'Agile': [
    { title: 'Agile with Atlassian Jira', platform: 'Coursera', icon: 'school', url: 'https://www.coursera.org/learn/agile-atlassian-jira', duration: '4h', free: true },
    { title: 'Scrum Master Certification Prep', platform: 'YouTube', icon: 'smart_display', url: 'https://youtube.com/results?search_query=scrum+master+certification+prep', duration: '3h', free: true },
  ],
  'Project Management': [
    { title: 'Google Project Management', platform: 'Coursera', icon: 'school', url: 'https://www.coursera.org/professional-certificates/google-project-management', duration: '6mo', free: true },
    { title: 'PMP Exam Prep', platform: 'YouTube', icon: 'smart_display', url: 'https://youtube.com/results?search_query=pmp+exam+prep+2025', duration: '8h', free: true },
  ],
};

function getDefaultResources(skill: string): LearningResource[] {
  return [
    { title: `${skill} Complete Guide`, platform: 'YouTube', icon: 'smart_display', url: `https://youtube.com/results?search_query=${encodeURIComponent(skill)}+tutorial+2025`, duration: 'Varies', free: true },
    { title: `Learn ${skill}`, platform: 'Google', icon: 'school', url: `https://www.google.com/search?q=learn+${encodeURIComponent(skill)}+free+course`, duration: 'Self-paced', free: true },
    { title: `${skill} Training`, platform: 'LinkedIn Learning', icon: 'work', url: `https://www.linkedin.com/learning/search?keywords=${encodeURIComponent(skill)}`, duration: 'Varies', free: false },
  ];
}

const SAMPLE_GAPS: SkillGap[] = [
  { skill: 'Kubernetes', confidence: 'ai-added', category: 'technical', resources: RESOURCE_DATABASE['Kubernetes'] || getDefaultResources('Kubernetes') },
  { skill: 'CI/CD', confidence: 'ai-added', category: 'technical', resources: RESOURCE_DATABASE['CI/CD'] || getDefaultResources('CI/CD') },
  { skill: 'GraphQL', confidence: 'weak', category: 'technical', resources: RESOURCE_DATABASE['GraphQL'] || getDefaultResources('GraphQL') },
  { skill: 'AWS', confidence: 'weak', category: 'technical', resources: RESOURCE_DATABASE['AWS'] || getDefaultResources('AWS') },
  { skill: 'Leadership', confidence: 'weak', category: 'soft', resources: RESOURCE_DATABASE['Leadership'] || getDefaultResources('Leadership') },
];

// ═══════════════════════════════════════
// SKILL COMPLEXITY → COMPRESSED TRAINING DAYS
// Optimized for job seekers — shortest effective prep
// ═══════════════════════════════════════
const SKILL_COMPLEXITY: Record<string, number> = {
  // Quick wins — 2 days (tool adoption)
  'Docker': 2, 'Git': 2, 'SQL': 2, 'SQLBolt': 2, 'Bash': 2, 'Linux': 2,
  'REST API': 2, 'JSON': 2, 'Markdown': 2, 'npm': 2, 'Webpack': 2, 'Vite': 2,
  // Standard — 4 days (framework/platform proficiency)
  'React': 4, 'TypeScript': 4, 'Next.js': 4, 'Node.js': 4, 'Python': 4,
  'GraphQL': 4, 'CI/CD': 4, 'Kubernetes': 4, 'PostgreSQL': 4, 'MongoDB': 4,
  'Vue': 4, 'Angular': 4, 'Svelte': 4, 'Express': 4, 'Django': 4, 'Flask': 4,
  'Go': 4, 'Rust': 4, 'Java': 4, 'C#': 4, 'C++': 4, 'Swift': 4, 'Kotlin': 4,
  'Redis': 4, 'Firebase': 4, 'Terraform': 4, 'Ansible': 4,
  // Deep dives — 5 days (cloud/ML/architecture)
  'AWS': 5, 'Azure': 5, 'GCP': 5, 'Machine Learning': 5, 'Deep Learning': 5,
  'Data Science': 5, 'Data Analysis': 5, 'System Design': 5,
  'Distributed Systems': 5, 'Security': 5, 'Cybersecurity': 5,
  'DevOps': 5, 'MLOps': 5, 'Data Engineering': 5,
  // Soft skills — 3 days (behavioral prep)
  'Leadership': 3, 'Agile': 3, 'Project Management': 3, 'Communication': 3,
  'Teamwork': 3, 'Problem Solving': 3, 'Critical Thinking': 3,
  'Time Management': 3, 'Presentation': 3, 'Negotiation': 3,
  'Stakeholder Management': 3, 'Mentorship': 3,
};

function getTrainingDays(skill: string, category: 'technical' | 'soft' | 'domain'): number {
  if (SKILL_COMPLEXITY[skill]) return SKILL_COMPLEXITY[skill];
  if (category === 'soft') return 3;
  if (category === 'domain') return 5;
  return 4;
}

// Duration options: fractional = hours (stored as day fraction), integer = days
// 0.08 ≈ 2h, 0.17 ≈ 4h, 0.33 ≈ 8h
interface DurationOption {
  value: number;     // planDays state value
  label: string;     // Button label
  fullLabel: string; // Card/header display
  icon: string;
  isHours: boolean;
  hours?: number;    // For hour-based durations
}

const DURATION_OPTIONS: DurationOption[] = [
  { value: 0.08, label: '2h',  fullLabel: '2-Hour Recap',    icon: 'bolt',           isHours: true, hours: 2 },
  { value: 0.17, label: '4h',  fullLabel: '4-Hour Sprint',   icon: 'bolt',           isHours: true, hours: 4 },
  { value: 0.33, label: '8h',  fullLabel: '8-Hour Crash Course', icon: 'speed',       isHours: true, hours: 8 },
  { value: 1,    label: '1d',  fullLabel: '1-Day Focus',     icon: 'today',          isHours: false },
  { value: 2,    label: '2d',  fullLabel: '2-Day Sprint',    icon: 'bolt',           isHours: false },
  { value: 3,    label: '3d',  fullLabel: '3-Day Focus',     icon: 'my_location',    isHours: false },
  { value: 5,    label: '5d',  fullLabel: '5-Day Deep Dive', icon: 'science',        isHours: false },
  { value: 7,    label: '7d',  fullLabel: '7-Day Mastery',   icon: 'workspace_premium', isHours: false },
];

function getDurationInfo(planDays: number): { label: string; fullLabel: string; icon: string; isHours: boolean; hours?: number } {
  const opt = DURATION_OPTIONS.find(o => o.value === planDays);
  if (opt) return opt;
  // Fallback for legacy integer values
  return { label: `${planDays}d`, fullLabel: `${planDays}-Day Plan`, icon: 'calendar_month', isHours: false };
}

// Legacy compat: still used by SkillCard for display
const DURATION_LABELS: Record<number, { label: string; icon: string }> = {};
DURATION_OPTIONS.forEach(o => {
  DURATION_LABELS[o.value] = { label: o.fullLabel, icon: o.icon };
});

// ═══════════════════════════════════════
// CURATED STUDY PLANS (per-day with platforms)
// ═══════════════════════════════════════
interface DayPlan {
  day: number;
  focus: string;
  hours: number;
  platform: string;
  platformIcon: string;
  resource: string;
  url: string;
}

const CURATED_PLANS: Record<string, DayPlan[]> = {
  'Kubernetes': [
    { day: 1, focus: 'Core Concepts: Pods, Nodes, Clusters', hours: 2, platform: 'YouTube', platformIcon: 'smart_display', resource: 'Kubernetes Crash Course', url: 'https://youtube.com/results?search_query=kubernetes+crash+course+2025' },
    { day: 2, focus: 'Deployments, Services & Networking', hours: 2.5, platform: 'KodeKloud', platformIcon: 'computer', resource: 'Kubernetes for Beginners', url: 'https://kodekloud.com/courses/kubernetes-for-the-absolute-beginners/' },
    { day: 3, focus: 'Helm, ConfigMaps & Secrets', hours: 2, platform: 'Official Docs', platformIcon: 'menu_book', resource: 'Kubernetes Documentation', url: 'https://kubernetes.io/docs/tutorials/' },
    { day: 4, focus: 'Practice: Deploy a full app on Minikube', hours: 3, platform: 'Hands-on Lab', platformIcon: 'build', resource: 'Killercoda Interactive', url: 'https://killercoda.com/playgrounds/scenario/kubernetes' },
  ],
  'CI/CD': [
    { day: 1, focus: 'CI/CD Concepts + GitHub Actions Basics', hours: 1.5, platform: 'YouTube', platformIcon: 'smart_display', resource: 'GitHub Actions Tutorial', url: 'https://youtube.com/results?search_query=github+actions+complete+guide+2025' },
    { day: 2, focus: 'Build Pipelines: Test, Lint, Deploy', hours: 2, platform: 'GitHub Docs', platformIcon: 'hub', resource: 'GitHub Actions Docs', url: 'https://docs.github.com/en/actions/learn-github-actions' },
    { day: 3, focus: 'Docker + CI/CD Integration', hours: 2, platform: 'LinkedIn Learning', platformIcon: 'work', resource: 'Learning CI/CD', url: 'https://www.linkedin.com/learning/search?keywords=ci+cd' },
    { day: 4, focus: 'Practice: Build real pipeline for a project', hours: 2.5, platform: 'Hands-on Lab', platformIcon: 'build', resource: 'Build Your Own Pipeline', url: 'https://github.com/skills/continuous-integration' },
  ],
  'GraphQL': [
    { day: 1, focus: 'GraphQL vs REST, Schemas & Types', hours: 1.5, platform: 'YouTube', platformIcon: 'smart_display', resource: 'GraphQL Crash Course', url: 'https://youtube.com/results?search_query=graphql+crash+course+2025' },
    { day: 2, focus: 'Queries, Mutations & Resolvers', hours: 2, platform: 'How to GraphQL', platformIcon: 'menu_book', resource: 'Interactive Tutorial', url: 'https://www.howtographql.com/' },
    { day: 3, focus: 'Apollo Client + React Integration', hours: 2, platform: 'Apollo Docs', platformIcon: 'rocket_launch', resource: 'Apollo Full Stack Tutorial', url: 'https://www.apollographql.com/tutorials/' },
    { day: 4, focus: 'Practice: Build a GraphQL API', hours: 2.5, platform: 'Hands-on Lab', platformIcon: 'build', resource: 'Build GraphQL Server', url: 'https://graphql.org/learn/' },
  ],
  'AWS': [
    { day: 1, focus: 'Cloud Fundamentals: EC2, S3, IAM', hours: 2, platform: 'YouTube', platformIcon: 'smart_display', resource: 'AWS Cloud Practitioner', url: 'https://youtube.com/results?search_query=aws+cloud+practitioner+2025' },
    { day: 2, focus: 'Serverless: Lambda, API Gateway, DynamoDB', hours: 2.5, platform: 'AWS Skill Builder', platformIcon: 'cloud', resource: 'AWS Skill Builder', url: 'https://skillbuilder.aws/' },
    { day: 3, focus: 'Networking: VPC, Route53, CloudFront', hours: 2, platform: 'LinkedIn Learning', platformIcon: 'work', resource: 'AWS Essential Training', url: 'https://www.linkedin.com/learning/search?keywords=aws' },
    { day: 4, focus: 'CI/CD on AWS: CodePipeline & CloudFormation', hours: 2, platform: 'Official Docs', platformIcon: 'menu_book', resource: 'AWS Well-Architected', url: 'https://aws.amazon.com/architecture/well-architected/' },
    { day: 5, focus: 'Practice: Deploy full-stack app on AWS', hours: 3, platform: 'Hands-on Lab', platformIcon: 'build', resource: 'AWS Free Tier Labs', url: 'https://aws.amazon.com/free/' },
  ],
  'Leadership': [
    { day: 1, focus: 'Leadership Styles & Self-Assessment', hours: 1.5, platform: 'LinkedIn Learning', platformIcon: 'work', resource: 'Leadership Foundations', url: 'https://www.linkedin.com/learning/topics/leadership-and-management' },
    { day: 2, focus: 'Team Dynamics & Conflict Resolution', hours: 1.5, platform: 'Coursera', platformIcon: 'school', resource: 'Leading Teams', url: 'https://www.coursera.org/learn/leading-teams' },
    { day: 3, focus: 'STAR Method: Behavioral Interview Prep', hours: 2, platform: 'YouTube', platformIcon: 'smart_display', resource: 'Leadership Interview Answers', url: 'https://youtube.com/results?search_query=leadership+behavioral+interview+STAR+method' },
  ],
  'Docker': [
    { day: 1, focus: 'Containers, Images & Dockerfile', hours: 1.5, platform: 'YouTube', platformIcon: 'smart_display', resource: 'Docker in 100 Seconds + Tutorial', url: 'https://youtube.com/results?search_query=docker+tutorial+beginners+2025' },
    { day: 2, focus: 'Docker Compose + Practice Build', hours: 2, platform: 'Official Docs', platformIcon: 'deployed_code', resource: 'Docker Get Started', url: 'https://docs.docker.com/get-started/' },
  ],
  'SQL': [
    { day: 1, focus: 'SELECT, JOINs, WHERE, GROUP BY', hours: 1.5, platform: 'SQLBolt', platformIcon: 'bolt', resource: 'SQLBolt Interactive', url: 'https://sqlbolt.com/' },
    { day: 2, focus: 'Subqueries, Window Functions & Practice', hours: 2, platform: 'YouTube', platformIcon: 'smart_display', resource: 'Advanced SQL', url: 'https://youtube.com/results?search_query=advanced+sql+interview+prep' },
  ],
  'React': [
    { day: 1, focus: 'Components, JSX, Props & State', hours: 2, platform: 'React.dev', platformIcon: 'menu_book', resource: 'Official React Tutorial', url: 'https://react.dev/learn' },
    { day: 2, focus: 'Hooks: useState, useEffect, useContext', hours: 2, platform: 'YouTube', platformIcon: 'smart_display', resource: 'React Hooks Course', url: 'https://youtube.com/results?search_query=react+hooks+complete+2025' },
    { day: 3, focus: 'State Management & Performance', hours: 2, platform: 'freeCodeCamp', platformIcon: 'architecture', resource: 'React & Redux', url: 'https://www.freecodecamp.org/learn/front-end-development-libraries/#react' },
    { day: 4, focus: 'Practice: Build a mini project', hours: 2.5, platform: 'Hands-on Lab', platformIcon: 'build', resource: 'Build with React', url: 'https://react.dev/learn/tutorial-tic-tac-toe' },
  ],
  'TypeScript': [
    { day: 1, focus: 'Types, Interfaces & Generics', hours: 1.5, platform: 'TypeScript Docs', platformIcon: 'menu_book', resource: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs/handbook/' },
    { day: 2, focus: 'Utility Types & Advanced Patterns', hours: 2, platform: 'YouTube', platformIcon: 'smart_display', resource: 'TypeScript Full Course', url: 'https://youtube.com/results?search_query=typescript+full+course+2025' },
    { day: 3, focus: 'TS + React: Typing Components', hours: 2, platform: 'Execute Program', platformIcon: 'computer', resource: 'TypeScript Exercises', url: 'https://www.typescriptlang.org/play' },
    { day: 4, focus: 'Practice: Refactor JS to TS', hours: 2, platform: 'Hands-on Lab', platformIcon: 'build', resource: 'Type Challenges', url: 'https://github.com/type-challenges/type-challenges' },
  ],
  'Python': [
    { day: 1, focus: 'Syntax, Data Structures & Functions', hours: 2, platform: 'YouTube', platformIcon: 'smart_display', resource: 'Python Crash Course', url: 'https://youtube.com/results?search_query=python+crash+course+2025' },
    { day: 2, focus: 'OOP, File I/O & Modules', hours: 2, platform: 'freeCodeCamp', platformIcon: 'architecture', resource: 'Scientific Python', url: 'https://www.freecodecamp.org/learn/scientific-computing-with-python/' },
    { day: 3, focus: 'Libraries: NumPy, Pandas basics', hours: 2, platform: 'Coursera', platformIcon: 'school', resource: 'Python for Data Science', url: 'https://www.coursera.org/specializations/python' },
    { day: 4, focus: 'Practice: Solve 10 LeetCode problems', hours: 2.5, platform: 'LeetCode', platformIcon: 'extension', resource: 'Python Problems', url: 'https://leetcode.com/problemset/?topicSlugs=array&difficulty=EASY' },
  ],
  'Node.js': [
    { day: 1, focus: 'Event Loop, Modules & async/await', hours: 2, platform: 'YouTube', platformIcon: 'smart_display', resource: 'Node.js Crash Course', url: 'https://youtube.com/results?search_query=node.js+crash+course+2025' },
    { day: 2, focus: 'Express.js: Routes, Middleware, REST', hours: 2, platform: 'Official Docs', platformIcon: 'menu_book', resource: 'Node.js Learn', url: 'https://nodejs.org/en/learn' },
    { day: 3, focus: 'Database Integration + Auth', hours: 2.5, platform: 'LinkedIn Learning', platformIcon: 'work', resource: 'Node.js Essential Training', url: 'https://www.linkedin.com/learning/search?keywords=node.js' },
    { day: 4, focus: 'Practice: Build a REST API', hours: 3, platform: 'Hands-on Lab', platformIcon: 'build', resource: 'Express Tutorial', url: 'https://expressjs.com/en/starter/installing.html' },
  ],
  'Next.js': [
    { day: 1, focus: 'App Router, Server Components, Routing', hours: 2, platform: 'Vercel', platformIcon: 'cloud_upload', resource: 'Learn Next.js', url: 'https://nextjs.org/learn' },
    { day: 2, focus: 'Data Fetching, Caching & APIs', hours: 2, platform: 'YouTube', platformIcon: 'smart_display', resource: 'Next.js Full Course', url: 'https://youtube.com/results?search_query=next.js+15+full+course' },
    { day: 3, focus: 'Auth, Middleware & Deployment', hours: 2, platform: 'Official Docs', platformIcon: 'menu_book', resource: 'Next.js Documentation', url: 'https://nextjs.org/docs' },
    { day: 4, focus: 'Practice: Build & deploy a full app', hours: 3, platform: 'Hands-on Lab', platformIcon: 'build', resource: 'Vercel Deploy', url: 'https://vercel.com/new' },
  ],
  'Machine Learning': [
    { day: 1, focus: 'ML Fundamentals: Regression & Classification', hours: 2, platform: 'Google', platformIcon: 'school', resource: 'ML Crash Course', url: 'https://developers.google.com/machine-learning/crash-course' },
    { day: 2, focus: 'Scikit-learn: Models & Evaluation', hours: 2.5, platform: 'YouTube', platformIcon: 'smart_display', resource: 'Scikit-learn Tutorial', url: 'https://youtube.com/results?search_query=scikit+learn+full+tutorial' },
    { day: 3, focus: 'Neural Networks & Deep Learning Intro', hours: 2.5, platform: 'fast.ai', platformIcon: 'psychology', resource: 'Practical Deep Learning', url: 'https://course.fast.ai/' },
    { day: 4, focus: 'NLP & Computer Vision Basics', hours: 2, platform: 'Coursera', platformIcon: 'school', resource: 'ML Specialization', url: 'https://www.coursera.org/specializations/machine-learning-introduction' },
    { day: 5, focus: 'Practice: Train & evaluate a model', hours: 3, platform: 'Kaggle', platformIcon: 'bar_chart', resource: 'Kaggle Competitions', url: 'https://www.kaggle.com/competitions' },
  ],
  'Agile': [
    { day: 1, focus: 'Agile Manifesto, Scrum Framework', hours: 1.5, platform: 'YouTube', platformIcon: 'smart_display', resource: 'Agile in 10 Minutes', url: 'https://youtube.com/results?search_query=agile+scrum+explained' },
    { day: 2, focus: 'Sprint Planning, Standups, Retros', hours: 1.5, platform: 'Coursera', platformIcon: 'school', resource: 'Agile with Jira', url: 'https://www.coursera.org/learn/agile-atlassian-jira' },
    { day: 3, focus: 'Kanban + Interview Scenario Prep', hours: 2, platform: 'LinkedIn Learning', platformIcon: 'work', resource: 'Agile Teams', url: 'https://www.linkedin.com/learning/search?keywords=agile' },
  ],
  'Project Management': [
    { day: 1, focus: 'PM Methodologies & Stakeholder Mgmt', hours: 2, platform: 'Coursera', platformIcon: 'school', resource: 'Google Project Mgmt', url: 'https://www.coursera.org/professional-certificates/google-project-management' },
    { day: 2, focus: 'Risk Assessment & Communication', hours: 1.5, platform: 'YouTube', platformIcon: 'smart_display', resource: 'PM Interview Prep', url: 'https://youtube.com/results?search_query=project+management+interview+prep' },
    { day: 3, focus: 'Tools + STAR method for PM interviews', hours: 2, platform: 'LinkedIn Learning', platformIcon: 'work', resource: 'PM Professional', url: 'https://www.linkedin.com/learning/search?keywords=project+management' },
  ],
};

function getCuratedPlan(skill: string, totalDays: number): DayPlan[] {
  if (CURATED_PLANS[skill]) return CURATED_PLANS[skill];
  // Fallback: generate a generic plan
  const platforms = [
    { platform: 'YouTube', icon: 'smart_display', url: `https://youtube.com/results?search_query=${encodeURIComponent(skill)}+tutorial+2025` },
    { platform: 'LinkedIn Learning', icon: 'work', url: `https://www.linkedin.com/learning/search?keywords=${encodeURIComponent(skill)}` },
    { platform: 'Coursera', icon: 'school', url: `https://www.coursera.org/search?query=${encodeURIComponent(skill)}` },
    { platform: 'freeCodeCamp', icon: 'architecture', url: 'https://www.freecodecamp.org/' },
    { platform: 'Hands-on Lab', icon: 'build', url: `https://www.google.com/search?q=${encodeURIComponent(skill)}+hands+on+practice` },
  ];
  const focuses = ['Core Concepts & Fundamentals', 'Intermediate Patterns', 'Advanced Techniques', 'Real-world Practice', 'Interview Prep & Review'];
  return Array.from({ length: totalDays }, (_, i) => ({
    day: i + 1,
    focus: focuses[i % focuses.length],
    hours: i === totalDays - 1 ? 2.5 : 2,
    platform: platforms[i % platforms.length].platform,
    platformIcon: platforms[i % platforms.length].icon,
    resource: `${skill} — ${focuses[i % focuses.length]}`,
    url: platforms[i % platforms.length].url,
  }));
}

// ═══════════════════════════════════════
// CATEGORY COLOR MAP
// ═══════════════════════════════════════
const CATEGORY_COLORS = {
  technical: {
    accent: 'from-teal-400 to-cyan-500',
    accentSolid: '#06b6d4',
    ring: '#06b6d4',
    ringTrailDark: 'rgba(6, 182, 212, 0.12)',
    ringTrailLight: 'rgba(6, 182, 212, 0.22)',
    badgeDark: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    badgeLight: 'bg-teal-100 text-teal-900 border-teal-400',
    bgDark: 'border-l-teal-500/60',
    bgLight: 'border-l-teal-600',
  },
  soft: {
    accent: 'from-amber-400 to-orange-500',
    accentSolid: '#f59e0b',
    ring: '#f59e0b',
    ringTrailDark: 'rgba(245, 158, 11, 0.12)',
    ringTrailLight: 'rgba(245, 158, 11, 0.22)',
    badgeDark: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    badgeLight: 'bg-amber-100 text-amber-900 border-amber-400',
    bgDark: 'border-l-amber-500/60',
    bgLight: 'border-l-amber-600',
  },
  domain: {
    accent: 'from-blue-400 to-indigo-500',
    accentSolid: '#3b82f6',
    ring: '#3b82f6',
    ringTrailDark: 'rgba(59, 130, 246, 0.12)',
    ringTrailLight: 'rgba(59, 130, 246, 0.22)',
    badgeDark: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    badgeLight: 'bg-blue-100 text-blue-900 border-blue-400',
    bgDark: 'border-l-blue-500/60',
    bgLight: 'border-l-blue-600',
  },
};

// ═══════════════════════════════════════
// SVG PROGRESS RING
// ═══════════════════════════════════════
function ProgressRing({ progress, size = 64, strokeWidth = 5, color, trailColor }: {
  progress: number; size?: number; strokeWidth?: number; color: string; trailColor: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trailColor} strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold" style={{ color }}>{Math.round(progress)}%</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// SKILL CARD (New Grid Design)
// ═══════════════════════════════════════
// ═══════════════════════════════════════
// SKILL CARD (New Grid Design)
// ═══════════════════════════════════════
function SkillCard({ gap, completedDays, totalDays, onDayToggle, onCourseToggle, onDismiss, onPractice, onGeneratePlan, planData, loadingPlan, isLight, isEssential, onExportVault, exportingVault }: {
  gap: SkillGap;
  completedDays: number[];
  totalDays: number;
  onDayToggle: (skill: string, day: number, completed: boolean) => void;
  onCourseToggle: (skill: string, complete: boolean) => void;
  onDismiss: (skill: string) => void;
  onPractice: (skill: string) => void;
  onGeneratePlan: (skill: string) => void;
  planData: any;
  loadingPlan: boolean;
  isLight: boolean;
  isEssential: boolean;
  onExportVault: (skill: string) => void;
  exportingVault: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);
  const colors = CATEGORY_COLORS[gap.category];
  const daysCompleted = completedDays.length;
  const progress = Math.round((daysCompleted / totalDays) * 100);
  const isComplete = daysCompleted >= totalDays;
  const durationInfo = DURATION_LABELS[totalDays] || { label: `${totalDays}-Day Plan`, icon: 'calendar_month' };
  const confidenceConfig = {
    'ai-added': { label: 'AI-Enhanced', icon: 'bolt' },
    'weak': { label: 'Needs Work', icon: 'trending_up' },
    'strong': { label: 'Strong', icon: 'check_circle' },
  }[gap.confidence];

  const handleDismissClick = () => {
    if (isEssential) {
      setShowDismissConfirm(true);
    } else {
      onDismiss(gap.skill);
    }
  };

  const hasPlanData = !!planData?.schedule;
  
  // Choose the active schedule
  const activeSchedule = hasPlanData 
    ? planData.schedule 
    : getCuratedPlan(gap.skill, totalDays);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      layout
      className={`relative rounded-2xl border-l-4 overflow-hidden transition-all ${
        isLight
          ? `bg-white border border-slate-300 shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.1)] ${colors.bgLight}`
          : `bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.1] ${colors.bgDark}`
      } ${isComplete ? (isLight ? 'opacity-70' : 'opacity-60') : ''}`}
    >
      {/* Essential badge glow */}
      {isEssential && (
        <div className="absolute top-0 right-0 w-20 h-20 pointer-events-none">
          <div className={`absolute top-0 right-0 w-full h-full ${isLight ? 'bg-amber-400/5' : 'bg-amber-500/5'} rounded-bl-3xl`} />
        </div>
      )}

      {/* Dismiss X button */}
      <button
        onClick={handleDismissClick}
        className={`absolute top-3 right-3 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
          isLight
            ? 'text-slate-300 hover:text-red-500 hover:bg-red-50'
            : 'text-white/15 hover:text-red-400 hover:bg-red-500/10'
        }`}
        title={isEssential ? `⚠ Essential skill — confirm to remove` : `Dismiss ${gap.skill}`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Dismiss Confirmation Modal */}
      <AnimatePresence>
        {showDismissConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl backdrop-blur-sm"
            style={{ background: isLight ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)' }}
          >
            <div className="text-center px-6 py-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-rounded text-2xl">warning</span>
              </div>
              <p className={`text-sm font-bold mb-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Remove essential skill?
              </p>
              <p className={`text-[11px] mb-4 max-w-[220px] mx-auto leading-relaxed ${isLight ? 'text-slate-500' : 'text-white/40'}`}>
                <strong>&ldquo;{gap.skill}&rdquo;</strong> is critical for this role. Removing it may leave a gap in your preparation.
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setShowDismissConfirm(false)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isLight
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      : 'bg-white/10 text-white hover:bg-white/15'
                  }`}
                >
                  Keep Skill
                </button>
                <button
                  onClick={() => { setShowDismissConfirm(false); onDismiss(gap.skill); }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-all"
                >
                  Remove Anyway
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Body */}
      <div className="p-5 pr-10">
        <div className="flex items-start gap-4">
          <ProgressRing
            progress={progress}
            color={colors.ring}
            trailColor={isLight ? colors.ringTrailLight : colors.ringTrailDark}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`text-base font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {gap.skill}
              </h3>
              <span className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold ${
                isLight ? colors.badgeLight : colors.badgeDark
              }`}>
                {gap.category}
              </span>
              {isEssential && (
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${
                  isLight
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                }`}>
                  <span className="material-symbols-rounded align-middle mr-1">star</span> Essential
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-2">
              {isComplete ? (
                <>
                  <span className="text-[10px]"><span className="material-symbols-rounded align-middle">emoji_events</span></span>
                  <span className={`text-[10px] font-bold ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>Completed</span>
                </>
              ) : daysCompleted > 0 ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className={`text-[10px] font-bold ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>In Progress — Day {Math.max(...completedDays) + 1 > totalDays ? totalDays : Math.max(...completedDays) + 1}</span>
                </>
              ) : (
                <>
                  <span className={`inline-flex rounded-full h-2 w-2 ${isLight ? 'bg-slate-300' : 'bg-white/15'}`}></span>
                  <span className={`text-[10px] font-medium ${isLight ? 'text-slate-400' : 'text-white/25'}`}>Not Started</span>
                </>
              )}
              <span className="mx-1">·</span>
              <span className={`text-[10px] font-medium ${isLight ? 'text-slate-400' : 'text-white/25'}`}>
                <span className="material-symbols-rounded text-[10px] align-middle">{durationInfo.icon}</span> {durationInfo.label}
              </span>
            </div>

            <div className="flex items-center gap-1 mt-3 flex-wrap">
              {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                const isDone = completedDays.includes(day);
                return (
                  <button
                    key={day}
                    onClick={() => onDayToggle(gap.skill, day, isDone)}
                    className={`relative ${totalDays > 7 ? 'w-6 h-5' : 'w-8 h-7'} rounded-lg text-[${totalDays > 7 ? '8' : '10'}px] font-bold transition-all ${
                      isDone
                        ? `bg-gradient-to-b ${colors.accent} text-white shadow-sm`
                        : isLight
                          ? 'bg-slate-200 text-slate-600 hover:bg-slate-300 border border-slate-300'
                          : 'bg-white/[0.04] text-white/25 hover:bg-white/[0.08] border border-white/[0.06]'
                    }`}
                  >
                    {isDone ? '✓' : day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 pt-3 border-t" style={{
          borderColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)'
        }}>
          <button
            onClick={() => onCourseToggle(gap.skill, !isComplete)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              isComplete
                ? isLight
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                : isLight
                  ? 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                  : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
            }`}
          >
            {isComplete ? <><span className="material-symbols-rounded align-middle mr-1">check_circle</span> Completed</> : <><span className="material-symbols-rounded align-middle mr-1 opacity-40">radio_button_unchecked</span> Mark Complete</>}
          </button>

          {!hasPlanData ? (
             <button
             onClick={() => onGeneratePlan(gap.skill)}
             disabled={loadingPlan}
             className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
               isLight
                 ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 focus:ring-2 focus:ring-indigo-500'
                 : 'bg-indigo-500/[0.08] text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/15'
             }`}
           >
             {loadingPlan ? <><span className="material-symbols-rounded align-middle mr-1">history</span> Generating AI Plan...</> : <><span className="material-symbols-rounded align-middle mr-1">auto_awesome</span> Generate AI Plan</>}
           </button>
          ) : (
             <button
             onClick={() => setExpanded(!expanded)}
             className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
               isLight
                 ? 'bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100'
                 : 'bg-cyan-500/[0.08] text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/15'
             }`}
           >
             <span className="material-symbols-rounded text-[14px] align-middle">calendar_month</span> {expanded ? 'Hide Plan' : 'View Plan'}
           </button>
          )}

          <div className="flex-1" />
          <button
            onClick={() => onPractice(gap.skill)}
            className={`p-1.5 rounded-lg transition-all ${
              isLight ? 'hover:bg-amber-50 text-amber-600' : 'hover:bg-amber-500/10 text-amber-400/60 hover:text-amber-400'
            }`}
            title={`Practice "${gap.skill}"`}
          >
            <span className="material-symbols-rounded text-[14px] align-middle">exercise</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className={`px-5 pb-5 space-y-1.5 ${
              isLight ? 'border-t border-slate-100' : 'border-t border-white/[0.04]'
            }`}>
              <div className="flex items-center justify-between pt-3 mb-2">
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${
                  isLight ? 'text-slate-400' : 'text-white/25'
                }`}>
                  <span className="material-symbols-rounded text-[14px] align-middle">calendar_month</span> {getDurationInfo(totalDays).fullLabel || `${totalDays}-Day Study Plan`}
                </p>
                <div className="flex items-center gap-3">
                  {hasPlanData && planData.summary && (
                    <p className={`text-[10px] max-w-[250px] truncate ${isLight ? 'text-indigo-600 font-medium' : 'text-indigo-400'}`}>
                       <span className="material-symbols-rounded align-middle mr-1">star</span> {planData.summary}
                    </p>
                  )}
                  {hasPlanData && (
                    <button
                      onClick={() => onExportVault(gap.skill)}
                      disabled={exportingVault}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold transition-all ${
                        isLight
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50'
                      }`}
                    >
                      {exportingVault ? <><span className="material-symbols-rounded align-middle mr-1">history</span> Saving...</> : <><span className="material-symbols-rounded text-[14px] align-middle">save</span> Save to Vault</>}
                    </button>
                  )}
                </div>
              </div>

              {activeSchedule.map((dayPlan: any) => {
                const isDayDone = completedDays.includes(dayPlan.day);
                
                // If it's the dynamic AI format, handle its structure gracefully
                const isDynamic = !!dayPlan.tasks;
                const hoursEstimate = dayPlan.timeEstimate ? dayPlan.timeEstimate.replace(/[^0-9.]/g, '') : (dayPlan.hours || 2);
                const displayFocus = isDynamic ? dayPlan.focus : dayPlan.focus;

                return (
                  <div
                    key={dayPlan.day}
                    className={`p-3 rounded-xl transition-all group ${
                      isDayDone
                        ? isLight
                          ? 'bg-emerald-50/50 border border-emerald-100'
                          : 'bg-emerald-500/[0.04] border border-emerald-500/10'
                        : isLight
                          ? 'bg-white border border-slate-300 hover:border-slate-400 hover:shadow-sm'
                          : 'bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 mt-1 rounded-lg flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 ${
                        isDayDone
                          ? `bg-gradient-to-br ${colors.accent} text-white`
                          : isLight
                            ? 'bg-slate-100 text-slate-500 border border-slate-200'
                            : 'bg-white/[0.05] text-white/30 border border-white/[0.08]'
                      }`}>
                        {isDayDone ? '✓' : `D${dayPlan.day}`}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-[11px] font-bold leading-tight ${
                            isDayDone
                              ? isLight ? 'text-emerald-700 opacity-60' : 'text-emerald-400 opacity-50'
                              : isLight ? 'text-slate-700' : 'text-white/80'
                          }`}>
                            {displayFocus}
                          </p>
                          <span className={`flex-shrink-0 ml-2 text-[9px] px-2 py-0.5 rounded-full font-bold ${
                            isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-white/30'
                          }`}>
                            {hoursEstimate}h
                          </span>
                        </div>
                        
                        {/* Dynamic AI Tasks */}
                        {isDynamic && dayPlan.tasks && (
                          <div className={`mt-2 mb-2 pl-2 border-l-2 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                            {dayPlan.tasks.map((task: string, tIdx: number) => (
                              <p key={tIdx} className={`text-[10px] leading-relaxed flex items-start gap-1 ${isLight ? 'text-slate-500' : 'text-white/50'}`}>
                                <span className="text-slate-400 mt-0.5">•</span> <span>{task}</span>
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Resource Links */}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {isDynamic ? (
                            dayPlan.resources?.map((r: any, rIdx: number) => {
                              const icons: Record<string, string> = { video: 'smart_display', article: 'article', practice: 'build', project: 'computer', course: 'school', reading: 'menu_book' };
                              return (
                                <a key={rIdx} href={r.url} target="_blank" rel="noopener noreferrer" className={`text-[9px] px-2 py-1 rounded-md transition-all font-medium flex items-center gap-1 ${
                                  isLight ? 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200' : 'bg-white/[0.03] text-white/40 hover:text-white/60 border border-white/[0.05]'
                                }`}>
                                  <span>{icons[r.type] || 'public'}</span>
                                  {r.title}
                                </a>
                              );
                            })
                          ) : (
                            <a href={(dayPlan as any).url} target="_blank" rel="noopener noreferrer" className={`text-[9px] px-2 py-1 rounded-md transition-all font-medium flex items-center gap-1 ${
                                isLight ? 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200' : 'bg-white/[0.03] text-white/40 hover:text-white/60 border border-white/[0.05]'
                              }`}>
                                <span className="material-symbols-rounded text-[10px] align-middle">{(dayPlan as any).platformIcon}</span> {(dayPlan as any).resource}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════
function SkillBridgePageInner() {
  const { user } = useStore();
  const router = useRouter();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const applicationId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('applicationId') : null;
  const [gaps, setGaps] = useState<SkillGap[]>([]);
  const [filter, setFilter] = useState<'all' | 'technical' | 'soft' | 'domain'>('all');
  const [hasData, setHasData] = useState(false);
  const [allProgress, setAllProgress] = useState<StudyProgress[]>([]);
  const [loadingPlans, setLoadingPlans] = useState<Record<string, boolean>>({});
  const [exportingVaults, setExportingVaults] = useState<Record<string, boolean>>({});
  const [generatedPlans, setGeneratedPlans] = useState<Record<string, boolean>>({});
  const [dismissedSkills, setDismissedSkills] = useState<string[]>([]);

  // Plan Config Modal State
  const [planConfigSkill, setPlanConfigSkill] = useState<string | null>(null);
  const [planDays, setPlanDays] = useState(2);
  const [planPlatforms, setPlanPlatforms] = useState<string[]>(['YouTube', 'Official Docs', 'Coursera']);

  // Load gaps from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('tc_skill_gaps');
      if (stored) {
        const parsed = JSON.parse(stored);
        const gapData: SkillGap[] = (parsed.gaps || []).map((g: any) => ({
          skill: g.skill,
          confidence: g.confidence || 'ai-added',
          category: g.category || 'technical',
          resources: RESOURCE_DATABASE[g.skill] || getDefaultResources(g.skill),
        }));
        if (gapData.length > 0) { setGaps(gapData); setHasData(true); return; }
      }
    } catch {}
    setGaps(SAMPLE_GAPS);
    setHasData(false);
  }, []);

  // Load progress from Firestore
  const loadProgress = useCallback(async () => {
    try {
      const result = await getAllStudyProgress();
      if (result.success && result.data) {
        setAllProgress(result.data);
        // Mark which skills have generated plans
        const plans: Record<string, boolean> = {};
        result.data.forEach(p => { plans[p.skill] = true; });
        setGeneratedPlans(plans);
      }
    } catch {}
  }, []);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  // Compute metrics — use SKILL_COMPLEXITY as source of truth for total days
  const totalSkillsBridging = allProgress.length;
  const getExpectedDays = (p: StudyProgress) => p.total_days || getTrainingDays(p.skill, (p.category as 'technical' | 'soft' | 'domain') || 'technical');
  const totalDaysCompleted = allProgress.reduce((sum, p) => sum + p.completed_days.length, 0);
  const totalDaysPossible = allProgress.reduce((sum, p) => sum + getExpectedDays(p), 0);
  const overallPercent = totalDaysPossible > 0 ? Math.round((totalDaysCompleted / totalDaysPossible) * 100) : 0;
  const completedSkills = allProgress.filter(p => p.completed_days.length >= getExpectedDays(p)).length;

  const getCompletedDaysForSkill = (skill: string) => {
    const progress = allProgress.find(p => p.skill.toLowerCase() === skill.toLowerCase());
    return progress?.completed_days || [];
  };

  // Day toggle handler
  const handleDayToggle = async (skill: string, day: number, isCurrentlyDone: boolean) => {
    if (isCurrentlyDone) {
      const result = await unmarkDayComplete(skill, day);
      if (result.success) { showToast(`Day ${day} unmarked`, '↺'); loadProgress(); }
    } else {
      // Ensure study progress exists first
      if (!generatedPlans[skill]) {
        await saveStudyProgress(skill, gaps.find(g => g.skill === skill)?.category || 'technical', undefined, applicationId || undefined);
        setGeneratedPlans(prev => ({ ...prev, [skill]: true }));
      }
      const result = await markDayComplete(skill, day);
      if (result.success) { showToast(`Day ${day} complete ✓`, 'check_circle'); loadProgress(); }
    }
  };

  // Course toggle handler
  const handleCourseToggle = async (skill: string, complete: boolean) => {
    const days = getTrainingDays(skill, gaps.find(g => g.skill === skill)?.category || 'technical');
    // Ensure study progress exists first
    if (!generatedPlans[skill]) {
      await saveStudyProgress(skill, gaps.find(g => g.skill === skill)?.category || 'technical', undefined, applicationId || undefined);
      setGeneratedPlans(prev => ({ ...prev, [skill]: true }));
    }
    if (complete) {
      const result = await markCourseComplete(skill, days);
      if (result.success) { showToast(`${skill} marked complete!`, 'emoji_events'); loadProgress(); }
    } else {
      const result = await markCourseIncomplete(skill);
      if (result.success) { showToast(`${skill} progress reset`, 'replay'); loadProgress(); }
    }
  };

  // Generate study plan — opens config modal first
  const handleGeneratePlan = (skill: string) => {
    const category = gaps.find(g => g.skill === skill)?.category || 'technical';
    const defaultDays = getTrainingDays(skill, category);
    setPlanDays(defaultDays);
    setPlanPlatforms(['YouTube', 'Official Docs', 'Coursera']);
    setPlanConfigSkill(skill);
  };

  // Actually generate after user confirms config
  const handleConfirmGeneratePlan = async () => {
    const skill = planConfigSkill;
    if (!skill) return;
    setPlanConfigSkill(null);
    setLoadingPlans(prev => ({ ...prev, [skill]: true }));
    try {
      const category = gaps.find(g => g.skill === skill)?.category || 'technical';
      const res = await authFetch('/api/resume/study-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skills: [skill],
          totalDays: planDays,
          platforms: planPlatforms,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.schedule && data.schedule.length > 0) {
        await saveStudyProgress(skill, category, data, applicationId || undefined);
        setGeneratedPlans(prev => ({ ...prev, [skill]: true }));
        showToast(`${getDurationInfo(planDays).fullLabel} for ${skill} created!`, 'calendar_month');
        loadProgress();
      } else {
        showToast('Plan generated but empty — try again', 'warning');
      }
    } catch (err: any) {
      console.error('[SkillBridge] Plan generation failed:', err);
      showToast(err.message || 'Failed to generate plan', 'cancel');
    }
    setLoadingPlans(prev => ({ ...prev, [skill]: false }));
  };

  const handleExportVault = async (skill: string) => {
    const progress = allProgress.find(p => p.skill === skill);
    const planData = progress?.plan_data;
    if (!planData || !planData.schedule) {
      showToast('No AI plan found to export', 'cancel');
      return;
    }

    setExportingVaults(prev => ({ ...prev, [skill]: true }));
    try {
      const res = await authFetch('/api/vault/export-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill,
          schedule: planData.schedule,
          summary: planData.summary,
          applicationId: applicationId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('Study Plan saved to Vault!', 'save');
    } catch (err: any) {
      showToast(err.message || 'Failed to export to Vault', 'cancel');
    }
    setExportingVaults(prev => ({ ...prev, [skill]: false }));
  };

  const handlePractice = (skill: string) => {
    localStorage.setItem('tc_gauntlet_skill', skill);
    router.push('/suite/flashcards');
  };

  const filteredGaps = gaps.filter(g => (filter === 'all' || g.category === filter) && !dismissedSkills.includes(g.skill));

  // Top 6 skills are "essential" — they get a special badge and dismiss confirmation
  const essentialSkills = new Set(gaps.slice(0, 6).map(g => g.skill));

  const handleDismiss = (skill: string) => {
    setDismissedSkills(prev => [...prev, skill]);
    if (essentialSkills.has(skill)) {
      showToast(`Essential skill "${skill}" removed — you can re-add it by refreshing`, 'warning');
    } else {
      showToast(`${skill} dismissed`, 'close');
    }
  };

  const techCount = gaps.filter(g => g.category === 'technical').length;
  const softCount = gaps.filter(g => g.category === 'soft').length;
  const domainCount = gaps.filter(g => g.category === 'domain').length;

  return (
    <div className={`min-h-screen ${isLight ? 'bg-white' : 'bg-[var(--theme-bg)]'}`}>

      {/* ── PLAN CONFIG MODAL ────────────── */}
      <AnimatePresence>
        {planConfigSkill && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: isLight ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.6)' }}
            onClick={() => setPlanConfigSkill(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-3xl overflow-hidden ${
                isLight
                  ? 'bg-white border border-slate-200 shadow-2xl'
                  : 'bg-[#0f1117] border border-white/10 shadow-2xl'
              }`}
            >
              {/* Header */}
              <div className={`px-6 pt-6 pb-4 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isLight ? 'bg-indigo-50' : 'bg-indigo-500/10'
                  }`}>
                    <span className={`material-symbols-rounded text-lg ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}>auto_awesome</span>
                  </div>
                  <div>
                    <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      Configure Plan: {planConfigSkill}
                    </h3>
                    <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-white/40'}`}>
                      Customize your study plan before generating
                    </p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-6">
                {/* Duration */}
                <div>
                  <label className={`text-xs font-bold uppercase tracking-wider mb-3 block ${isLight ? 'text-slate-500' : 'text-white/30'}`}>
                    <span className="material-symbols-rounded text-[14px] align-middle mr-1">calendar_month</span>
                    Plan Duration
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DURATION_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setPlanDays(opt.value)}
                        className={`px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                          planDays === opt.value
                            ? isLight
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                              : 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                            : isLight
                              ? 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                              : 'bg-white/[0.04] text-white/50 border border-white/[0.08] hover:bg-white/[0.08]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className={`text-[10px] mt-2 ${isLight ? 'text-slate-400' : 'text-white/20'}`}>
                    {planDays < 1 ? 'Quick recap — crash course essentials' : planDays <= 2 ? 'Sprint — quick tool adoption' : planDays <= 4 ? 'Focused — framework proficiency' : 'Deep Dive — comprehensive mastery'}
                  </p>
                </div>

                {/* Platform Preferences */}
                <div>
                  <label className={`text-xs font-bold uppercase tracking-wider mb-3 block ${isLight ? 'text-slate-500' : 'text-white/30'}`}>
                    <span className="material-symbols-rounded text-[14px] align-middle mr-1">devices</span>
                    Preferred Platforms
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { name: 'YouTube', icon: 'smart_display' },
                      { name: 'Coursera', icon: 'school' },
                      { name: 'Official Docs', icon: 'menu_book' },
                      { name: 'LinkedIn Learning', icon: 'work' },
                      { name: 'freeCodeCamp', icon: 'code' },
                      { name: 'Udemy', icon: 'play_circle' },
                      { name: 'Hands-on Labs', icon: 'build' },
                      { name: 'Kaggle', icon: 'bar_chart' },
                    ].map(p => {
                      const isSelected = planPlatforms.includes(p.name);
                      return (
                        <button
                          key={p.name}
                          onClick={() => {
                            if (isSelected) {
                              if (planPlatforms.length > 1) {
                                setPlanPlatforms(prev => prev.filter(x => x !== p.name));
                              }
                            } else {
                              setPlanPlatforms(prev => [...prev, p.name]);
                            }
                          }}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                            isSelected
                              ? isLight
                                ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-400 shadow-sm'
                                : 'bg-indigo-500/15 text-indigo-300 border-2 border-indigo-500/40'
                              : isLight
                                ? 'bg-slate-50 text-slate-500 border border-slate-200 hover:border-slate-300'
                                : 'bg-white/[0.03] text-white/40 border border-white/[0.06] hover:border-white/[0.12]'
                          }`}
                        >
                          <span className="material-symbols-rounded text-[14px]">{p.icon}</span>
                          {p.name}
                          {isSelected && <span className="text-[10px]">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                  <p className={`text-[10px] mt-2 ${isLight ? 'text-slate-400' : 'text-white/20'}`}>
                    Select at least 1 platform. AI will prioritize resources from these.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className={`px-6 py-4 flex items-center justify-end gap-3 border-t ${isLight ? 'border-slate-100 bg-slate-50/50' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                <button
                  onClick={() => setPlanConfigSkill(null)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isLight
                      ? 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmGeneratePlan}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    isLight
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20'
                      : 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-lg shadow-indigo-500/20'
                  }`}
                >
                  <span className="material-symbols-rounded text-[14px]">auto_awesome</span>
                  Generate {getDurationInfo(planDays).fullLabel.replace(/\d+-/, '').trim() ? getDurationInfo(planDays).fullLabel : `${planDays}-Day Plan`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* ── HERO ────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative overflow-hidden rounded-3xl p-8 mb-8 ${
            isLight
              ? 'bg-white border border-slate-300 shadow-[0_2px_6px_rgba(0,0,0,0.06)]'
              : 'bg-white/[0.02] border border-white/[0.06]'
          }`}
        >
          <div className="absolute inset-0 opacity-30">
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 flex items-center justify-between pl-12 lg:pl-0">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="material-symbols-rounded text-2xl align-middle" style={{ color: 'var(--text-secondary)' }}>route</span>
                <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                    Skill Bridge
                </h1>
                <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                  isLight ? 'bg-teal-100 text-teal-800 border border-teal-400 shadow-sm' : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                }`}>PRO</span>
              </div>
              <p className={`text-sm mt-2 max-w-lg leading-relaxed ${isLight ? 'text-slate-500' : 'text-white/40'}`}>
                From Resume to Ready — we don&apos;t just dress up your resume.
                <span className={`font-semibold ${isLight ? 'text-teal-600' : 'text-teal-400'}`}> We make you the candidate it says you are.</span>
              </p>
            </div>

            {/* Overall Progress Ring */}
            {totalSkillsBridging > 0 && (
              <div className="hidden md:flex flex-col items-center gap-2">
                <ProgressRing progress={overallPercent} size={90} strokeWidth={7} color="#06b6d4" trailColor={isLight ? 'rgba(6,182,212,0.12)' : 'rgba(6,182,212,0.08)'} />
                <span className={`text-[10px] font-semibold ${isLight ? 'text-slate-400' : 'text-white/30'}`}>Overall Progress</span>
              </div>
            )}
            <PageHelp toolId="skill-bridge" />
          </div>
        </motion.div>

        {/* ── STATS ROW ──────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
        >
          {[
            { label: 'Skills Detected', value: gaps.length, icon: 'search', color: isLight ? 'text-teal-800' : 'text-teal-400', borderColor: isLight ? 'border-t-teal-500' : '' },
            { label: 'Days Completed', value: totalDaysCompleted, icon: 'check_circle', color: isLight ? 'text-emerald-800' : 'text-emerald-400', borderColor: isLight ? 'border-t-emerald-500' : '' },
            { label: 'Courses Done', value: completedSkills, icon: 'emoji_events', color: isLight ? 'text-amber-800' : 'text-amber-400', borderColor: isLight ? 'border-t-amber-500' : '' },
            { label: 'In Progress', value: Math.max(0, totalSkillsBridging - completedSkills), icon: 'edit_document', color: isLight ? 'text-blue-800' : 'text-blue-400', borderColor: isLight ? 'border-t-blue-500' : '' },
          ].map((stat) => (
            <div key={stat.label} className={`p-4 rounded-2xl text-center transition-all border-t-[3px] ${
              isLight
                ? `bg-white border border-slate-300 shadow-[0_2px_6px_rgba(0,0,0,0.06)] ${stat.borderColor}`
                : 'bg-white/[0.02] border border-white/[0.06] border-t-transparent'
            }`}>
              <span className="material-symbols-rounded text-xl align-middle">{stat.icon}</span>
              <p className={`text-2xl font-extrabold mt-1 ${stat.color}`}>{stat.value}</p>
              <p className={`text-[10px] font-medium mt-0.5 ${isLight ? 'text-slate-400' : 'text-white/25'}`}>{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Demo notice */}
        {!hasData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className={`mb-6 p-3.5 rounded-xl flex items-center gap-2.5 ${
              isLight
                ? 'bg-blue-50 border border-blue-200 text-blue-700'
                : 'bg-blue-500/[0.05] border border-blue-500/[0.12] text-blue-400/80'
            }`}
          >
            <span className="material-symbols-rounded text-sm align-middle text-amber-500 mr-2">lightbulb</span>
            <p className="text-[11px]">
              <span className="font-bold">Demo Mode:</span> Run AI Enhance on your resume to see personalized skill gaps. These are sample skills.
            </p>
          </motion.div>
        )}

        {/* ── FILTER TABS ────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 mb-6"
        >
          {[
            { key: 'all', label: 'All Skills', icon: '', count: gaps.length },
            { key: 'technical', label: 'Technical', icon: 'computer', count: techCount },
            { key: 'soft', label: 'Soft Skills', icon: 'handshake', count: softCount },
            { key: 'domain', label: 'Domain', icon: 'domain', count: domainCount },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                filter === f.key
                  ? isLight
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)] shadow-sm'
                    : 'bg-white/10 text-white border border-white/15'
                  : isLight
                    ? 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'
                    : 'text-white/30 hover:text-white/50 hover:bg-white/[0.04]'
              }`}
            >
              {f.icon && <span className="material-symbols-rounded text-[12px] align-middle mr-1">{f.icon}</span>}
              {f.label} {f.count > 0 && `(${f.count})`}
            </button>
          ))}
        </motion.div>

        {/* ── SKILL CARDS GRID ───────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10"
        >
          {filteredGaps.map((gap, i) => (
            <motion.div
              key={gap.skill}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <SkillCard
                gap={gap}
                completedDays={getCompletedDaysForSkill(gap.skill)}
                totalDays={getTrainingDays(gap.skill, gap.category)}
                onDayToggle={handleDayToggle}
                onCourseToggle={handleCourseToggle}
                onDismiss={handleDismiss}
                onPractice={handlePractice}
                onGeneratePlan={handleGeneratePlan}
                planData={allProgress.find(p => p.skill === gap.skill)?.plan_data}
                loadingPlan={!!loadingPlans[gap.skill]}
                isLight={isLight}
                isEssential={essentialSkills.has(gap.skill)}
                onExportVault={handleExportVault}
                exportingVault={!!exportingVaults[gap.skill]}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* ── LEARNING TIMELINE ──────────────── */}
        {allProgress.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`mb-10 p-6 rounded-2xl ${
              isLight ? 'bg-white border border-slate-300 shadow-[0_2px_6px_rgba(0,0,0,0.06)]' : 'bg-white/[0.02] border border-white/[0.06]'
            }`}
          >
            <h3 className={`text-sm font-bold mb-4 flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white/70'}`}>
              <span className="material-symbols-rounded align-middle">trending_up</span> Active Learning Timeline
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {allProgress.filter(p => p.completed_days.length < getExpectedDays(p)).map((p) => {
                const colors = CATEGORY_COLORS[p.category] || CATEGORY_COLORS.technical;
                const pDays = getExpectedDays(p);
                const nextDay = Math.max(1, ...p.completed_days.map(d => d + 1));
                return (
                  <div
                    key={p.skill}
                    className={`flex-shrink-0 p-4 rounded-xl border-l-3 min-w-[160px] transition-all ${
                      isLight
                        ? `bg-white border border-slate-300 shadow-sm ${colors.bgLight}`
                        : `bg-white/[0.02] border border-white/[0.06] ${colors.bgDark}`
                    }`}
                  >
                    <p className={`text-xs font-bold truncate ${isLight ? 'text-slate-800' : 'text-white/80'}`}>{p.skill}</p>
                    <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-white/30'}`}>
                      Next: Day {nextDay > pDays ? pDays : nextDay} of {pDays}
                    </p>
                    <div className="flex gap-0.5 mt-2 flex-wrap">
                      {Array.from({ length: pDays }, (_, i) => i + 1).map(d => (
                        <div
                          key={d}
                          className={`w-3 h-1.5 rounded-full ${
                            p.completed_days.includes(d)
                              ? `bg-gradient-to-r ${colors.accent}`
                              : isLight ? 'bg-slate-200' : 'bg-white/8'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── FREE PLATFORMS ─────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mb-8"
        >
          <h2 className={`text-base font-bold mb-4 flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white/70'}`}>
            <span className="material-symbols-rounded text-lg">public</span> Free Learning Platforms
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: 'YouTube', icon: 'smart_display', url: 'https://youtube.com', desc: 'Free video courses', color: 'text-red-500' },
              { name: 'freeCodeCamp', icon: 'code_blocks', url: 'https://freecodecamp.org', desc: 'Free coding bootcamp', color: 'text-emerald-500' },
              { name: 'Google Certs', icon: 'stars', url: 'https://grow.google/certificates/', desc: 'Career certificates', color: 'text-blue-500' },
              { name: 'AWS Training', icon: 'cloud', url: 'https://skillbuilder.aws/', desc: 'Cloud skills', color: 'text-amber-500' },
              { name: 'Coursera', icon: 'school', url: 'https://coursera.org', desc: 'University courses', color: 'text-blue-600' },
              { name: 'LinkedIn', icon: 'work', url: 'https://linkedin.com/learning', desc: 'Professional skills', color: 'text-sky-500' },
              { name: 'edX', icon: 'account_balance', url: 'https://edx.org', desc: 'MIT/Harvard courses', color: 'text-red-600' },
              { name: 'Codecademy', icon: 'terminal', url: 'https://codecademy.com', desc: 'Interactive coding', color: 'text-teal-500' },
            ].map((p) => (
              <a
                key={p.name}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`p-4 rounded-xl transition-all group ${
                  isLight
                    ? 'bg-white border border-slate-300 hover:border-slate-400 hover:shadow-md shadow-sm'
                    : 'bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04]'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-2.5 shadow-sm ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`}>
                  <span className={`material-symbols-rounded ${p.color}`}>{p.icon}</span>
                </div>
                <p className={`text-xs font-bold transition-colors ${
                  isLight ? 'text-slate-700 group-hover:text-slate-900' : 'text-white/60 group-hover:text-white/80'
                }`}>{p.name}</p>
                <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-white/25'}`}>{p.desc}</p>
              </a>
            ))}
          </div>
        </motion.div>

        {/* ── GAUNTLET CTA ───────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className={`p-6 rounded-2xl text-center mb-8 ${
            isLight
              ? 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200'
              : 'bg-gradient-to-r from-amber-500/[0.04] to-orange-500/[0.04] border border-amber-500/[0.1]'
          }`}
        >
          <p className={`text-lg font-bold mb-1 ${isLight ? 'text-slate-800' : 'text-white/70'}`}>Ready to put your skills to the test?</p>
          <p className={`text-xs mb-4 ${isLight ? 'text-slate-500' : 'text-white/30'}`}>The Gauntlet will simulate real interviews targeting your gap areas.</p>
          <button
            onClick={() => router.push('/suite/flashcards')}
          className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${
              isLight
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md hover:shadow-lg'
                : 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-amber-400 hover:from-amber-500/15 hover:to-orange-500/15'
            }`}
          >
            <span className="material-symbols-rounded text-[14px] align-middle">swords</span> Enter The Gauntlet
          </button>
        </motion.div>
      </div>
    </div>
  );
}

export default function SkillBridgePage() {
  return (
    <ProGate
      feature="Skill Bridge"
      description="Skill Bridge generates personalized learning paths from your resume gaps to interview-ready skills. This is a Pro-exclusive feature."
    >
      <SkillBridgePageInner />
    </ProGate>
  );
}


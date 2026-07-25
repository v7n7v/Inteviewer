import type { CanonicalResume } from '@/lib/resume-normalizer';

export type ResumeTemplateFixtureId = 'full' | 'sparse' | 'long';

export const RESUME_TEMPLATE_FIXTURES: Record<ResumeTemplateFixtureId, CanonicalResume> = {
  full: {
    name: 'Jordan Avery Morgan',
    title: 'Vice President, Product & Operations',
    email: 'jordan.morgan@example.com',
    phone: '+1 212 555 0148',
    location: 'New York, NY',
    linkedin: 'linkedin.com/in/jordanmorgan',
    website: 'jordanmorgan.work',
    summary: 'Product and operations leader who translates customer evidence into durable platforms, accountable teams, and measurable growth across complex organizations.',
    experience: [
      {
        company: 'Northstar Systems',
        role: 'Vice President, Product & Operations',
        duration: '2022 – Present',
        achievements: [
          'Led a 42-person product, design, analytics, and operations organization across three markets while improving annual recurring revenue by 31%.',
          'Rebuilt portfolio governance around customer evidence and unit economics, reducing low-confidence roadmap work by 38%.',
          'Launched an enterprise workflow used by 18,000 professionals and increased first-year expansion revenue by $4.2M.',
        ],
      },
      {
        company: 'Common Thread Labs',
        role: 'Director of Product Strategy',
        duration: '2018 – 2022',
        achievements: [
          'Established the company’s first research and experimentation practice, improving activation by 24% across two core products.',
          'Partnered with engineering and go-to-market leaders to complete a multi-year platform consolidation six months ahead of plan.',
        ],
      },
      {
        company: 'Meridian Advisory',
        role: 'Senior Strategy Consultant',
        duration: '2015 – 2018',
        achievements: [
          'Advised financial services and healthcare executives on operating-model redesign, digital transformation, and growth strategy.',
        ],
      },
    ],
    education: [
      {
        degree: 'Master of Business Administration',
        institution: 'Columbia Business School',
        year: '2015',
        details: 'Strategy and organizational leadership',
      },
      {
        degree: 'Bachelor of Science, Information Systems',
        institution: 'Howard University',
        year: '2010',
      },
    ],
    skills: [
      { category: 'Leadership', items: ['Portfolio strategy', 'Operating models', 'Executive communication', 'Team development'] },
      { category: 'Product', items: ['Customer discovery', 'Platform strategy', 'Experimentation', 'Roadmapping'] },
      { category: 'Analytics', items: ['Unit economics', 'Funnel analysis', 'Forecasting', 'KPI design'] },
    ],
    certifications: ['Pragmatic Institute — Product Management', 'Prosci Change Management'],
  },
  sparse: {
    name: 'Maya Chen',
    title: 'Business Analyst',
    email: 'maya.chen@example.com',
    phone: '',
    location: 'Seattle, WA',
    linkedin: '',
    website: '',
    summary: 'Early-career analyst with internship experience turning operational data into practical process improvements.',
    experience: [
      {
        company: 'City Innovation Office',
        role: 'Operations Intern',
        duration: 'Summer 2025',
        achievements: ['Mapped a resident-support workflow and identified changes that reduced average handoff time by 18%.'],
      },
    ],
    education: [
      {
        degree: 'Bachelor of Arts, Economics',
        institution: 'University of Washington',
        year: '2026',
      },
    ],
    skills: [{ category: 'Skills', items: ['Excel', 'SQL', 'Process mapping', 'Presentation design'] }],
    certifications: [],
  },
  long: {
    name: 'Dr. Alexandrina-Chiamaka Okafor-Rodríguez',
    title: 'Global Healthcare Transformation, Clinical Operations & Responsible AI Executive',
    email: 'alexandrina.okafor-rodriguez@example-healthcare.org',
    phone: '+44 20 7946 0958',
    location: 'London, United Kingdom · New York, United States',
    linkedin: 'linkedin.com/in/alexandrina-okafor-rodriguez',
    website: 'alexandrina-health-transformation.example',
    summary: 'International healthcare transformation executive with experience aligning clinical operations, responsible artificial intelligence, workforce strategy, and patient-safety programs across regulated, multi-market systems. Known for building evidence-led operating models that preserve clinical judgment while improving access, quality, and financial sustainability.',
    experience: [
      {
        company: 'Global Meridian Health Partnership',
        role: 'Chief Transformation and Clinical Operations Officer',
        duration: 'January 2021 – Present',
        achievements: [
          'Designed and led a five-country operating-model transformation spanning 64 care sites, 12,500 employees, and a combined annual operating budget of $3.8B.',
          'Established responsible-AI review, clinical validation, and post-deployment monitoring standards used across radiology, scheduling, population health, and revenue-cycle programs.',
          'Improved outpatient access by 27%, reduced avoidable clinical handoffs by 19%, and reinvested $46M in workforce development and community-based care.',
          'Built an executive scorecard linking patient safety, health equity, workforce capacity, digital adoption, and financial performance without collapsing outcomes into a single composite measure.',
        ],
      },
      {
        company: 'St. Catherine Academic Medical Network',
        role: 'Senior Vice President, Enterprise Clinical Excellence',
        duration: 'March 2016 – December 2020',
        achievements: [
          'Led quality, patient safety, clinical analytics, and service-line improvement for an academic network with 8 hospitals and more than 2.1M annual patient encounters.',
          'Created a multidisciplinary learning system that reduced serious safety events by 34% over three years and increased near-miss reporting by 62%.',
          'Partnered with university faculty and frontline clinicians to translate implementation research into repeatable care pathways across cardiology, oncology, and emergency medicine.',
        ],
      },
      {
        company: 'National Centre for Health System Design',
        role: 'Director, Integrated Care and Population Health',
        duration: 'August 2011 – February 2016',
        achievements: [
          'Advised regional health authorities on integrated-care networks, population-health investment, and measurement systems serving more than 7 million residents.',
          'Developed a risk-stratified access model that expanded community-based chronic-care capacity while protecting continuity for medically complex patients.',
        ],
      },
      {
        company: 'Royal Metropolitan Teaching Hospital',
        role: 'Clinical Program Manager, Internal Medicine',
        duration: 'July 2007 – July 2011',
        achievements: [
          'Coordinated multidisciplinary redesign work across internal medicine, pharmacy, nursing, and social care, with a focus on safer transitions after hospitalization.',
        ],
      },
    ],
    education: [
      {
        degree: 'Doctor of Public Health, Health Policy and Management',
        institution: 'London School of Hygiene & Tropical Medicine',
        year: '2013',
        details: 'Research focus: implementation, health-system learning, and equitable access',
      },
      {
        degree: 'Master of Science, Health Services Research',
        institution: 'University College London',
        year: '2007',
      },
      {
        degree: 'Bachelor of Medicine and Bachelor of Surgery',
        institution: 'University of Lagos College of Medicine',
        year: '2003',
      },
    ],
    skills: [
      { category: 'Enterprise Leadership', items: ['Clinical operating models', 'Transformation governance', 'Board communication', 'Workforce strategy', 'Cross-market leadership'] },
      { category: 'Clinical Excellence', items: ['Patient safety', 'Quality improvement', 'Integrated care', 'Population health', 'Implementation science'] },
      { category: 'Data & Responsible AI', items: ['Clinical validation', 'Algorithm governance', 'Outcome measurement', 'Post-deployment monitoring', 'Health equity analytics'] },
      { category: 'Financial & Operational', items: ['Service-line strategy', 'Capacity planning', 'Benefits realization', 'Portfolio prioritization', 'Strategic partnerships'] },
    ],
    certifications: [
      'Fellow, Faculty of Public Health',
      'Certified Professional in Healthcare Quality',
      'Advanced Improvement Methods — Institute for Healthcare Improvement',
      'Responsible AI Leadership Certificate',
    ],
  },
};


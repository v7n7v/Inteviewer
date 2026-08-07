/* ---------------------------------------------------------------------------
 * Motion and interaction for the landing page.
 *
 * This is the prototype's two inline <script> blocks, ported. Three things
 * changed in the move, and all three are deliberate:
 *
 *   1. Every lookup is scoped to the mounted root, not to `document`. Two
 *      copies of the landing on one page - a preview, a Storybook frame, React
 *      StrictMode mounting twice in development - would otherwise fight over
 *      the same #ids.
 *   2. Everything the module attaches is returned in a teardown. Timers,
 *      intervals, rAF handles, observers and window listeners all come off on
 *      unmount, because a Next route change unmounts this and the alternative
 *      is a hero animation still running on /pricing.
 *   3. `ready` moves from <body> to the root element, so the class cannot
 *      leak into the rest of the app.
 *
 * What did NOT change: the per-region try/catch. A throw in the chat must not
 * take the career check down with it. This is the same fault isolation the
 * prototype shipped with, for the same reason - the page went blank on a real
 * device once already, and every hiding rule is gated on `html.js` for the
 * same reason.
 * ------------------------------------------------------------------------- */

type Cleanup = () => void;

interface Ctx {
  root: HTMLElement;
  rm: boolean;
  cleanups: Cleanup[];
  /** window/document listener that is removed on teardown */
  on: <K extends keyof WindowEventMap>(
    target: Window | Document | HTMLElement,
    type: K | string,
    fn: EventListenerOrEventListenerObject,
    opts?: AddEventListenerOptions,
  ) => void;
  timer: (fn: () => void, ms: number) => number;
  interval: (fn: () => void, ms: number) => number;
  observe: (o: IntersectionObserver) => IntersectionObserver;
}

/* the phrase list is local to this file. It used to cite a shared `weakWords`
   constant in careerLandingContent.ts; that file was dead code and no such shared
   constant exists anywhere in the product. */
const WEAK_PRODUCT = [
  'responsible for', 'improving', 'operational efficiency', 'multiple stakeholders',
  'excited to apply', 'comprehensive background', 'aligns well', 'esteemed organization',
  'would be interested', 'learning more about the opportunity', 'discussing my qualifications',
  'strong communicator', 'work well with teams', 'solve problems', 'deliver results',
];
/* a documented demo extension of common filler - NOT product data */
const WEAK_DEMO = [
  'team player', 'detail-oriented', 'hard worker', 'self-starter', 'go-getter',
  'think outside the box', 'results-driven', 'proven track record', 'dynamic', 'synergy',
  'leverage', 'utilize', 'spearheaded', 'passionate about', 'wide range of', 'various',
  'assisted with', 'helped with', 'worked on', 'tasked with', 'duties included',
  'fast-paced environment',
];
const WEAK = WEAK_PRODUCT.concat(WEAK_DEMO);

const SAMPLES = [
  'Responsible for managing cross-functional projects and improving operational efficiency across multiple stakeholders.',
  'I am excited to apply because my comprehensive background aligns well with the requirements of this esteemed organization.',
  'Thank you for reaching out. I would be interested in learning more about the opportunity and discussing my qualifications.',
];

export const RES_EMPTY =
  '<p class="res-empty">Results appear as you type. Nothing is uploaded. This runs in your browser.</p>';

export interface Example {
  b: string;
  a: string;
  m: string;
  sb: number;
  sa: number;
  w: string[];
}

/* the same four examples as beforeAfterExamples in the content file */
export const EXAMPLES: Example[] = [
  {
    b: 'Responsible for managing cross-functional projects and improving operational efficiency across multiple stakeholders.',
    a: 'Led 6 partners across product, sales, and operations to cut onboarding delays by 31% in one quarter.',
    m: 'Specificity up', sb: 38, sa: 91,
    w: ['Responsible for', 'improving', 'operational efficiency', 'multiple stakeholders'],
  },
  {
    b: 'I am excited to apply because my comprehensive background aligns well with the requirements of this esteemed organization.',
    a: 'Your team needs someone who can turn messy workflows into shipped systems. That is the product operations work I have done for the last three years.',
    m: 'Cliche density down', sb: 29, sa: 87,
    w: ['excited to apply', 'comprehensive background', 'aligns well', 'esteemed organization'],
  },
  {
    b: 'Thank you for reaching out. I would be interested in learning more about the opportunity and discussing my qualifications.',
    a: 'Thanks for reaching out. The role looks close to the product ops work I enjoy most, especially the systems and stakeholder piece.',
    m: 'Voice clarity up', sb: 42, sa: 88,
    w: ['would be interested', 'learning more about the opportunity', 'discussing my qualifications'],
  },
  {
    b: 'I am a strong communicator and I work well with teams to solve problems and deliver results.',
    a: 'When onboarding delays rose, I mapped the handoff, found two approval bottlenecks, and rebuilt the weekly review so sales and support could resolve blockers before launch.',
    m: 'Evidence added', sb: 34, sa: 93,
    w: ['strong communicator', 'work well with teams', 'solve problems', 'deliver results'],
  },
];

export type ChatTurn = ['u' | 'a', string];

/* One candidate, three points in the same interview. Every capability
   referenced is one the product actually lists. */
export const CHATS: ChatTurn[][] = [
  [
    ['u', 'I have a first-round with Northwind on Thursday. Product analyst. I have not interviewed in four years.'],
    ['a', 'Then we start with what you already have. Three stories from your resume are strong enough to carry a whole round: the onboarding rebuild, the churn dashboard, and the pricing migration.'],
    ['u', 'The onboarding one I always tell badly. It rambles.'],
    ['a', 'Because you open with the process. Open with the number: onboarding took eleven days and you got it to four. Then the two decisions that did it. Want to practise it out loud?'],
    ['u', 'Yes, but they will ask why I left. That is the part I dread.'],
    ['a', 'One sentence, no apology, then move to what you want next. Draft: the team was cut in March, I am looking for a role where analytics sits closer to the product decision. Say it once and stop.'],
  ],
  [
    ['u', 'Just came out. I think I talked too much on the second question.'],
    ['a', 'What was the question?'],
    ['u', 'How I would measure whether a feature worked. I listed about six metrics.'],
    ['a', 'Six is not fatal, it just reads as unprioritised. If it comes up in the next round, name one metric and one guardrail, then say the rest are secondary. That is the whole fix.'],
    ['u', 'They also asked about SQL depth and I hedged.'],
    ['a', 'You have written window functions in two of your last three roles. That is not hedging territory. I have put it at the top of your notes so it is in front of you next time.'],
  ],
  [
    ['u', 'It has been eight days and nobody has replied.'],
    ['a', 'Day eight is the right moment to nudge. Across the roles you are tracking, the median time to a decision is eleven days, so you are inside the window, not late.'],
    ['u', 'I do not want to sound desperate.'],
    ['a', 'Then do not ask for news. Add something. Four lines: thanks, the one metric answer you wanted to give properly, and that you are still interested. Draft is in your outbox.'],
    ['u', 'Send it.'],
    ['a', 'That one is yours to press. Nothing leaves this account without you doing it.'],
  ],
];

const SECTIONS: Array<[string, string]> = [
  ['check', 'Career Check'], ['proof', 'Proof'], ['tools', 'Tools'],
  ['taco', 'Taco'], ['pricing', 'Pricing'],
];

const esc = (s: string) =>
  s.replace(/[&<>]/g, (c) => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }) as Record<string, string>)[c]);

/** The static first paint of the rewrite widget, so the markup and the module
 *  cannot disagree about what example 0 looks like before script runs. */
export function rewriteHtml(i: number): string {
  const e = EXAMPLES[i];
  let before = esc(e.b);
  e.w.forEach((p) => {
    before = before.replace(esc(p), `<span class="w weak">${esc(p)}</span>`);
  });
  return `<span class="before">${before}</span><span class="after">${esc(e.a)}</span>`;
}

/** The chat as plain bubbles - what someone with no JavaScript reads. */
export function chatHtml(i: number): string {
  return CHATS[i]
    .map((m) => `<div class="msg ${m[0] === 'u' ? 'msg-u' : 'msg-a'}">${esc(m[1])}</div>`)
    .join('');
}

/* ------------------------------------------------------------------ mount */

export function mountTalentLanding(root: HTMLElement): Cleanup {
  const cleanups: Cleanup[] = [];
  const timers = new Set<number>();
  const intervals = new Set<number>();

  const ctx: Ctx = {
    root,
    rm: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    cleanups,
    on: (target, type, fn, opts) => {
      target.addEventListener(type as string, fn, opts);
      cleanups.push(() => target.removeEventListener(type as string, fn, opts));
    },
    timer: (fn, ms) => {
      const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms);
      timers.add(id);
      return id;
    },
    interval: (fn, ms) => {
      const id = window.setInterval(fn, ms);
      intervals.add(id);
      return id;
    },
    observe: (o) => { cleanups.push(() => o.disconnect()); return o; },
  };

  const q = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const qa = <T extends Element = HTMLElement>(sel: string) => Array.from(root.querySelectorAll<T>(sel));

  const region = (name: string, fn: () => void) => {
    try { fn(); } catch (e) { console.error(`[landing:${name}]`, e); }
  };

  /* --------------------------------------------------------- the first draft
     Filler in, flagged, struck, real copy out of it, hold, again. Two blocks
     run the same four beats a third of a second apart, which is what makes it
     read as one page rewriting itself rather than two widgets animating. */
  region('draft', () => {
    const rise = () => root.classList.add('ready');
    const h1w = q('#h1wrap');
    const subw = q('#subwrap');
    const kick = q('#kickT');
    if (!h1w || !subw || ctx.rm) { requestAnimationFrame(rise); return; }

    const SAID = 'Review-first career operating system';
    const CAP = 'Our first draft, checked';
    let t: number[] = [];
    let stopped = false;
    let running = false;

    const at = (ms: number, fn: () => void) => { t.push(ctx.timer(fn, ms)); };
    const wipe = () => { t.forEach((id) => clearTimeout(id)); t = []; };
    /* each block keeps its own base class so state changes cannot lose it */
    h1w.dataset.base = 'h1wrap';
    subw.dataset.base = 'subwrap';
    const set = (el: HTMLElement, cls: string) => { el.className = `${el.dataset.base} ${cls}`; };
    const say = (text: string) => {
      if (!kick || kick.textContent === text) return;
      kick.classList.add('away');
      at(400, () => { kick.textContent = text; kick.classList.remove('away'); });
    };

    /* the resting state: real copy, no draft, eyebrow back to its own line */
    const rest = () => {
      wipe();
      set(h1w, 'd-out'); set(subw, 'd-out');
      if (kick) { kick.textContent = SAID; kick.classList.remove('away'); }
      rise();
    };

    const LAG = 340;
    const cycle = () => {
      if (stopped) return;
      running = true;
      /* dropping `ready` at the top of each cycle means every pass rises,
         rather than only the first one */
      root.classList.remove('ready');
      ([[h1w, 0], [subw, LAG]] as Array<[HTMLElement, number]>).forEach(([el, o]) => {
        at(0 + o, () => set(el, 'd-in'));
        at(1500 + o, () => set(el, 'd-in d-mark'));
        at(2350 + o, () => set(el, 'd-in d-mark d-cut'));
        at(3150 + o, () => set(el, 'd-in d-mark d-cut d-out'));
      });
      at(3150, rise);
      at(3700, () => say(CAP));
      at(7600, () => say(SAID));
      at(9400, cycle);
    };

    /* a deliberate interaction ends it for good and leaves the real copy up.
       Scrolling is NOT one - scrolling past is what the observer is for. */
    const onHit = (e: Event) => {
      const hero = q('.hero');
      if (e.type === 'keydown' || (hero && hero.contains(e.target as Node))) {
        if (stopped) return;
        stopped = true;
        rest();
      }
    };
    ctx.on(window, 'pointerdown', onHit, { capture: true, passive: true });
    ctx.on(window, 'keydown', onHit, { capture: true, passive: true });

    const hero = q('.hero');
    if ('IntersectionObserver' in window && hero) {
      const hio = ctx.observe(new IntersectionObserver((es) => {
        es.forEach((en) => {
          if (stopped) return;
          if (en.isIntersecting) { if (!running) cycle(); }
          else { rest(); running = false; }
        });
      }, { threshold: 0.2 }));
      hio.observe(hero);
    }
    cycle();
    cleanups.push(() => { stopped = true; wipe(); });
  });

  /* ------------------------------------------------------------- live check
     Real analysis, in the browser, nothing uploaded. */
  region('live-check', () => {
    const ta = q<HTMLTextAreaElement>('#ta');
    const res = q('#res');
    const wc = q('#wc');
    if (!ta || !res || !wc) return;

    const analyse = () => {
      const t = ta.value;
      const words = t.trim() ? t.trim().split(/\s+/).length : 0;
      wc.textContent = `${words} / 500 words`;
      wc.classList.toggle('over', words > 500);
      if (!t.trim()) { res.innerHTML = RES_EMPTY; return; }

      const low = t.toLowerCase();
      const found: string[] = [];
      WEAK.forEach((p) => { if (low.indexOf(p) > -1 && found.indexOf(p) < 0) found.push(p); });

      const rows: string[] = [];
      rows.push(found.length
        ? `<div class="res-row hit"><i></i><div><b>${found.length} low-signal phrase${found.length > 1 ? 's' : ''}</b><span>${
            found.slice(0, 6).map((p) => `<mark>${esc(p)}</mark>`).join(', ')
          }${found.length > 6 ? ` and ${found.length - 6} more` : ''
          }. Each of these can be replaced with something only you could have written.</span></div></div>`
        : '<div class="res-row ok"><i></i><div><b>No filler phrases caught</b><span>Nothing from the low-signal list appears here.</span></div></div>');

      const nums = t.match(/\b\d+(?:[.,]\d+)?%?\b/g) || [];
      rows.push(nums.length
        ? `<div class="res-row ok"><i></i><div><b>${nums.length} number${nums.length > 1 ? 's' : ''} present</b><span>Concrete figures are the fastest way to make a claim checkable.</span></div></div>`
        : '<div class="res-row hit"><i></i><div><b>No numbers</b><span>Scope, scale or a result would make this verifiable rather than asserted.</span></div></div>');

      const first = (t.trim().split(/[.!?\n]/)[0] || '').trim();
      if (/^(i am|i’m|i'm|my name|thank you for)/i.test(first)) {
        rows.push('<div class="res-row hit"><i></i><div><b>Opens about you</b><span>The strongest openings start with the problem or the work, not the applicant.</span></div></div>');
      }

      const sents = t.split(/[.!?]+/).filter((s) => s.trim().length > 4);
      const longest = sents.reduce((a, s) => Math.max(a, s.trim().split(/\s+/).length), 0);
      if (longest > 34) {
        rows.push(`<div class="res-row hit"><i></i><div><b>One sentence runs ${longest} words</b><span>Long sentences hide the claim. Split at the first natural break.</span></div></div>`);
      }

      res.innerHTML = rows.join('');
    };

    ctx.on(ta, 'input', analyse);
    qa<HTMLButtonElement>('.try button').forEach((b) => {
      ctx.on(b, 'click', () => {
        ta.value = SAMPLES[Number(b.dataset.s)];
        analyse();
        ta.focus();
      });
    });
    analyse();
  });

  /* --------------------------------------------------------- rewrite in place
     The sentence rewrites itself: marked phrases strike out, the stronger line
     rises in behind them, the score counts up. */
  region('rewrite', () => {
    const rw = q('#rw');
    const rwText = q('#rwText');
    const rwScore = q('#rwScore');
    const rwCap = q('#rwCap');
    const rwGo = q('#rwGo');
    const rwMetric = q('#rwMetric');
    if (!rw || !rwText || !rwScore || !rwCap || !rwGo || !rwMetric) return;

    let cur = 0;
    let counting: number | null = null;
    cleanups.push(() => { if (counting) cancelAnimationFrame(counting); });

    const countTo = (from: number, to: number, ms: number) => {
      if (counting) cancelAnimationFrame(counting);
      if (ctx.rm) { rwScore.textContent = String(to); return; }
      let t0: number | null = null;
      const step = (t: number) => {
        if (t0 === null) t0 = t;
        const k = Math.min((t - t0) / ms, 1);
        const e = 1 - Math.pow(1 - k, 3);
        rwScore.textContent = String(Math.round(from + (to - from) * e));
        if (k < 1) counting = requestAnimationFrame(step);
      };
      counting = requestAnimationFrame(step);
    };

    const paint = (i: number) => {
      cur = i;
      const e = EXAMPLES[i];
      rwText.innerHTML = rewriteHtml(i);
      rw.classList.remove('done');
      rwScore.textContent = String(e.sb);
      rwCap.textContent = 'Before';
      rwGo.textContent = 'Rewrite it';
      rwMetric.textContent = e.m;
    };

    ctx.on(rwGo, 'click', () => {
      const e = EXAMPLES[cur];
      const on = !rw.classList.contains('done');
      rw.classList.toggle('done', on);
      rwCap.textContent = on ? 'After' : 'Before';
      rwGo.textContent = on ? 'Show the original' : 'Rewrite it';
      countTo(on ? e.sb : e.sa, on ? e.sa : e.sb, 620);
    });
    qa<HTMLButtonElement>('.rw-pick button').forEach((btn) => {
      ctx.on(btn, 'click', () => {
        qa('.rw-pick button').forEach((b) => b.setAttribute('aria-selected', 'false'));
        btn.setAttribute('aria-selected', 'true');
        paint(Number(btn.dataset.i));
      });
    });
    paint(0);
  });

  /* ------------------------------------------------------------ the chat plays */
  region('chat', () => {
    const log = q('#chatLog');
    const tabs = q('#chatTabs');
    if (!log) return;

    let held = false;
    let ticker: number | null = null;
    let localTimers: number[] = [];

    const clearAll = () => {
      localTimers.forEach((id) => clearTimeout(id));
      localTimers = [];
      if (ticker) { clearInterval(ticker); ticker = null; }
    };
    cleanups.push(clearAll);

    const later = (fn: () => void, ms: number) => { localTimers.push(ctx.timer(fn, ms)); };
    const toBottom = () => { log.scrollTop = log.scrollHeight; };
    const bubble = (role: 'u' | 'a') => {
      const d = document.createElement('div');
      d.className = `msg ${role === 'u' ? 'msg-u' : 'msg-a'}`;
      log.appendChild(d);
      toBottom();
      return d;
    };
    const typingDots = () => {
      const d = bubble('a');
      d.className += ' typing';
      d.innerHTML = '<i></i><i></i><i></i>';
      toBottom();
      return d;
    };
    /* Both sides are typed out. A chat where only one side composes reads like
       a transcript being replayed rather than a conversation happening. */
    const typeInto = (el: HTMLElement, text: string, cps: number, done?: () => void) => {
      let i = 0;
      el.classList.add('typ');
      ticker = ctx.interval(() => {
        i = Math.min(text.length, i + (text.length > 90 ? 3 : 2));
        el.textContent = text.slice(0, i);
        toBottom();
        if (i >= text.length) {
          if (ticker) clearInterval(ticker);
          ticker = null;
          el.classList.remove('typ');
          if (done) done();
        }
      }, cps);
    };

    const play = (i: number, manual?: boolean) => {
      clearAll();
      log.innerHTML = '';
      if (manual) held = true;   /* once you choose one, stop cycling under you */
      if (tabs) Array.from(tabs.children).forEach((b, n) => b.setAttribute('aria-selected', String(n === i)));
      if (ctx.rm) {
        CHATS[i].forEach((m) => { bubble(m[0]).textContent = m[1]; });
        return;
      }
      const seq = CHATS[i];
      let n = 0;
      const next = () => {
        if (n >= seq.length) {
          later(() => { if (!held) play((i + 1) % CHATS.length); }, 3200);
          return;
        }
        const m = seq[n++];
        if (m[0] === 'a') {
          const dots = typingDots();
          later(() => {
            dots.remove();
            typeInto(bubble('a'), m[1], 26, () => later(next, 620));
          }, 780);
        } else {
          /* the candidate pauses before starting to type, the way people do */
          later(() => {
            typeInto(bubble('u'), m[1], 34, () => later(next, 480));
          }, 380);
        }
      };
      next();
    };

    if (tabs) {
      Array.from(tabs.children).forEach((b) => {
        ctx.on(b as HTMLElement, 'click', () => play(Number((b as HTMLElement).dataset.c), true));
      });
    }
    /* only start once it is on screen, so the first conversation is not missed */
    if ('IntersectionObserver' in window) {
      const cio = ctx.observe(new IntersectionObserver((es) => {
        es.forEach((en) => { if (en.isIntersecting) { play(0); cio.disconnect(); } });
      }, { threshold: 0.25 }));
      cio.observe(log);
    } else {
      play(0);
    }
  });

  /* --------------------------------------------- the page through the four
     `.on` accumulates rather than moving, so each card holds its result and
     the row reads as one document at four stages. */
  region('modes', () => {
    const modes = q('#modes');
    if (!modes || ctx.rm) return;
    const cards = Array.from(modes.querySelectorAll<HTMLElement>('.mode'));
    let mi = 0;
    let mtimer: number | null = null;
    const mstep = () => {
      if (mi < cards.length) { cards[mi].classList.add('on'); mi++; }
      else if (mi === cards.length + 2) {           /* hold the finished row */
        cards.forEach((c) => c.classList.remove('on'));
        mi = 0;
      } else mi++;
    };
    const stop = () => { if (mtimer) { clearInterval(mtimer); mtimer = null; } };
    cleanups.push(stop);
    if ('IntersectionObserver' in window) {
      const mio = ctx.observe(new IntersectionObserver((es) => {
        es.forEach((en) => {
          if (en.isIntersecting) { if (!mtimer) { mstep(); mtimer = ctx.interval(mstep, 900); } }
          else stop();
        });
      }, { threshold: 0.25 }));
      mio.observe(modes);
    } else { mstep(); mtimer = ctx.interval(mstep, 900); }
  });

  /* ------- scroll reveal, with a sweep so an anchor jump cannot leave content
     hidden. The sweep is why a deep link to #pricing does not land on a blank
     screen: the observer only fires on things that cross the edge. */
  region('reveal', () => {
    const pending = qa<HTMLElement>('.rise');
    const showEl = (n: HTMLElement, i: number) => {
      n.style.transitionDelay = `${Math.min(i || 0, 6) * 70}ms`;
      n.classList.add('in');
      const k = pending.indexOf(n);
      if (k > -1) pending.splice(k, 1);
    };
    if ('IntersectionObserver' in window && !ctx.rm) {
      const io = ctx.observe(new IntersectionObserver((es) => {
        es.forEach((e, i) => { if (e.isIntersecting) { showEl(e.target as HTMLElement, i); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }));
      pending.forEach((n) => io.observe(n));
      let busy = false;
      const sweep = () => {
        if (busy) return;
        busy = true;
        requestAnimationFrame(() => {
          busy = false;
          for (let i = pending.length - 1; i >= 0; i--) {
            const n = pending[i];
            if (n.getBoundingClientRect().top < innerHeight * 0.9) { io.unobserve(n); showEl(n, 0); }
          }
        });
      };
      ctx.on(window, 'scroll', sweep, { passive: true });
      ctx.on(window, 'hashchange', sweep);
    } else {
      pending.slice().forEach((n) => showEl(n, 0));
    }
  });

  /* -------------------------------------------------------- dock and sheet
     On a 900px phone held one-handed the comfortable reach is the bottom 60%.
     The nav links are display:none below 980px, so without this half the page
     has no way in. */
  region('dock', () => {
    const bbar = q('#bbar');
    const sheet = q('#sheet');
    const menuT = q<HTMLButtonElement>('#menuT');
    const bbHere = q('#bbHere');

    if (menuT && sheet) {
      const setSheet = (on: boolean) => {
        sheet.hidden = !on;
        requestAnimationFrame(() => sheet.classList.toggle('open', on));
        menuT.setAttribute('aria-expanded', String(on));
        menuT.setAttribute('aria-label', on ? 'Close menu' : 'Open menu');
        document.body.style.overflow = on ? 'hidden' : '';
      };
      cleanups.push(() => { document.body.style.overflow = ''; });
      ctx.on(menuT, 'click', () => setSheet(sheet.hidden));
      ctx.on(sheet, 'click', (e) => {
        const t = e.target as HTMLElement;
        if (t === sheet || t.tagName === 'A') setSheet(false);
      });
      ctx.on(window, 'keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Escape' && !sheet.hidden) setSheet(false);
      });
    }

    /* the dock names the section you are in, and marks it in the sheet. Read
       from the same #ids the sheet links to, so the two cannot disagree. */
    let lastSect = '';
    const markSection = () => {
      if (!bbHere) return;
      let best = SECTIONS[0];
      let bestTop = -Infinity;
      SECTIONS.forEach((p) => {
        const el = root.querySelector(`#${p[0]}`);
        if (!el) return;
        const top = el.getBoundingClientRect().top - innerHeight * 0.34;
        if (top <= 0 && top > bestTop) { bestTop = top; best = p; }
      });
      if (best[0] === lastSect) return;
      lastSect = best[0];
      bbHere.textContent = best[1];
      if (sheet) {
        Array.from(sheet.querySelectorAll('a')).forEach((a) => {
          a.setAttribute('aria-current', String(a.getAttribute('href') === `#${best[0]}`));
        });
      }
    };

    /* ------------------------------------------------------------- scroll
       One rAF-throttled handler, transform and custom-property writes only,
       so nothing here touches layout:
         · the nav's bottom edge doubles as a reading-progress bar
         · the hero mark rises slower than the page, and its two ribbons ease
           apart a few degrees - the fold opening as you descend
         · the nav goes solid once the hero is behind you */
    const nav = q('#nav');
    const mkA = q<SVGElement>('.hero-mk .ribA');
    const mkB = q<SVGElement>('.hero-mk .ribB');
    const hero = q('.hero');
    let ticking = false;
    const frame = () => {
      ticking = false;
      const y = scrollY || 0;
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - innerHeight);
      if (nav) {
        nav.style.setProperty('--sp', (y / max).toFixed(4));
        nav.classList.toggle('stuck', y > 40);
      }
      if (bbar) bbar.classList.toggle('up', y > innerHeight * 0.62);
      markSection();
      if (ctx.rm || !mkA || !mkB || !hero) return;
      const hh = hero.offsetHeight || 1;
      const t = Math.min(y / hh, 1);              /* 0 at top, 1 past the hero */
      const lift = -t * 90;                       /* mark rises slower than copy */
      const open = t * 3.2;                       /* ribbons ease apart, degrees */
      mkA.style.transform = `translateY(${lift.toFixed(1)}px) rotate(${(-open).toFixed(2)}deg)`;
      mkB.style.transform = `translateY(${lift.toFixed(1)}px) rotate(${open.toFixed(2)}deg)`;
    };
    ctx.on(window, 'scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(frame); }
    }, { passive: true });
    ctx.on(window, 'resize', frame, { passive: true });
    frame();
  });

  /* ---------------------------------------------------------------- nav menus
     The panels already open and close without this - they are <details>. What
     script adds: hover-to-open on a fine pointer, one panel open at a time,
     Escape and outside-click to dismiss, and wiring the entries that point at
     a widget state to that state. */
  region('nav-menus', () => {
    const nds = qa<HTMLDetailsElement>('.nd');
    if (!nds.length) return;
    const closeAll = (except?: HTMLDetailsElement) => {
      nds.forEach((d) => { if (d !== except) d.open = false; });
    };
    const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
    nds.forEach((d) => {
      ctx.on(d, 'toggle', () => { if (d.open) closeAll(d); });
      if (!fine) return;
      let shut: number | null = null;
      ctx.on(d, 'mouseenter', () => { if (shut) clearTimeout(shut); d.open = true; });
      ctx.on(d, 'mouseleave', () => { shut = ctx.timer(() => { d.open = false; }, 180); });
      /* mouseenter has already opened it by the time the click lands, so the
         native toggle would immediately shut it again. Suppress the toggle for
         pointer clicks only - e.detail is 0 when a keyboard fired it, and
         Enter/Space must keep working. */
      const summary = d.querySelector('summary');
      if (summary) {
        ctx.on(summary as HTMLElement, 'click', (e) => {
          if ((e as MouseEvent).detail > 0) e.preventDefault();
        });
      }
    });
    ctx.on(window, 'keydown', (e) => { if ((e as KeyboardEvent).key === 'Escape') closeAll(); });
    ctx.on(window, 'click', (e) => {
      const t = e.target as HTMLElement;
      if (!t.closest || !t.closest('.nd')) closeAll();
    });
    /* an entry that names a widget state selects it, rather than dropping the
       reader at the top of a section and leaving them to find it */
    qa<HTMLAnchorElement>('.nd-pop a').forEach((a) => {
      ctx.on(a, 'click', () => {
        if (a.dataset.ex !== undefined) {
          q<HTMLButtonElement>(`.rw-pick button[data-i="${a.dataset.ex}"]`)?.click();
        }
        if (a.dataset.chat !== undefined) {
          q<HTMLButtonElement>(`.chat-tabs button[data-c="${a.dataset.chat}"]`)?.click();
        }
        closeAll();
      });
    });
  });

  return () => {
    timers.forEach((id) => clearTimeout(id));
    intervals.forEach((id) => clearInterval(id));
    timers.clear();
    intervals.clear();
    cleanups.splice(0).forEach((fn) => { try { fn(); } catch { /* teardown is best-effort */ } });
  };
}

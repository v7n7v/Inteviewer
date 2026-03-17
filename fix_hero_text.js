const fs = require('fs');
const filePath = 'components/HeroSection.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
  ['className="w-3 h-3 text-white"', 'className={`w-3 h-3 ${isLight ? \'text-gray-900\' : \'text-white\'}`}'],
  ['className="text-[14px] text-white/30 leading-relaxed mb-5 max-w-md"', 'className={`text-[14px] leading-relaxed mb-5 max-w-md ${isLight ? \'text-gray-600\' : \'text-white/30\'}` }'],
  ['className="flex items-center gap-1.5 text-[11px] text-white/30 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.05]"', 'className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border ${isLight ? \'text-gray-500 bg-black/5 border-black/10\' : \'text-white/30 bg-white/[0.03] border-white/[0.05]\'}` }'],
  ['className="text-[10px] font-medium text-white/20 uppercase tracking-[0.2em]"', 'className={`text-[10px] font-medium uppercase tracking-[0.2em] ${isLight ? \'text-gray-500\' : \'text-white/20\'}` }'],
  ['className="text-xl md:text-2xl font-bold text-white/85 tracking-tight"', 'className={`text-xl md:text-2xl font-bold tracking-tight ${isLight ? \'text-gray-900\' : \'text-white/85\'}` }'],
  ['isActive ? \'text-white/90\' : \'text-white/40 group-hover:text-white/60\'', 'isActive ? (isLight ? \'text-gray-900\' : \'text-white/90\') : (isLight ? \'text-gray-400 group-hover:text-gray-600\' : \'text-white/40 group-hover:text-white/60\')'],
  ['className="text-[15px] font-semibold text-white/85"', 'className={`text-[15px] font-semibold ${isLight ? \'text-gray-900\' : \'text-white/85\'}` }'],
  ['className="text-[13px] text-white/35 leading-relaxed mb-5 max-w-md"', 'className={`text-[13px] leading-relaxed mb-5 max-w-md ${isLight ? \'text-gray-600\' : \'text-white/35\'}` }'],
  ['className="text-[9px] text-white/15"', 'className={`text-[9px] ${isLight ? \'text-gray-400\' : \'text-white/15\'}` }'],
  ['className="text-[15px] md:text-base text-white/50 leading-relaxed mb-3 font-light"', 'className={`text-[15px] md:text-base leading-relaxed mb-3 font-light ${isLight ? \'text-gray-600\' : \'text-white/50\'}` }'],
  ['className="w-6 h-6 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-[9px] font-semibold text-white/35"', 'className={`w-6 h-6 rounded-full border flex items-center justify-center text-[9px] font-semibold ${isLight ? \'bg-black/5 border-black/10 text-gray-500\' : \'bg-white/[0.04] border-white/[0.06] text-white/35\'}` }'],
  ['className="text-[11px] text-white/45 font-medium"', 'className={`text-[11px] font-medium ${isLight ? \'text-gray-700\' : \'text-white/45\'}` }'],
  ['className="text-[14px] text-white/25 max-w-md mx-auto"', 'className={`text-[14px] max-w-md mx-auto ${isLight ? \'text-gray-500\' : \'text-white/25\'}` }'],
  ['className="text-[15px] font-semibold text-white/70 mb-1"', 'className={`text-[15px] font-semibold mb-1 ${isLight ? \'text-gray-700\' : \'text-white/70\'}` }'],
  ['className="text-3xl font-bold text-white/80"', 'className={`text-3xl font-bold ${isLight ? \'text-gray-900\' : \'text-white/80\'}` }'],
  ['className="text-[12px] text-white/20"', 'className={`text-[12px] ${isLight ? \'text-gray-400\' : \'text-white/20\'}` }'],
  ['className="text-[12px] text-white/25 mt-2"', 'className={`text-[12px] mt-2 ${isLight ? \'text-gray-500\' : \'text-white/25\'}` }'],
  ['className="w-2.5 h-2.5 text-white/25"', 'className={`w-2.5 h-2.5 ${isLight ? \'text-gray-400\' : \'text-white/25\'}` }'],
  ['className="text-[12px] text-white/40"', 'className={`text-[12px] ${isLight ? \'text-gray-600\' : \'text-white/40\'}` }'],
  ['className="text-[9px] text-white/15 ml-auto"', 'className={`text-[9px] ml-auto ${isLight ? \'text-gray-400\' : \'text-white/15\'}` }'],
  ['className="w-full text-[13px] font-medium text-white/60 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] py-2.5 rounded-xl transition-all"', 'className={`w-full text-[13px] font-medium py-2.5 rounded-xl transition-all ${isLight ? \'text-gray-600 bg-black/5 hover:bg-black/10 border border-black/10\' : \'text-white/60 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08]\'}` }'],
  ['className="text-[15px] font-semibold text-white/90 mb-1"', 'className={`text-[15px] font-semibold mb-1 ${isLight ? \'text-gray-900\' : \'text-white/90\'}` }'],
  ['className="text-3xl font-bold text-white"', 'className={`text-3xl font-bold ${isLight ? \'text-gray-900\' : \'text-white\'}` }'],
  ['className="text-[12px] text-white/30"', 'className={`text-[12px] ${isLight ? \'text-gray-500\' : \'text-white/30\'}` }'],
  ['className="line-through text-white/15"', 'className={`line-through ${isLight ? \'text-gray-400\' : \'text-white/15\'}` }'],
  ['className="text-xl font-bold text-white/80 tracking-tight mb-2"', 'className={`text-xl font-bold tracking-tight mb-2 ${isLight ? \'text-gray-800\' : \'text-white/80\'}` }'],
  ['className="text-[13px] text-white/20 mb-5"', 'className={`text-[13px] mb-5 ${isLight ? \'text-gray-500\' : \'text-white/20\'}` }'],
  ['className="w-2.5 h-2.5 text-white"', 'className={`w-2.5 h-2.5 ${isLight ? \'text-gray-900\' : \'text-white\'}` }'],
  ['className="text-[11px] text-white/25"', 'className={`text-[11px] ${isLight ? \'text-gray-400\' : \'text-white/25\'}` }'],
  ['className="flex items-center gap-4 text-[11px] text-white/15"', 'className={`flex items-center gap-4 text-[11px] ${isLight ? \'text-gray-400\' : \'text-white/15\'}` }'],
  ['className="hover:text-white/35 transition-colors"', 'className={`transition-colors ${isLight ? \'hover:text-gray-600\' : \'hover:text-white/35\'}` }'],
  ['className="text-[13px] font-semibold tracking-tight text-white/90"', 'className={`text-[13px] font-semibold tracking-tight ${isLight ? \'text-gray-800\' : \'text-white/90\'}` }'],
  ['<span className="text-[9px] text-white/15">{quotes[activeQuote].title} • {quotes[activeQuote].co}</span>', '<span className={`text-[9px] ${isLight ? \'text-gray-400\' : \'text-white/15\'}`}>{quotes[activeQuote].title} • {quotes[activeQuote].co}</span>']
];

for (const [find, replace] of replacements) {
    if(!content.includes(find)) console.log(`Not found: ${find}`);
    content = content.replaceAll(find, replace);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Script done.');

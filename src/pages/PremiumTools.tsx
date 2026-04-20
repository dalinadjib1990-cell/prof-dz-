import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Wand2, CheckSquare, Lock, Key, Mail, Phone, Sparkles, Send, Loader2, FileText, ClipboardCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { doc, updateDoc, Timestamp, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function PremiumTools() {
  const { profile } = useAuth();
  const [activeTool, setActiveTool] = useState<'generator' | 'corrector' | null>(null);
  const [activationCode, setActivationCode] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  
  // Generator State
  const [genScope, setGenScope] = useState<'lesson_plan' | 'assignment' | 'exam'>('lesson_plan');
  const [genSubject, setGenSubject] = useState(profile?.subject || '');
  const [genLevel, setGenLevel] = useState(profile?.level || '');
  const [genTopic, setGenTopic] = useState('');
  const [genResult, setGenResult] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Corrector State
  const [correctText, setCorrectText] = useState('');
  const [correctResult, setCorrectResult] = useState('');
  const [isCorrecting, setIsCorrecting] = useState(false);

  const isPremium = profile?.premiumUntil ? profile.premiumUntil.toDate() > new Date() : false;

  const handleActivate = async () => {
    if (!profile) return;
    setIsActivating(true);
    setActivationError(null);
    try {
      // For the sake of this implementation, we check a collection 'activation_codes'
      const codesRef = collection(db, 'activation_codes');
      const q = query(codesRef, where('code', '==', activationCode.trim()));
      const snap = await getDocs(q);

      if (snap.empty) {
        // Fallback for demonstration: DALI-TEAC-2026
        if (activationCode.trim() === 'DALI-TEAC-2026') {
          const expiryDate = new Date();
          expiryDate.setFullYear(expiryDate.getFullYear() + 1);
          await updateDoc(doc(db, 'users', profile.uid), {
            premiumUntil: Timestamp.fromDate(expiryDate),
            isActivated: true
          });
          setActivationCode('');
          setIsActivating(false);
          alert('Demo code accepted! Your yearly premium subscription is now active.');
          return;
        }
        setActivationError('Invalid activation code. Please contact the administrator.');
        setIsActivating(false);
        return;
      }

      const codeDoc = snap.docs[0];
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 year

      await updateDoc(doc(db, 'users', profile.uid), {
        premiumUntil: Timestamp.fromDate(expiryDate),
        isActivated: true
      });

      // Delete the used code
      await deleteDoc(codeDoc.ref);
      
      setActivationCode('');
      setIsActivating(false);
      alert('Congratulations! Your yearly premium subscription is now active.');
    } catch (err: any) {
      setActivationError(err.message || 'Activation failed.');
      setIsActivating(false);
    }
  };

  const generateContent = async () => {
    setIsGenerating(true);
    try {
      const prompt = `You are an expert Algerian teacher. Generate a high-quality ${genScope.replace('_', ' ')} for the subject "${genSubject}" and level "${genLevel}".
      Topic: ${genTopic}
      Language: ${profile?.settings?.language === 'ar' ? 'Arabic' : 'French/English as appropriate for the subject'}
      Structure: Professional and ready-to-use.
      Include: Learning objectives, detailed content, and assessment questions.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
      });

      setGenResult(response.text || 'No generation result.');
    } catch (err) {
      console.error(err);
      alert('Generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const correctContent = async () => {
    setIsCorrecting(true);
    try {
      const prompt = `You are an expert educational corrector. Analyze the following student response or teacher content for subject "${profile?.subject}". 
      Content: ${correctText}
      Task: Provide a detailed correction, grade (out of 20), and constructive feedback.
      Language: ${profile?.settings?.language === 'ar' ? 'Arabic' : 'French/English'}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
      });

      setCorrectResult(response.text || 'No correction result.');
    } catch (err) {
      console.error(err);
      alert('Correction failed.');
    } finally {
      setIsCorrecting(false);
    }
  };

  if (!isPremium) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-8 text-center bg-slate-950 rounded-[40px] border border-slate-900 border-dashed relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-blue-600/5 pointer-events-none"></div>
        
        <div className="bg-purple-600/20 p-6 rounded-[32px] mb-8 relative">
          <div className="absolute inset-0 bg-purple-500 blur-2xl opacity-20 animate-pulse"></div>
          <Lock className="w-16 h-16 text-purple-500 relative z-10" />
        </div>

        <h1 className="text-4xl font-black text-white mb-4">Premium AI Tools</h1>
        <p className="text-slate-400 max-w-lg mb-8 text-lg font-medium">
          Access our powerful AI generators for lesson plans, tests, and automated grading. 
          A yearly subscription is required to unlock these professional features.
        </p>

        <div className="w-full max-w-md bg-slate-900 rounded-[32px] p-8 border border-slate-800 shadow-2xl relative z-10">
          <h2 className="text-xl font-black text-white mb-6 flex items-center justify-center gap-2">
            <Key className="w-5 h-5 text-purple-500" />
            Enter Activation Code
          </h2>
          
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Enter your 12-digit code..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white font-mono focus:ring-2 focus:ring-purple-500 outline-none transition-all"
              value={activationCode}
              onChange={(e) => setActivationCode(e.target.value)}
            />
            
            {activationError && (
              <div className="flex items-center gap-2 text-red-400 text-sm font-bold bg-red-400/10 p-3 rounded-xl border border-red-400/20">
                <AlertCircle className="w-4 h-4" />
                {activationError}
              </div>
            )}

            <button 
              onClick={handleActivate}
              disabled={isActivating || !activationCode}
              className="w-full py-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-black rounded-2xl transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
            >
              {isActivating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              Activate Subscription
            </button>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-800 space-y-4">
            <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Contact for Activation</p>
            <div className="flex flex-col gap-3">
              <a href="mailto:dalinadjib1990@gmail.com" className="flex items-center gap-3 text-slate-300 hover:text-purple-400 transition-colors bg-slate-950 p-4 rounded-xl border border-slate-800 group">
                <Mail className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-sm">dalinadjib1990@gmail.com</span>
              </a>
              <a href="tel:0673831994" className="flex items-center gap-3 text-slate-300 hover:text-purple-400 transition-colors bg-slate-950 p-4 rounded-xl border border-slate-800 group">
                <Phone className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-sm">0673831994</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-purple-600 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="relative z-10">
          <p className="text-purple-200 text-sm font-black uppercase tracking-widest mb-1">Premium Dashboard</p>
          <h1 className="text-4xl font-black mb-2">AI Teacher Assistant</h1>
          <p className="text-purple-100 font-medium opacity-90">Revolutionize your teaching with pro AI tools.</p>
        </div>
        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-6 py-3 rounded-3xl border border-white/20 relative z-10">
          <CheckCircle2 className="w-6 h-6 text-green-400" />
          <div className="text-left">
            <p className="text-[10px] font-black uppercase tracking-tighter text-white/60 leading-none">Subscription Active</p>
            <p className="text-sm font-black">Until {profile.premiumUntil?.toDate().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Tool 1: Generator */}
        <motion.div 
          whileHover={{ y: -5 }}
          className={cn(
            "p-8 rounded-[40px] border-2 transition-all cursor-pointer group relative overflow-hidden",
            activeTool === 'generator' ? "bg-slate-900 border-purple-500 shadow-2xl shadow-purple-500/10" : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
          )}
          onClick={() => setActiveTool('generator')}
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Wand2 className="w-32 h-32" />
          </div>
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-colors ${activeTool === 'generator' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700'}`}>
            <FileText className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">مولد المذكرات والواجبات</h2>
          <p className="text-slate-400 font-medium text-sm leading-relaxed mb-6">
            قم بتوليد مذكرات الأستاذ، الفروض والاختبارات بشكل احترافي وسريع باستخدام الذكاء الاصطناعي.
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-purple-400 font-black text-xs uppercase tracking-widest">
              <span>استخدام الأداة المدمجة</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
            <a 
              href="https://pro-mat-psn3.vercel.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-2 text-center py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-500 hover:text-purple-400 hover:border-purple-500/30 transition-all"
            >
              فتح التطبيق الخارجي (Pro-Mat)
            </a>
          </div>
        </motion.div>

        {/* Tool 2: Corrector */}
        <motion.div 
          whileHover={{ y: -5 }}
          className={cn(
            "p-8 rounded-[40px] border-2 transition-all cursor-pointer group relative overflow-hidden",
            activeTool === 'corrector' ? "bg-slate-900 border-blue-500 shadow-2xl shadow-blue-500/10" : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
          )}
          onClick={() => setActiveTool('corrector')}
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <CheckSquare className="w-32 h-32" />
          </div>
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-colors ${activeTool === 'corrector' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700'}`}>
            <ClipboardCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">المصحح الذكي</h2>
          <p className="text-slate-400 font-medium text-sm leading-relaxed mb-6">
            تصحيح الفروض والاختبارات وتقديم ملاحظات توجيهية للطلبة بشكل آلي.
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-blue-400 font-black text-xs uppercase tracking-widest">
              <span>استخدام الأداة المدمجة</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
            <a 
              href="https://cour-qi-kc16.vercel.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-2 text-center py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-500 hover:text-blue-400 hover:border-blue-500/30 transition-all"
            >
              فتح التطبيق الخارجي (Cour-Qi)
            </a>
          </div>
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        {activeTool === 'generator' && (
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="bg-slate-900 rounded-[40px] border border-slate-800 p-8 shadow-2xl"
          >
            <div className="flex items-center gap-4 mb-8 border-b border-slate-800 pb-8">
              <div className="bg-purple-600 p-3 rounded-2xl">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-black text-white">Generator Workspace</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-4">Type of Document</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['lesson_plan', 'assignment', 'exam'].map((type) => (
                      <button 
                        key={type}
                        onClick={() => setGenScope(type as any)}
                        className={`py-3 rounded-2xl text-xs font-black transition-all ${genScope === type ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-950 text-slate-500 hover:text-slate-300 border border-slate-800'}`}
                      >
                        {type === 'lesson_plan' ? 'Memo' : type === 'assignment' ? 'Test' : 'Exam'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-4">Subject</label>
                    <input 
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all font-bold"
                      value={genSubject}
                      onChange={(e) => setGenSubject(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-4">Level</label>
                    <input 
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all font-bold"
                      value={genLevel}
                      onChange={(e) => setGenLevel(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-4">Topic / Specific Details</label>
                  <textarea 
                    rows={4}
                    placeholder="e.g. Photosynthesis in plants, Second World War, Quadratic equations..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-3xl px-6 py-4 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium resize-none"
                    value={genTopic}
                    onChange={(e) => setGenTopic(e.target.value)}
                  />
                </div>

                <button 
                  onClick={generateContent}
                  disabled={isGenerating || !genTopic}
                  className="w-full py-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-black rounded-2xl transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-3 group"
                >
                  {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                  Generate Document
                </button>
              </div>

              <div className="bg-slate-950 rounded-[32px] border border-slate-800 p-8 min-h-[400px] relative">
                {!genResult && !isGenerating && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700 p-8 text-center">
                    <Sparkles className="w-12 h-12 mb-4 opacity-50" />
                    <p className="font-bold">Your generated content will appear here.</p>
                  </div>
                )}
                {isGenerating && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-purple-500/50 p-8 text-center">
                    <Loader2 className="w-12 h-12 mb-4 animate-spin" />
                    <p className="font-black animate-pulse">Consulting AI Professors...</p>
                  </div>
                )}
                <div className="markdown-body prose prose-invert max-w-none">
                  <ReactMarkdown>{genResult}</ReactMarkdown>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTool === 'corrector' && (
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="bg-slate-900 rounded-[40px] border border-slate-800 p-8 shadow-2xl"
          >
            <div className="flex items-center gap-4 mb-8 border-b border-slate-800 pb-8">
              <div className="bg-blue-600 p-3 rounded-2xl">
                <ClipboardCheck className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-black text-white">Correction Workspace</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-4">Input student content or scan text</label>
                  <textarea 
                    rows={12}
                    placeholder="Paste student answer, essay, or specific exercise text here..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-3xl px-6 py-6 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium resize-none shadow-inner"
                    value={correctText}
                    onChange={(e) => setCorrectText(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-4 text-xs font-bold text-slate-500 bg-blue-500/5 p-4 rounded-2xl border border-blue-500/10">
                  <Info className="w-5 h-5 text-blue-500 shrink-0" />
                  AI will check grammar, factual accuracy, and provide a grading suggestion based on your subject profile.
                </div>

                <button 
                  onClick={correctContent}
                  disabled={isCorrecting || !correctText}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-3 group"
                >
                  {isCorrecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 group-hover:scale-125 transition-transform" />}
                  Analyze & Correct
                </button>
              </div>

              <div className="bg-slate-950 rounded-[32px] border border-slate-800 p-8 min-h-[400px] relative">
                {!correctResult && !isCorrecting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700 p-8 text-center">
                    <ClipboardCheck className="w-12 h-12 mb-4 opacity-50" />
                    <p className="font-bold">Correction and feedback will appear here.</p>
                  </div>
                )}
                {isCorrecting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-blue-500/50 p-8 text-center">
                    <Loader2 className="w-12 h-12 mb-4 animate-spin" />
                    <p className="font-black animate-pulse">Analyzing student work...</p>
                  </div>
                )}
                <div className="markdown-body prose prose-invert max-w-none">
                  <ReactMarkdown>{correctResult}</ReactMarkdown>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper icons
function ChevronRight(props: any) {
  return <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>;
}

function Info(props: any) {
  return <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>;
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, SendHorizontal, X, Sparkles, Calendar, ClipboardCheck, ArrowUpRight, Eraser } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Task, ScheduleEvent } from '../types';
import { GoogleGenAI } from '@google/genai';

// Let's import the user-approved TonAvatar image component or just define one using the fresh avatar URL
const TON_AVATAR_URL = "https://i.imgur.com/09S3lJS.png";

const TonAvatar: React.FC<{ size?: number }> = ({ size = 40 }) => {
  return (
    <img 
      src={TON_AVATAR_URL} 
      alt="Ton Avatar" 
      width={size} 
      height={size} 
      className="shrink-0 select-none shadow-xs rounded-full bg-[#f8fafc] border border-slate-200 object-cover" 
      style={{ width: size, height: size }}
      referrerPolicy="no-referrer"
    />
  );
};

// Help parser to render simple Markdown safely in line-by-line format
const SimpleMarkdown: React.FC<{ content: string }> = ({ content }) => {
  // Simple markdown renderer for bolding, bullet points, headers, inline code, and line breaks
  const paragraphs = content.split('\n');
  return (
    <div className="space-y-1.5 whitespace-pre-wrap">
      {paragraphs.map((para, pIdx) => {
        let trimmed = para.trim();
        if (!trimmed) return <div key={pIdx} className="h-2" />;

        // Check if paragraph is clean list item
        const isBullet = trimmed.startsWith('*') || trimmed.startsWith('-') || trimmed.startsWith('•');
        if (isBullet) {
          trimmed = trimmed.substring(1).trim();
        }

        // Process bold (**text**)
        const parts = [];
        let index = 0;
        const boldRegex = /\*\*(.*?)\*\*/g;
        let match;
        
        while ((match = boldRegex.exec(trimmed)) !== null) {
          // Add text before match
          if (match.index > index) {
            parts.push(trimmed.substring(index, match.index));
          }
          // Add bold text
          parts.push(
            <strong key={match.index} className="font-extrabold text-[#0f172a]">
              {match[1]}
            </strong>
          );
          index = boldRegex.lastIndex;
        }
        
        if (index < trimmed.length) {
          parts.push(trimmed.substring(index));
        }

        if (isBullet) {
          return (
            <div key={pIdx} className="flex gap-2 items-start pl-2">
              <span className="text-amber-500 font-extrabold text-[12px] mt-0.5">•</span>
              <span className="flex-1 text-slate-700 leading-relaxed text-[12px]">{parts}</span>
            </div>
          );
        }

        return (
          <p key={pIdx} className="text-slate-705 leading-relaxed text-[12px]">
            {parts}
          </p>
        );
      })}
    </div>
  );
};

interface TonFABChatProps {
  currentUser: User | null;
  tasks: Task[];
  schedules: ScheduleEvent[];
  users: User[];
}

export const TonFABChat: React.FC<TonFABChatProps> = ({ currentUser, tasks, schedules, users }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; content: string }[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showBadge, setShowBadge] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss the helper preview bubble 3 seconds after page load
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowBadge(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Initialize with a warm, customized greeting or load saved chat logs
  useEffect(() => {
    if (currentUser) {
      try {
        const saved = localStorage.getItem(`ton_home_chat_history_${currentUser.id}`);
        if (saved) {
          setMessages(JSON.parse(saved));
          return;
        }
      } catch (e) {
        console.error("Erro ao carregar histórico do Ton:", e);
      }

      const firstName = currentUser.name.split(' ')[0];
      setMessages([
        {
          role: 'model',
          content: `Paz e Bem, **${firstName}**! 🙏 Eu sou o **Ton**, seu tutor e assistente virtual da Pascom!\n\nPosso te ajudar a consultar suas **Tarefas**, verificar suas **Escalas** ou conferir a **Agenda Geral** da nossa comunidade. O que gostaria de conferir hoje?`
        }
      ]);
    } else {
      setMessages([
        {
          role: 'model',
          content: 'Olá! Eu sou o **Ton**, assistente pessoal inteligente da Pascom. Por favor, faça login para podermos consultar suas tarefas e escalas!'
        }
      ]);
    }
  }, [currentUser]);

  // Persist homepage chatbot history automatically
  useEffect(() => {
    if (currentUser && messages.length > 0) {
      try {
        localStorage.setItem(`ton_home_chat_history_${currentUser.id}`, JSON.stringify(messages));
      } catch (e) {
        console.error("Erro ao salvar histórico do Ton:", e);
      }
    }
  }, [messages, currentUser]);

  // Scroll to bottom when messages list updates
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  if (!currentUser) return null;

  // Build the live grounding context files to ground Ton's capabilities
  const myAssignedTasks = tasks.filter(t => t.assigneeIds && t.assigneeIds.includes(currentUser.id));
  
  const myAssignedSchedules = schedules.filter(evt => {
    return evt.roles && evt.roles.some(role => role.assignedUserId === currentUser.id);
  });

  // 1. Build Grounding: Tasks Details
  const tasksContextText = myAssignedTasks.length > 0 
    ? myAssignedTasks.map((t, idx) => {
        return `- **Tarefa ${idx+1}**: "${t.title}"
  * Descrição: ${t.description || 'Sem descrição'}
  * Prioridade: ${t.priority}
  * Status Atual: ${t.status}
  * Prazo: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-BR') : 'Sem prazo'}`;
      }).join('\n\n')
    : 'Você não possui nenhuma tarefa diretamente atribuída a você no momento.';

  // 2. Build Grounding: Schedules Details
  const schedulesContextText = myAssignedSchedules.length > 0
    ? myAssignedSchedules.map((evt, idx) => {
        const userRoles = evt.roles
          .filter(r => r.assignedUserId === currentUser.id)
          .map(r => `${r.roleName} (Status: ${r.status === 'confirmed' ? 'Confirmado' : r.status === 'declined' ? 'Recusado' : 'Pendente'})`)
          .join(', ');

        return `- **Escala ${idx+1}**: "${evt.title}"
  * Data: ${new Date(evt.date).toLocaleDateString('pt-BR')} às ${evt.time}
  * Tipo: ${evt.type}
  * Suas Funções nessa Escala: ${userRoles}`;
      }).join('\n\n')
    : 'Você não tem plantões ou escalas de serviço atribuídos no momento.';

  // 3. Build Grounding: General Calendar/Agenda of Church
  const calendarContextText = schedules.length > 0
    ? schedules.slice(0, 15).map((evt, idx) => {
        const slots = evt.roles.map(r => {
          const person = users.find(u => u.id === r.assignedUserId);
          return `[${r.roleName}: ${person ? person.name : 'Vaga'} (${r.status || 'pendente'})]`;
        }).join(' ');

        return `- **Celebração/Evento #${idx+1}**: "${evt.title}"
  * Tipo: ${evt.type} | Data: ${new Date(evt.date).toLocaleDateString('pt-BR')} às ${evt.time}
  * Equipe escalada: ${slots}`;
      }).join('\n\n')
    : 'A agenda de celebrações e escalas está vazia no momento.';

  // Formulating Reference Materials payload for matching Ton's endpoint format
  const referenceMaterials = [
    {
      title: "Minhas Tarefas Atribuídas",
      type: "Minhas Tarefas",
      metadata: {
        codeSnippet: `Informa a seguir as tarefas atribuídas ao usuário logado (${currentUser.name}, Função/Cargo: ${currentUser.role}):\n\n${tasksContextText}`
      }
    },
    {
      title: "Minhas Escalas de Serviço",
      type: "Escalas",
      metadata: {
        codeSnippet: `Informa as escalas de trabalho/plantões designadas ao usuário ${currentUser.name}:\n\n${schedulesContextText}`
      }
    },
    {
      title: "Agenda Geral da Comunidade Pascom",
      type: "Agenda Geral",
      metadata: {
        codeSnippet: `Contém a agenda e calendário geral de missas, eventos e reuniões de toda a comunidade da paróquia com a respectiva equipe escalada:\n\n${calendarContextText}`
      }
    },
    {
      title: "Perfil do Usuário Logado",
      type: "Perfil",
      metadata: {
        codeSnippet: `Nome: ${currentUser.name}\nEmail: ${currentUser.email || 'Não informado'}\nAtribuição: ${currentUser.role}\nHabilidades: ${currentUser.skills?.join(', ') || 'Sem habilidades cadastradas'}\nAniversário: ${currentUser.birthday ? new Date(currentUser.birthday).toLocaleDateString('pt-BR') : 'Sem data'}`
      }
    }
  ];

  // System Prompt for Client-Side Fallback
  const getSystemPrompt = () => {
    let groundingContext = "Nenhum material adicional foi cadastrado para grounding neste curso por enquanto. Responda amigavelmente com base nas diretrizes gerais pastorais e conhecimentos teológicos adequados.";
    if (referenceMaterials && Array.isArray(referenceMaterials) && referenceMaterials.length > 0) {
      groundingContext = referenceMaterials.map((mat: any, idx: number) => {
        let matStr = `[Material #${idx + 1}] Título: ${mat.title} | Tipo: ${mat.type}`;
        if (mat.url && mat.url !== '#') {
          matStr += ` | URL/Link: ${mat.url}`;
        }
        if (mat.metadata?.codeSnippet) {
          matStr += `\nConteúdo Textual de Referência:\n"""\n${mat.metadata.codeSnippet}\n"""`;
        }
        return matStr;
      }).join("\n\n---\n\n");
    }

    return `Você é o "Ton", um assistente de inteligência artificial amigável, acolhedor e especialista no conteúdo deste curso da Pascom.
Sua missão é responder às dúvidas dos alunos com clareza, paciência, serenidade e uma didática exemplar.

DIRETRIZES IMPORTANTES DE COMPORTAMENTO:
1. Sempre se identifique como "Ton", o auxiliar do aluno.
2. Mantenha uma conduta humilde, acolhedora, pastoral e prestativa. Pode usar saudações fraternas condizentes (como "Paz de Cristo", "Saudações fraternas", ou "Paz e Bem!") apenas na primeira mensagem da interação.
3. NÃO repita saudações, apresentações, saudações diárias, ou palavras de boas-vindas (ex: "Paz e Bem", "Seja bem-vindo de volta", "Eu sou o Ton") nas mensagens seguintes / subsequentes da conversa. Responda diretamente e amigavelmente à dúvida do usuário sem enrolações ou repetição de introdução.
4. Use prioritariamente os MATERIAIS DE CONSULTA ATRELADOS AO CURSO listados abaixo. Se a dúvida puder ser esclarecida usando esses documentos, fundamente neles sua resposta.
5. Caso o assunto não esteja presente nestes materiais de referência, responda utilizando seu vasto repertório teológico católico, pastoral, pedagógico e de comunicação da Igreja (Pascom/Vaticano II/etc.), informando gentilmente o aluno com clareza.
6. Nunca invente fatos ou elabore URLs fictícias.
7. Formate sua resposta de maneira excelente usando Markdown (tópicos, negritos, cabeçalhos simples) para facilitar a leitura.

MATERIAIS DE CONSULTA DISPONIBILIZADOS PELO MINISTRANTE:
=========================================
${groundingContext}
=========================================
`;
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputVal.trim() || isLoading) return;

    const userMsg = { role: 'user' as const, content: inputVal };
    const updatedMessages = [...messages, userMsg];
    
    setMessages(updatedMessages);
    setInputVal('');
    setIsLoading(true);

    let serverSuccess = false;
    let replyText = "";

    // 1. Try server-side first
    try {
      const response = await fetch("/api/gemini/ton-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          referenceMaterials: referenceMaterials
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.reply) {
          replyText = data.reply;
          serverSuccess = true;
        }
      }
    } catch (serverErr) {
      console.warn("Server Ton Chat failed or returned error, trying client-side fallback...", serverErr);
    }

    // 2. Client-side fallback if server fails
    if (!serverSuccess) {
      // @ts-ignore
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
      if (!apiKey) {
        setIsLoading(false);
        setMessages(prev => [
          ...prev,
          {
            role: 'model',
            content: `⚠️ **Chave API do Gemini não encontrada**\n\nComo esta versão está sendo executada em uma hospedagem estática (como o GitHub Pages/Vercel) sem servidor ativo, o assistente necessita que a variável de ambiente \`GEMINI_API_KEY\` ou \`VITE_GEMINI_API_KEY\` esteja configurada no ambiente de publicação/build para responder diretamente no seu navegador.\n\n*Nota: Se você adicionou a variável agora, lembre-se de disparar um novo deploy (Redeploy) na plataforma de hospedagem para que o Vite compile a aplicação com a nova chave.*`
          }
        ]);
        return;
      }

      try {
        const ai = new GoogleGenAI({ apiKey });
        const systemPrompt = getSystemPrompt();
        
        const messagesSlice = updatedMessages.slice(-15);
        const contentsPayload = messagesSlice.map((m: any) => {
          const role = m.role === 'model' || m.role === 'assistant' ? 'model' : 'user';
          return {
            role: role,
            parts: [{ text: m.content || "" }]
          };
        });

        const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-3.5-flash"];
        let clientSuccess = false;
        let lastError: any = null;

        for (const model of candidateModels) {
          try {
            const result = await ai.models.generateContent({
              model: model,
              contents: contentsPayload,
              config: {
                systemInstruction: systemPrompt,
                temperature: 0.7,
              }
            });

            if (result?.text) {
              replyText = result.text;
              clientSuccess = true;
              break;
            }
          } catch (modelErr) {
            lastError = modelErr;
            console.warn(`[Client Ton Chat] Erro com o modelo ${model}:`, modelErr);
          }
        }

        if (clientSuccess) {
          setMessages(prev => [...prev, { role: 'model', content: replyText }]);
        } else {
          throw lastError || new Error("Não foi possível obter resposta de nenhum modelo Gemini do lado do cliente.");
        }
      } catch (err: any) {
        console.error(err);
        setMessages(prev => [
          ...prev,
          {
            role: 'model',
            content: `⚠️ Não consegui processar sua mensagem. Verifique se sua chave API do Gemini é válida ou tente novamente. Erro: ${err.message || err}`
          }
        ]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // 3. If server-side was successful
    if (serverSuccess) {
      setMessages(prev => [...prev, { role: 'model', content: replyText }]);
      setIsLoading(false);
    }
  };

  const cleanConversation = () => {
    if (confirm("Deseja mesmo limpar as conversas anteriores com o Ton?")) {
      const firstName = currentUser.name.split(' ')[0];
      setMessages([
        {
          role: 'model',
          content: `Paz e Bem, **${firstName}**! Conversa reiniciada. Como posso ajudá-lo com suas escalas e tarefas neste momento?`
        }
      ]);
    }
  };

  const quickAction = (option: string) => {
    setInputVal(option);
  };

  return (
    <>
      {/* Dynamic FLOATING ACTION BUTTON in bottom right corner */}
      <div className="fixed bottom-24 right-6 md:bottom-6 md:right-6 z-40 flex flex-col items-end gap-3 pointer-events-none">
        
        {/* Helper preview bubble badge */}
        {!isOpen && showBadge && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: [0, 1, 1], y: [10, 0, 0], scale: [0.9, 1.05, 1] }}
            transition={{ delay: 2, duration: 0.8 }}
            className="pointer-events-auto bg-white/95 backdrop-blur-md text-slate-800 text-[11px] font-black py-2 px-3.5 rounded-2xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] border border-slate-100 flex items-center gap-2 cursor-pointer max-w-xs"
            onClick={() => setIsOpen(true)}
          >
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>
            Dúvidas? Fale com o Ton! ⚡
          </motion.div>
        )}

        {/* Floating circular button with ton avatar */}
        <motion.button
          id="btn-ton-fab"
          whileHover={{ scale: 1.1, rotate: 3 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(!isOpen)}
          className="pointer-events-auto w-14 h-14 rounded-full bg-brand-blue flex items-center justify-center shadow-[0_8px_30px_rgb(26,54,93,0.35)] hover:shadow-[0_12px_40px_rgb(26,54,93,0.45)] border-2 border-white cursor-pointer relative group transition-colors overflow-hidden"
        >
          {isOpen ? (
            <X size={24} className="text-white relative z-10" />
          ) : (
            <div className="w-full h-full relative flex items-center justify-center">
              <img 
                src={TON_AVATAR_URL} 
                className="w-full h-full object-cover rounded-full" 
                alt="Ton Assistant" 
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-0 right-0 w-4 h-4 bg-amber-500 ring-2 ring-white rounded-full flex items-center justify-center">
                <Sparkles size={8} className="text-white fill-white/20" />
              </div>
            </div>
          )}
        </motion.button>
      </div>

      {/* Floating Chat Dialog Drawer / Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            className="fixed bottom-24 right-6 w-[92vw] sm:w-[410px] h-[520px] max-h-[80vh] bg-white rounded-3xl shadow-[0_20px_50px_rgba(15,23,42,0.15)] border border-slate-100 flex flex-col overflow-hidden z-50 transform-gpu"
          >
            {/* Header section with brand blue gradient */}
            <div className="bg-gradient-to-r from-brand-blue to-indigo-900 px-5 py-4 flex items-center justify-between shadow-md shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <TonAvatar size={42} />
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-brand-blue rounded-full" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-white font-extrabold text-sm md:text-base leading-none">Ton IA</h3>
                    <span className="bg-amber-400/20 text-brand-yellow font-black text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-amber-400/20">Assistente</span>
                  </div>
                  <p className="text-[10px] text-slate-200 mt-1 font-bold">Teologia, Escalas e Tarefas Pascom</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <button 
                  onClick={cleanConversation} 
                  title="Limpar Conversa" 
                  className="p-1.5 rounded-lg text-white/75 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <Eraser size={16} />
                </button>
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="p-1.5 rounded-lg text-white/75 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Conversation Window Body */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 space-y-3.5">
              {messages.map((m, idx) => {
                const isUser = m.role === 'user';
                return (
                  <div 
                    key={`ton-msg-${idx}`} 
                    className={`flex gap-2 max-w-[85%] ${isUser ? 'self-end ml-auto flex-row-reverse' : 'self-start items-start'}`}
                  >
                    {!isUser && <TonAvatar size={28} />}
                    <div 
                      className={`p-3 rounded-2xl shadow-2xs ${
                        isUser 
                        ? 'bg-brand-blue text-white rounded-tr-none' 
                        : 'bg-white text-slate-850 border border-slate-100 rounded-tl-none'
                      }`}
                    >
                      <SimpleMarkdown content={m.content} />
                      <span className={`text-[8px] block mt-1.5 pt-1.5 border-t text-right ${isUser ? 'text-white/60 border-white/10' : 'text-slate-400 border-slate-100'}`}>
                        {isUser ? 'Você' : 'Ton'} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Loader indicator while Ton consults the DB */}
              {isLoading && (
                <div className="flex gap-2 max-w-[80%] items-start">
                  <TonAvatar size={28} />
                  <div className="bg-white p-3.5 rounded-2xl rounded-tl-none border border-slate-100 shadow-2xs space-y-1">
                    <div className="flex gap-1.5 items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-[10px] text-slate-400 font-extrabold italic">Ton está analisando suas escalas e tarefas...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions Panel */}
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100/60 overflow-x-auto hide-scroll flex gap-2 shrink-0 select-none">
              <button 
                onClick={() => quickAction("Minhas escalas")} 
                className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-white text-[10px] font-black text-slate-600 rounded-full border border-slate-200 hover:border-brand-blue hover:text-brand-blue transition-colors cursor-pointer"
              >
                <Calendar size={10} /> Minhas Escalas
              </button>
              <button 
                onClick={() => quickAction("Quais são minhas tarefas?")} 
                className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-white text-[10px] font-black text-slate-600 rounded-full border border-slate-200 hover:border-brand-blue hover:text-brand-blue transition-colors cursor-pointer"
              >
                <ClipboardCheck size={10} /> Minhas Tarefas
              </button>
              <button 
                onClick={() => quickAction("Agenda do mês")} 
                className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-white text-[10px] font-black text-slate-600 rounded-full border border-slate-200 hover:border-brand-blue hover:text-brand-blue transition-colors cursor-pointer"
              >
                <ArrowUpRight size={10} /> Agenda Geral
              </button>
            </div>

            {/* Form text typing submission */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-100 flex gap-2 items-center shrink-0">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                disabled={isLoading}
                placeholder="Pergunte sobre escalas, tarefas, agenda..."
                className="flex-1 bg-slate-50 border border-slate-200 text-xs py-2.5 px-3.5 rounded-xl focus:outline-hidden focus:border-brand-blue focus:bg-white text-slate-800 placeholder-slate-400 font-medium transition-all"
              />
              <button
                type="submit"
                disabled={isLoading || !inputVal.trim()}
                className="p-2.5 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-xl transition-all cursor-pointer disabled:bg-slate-100 disabled:text-slate-350 disabled:cursor-not-allowed"
              >
                <SendHorizontal size={14} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

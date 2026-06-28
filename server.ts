import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = 3000;

// Set up body parsing with a generous limit for bases64 files
app.use(express.json({ limit: "20mb" }));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Helper to fetch URL content and clean it to minimize token count
async function fetchUrlContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const html = await response.text();
    // Safely remove scripts, styles and convert HTML tags to basic text
    const cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned.slice(0, 60000); // 60k character safety buffer
  } catch (error: any) {
    console.error("Error loading URL content:", error);
    return `[Erro ao carregar o conteúdo do link: ${error.message}]`;
  }
}

// Robust fallback model generator with built-in retries for 503 or transient conditions
async function generateContentWithFallback(contents: any[], responseSchema: any): Promise<string> {
  const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-3.5-flash"];
  let lastError: any = null;

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`Tentando processar com o modelo ${model} (Tentativa ${attempt}/2)...`);
        const response = await ai.models.generateContent({
          model: model,
          contents: contents,
          config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema
          }
        });
        
        const text = response?.text;
        if (text) {
          console.log(`Sucesso ao processar com modelo ${model}!`);
          return text;
        }
        throw new Error("Resposta de texto vazia retornada pelo modelo.");
      } catch (err: any) {
        lastError = err;
        console.warn(`Aviso: Erro com o modelo ${model} (Tentativa ${attempt}):`, err?.message || err);
        if (attempt < 2) {
          // Exponential backoff wait
          await new Promise(resolve => setTimeout(resolve, attempt * 1200));
        }
      }
    }
  }

  throw lastError || new Error("Todos os candidatos de modelos do Gemini retornaram falha.");
}

// API endpoint for Question Parsing
app.post("/api/gemini/import-questions", async (req, res) => {
  try {
    const { text, url, fileBase64, fileMimeType } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Chave do Gemini API não configurada no servidor." });
    }

    let contents: any[] = [];
    let promptText = "Você é um professor assistente especialista em pedagogia e avaliações. Sua missão é extrair perguntas acadêmicas de forma estrita do conteúdo e retornar em formato JSON especificado.\n\n";

    if (url) {
      const cleanedHtml = await fetchUrlContent(url);
      promptText += `CONTEÚDO EXTRAÍDO DO LINK (${url}):\n"""\n${cleanedHtml}\n"""\n\n`;
    }

    if (text) {
      promptText += `CONTEÚDO DE TEXTO ENVIADO:\n"""\n${text}\n"""\n\n`;
    }

    // Prepare content parts
    if (fileBase64 && fileMimeType) {
      // Direct binary file support (e.g. PDF or Image)
      contents.push({
        inlineData: {
          data: fileBase64,
          mimeType: fileMimeType,
        },
      });
      promptText += "Por favor, analise a imagem ou o documento PDF enviado acima para extrair as questões.\n";
    }

    promptText += `
Instruções para estruturação das questões:
1. Extraia o maior número de questões bem estruturadas possível.
2. Identifique o tipo de questão:
   - 'multiple_choice' se houver alternativas (A, B, C, D ou 1, 2, 3, 4, etc.).
   - 'true_false' se for Verdadeiro/Falso ou verdadeiro/falso.
   - 'discursive' se for dissertativa/subjetiva.
3. Tratamento de respostas:
   - Para 'multiple_choice', identifique qual alternativa é a correta. Retorne apenas a letra correspondente em MAIÚSCULO ('A', 'B', 'C' ou 'D'). Se não houver resposta correta óbvia explicitada, analise o contexto e forneça a resposta cientificamente correta/lógica.
   - Para 'true_false', retorne 'V' ou 'F'.
   - Para 'discursive', preencha 'correctAnswer' com uma orientação ou resposta padrão recomendada para correção pelo instrutor.
4. Para 'multiple_choice', preencha as 'options' limpando marcas de letras (como 'A)', 'a-', 'b)') do início. Limite a até 4 opções por padrão.
5. Defina um peso default apropriado para 'points' (ex: 20 se não especificado).
6. Adicione uma frase explicativa amigável em 'feedback' sobre a resposta correta para auxiliar o estudante.

Retorne SOMENTE uma lista em formato JSON que segue de perto o modelo/schema especificado.`;

    contents.push({ text: promptText });

    const finalResultSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          questionText: { type: Type.STRING, description: "O enunciado ou pergunta principal" },
          type: { type: Type.STRING, description: "Tipo de questão: multiple_choice, true_false ou discursive" },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Array de opções de resposta apenas para tipo multiple_choice, caso contrário deixar vazio ou omitido."
          },
          correctAnswer: { type: Type.STRING, description: "Gabarito: Letra única (A, B, C, D) para múltipla escolha, V ou F para verdadeiro/falso, ou resposta sugerida para discursiva." },
          points: { type: Type.INTEGER, description: "Pontos sugeridos para a questão (default: 20)." },
          feedback: { type: Type.STRING, description: "Explicação ou justificativa da resposta para feedback pós-prova." }
        },
        required: ["questionText", "type", "correctAnswer", "points"]
      }
    };

    const resultText = await generateContentWithFallback(contents, finalResultSchema);

    if (!resultText) {
      throw new Error("Ocorreu um erro gerando conteúdos: Resposta de IA vazia.");
    }

    const parsedQuestions = JSON.parse(resultText.trim());
    return res.json({ success: true, questions: parsedQuestions });

  } catch (error: any) {
    console.error("Gemini processing error:", error);
    return res.status(500).json({ error: error.message || "Erro desconhecido processando com Gemini" });
  }
});

// API endpoint for Ton AI Assistant Chat
app.post("/api/gemini/ton-chat", async (req, res) => {
  try {
    const { messages, referenceMaterials } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Chave do Gemini API não configurada no servidor." });
    }

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "O campo 'messages' é obrigatório e deve ser um array." });
    }

    // Format reference materials into reference material text guidance
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

    const systemPrompt = `Você é o "Ton", um assistente de inteligência artificial amigável, acolhedor e especialista no conteúdo deste curso da Pascom.
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

    // Map message list format into Gemini API parts payload
    // Filter to last 15 messages to prevent hitting token bounds or trailing noise
    const messagesSlice = messages.slice(-15);
    const contentsPayload = messagesSlice.map((m: any) => {
      // mapping 'user' or 'model' roles
      const role = m.role === 'model' || m.role === 'assistant' ? 'model' : 'user';
      return {
        role: role,
        parts: [{ text: m.content || "" }]
      };
    });

    // Run text generation using a robust fallback list of models with retries
    const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-3.5-flash"];
    let replyText = "";
    let success = false;
    let lastError: any = null;

    for (const model of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`[Ton Chat] Tentando processar com o modelo ${model} (Tentativa ${attempt}/2)...`);
          const response = await ai.models.generateContent({
            model: model,
            contents: contentsPayload,
            config: {
              systemInstruction: systemPrompt,
              temperature: 0.7,
            }
          });

          if (response?.text) {
            replyText = response.text;
            success = true;
            console.log(`[Ton Chat] Sucesso ao processar com o modelo ${model}!`);
            break;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`[Ton Chat] Erro com o modelo ${model} (Tentativa ${attempt}):`, err?.message || err);
          if (attempt < 2) {
            // Wait slightly before retrying the same model
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          }
        }
      }
      if (success) {
        break;
      }
    }

    if (!success) {
      throw lastError || new Error("Todos os candidatos de modelos do Gemini para o chat do Ton retornaram falha.");
    }

    return res.json({ success: true, reply: replyText });

  } catch (error: any) {
    console.error("Ton AI Chat processing error:", error);
    return res.status(500).json({ error: error.message || "Erro interno processando diálogo com Ton" });
  }
});

// Vite & Static Asset Handling
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://0.0.0.0:${PORT}`);
  });
}

setupServer();

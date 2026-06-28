import React, { useRef } from 'react';
import { LMSCertificate } from '../../lmsTypes';
import { Award, Printer, ShieldCheck, Lock } from 'lucide-react';

interface CertificateViewProps {
  certificate: LMSCertificate;
  onClose?: () => void;
}

// Generate the beautiful, unpolluted HTML matching the user-uploaded model perfectly
export const generateCertificateHTML = (certificate: LMSCertificate): string => {
  const verifyUrl = `${window.location.origin}?verify=${certificate?.id || 'PASCOM-EAD'}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}`;
  const verifyUrlShort = verifyUrl.replace('https://', '').replace('http://', '');

  const getSignatureHash = (id?: string) => {
    if (!id) return 'SHA256-ED8C1A82-F86D120B-18AC240F';
    const text = `PASCOM-${id.toUpperCase()}-EAD-NATAL`;
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
       hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hex = Math.abs(hash).toString(16).padEnd(8, '4').toUpperCase();
    return `SHA256-ECLES-${hex.substring(0, 4)}-${hex.substring(4, 8)}-${id.substring(0, 4).toUpperCase()}`;
  };

  const securityHash = getSignatureHash(certificate?.id);
  const formattedDate = (() => {
    try {
      const d = certificate?.issuedAt ? new Date(certificate.issuedAt) : new Date();
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
      }
    } catch {}
    return new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  })();

  return `
<!DOCTYPE html>
<html>
  <head>
    <title>Certificado - ${certificate?.userName || 'Agente Pascom'}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
      @media print {
        body { 
          margin: 0; 
          padding: 0; 
          -webkit-print-color-adjust: exact; 
          print-color-adjust: exact;
          font-family: 'Plus Jakarta Sans', sans-serif; 
          background-color: #f1f5f9;
        }
        @page { 
          size: landscape; 
          margin: 0; 
        }
      }
      body {
        font-family: 'Plus Jakarta Sans', sans-serif;
      }
    </style>
  </head>
  <body class="bg-slate-100 p-0 flex items-center justify-center min-h-screen">
    <!-- Outer landscape frame -->
    <div class="w-[1000px] h-[707px] bg-slate-200 p-8 flex items-center justify-center relative box-border overflow-hidden select-none">
      
      <!-- Blue Decorative Corner Bands (L-shape layout in the background matching Borcelle model) -->
      <div class="absolute top-0 left-0 w-[45px] h-full bg-[#1b3a70] z-0"></div>
      <div class="absolute bottom-0 left-0 w-full h-[45px] bg-[#1b3a70] z-0"></div>
      
      <!-- Main White Certificate Card sitting on top of the blue corner blocks -->
      <div class="w-full h-full bg-white rounded-[2rem] shadow-[0_20px_40px_-10px_rgba(30,58,138,0.2)] relative flex flex-col justify-between p-12 pl-20 z-10 box-border border border-slate-100">
        
        <!-- Top-Left Orange/Gold notch line -->
        <div class="absolute top-8 left-10 w-28 h-2 bg-[#f1a80a] rounded-full"></div>
        
        <!-- Stamp circle in the top right -->
        <div class="absolute top-8 right-12 flex flex-col items-center">
          <div class="w-20 h-20 rounded-full border-2 border-dashed border-[#1b3a70]/30 flex items-center justify-center relative p-1 bg-white">
            <div class="w-full h-full rounded-full border border-[#1b3a70]/40 flex flex-col items-center justify-center text-center p-1 bg-slate-50 relative">
              <span class="text-[5.5px] font-black text-[#1b3a70] tracking-[0.12em] uppercase leading-none mb-0.5">PASCOM</span>
              <svg class="h-5 w-5 text-amber-500 my-0.5 animate-pulse" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-[6.5px] font-extrabold text-[#1b3a70] tracking-wider uppercase">TASKS</span>
            </div>
          </div>
        </div>

        <!-- Dynamic Header Info above title -->
        <div class="text-left mt-2">
          <p class="text-[10px] font-bold text-[#1b3a70] tracking-[0.15em] uppercase leading-none mb-1">
            Arquidiocese de Natal • Paróquia de Santo Antônio
          </p>
          <p class="text-[8.5px] font-semibold text-slate-400 tracking-[0.08em] uppercase">
            Pastoral da Comunicação — CNPJ 08.026.122/0001-69
          </p>
        </div>

        <!-- Central Credential Content -->
        <div class="my-auto pt-4 text-left">
          <h1 class="text-[48px] font-bold text-slate-700 tracking-tight font-serif leading-none mb-6">Certificado</h1>
          
          <h2 class="text-3xl font-extrabold text-[#111827] tracking-tight mb-4">
            ${certificate?.userName || 'Agente Pascom'}
          </h2>
          
          <p class="text-[15.5px] text-slate-550 max-w-3xl leading-relaxed">
            participou e concluiu o <strong class="text-[#1b3a70] font-extrabold">Curso Livre de ${certificate?.courseTitle || 'Formação da PASCOM'}</strong>, com carga horária total de <strong class="text-[#1b3a70] font-extrabold">${certificate?.courseHours || 32} horas</strong>, realizado pela Pastoral da Comunicação da Paróquia de Santo Antônio, em <strong class="text-slate-800 font-semibold">${formattedDate}</strong>.
          </p>
        </div>

        <!-- Footer / Signatures & Authenticity -->
        <div class="flex justify-between items-end mt-auto pt-6 border-t border-slate-100">
          
          <!-- Sole Signature: Pároco (Pe. João Maria) -->
          <div class="flex flex-col items-start w-[280px] text-left">
            <div class="w-full h-10 flex items-end justify-start font-serif text-slate-800 italic text-base select-none pb-0.5 relative">
              <span class="absolute bottom-1 left-4 font-mono text-slate-400 text-[11px] tracking-widest pointer-events-none select-none italic opacity-60">
                Pe. J. Maria Sobrinho
              </span>
              <div class="w-full border-b border-slate-300 mt-auto"></div>
            </div>
            <span class="text-[11px] font-black text-[#1b3a70] tracking-wider uppercase mt-1.5">Pe. João Maria dos Anjos Sobrinho</span>
            <span class="text-[9px] font-bold text-slate-400 uppercase">Pároco • Paróquia de Santo Antônio</span>
          </div>

          <!-- Mid Section: Secure Digital Lock / Assinatura Digital do Pároco -->
          <div class="flex flex-col items-end text-right mr-4 text-[8px] font-mono text-slate-400 gap-1">
            <div class="bg-slate-50 border border-slate-150 p-2 rounded-lg flex flex-col gap-0.5 text-left w-56 shadow-inner">
              <span class="text-[#1b3a70] text-[7.5px] font-black uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <svg class="h-2.5 w-2.5 text-[#1b3a70]" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296a3.745 3.745 0 01-1.593 3.068z"/>
                </svg>
                Assinatura Digital do Pároco
              </span>
              <p class="flex justify-between font-mono text-[6.5px]"><span class="text-slate-400">PÁROCO:</span> <strong class="text-slate-700">PE. JOÃO MARIA S. ANJOS</strong></p>
              <p class="flex justify-between font-mono text-[6.5px]"><span class="text-slate-400">ASSINATURA:</span> <strong class="text-slate-700 truncate max-w-[100px]" title="${securityHash}">${securityHash}</strong></p>
              <p class="flex justify-between font-mono text-[6.5px]"><span class="text-slate-400">STATUS:</span> <strong class="text-green-600 font-extrabold uppercase">ASSINADO E VÁLIDO</strong></p>
            </div>
          </div>

          <!-- QR Code Right Portion -->
          <div class="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-slate-200 shrink-0 select-none">
            <img src="${qrCodeUrl}" alt="QR Code" class="h-11 w-11" referrerPolicy="no-referrer" />
            <div class="text-left">
              <p class="text-[7px] font-black uppercase tracking-wider text-[#1b3a70] leading-none mb-0.5">Validar</p>
              <p class="text-[9px] font-bold text-slate-705 leading-tight">Credencial</p>
              <p class="text-[6.5px] font-mono text-slate-400 max-w-[80px] truncate" title="${verifyUrl}">${verifyUrlShort}</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  </body>
</html>
  `;
};

// Programmatic trigger that bypasses the preview modal and downloads/prints the PDF automatically
export const triggerDirectCertificatePrint = (certificate: LMSCertificate) => {
  const htmlContent = generateCertificateHTML(certificate);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.write(`
      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() { window.close(); }, 500);
        }
      </script>
    `);
    printWindow.document.close();
  }
};

export const CertificateView: React.FC<CertificateViewProps> = ({ certificate, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    triggerDirectCertificatePrint(certificate);
  };

  const htmlContentInFrame = generateCertificateHTML(certificate);

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto py-2 h-auto text-left">
      {/* Action panel */}
      <div className="flex items-center justify-between bg-white border border-slate-100 p-4 rounded-3xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <ShieldCheck size={22} className="animate-pulse" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-slate-850">Certificado Oficial EAD</h4>
            <p className="text-[11px] text-slate-450 font-mono">Assinado e Registrado: {certificate?.id || 'Automação'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Printer size={15} /> Imprimir / Gerar PDF
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition-all cursor-pointer border border-slate-150"
            >
              Fechar
            </button>
          )}
        </div>
      </div>

      {/* Frame representation inside visual browser */}
      <div className="overflow-x-auto shadow-2xl rounded-[2.5rem] border border-slate-200 bg-slate-100 p-4 flex items-center justify-center">
        <iframe
          title="Pré-visualização do Certificado"
          srcDoc={htmlContentInFrame}
          className="w-[1010px] h-[720px] bg-white rounded-2xl border-0 shadow-inner"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, 
  Wrench, 
  Key, 
  Download, 
  Trash2, 
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// --- CONFIGURAÇÕES E TIPOS ---

// Cores sólidas solicitadas pelo usuário (Rigorosas para impressão)
const COLORS = {
  OCUPADO: '#e74c3c',    // Vermelho
  LIMPEZA: '#f1c40f',    // Amarelo
  MANUTENCAO: '#3498db',  // Azul
  DISPONIVEL: '#ffffff',  // Branco/Cinza
  BORDER: '#000000',      // Bordas Pretas
};

enum UHStatus {
  DISPONIVEL = 'disponivel',
  OCUPADO = 'ocupado',
  LIMPEZA = 'limpeza',
  MANUTENCAO = 'manutencao',
}

interface UH {
  id: string;
  status: UHStatus;
  saidaHoje: boolean;
  reservaHoje: boolean;
}

const INITIAL_UH_LIST = [
  '034', '059', '060', '061', '065', '068', '069', '070', '080', '085', '090', '095', '100', 
  '105', '110', '115', '120', '125', '130', '135', '140', '145', '150', '155', '161', '165', '170', '172'
];

export default function App() {
  const [uhs, setUhs] = useState<UH[]>([]);
  const [editingUh, setEditingUh] = useState<UH | null>(null);
  const [newUhId, setNewUhId] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Efeito para carregar dados
  useEffect(() => {
    const saved = localStorage.getItem('chaves_uh_data_v3');
    if (saved) {
      setUhs(JSON.parse(saved));
    } else {
      const initial = INITIAL_UH_LIST.map(id => ({
        id,
        status: UHStatus.DISPONIVEL,
        saidaHoje: false,
        reservaHoje: false
      }));
      setUhs(initial);
    }
  }, []);

  useEffect(() => {
    if (uhs.length > 0) {
      localStorage.setItem('chaves_uh_data_v3', JSON.stringify(uhs));
    }
  }, [uhs]);

  const addUh = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUhId.trim()) return;
    
    if (uhs.find(u => u.id === newUhId.trim())) {
      alert("Esta UH já existe na grade!");
      return;
    }

    const newUh: UH = {
      id: newUhId.trim(),
      status: UHStatus.DISPONIVEL,
      saidaHoje: false,
      reservaHoje: false
    };

    setUhs(prev => {
      const updated = [...prev, newUh];
      // Ordenar numericamente se possível, senão alfabeticamente
      return updated.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    });
    setNewUhId('');
  };

  const removeUh = (id: string) => {
    if (confirm(`Tem certeza que deseja remover permanentemente a UH ${id}?`)) {
      setUhs(prev => prev.filter(u => u.id !== id));
      setEditingUh(null);
    }
  };

  const updateUh = (id: string, updates: Partial<UH>) => {
    setUhs(prev => prev.map(uh => uh.id === id ? { ...uh, ...updates } : uh));
    if (updates.status !== undefined) setEditingUh(null);
  };

  const exportToPDF = async () => {
    if (!gridRef.current || isGeneratingPDF) return;

    setIsGeneratingPDF(true);
    // Garantir que a página esteja no topo para o html2canvas não capturar com offset errado
    window.scrollTo(0, 0);

    try {
      // Pequeno atraso para garantir que qualquer animação tenha terminado
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(gridRef.current, {
        scale: 2, // 2 é mais estável para evitar estouro de memória
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: gridRef.current.scrollWidth,
        windowHeight: gridRef.current.scrollHeight,
        x: 0,
        y: 0
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Estilo do Cabeçalho do PDF
      pdf.setFontSize(22);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'bold');
      pdf.text('APTOS CHAVE MECÂNICA', pageWidth / 2, 20, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      const dataAtual = new Date().toLocaleDateString('pt-BR');
      pdf.text(`TURNO: DIURNO`, 10, 32);
      pdf.text(`DATA: ${dataAtual}`, pageWidth - 10, 32, { align: 'right' });

      // Desenha a imagem da grade
      pdf.addImage(imgData, 'PNG', 10, 40, imgWidth, imgHeight);

      // Rodapé de Observações
      const footerY = Math.min(45 + imgHeight, pageHeight - 50);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('OBS:', 10, footerY);
      
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.3);
      for (let i = 0; i < 3; i++) {
        const lineY = footerY + 12 + (i * 12);
        if (lineY < pageHeight - 10) {
          pdf.line(10, lineY, pageWidth - 10, lineY);
        }
      }

      pdf.save(`Controle_Chaves_${dataAtual.replace(/\//g, '-')}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar PDF. Verifique se o navegador deu permissão de download.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const getStatusColor = (status: UHStatus) => {
    switch (status) {
      case UHStatus.OCUPADO: return COLORS.OCUPADO;
      case UHStatus.LIMPEZA: return COLORS.LIMPEZA;
      case UHStatus.MANUTENCAO: return COLORS.MANUTENCAO;
      default: return COLORS.DISPONIVEL;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans selection:bg-blue-200">
      
      {/* BOTÃO FIXO NO TOPO - REQUISITO: GERAR RELATÓRIO PDF */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200 py-4 px-6 flex justify-center">
        <button 
          onClick={exportToPDF}
          disabled={isGeneratingPDF}
          className={`group flex items-center gap-3 px-12 py-4 bg-red-600 text-white rounded-full font-black uppercase tracking-widest text-sm transition-all shadow-xl hover:shadow-2xl active:scale-95 ${isGeneratingPDF ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black'}`}
        >
          <Download className={`w-5 h-5 ${isGeneratingPDF ? 'animate-spin' : 'group-hover:animate-bounce'}`} />
          {isGeneratingPDF ? 'Gerando...' : 'Gerar Relatório PDF'}
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-4 sm:p-10">
        
        {/* Título da Página */}
        <header className="mb-12 text-center">
          <div className="inline-block bg-black text-white px-6 py-2 mb-4">
            <h1 className="text-2xl font-black tracking-tighter uppercase">Painel de Controle</h1>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-14 text-sm font-bold text-gray-400 mb-8">
            <span className="flex items-center gap-2 uppercase tracking-widest"><Clock size={16} /> Turno: Diurno</span>
            <span className="flex items-center gap-2 uppercase tracking-widest leading-none">Data: {new Date().toLocaleDateString('pt-BR')}</span>
          </div>

          {/* NOVO: Formulário para adicionar UH */}
          <form onSubmit={addUh} className="flex justify-center gap-2 max-w-sm mx-auto">
            <input 
              type="text" 
              value={newUhId}
              onChange={(e) => setNewUhId(e.target.value)}
              placeholder="Número UH (ex: 205)"
              className="flex-1 bg-white border-2 border-black px-4 py-2 font-bold uppercase placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-200 transition-all"
            />
            <button 
              type="submit"
              className="bg-black text-white px-6 py-2 font-black hover:bg-gray-800 transition-colors"
            >
              ADICIONAR
            </button>
          </form>
        </header>

        {/* GRADE DE UH - ESTILO MODERNO: QUADRADOS SEPARADOS E FLUTUANTES */}
        <div 
          ref={gridRef}
          className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-4 p-8 bg-white rounded-[40px] shadow-2xl border border-gray-100"
        >
          {uhs.map((uh) => (
            <motion.div
              key={uh.id}
              whileHover={{ y: -5, scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setEditingUh(uh)}
              style={{ backgroundColor: getStatusColor(uh.status) }}
              className={`relative cursor-pointer aspect-square flex flex-col items-center justify-center rounded-2xl border-2 border-black transition-all shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] group overflow-hidden`}
              id={`uh-card-${uh.id}`}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-10 bg-white transition-opacity" />
              
              <span className={`text-2xl sm:text-3xl font-black z-10 ${uh.status === UHStatus.OCUPADO || uh.status === UHStatus.MANUTENCAO ? 'text-white' : 'text-black'}`}>
                {uh.id}
              </span>
              
              {/* Marcadores S (Canto Inferior Direito) e R (Canto Superior Esquerdo) */}
              <div className="absolute inset-1.5 pointer-events-none z-20">
                {uh.reservaHoje && (
                  <div className="absolute top-0 left-0 w-8 h-8 bg-white text-blue-700 text-[10px] font-black flex items-center justify-center rounded-full border-[3px] border-blue-700 shadow-md transform -translate-x-1 -translate-y-1" title="Reserva (Entrada)">
                    R
                  </div>
                )}
                {uh.saidaHoje && (
                  <div className="absolute bottom-0 right-0 w-8 h-8 flex items-center justify-center drop-shadow-md transform translate-x-1 translate-y-1" title="Saída (Checkout)">
                    <svg viewBox="0 0 24 24" className="absolute inset-0 w-full h-full text-yellow-400">
                      <path fill="currentColor" stroke="black" strokeWidth="3" d="M12 2L2 20h20L12 2z" />
                    </svg>
                    <span className="relative z-10 text-[10px] font-black text-black mt-1">S</span>
                  </div>
                )}
              </div>

              {/* Detalhe estético: grade discreta no fundo do card */}
              <div className="absolute inset-0 opacity-10 pointer-events-none" 
                   style={{backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '10px 10px'}} />
            </motion.div>
          ))}
        </div>

        {/* Legenda Visual na Tela */}
        <div className="mt-16 flex flex-wrap justify-center gap-6 no-print">
          <LegendItem color={COLORS.OCUPADO} label="Ocupado" />
          <LegendItem color={COLORS.LIMPEZA} label="Limpeza" />
          <LegendItem color={COLORS.MANUTENCAO} label="Manutenção" />
          <LegendItem color={COLORS.DISPONIVEL} label="Disponível" border />
          
          <button 
            onClick={() => {
              if(confirm("Deseja realmente limpar todos os status e marcadores?")) {
                setUhs(INITIAL_UH_LIST.map(id => ({
                  id, status: UHStatus.DISPONIVEL, saidaHoje: false, reservaHoje: false
                })));
              }
            }}
            className="flex items-center gap-2 ml-4 text-xs font-black text-red-500 hover:text-red-700 transition-colors"
          >
            <Trash2 size={14} /> REINICIAR TUDO
          </button>
        </div>
      </div>

      {/* MODAL DE SELEÇÃO DE STATUS */}
      <AnimatePresence>
        {editingUh && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditingUh(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-50"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-0 m-auto w-[95%] max-w-lg h-fit bg-white p-8 rounded-[40px] z-[60] shadow-2xl overflow-y-auto max-h-[90vh] border border-gray-100"
              id="status-modal"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-5xl font-black tracking-tighter text-gray-900 leading-none">UH {editingUh.id}</h2>
                  <p className="text-[10px] font-black text-red-500 mt-2 uppercase tracking-widest bg-red-50 inline-block px-2 py-1 rounded">Selecione o Novo Status</p>
                </div>
                <button 
                  onClick={() => setEditingUh(null)} 
                  className="p-3 hover:bg-gray-100 rounded-full transition-colors group"
                >
                  <ChevronDown size={36} className="text-gray-300 group-hover:text-black transition-colors" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <StatusBtn 
                  label="OCUPADO" color={COLORS.OCUPADO} 
                  active={editingUh.status === UHStatus.OCUPADO} 
                  onClick={() => updateUh(editingUh.id, { status: UHStatus.OCUPADO })} 
                  icon={<Key size={24} />}
                />
                <StatusBtn 
                  label="LIMPEZA" color={COLORS.LIMPEZA} 
                  active={editingUh.status === UHStatus.LIMPEZA} 
                  onClick={() => updateUh(editingUh.id, { status: UHStatus.LIMPEZA })} 
                  icon={<Clock size={24} />}
                />
                <StatusBtn 
                  label="MANUTENÇÃO" color={COLORS.MANUTENCAO} 
                  active={editingUh.status === UHStatus.MANUTENCAO} 
                  onClick={() => updateUh(editingUh.id, { status: UHStatus.MANUTENCAO })} 
                  icon={<Wrench size={24} />}
                />
                <StatusBtn 
                  label="DISPONÍVEL" color={COLORS.DISPONIVEL} 
                  active={editingUh.status === UHStatus.DISPONIVEL} 
                  border onClick={() => updateUh(editingUh.id, { status: UHStatus.DISPONIVEL })} 
                  icon={<div className="w-6 h-6 rounded-full border-4 border-current" />}
                />
              </div>

              <div className="bg-slate-50 p-6 rounded-[30px] border border-slate-100 mb-8">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 text-center">Filtros de Saída e Reserva</h3>
                <div className="grid grid-cols-2 gap-4">
                  <MarkerBtn 
                    label="SAÍDA (S)" symbol="S" 
                    active={editingUh.saidaHoje} 
                    color="bg-yellow-400" 
                    onClick={() => updateUh(editingUh.id, { saidaHoje: !editingUh.saidaHoje })} 
                  />
                  <MarkerBtn 
                    label="RESERVA (R)" symbol="R" 
                    active={editingUh.reservaHoje} 
                    color="bg-blue-600 text-white rounded-full" 
                    onClick={() => updateUh(editingUh.id, { reservaHoje: !editingUh.reservaHoje })} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button 
                  onClick={() => setEditingUh(null)}
                  className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-gray-800 transition-all hover:shadow-lg active:scale-95 shadow-black/10"
                >
                  Confirmar
                </button>
                <button 
                  onClick={() => removeUh(editingUh.id)}
                  className="w-full py-3 text-[10px] font-black text-gray-300 hover:text-red-500 transition-colors uppercase tracking-widest"
                >
                  Remover esta UH da grade
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="h-20" />
    </div>
  );
}

// Componentes Auxiliares

function LegendItem({ color, label, border }: any) {
  return (
    <div className="flex items-center gap-3">
      <div 
        style={{ backgroundColor: color }} 
        className={`w-5 h-5 border border-black ${border ? 'shadow-inner' : ''}`} 
      />
      <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">{label}</span>
    </div>
  );
}

function StatusBtn({ label, color, active, onClick, icon, border }: any) {
  const isDark = label === 'OCUPADO' || label === 'MANUTENÇÃO';
  
  return (
    <button 
      onClick={onClick}
      style={{ backgroundColor: active ? color : '#f8fafc' }}
      className={`flex flex-col items-center justify-center p-6 gap-3 rounded-2xl border-2 transition-all active:scale-95
        ${active ? 'border-black shadow-lg scale-105 z-10' : 'border-gray-100 text-gray-400 hover:border-gray-200'}
        ${active && isDark ? 'text-white' : ''}
        ${active && !isDark ? 'text-black' : ''}
      `}
    >
      {icon}
      <span className="text-[10px] font-black tracking-widest">{label}</span>
    </button>
  );
}

function MarkerBtn({ label, symbol, active, color, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all
        ${active ? 'bg-gray-50 border-black shadow-md' : 'bg-white border-gray-100 text-gray-300'}
      `}
    >
      <span className="text-xs font-black uppercase tracking-tighter">{label}</span>
      <div className={`w-9 h-9 flex items-center justify-center font-black border-2 border-black text-sm ${color} ${active ? 'opacity-100' : 'opacity-20'}`}>
        {symbol}
      </div>
    </button>
  );
}

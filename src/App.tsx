import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Minus, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Trash2, 
  Pencil,
  Calendar,
  Tag,
  FileText,
  X,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  User,
  Users,
  Download,
  LayoutDashboard,
  List,
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, Transaction, Category, CATEGORIES, Member } from './lib/utils';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { db, auth } from './firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, setDoc, getDoc } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';

interface UserProfile {
  name: string;
  email: string;
  userId: string;
  createdAt: string;
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryType, setCategoryType] = useState<'income' | 'expense'>('expense');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'transactions' | 'charts'>('summary');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isExporting, setIsExporting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportMonth, setExportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [formData, setFormData] = useState({
    type: 'expense' as 'income' | 'expense',
    category: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    payment_method: 'PIX',
    users: [] as string[]
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setProfileName(currentUser.displayName || '');
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const profile = snapshot.data() as UserProfile;
        setUserProfile(profile);
        setFormData(prev => ({ ...prev, users: [profile.name] }));
        setIsProfileModalOpen(false);
      } else {
        setIsProfileModalOpen(true);
      }
    });

    return () => unsubscribeProfile();
  }, [user, isAuthReady]);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!user || !userProfile) {
      setLoading(false);
      setTransactions([]);
      setCategories([]);
      return;
    }

    setLoading(true);

    const qTransactions = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribeTransactions = onSnapshot(qTransactions, (snapshot) => {
      const txData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      setTransactions(txData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching transactions:", error);
      setLoading(false);
    });

    const qCategories = query(
      collection(db, 'categories'),
      where('userId', '==', user.uid)
    );

    const unsubscribeCategories = onSnapshot(qCategories, async (snapshot) => {
      const catData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      
      if (catData.length === 0 && snapshot.metadata.fromCache === false) {
        // Seed default categories
        const defaultIncome = ["Salário", "Freelance", "Investimentos", "Presente", "Outros"];
        const defaultExpense = ["Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", "Educação", "Compras", "Assinaturas", "Outros"];
        
        try {
          const promises = [];
          for (const name of defaultIncome) {
            promises.push(addDoc(collection(db, 'categories'), { type: 'income', name, userId: user.uid, createdAt: new Date().toISOString() }));
          }
          for (const name of defaultExpense) {
            promises.push(addDoc(collection(db, 'categories'), { type: 'expense', name, userId: user.uid, createdAt: new Date().toISOString() }));
          }
          await Promise.all(promises);
        } catch (e) {
          console.error("Error seeding categories", e);
        }
      } else {
        setCategories(catData);
        if (!formData.category && catData.length > 0) {
          const defaultCat = catData.find(c => c.type === 'expense');
          if (defaultCat) {
            setFormData(prev => ({ ...prev, category: defaultCat.name }));
          }
        }
      }
    }, (error) => {
      console.error("Error fetching categories:", error);
    });

    const qMembers = query(
      collection(db, 'members'),
      where('userId', '==', user.uid)
    );

    const unsubscribeMembers = onSnapshot(qMembers, (snapshot) => {
      const memberData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Member[];
      setMembers(memberData);
    }, (error) => {
      console.error("Error fetching members:", error);
    });

    return () => {
      unsubscribeTransactions();
      unsubscribeCategories();
      unsubscribeMembers();
    };
  }, [user, isAuthReady, userProfile]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profileName.trim()) return;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        name: profileName.trim(),
        email: user.email || '',
        userId: user.uid,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Erro ao salvar perfil");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !user) return;
    try {
      await addDoc(collection(db, 'categories'), {
        type: categoryType,
        name: newCategoryName.trim(),
        userId: user.uid,
        createdAt: new Date().toISOString()
      });
      setNewCategoryName('');
    } catch (error) {
      console.error('Error adding category:', error);
      alert('Erro ao adicionar categoria');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  // Get unique months from transactions or current month
  const availableMonths = React.useMemo(() => {
    const months = new Set<string>();
    months.add(format(new Date(), 'yyyy-MM'));
    transactions.forEach(t => {
      months.add(t.date.substring(0, 7));
    });
    return Array.from(months).sort().reverse();
  }, [transactions]);

  const filteredTransactions = React.useMemo(() => {
    return transactions.filter(t => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxmuQkZkAHkpnUEauSzcD9b6PExNalR5wAMaM2-GInb_wYRDKJDIrQnWVvfGqhd0Abc/exec';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const transactionData = {
        ...formData,
        amount: parseFloat(formData.amount),
        userId: user.uid,
        createdAt: new Date().toISOString()
      };

      if (editingId) {
        // Remove createdAt to not overwrite it, or keep it if we want to update it
        const { createdAt, ...updateData } = transactionData;
        await updateDoc(doc(db, 'transactions', editingId), updateData);
      } else {
        await addDoc(collection(db, 'transactions'), transactionData);
      }

      // Enviar para o Google Sheets (apenas se for nova transação ou se o usuário quiser sincronizar edições)
      // O script do usuário espera 'descricao' e 'valor'
      const sheetFormData = new FormData();
      sheetFormData.append('descricao', formData.description || formData.category);
      sheetFormData.append('valor', formData.amount);
      sheetFormData.append('data', formData.date);
      sheetFormData.append('categoria', formData.category);
      sheetFormData.append('usuario', formData.users.join(', '));
      sheetFormData.append('tipo', formData.type);
      if (formData.type === 'expense') {
        sheetFormData.append('pagamento', formData.payment_method);
      }

      fetch(GOOGLE_SHEETS_URL, { 
        method: 'POST', 
        body: sheetFormData,
        mode: 'no-cors' // Google Apps Script often requires no-cors for simple POSTs from browser
      }).catch(err => console.error('Erro ao enviar para Google Sheets:', err));

      setIsModalOpen(false);
      setEditingId(null);
      setFormData({
        type: 'expense',
        category: categories.find(c => c.type === 'expense')?.name || '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        payment_method: 'PIX',
        users: userProfile ? [userProfile.name] : []
      });
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setFormData({
      type: transaction.type,
      category: transaction.category,
      amount: transaction.amount.toString(),
      date: transaction.date,
      description: transaction.description || '',
      payment_method: transaction.payment_method || 'PIX',
      users: transaction.users || ((transaction as any).user ? [(transaction as any).user] : [])
    });
    setEditingId(transaction.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
      setDeleteConfirmationId(null);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Erro ao excluir transação');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMemberName.trim()) return;
    try {
      await addDoc(collection(db, 'members'), {
        name: newMemberName.trim(),
        userId: user.uid,
        createdAt: new Date().toISOString()
      });
      setNewMemberName('');
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  const handleDeleteMember = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'members', id));
    } catch (error) {
      console.error('Error deleting member:', error);
    }
  };

  const exportToPDF = async () => {
    const element = document.getElementById('export-content');
    if (!element) return;

    // Temporarily switch to the month we want to export
    const originalMonth = selectedMonth;
    setSelectedMonth(exportMonth);
    setIsExportModalOpen(false);
    setIsExporting(true);
    
    // Wait for state update, data fetching and potential re-renders
    // Increased timeout to ensure Firestore data and Recharts are ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // Scroll to top to avoid offset issues with html2canvas
      window.scrollTo(0, 0);

      const canvas = await html2canvas(element, {
        scale: 1.5, // Slightly lower scale for better compatibility
        useCORS: true,
        logging: false,
        backgroundColor: '#fafafa',
        windowWidth: 1200,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('export-content');
          if (el) {
            el.style.width = '1200px';
            el.style.padding = '40px';
            el.style.display = 'block';
            
            // Force all sections to be visible regardless of activeTab
            const sections = el.querySelectorAll('.hidden, .lg\\:block, .lg\\:grid');
            sections.forEach(s => {
              const htmlS = s as HTMLElement;
              htmlS.style.setProperty('display', 'block', 'important');
              if (htmlS.classList.contains('grid') || htmlS.classList.contains('lg:grid')) {
                htmlS.style.setProperty('display', 'grid', 'important');
              }
            });
          }
        }
      });

      if (!canvas) {
        throw new Error('Falha ao criar o canvas do relatório.');
      }

      const imgData = canvas.toDataURL('image/jpeg', 0.8); // Use JPEG with compression to reduce size
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`relatorio-financeiro-${exportMonth}.pdf`);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert(`Erro ao gerar PDF: ${error.message || 'Erro desconhecido'}. Tente novamente em alguns instantes.`);
    } finally {
      setIsExporting(false);
      setSelectedMonth(originalMonth);
    }
  };

  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const balance = totalIncome - totalExpense;

  const chartData = Object.entries(
    filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const paymentMethodChartData = Object.entries(
    filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        const method = t.payment_method || 'Outros';
        acc[method] = (acc[method] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const userChartData = Object.entries(
    filteredTransactions
      .reduce((acc, t) => {
        const user = t.user || 'Outros';
        if (!acc[user]) acc[user] = { name: user, income: 0, expense: 0 };
        if (t.type === 'income') acc[user].income += t.amount;
        else acc[user].expense += t.amount;
        return acc;
      }, {} as Record<string, { name: string, income: number, expense: number }>)
  ).map(([_, value]) => value);

  const activeCategories = categories.filter(c => c.type === formData.type);
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-zinc-500">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 shadow-2xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Wallet className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">FinanTrack</h1>
          <p className="text-zinc-400 mb-8">Faça login para gerenciar suas finanças de forma segura e sincronizada.</p>
          <button
            onClick={handleLogin}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            <User className="w-5 h-5" />
            Entrar com Google
          </button>
        </div>
      </div>
    );
  }

  if (!userProfile && !isProfileModalOpen) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500 animate-pulse">Carregando perfil...</div>
      </div>
    );
  }

  if (!userProfile && isProfileModalOpen) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 shadow-2xl max-w-md w-full"
        >
          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <User className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 text-center">Como devemos te chamar?</h2>
          <p className="text-zinc-400 mb-8 text-center">Configure seu nome para personalizar sua experiência no FinanTrack.</p>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Seu Nome</label>
              <input
                type="text"
                required
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="Ex: Daniel Petry"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl font-medium transition-colors shadow-lg shadow-emerald-600/20"
            >
              Começar a usar
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-24 lg:pb-12">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                <Wallet className="text-white w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white hidden xs:block">FinanTrack</h1>
            </div>
            
            <div className="h-6 w-px bg-zinc-800 mx-2 hidden sm:block" />
            
            {/* Monthly Indicator / Selector */}
            <div className="relative group">
              <div className="flex items-center gap-2 bg-zinc-800/50 hover:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700 transition-colors cursor-pointer">
                <Calendar className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-semibold text-zinc-100 uppercase tracking-wide">
                  {format(parseISO(`${selectedMonth}-01`), "MMMM yyyy", { locale: ptBR })}
                </span>
                <input 
                  type="month" 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setIsExportModalOpen(true)}
              disabled={isExporting}
              className={cn(
                "p-2 rounded-lg transition-colors flex items-center gap-2",
                isExporting ? "opacity-50 cursor-not-allowed" : "text-zinc-400 hover:text-emerald-500 hover:bg-emerald-500/10"
              )}
              title="Exportar PDF"
            >
              {isExporting ? (
                <div className="w-5 h-5 border-2 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              <span className="hidden md:inline text-sm font-medium">Exportar</span>
            </button>

            <button
              onClick={() => setIsMemberModalOpen(true)}
              className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors flex items-center gap-2"
              title="Membros"
            >
              <Users className="w-5 h-5" />
              <span className="hidden md:inline text-sm font-medium">Membros</span>
            </button>

            <div className="h-6 w-px bg-zinc-800 mx-1 hidden sm:block" />

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-bold text-zinc-100 leading-none">{userProfile?.name}</span>
                <button onClick={handleLogout} className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors">Sair</button>
              </div>
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-emerald-600/20">
                {userProfile?.name.charAt(0)}
              </div>
            </div>
            
            <button
              onClick={() => {
                setEditingId(null);
                setFormData({
                  type: 'expense',
                  category: categories.find(c => c.type === 'expense')?.name || '',
                  amount: '',
                  date: new Date().toISOString().split('T')[0],
                  description: '',
                  payment_method: 'PIX',
                  users: userProfile ? [userProfile.name] : []
                });
                setIsModalOpen(true);
              }}
              className="hidden sm:flex bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg font-medium transition-colors items-center justify-center shadow-lg shadow-emerald-600/20"
              title="Nova Transação"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8 space-y-8">
        <div id="export-content" className={cn("space-y-8 pb-8", isExporting && "p-8 bg-zinc-950")}>
          {isExporting && (
            <div className="mb-8 border-b border-zinc-800 pb-4">
              <h1 className="text-2xl font-bold text-white">Relatório Financeiro - FinanTrack</h1>
              <p className="text-zinc-400">{format(parseISO(`${selectedMonth}-01`), "MMMM 'de' yyyy", { locale: ptBR })}</p>
            </div>
          )}
          {/* Summary Cards */}
          <div className={cn(
            "grid grid-cols-1 md:grid-cols-3 gap-6",
            (activeTab !== 'summary' && !isExporting) && "hidden lg:grid"
          )}>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Saldo Total</span>
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Wallet className="text-emerald-500 w-5 h-5" />
              </div>
            </div>
            <div className={cn("text-3xl font-bold", balance >= 0 ? "text-white" : "text-red-500")}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(balance)}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Entradas</span>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <TrendingUp className="text-blue-500 w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-bold text-blue-500">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalIncome)}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Saídas</span>
              <div className="p-2 bg-red-500/10 rounded-lg">
                <TrendingDown className="text-red-500 w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-bold text-red-500">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalExpense)}
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Transactions List */}
          <div className={cn(
            "lg:col-span-2 space-y-4",
            (activeTab !== 'transactions' && !isExporting) && "hidden lg:block"
          )}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-100">Transações Recentes</h2>
            </div>
            
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm overflow-hidden">
              {loading ? (
                <div className="p-12 text-center text-zinc-400">Carregando...</div>
              ) : filteredTransactions.length === 0 ? (
                <div className="p-12 text-center text-zinc-400">Nenhuma transação encontrada para este mês.</div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {filteredTransactions.map((t) => (
                    <motion.div 
                      key={t.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          t.type === 'income' ? "bg-blue-500/10 text-blue-500" : "bg-red-500/10 text-red-500"
                        )}>
                          {t.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-100">{t.description || t.category}</p>
                          <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
                            <span className="bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">{t.category}</span>
                            <span>•</span>
                            <span>{format(parseISO(t.date), "dd 'de' MMMM", { locale: ptBR })}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> 
                              {t.users?.length > 0 ? t.users.join(', ') : ((t as any).user || userProfile?.name)}
                            </span>
                            {t.type === 'expense' && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> {t.payment_method || 'PIX'}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={cn(
                          "font-semibold",
                          t.type === 'income' ? "text-blue-500" : "text-red-500"
                        )}>
                          {t.type === 'income' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEdit(t)}
                            className="p-2 text-zinc-500 hover:text-blue-500 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmationId(t.id)}
                            className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Charts & Insights */}
          <div className={cn(
            "space-y-8",
            (activeTab !== 'charts' && !isExporting) && "hidden lg:block"
          )}>
            <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-sm">
              <h2 className="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-emerald-500" />
                Gastos por Categoria
              </h2>
              <div className="h-64">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#f4f4f5' }}
                        itemStyle={{ color: '#f4f4f5' }}
                        formatter={(value: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                    Dados insuficientes para o gráfico
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-2">
                {chartData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-zinc-400">{item.name}</span>
                    </div>
                    <span className="font-medium text-zinc-100">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.value))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-sm">
              <h2 className="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-emerald-500" />
                Gastos por Forma de Pagamento
              </h2>
              <div className="h-64">
                {paymentMethodChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMethodChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {paymentMethodChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#f4f4f5' }}
                        itemStyle={{ color: '#f4f4f5' }}
                        formatter={(value: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                    Dados insuficientes para o gráfico
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-2">
                {paymentMethodChartData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[(index + 4) % COLORS.length] }} />
                      <span className="text-zinc-400">{item.name}</span>
                    </div>
                    <span className="font-medium text-zinc-100">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.value))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-sm">
              <h2 className="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                Receitas e Despesas por Usuário
              </h2>
              <div className="h-64">
                {userChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={userChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa' }} />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#a1a1aa' }}
                        tickFormatter={(value) => `R$ ${value}`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#f4f4f5' }}
                        itemStyle={{ color: '#f4f4f5' }}
                        formatter={(value: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))}
                        cursor={{ fill: '#18181b' }}
                      />
                      <Bar dataKey="income" name="Receitas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                    Dados insuficientes para o gráfico
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>
      </main>

      {/* Modal Nova Transação */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsModalOpen(false);
                setEditingId(null);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden border border-zinc-800"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">
                  {editingId ? 'Editar Transação' : 'Nova Transação'}
                </h3>
                <button 
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingId(null);
                  }}
                  className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="flex p-1 bg-zinc-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'expense', category: categories.find(c => c.type === 'expense')?.name || '' })}
                    className={cn(
                      "flex-1 py-2 rounded-md text-sm font-medium transition-all",
                      formData.type === 'expense' ? "bg-zinc-700 text-red-500 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'income', category: categories.find(c => c.type === 'income')?.name || '' })}
                    className={cn(
                      "flex-1 py-2 rounded-md text-sm font-medium transition-all",
                      formData.type === 'income' ? "bg-zinc-700 text-blue-500 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    Receita
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                      <Tag className="w-4 h-4" /> Categoria
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        setIsCategoryModalOpen(true);
                      }}
                      className="text-xs text-emerald-500 hover:text-emerald-400 font-medium"
                    >
                      Gerenciar Categorias
                    </button>
                  </div>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    {activeCategories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Wallet className="w-4 h-4" /> Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0,00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Data
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300 flex items-center justify-between">
                    <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Usuários</span>
                    <button 
                      type="button"
                      onClick={() => setIsMemberModalOpen(true)}
                      className="text-xs text-emerald-500 hover:underline"
                    >
                      + Novo Membro
                    </button>
                  </label>
                  <div className="flex flex-wrap gap-2 p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg min-h-[42px]">
                    {[userProfile?.name, ...members.map(m => m.name)].filter(Boolean).map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          const currentUsers = formData.users;
                          if (currentUsers.includes(name!)) {
                            setFormData({ ...formData, users: currentUsers.filter(u => u !== name) });
                          } else {
                            setFormData({ ...formData, users: [...currentUsers, name!] });
                          }
                        }}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                          formData.users.includes(name!)
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-emerald-500"
                        )}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  {formData.users.length === 0 && (
                    <p className="text-[10px] text-red-500">Selecione pelo menos um usuário.</p>
                  )}
                </div>

                {formData.type === 'expense' && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> Forma de Pagamento
                    </label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as "PIX" | "Dinheiro" | "Cartão" })}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    >
                      <option value="PIX">PIX</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Cartão">Cartão</option>
                    </select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Descrição
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Aluguel, Salário..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-600/20 transition-all mt-4"
                >
                  {editingId ? 'Salvar Alterações' : 'Salvar Transação'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Gerenciar Categorias */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[80vh] border border-zinc-800"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-white">Gerenciar Categorias</h3>
                <button 
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto space-y-6">
                <div className="flex p-1 bg-zinc-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setCategoryType('expense')}
                    className={cn(
                      "flex-1 py-2 rounded-md text-sm font-medium transition-all",
                      categoryType === 'expense' ? "bg-zinc-700 text-red-500 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    Despesas
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryType('income')}
                    className={cn(
                      "flex-1 py-2 rounded-md text-sm font-medium transition-all",
                      categoryType === 'income' ? "bg-zinc-700 text-blue-500 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    Receitas
                  </button>
                </div>

                <form onSubmit={handleAddCategory} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nova categoria..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="flex-1 bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </form>

                <div className="space-y-2">
                  {categories.filter(c => c.type === categoryType).map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-800 group">
                      <span className="text-zinc-200 font-medium">{cat.name}</span>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                        title="Excluir categoria"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {categories.filter(c => c.type === categoryType).length === 0 && (
                    <div className="text-center text-zinc-500 py-4 text-sm">
                      Nenhuma categoria cadastrada.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Exclusão */}
      <AnimatePresence>
        {deleteConfirmationId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmationId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-zinc-900 w-full max-w-sm rounded-2xl shadow-2xl relative z-10 overflow-hidden flex flex-col border border-zinc-800"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Excluir Transação</h3>
                  <p className="text-sm text-zinc-400 mt-1">
                    Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.
                  </p>
                </div>
              </div>
              <div className="p-4 bg-zinc-800/50 border-t border-zinc-800 flex gap-3">
                <button
                  onClick={() => setDeleteConfirmationId(null)}
                  className="flex-1 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl font-medium hover:bg-zinc-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmationId)}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation Bar (Mobile Only) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 px-6 py-3 z-40 flex items-center justify-between shadow-[0_-4px_12px_rgba(0,0,0,0.2)]">
        <button
          onClick={() => setActiveTab('summary')}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activeTab === 'summary' ? "text-emerald-500" : "text-zinc-500"
          )}
        >
          <LayoutDashboard className="w-6 h-6" />
          <span className="text-[10px] font-medium">Resumo</span>
        </button>
        
        <button
          onClick={() => setActiveTab('transactions')}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activeTab === 'transactions' ? "text-emerald-500" : "text-zinc-500"
          )}
        >
          <List className="w-6 h-6" />
          <span className="text-[10px] font-medium">Transações</span>
        </button>
        
        <div className="relative -top-6">
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({
                type: 'expense',
                category: categories.find(c => c.type === 'expense')?.name || '',
                amount: '',
                date: new Date().toISOString().split('T')[0],
                description: '',
                payment_method: 'PIX',
                users: userProfile ? [userProfile.name] : []
              });
              setIsModalOpen(true);
            }}
            className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-600/30 active:scale-95 transition-transform"
          >
            <Plus className="w-7 h-7" />
          </button>
        </div>

        <button
          onClick={() => setActiveTab('charts')}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activeTab === 'charts' ? "text-emerald-500" : "text-zinc-500"
          )}
        >
          <BarChart3 className="w-6 h-6" />
          <span className="text-[10px] font-medium">Gráficos</span>
        </button>

        <button
          onClick={() => setIsCategoryModalOpen(true)}
          className="flex flex-col items-center gap-1 text-zinc-500"
        >
          <Tag className="w-6 h-6" />
          <span className="text-[10px] font-medium">Categorias</span>
        </button>
      </div>
      {/* Export Selection Modal */}
      <AnimatePresence>
        {isExportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-zinc-800"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Exportar Relatório</h3>
                <button onClick={() => setIsExportModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <p className="text-sm text-zinc-400">Selecione o mês do relatório que deseja gerar em PDF:</p>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Período</label>
                  <input 
                    type="month" 
                    value={exportMonth}
                    onChange={(e) => setExportMonth(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-white"
                  />
                </div>
              </div>

              <div className="p-6 bg-zinc-800/50 border-t border-zinc-800 flex gap-3">
                <button
                  onClick={() => setIsExportModalOpen(false)}
                  className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-300 px-4 py-2.5 rounded-xl font-medium hover:bg-zinc-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={exportToPDF}
                  className="flex-1 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                >
                  Gerar PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Member Management Modal */}
      <AnimatePresence>
        {isMemberModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-zinc-800"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Gerenciar Membros</h3>
                <button onClick={() => setIsMemberModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <form onSubmit={handleAddMember} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nome do novo membro"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="flex-1 bg-zinc-800 border border-zinc-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-emerald-600/20"
                  >
                    Adicionar
                  </button>
                </form>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-zinc-500">Membros Atuais</p>
                  <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="p-3 flex items-center justify-between bg-zinc-800/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold text-xs">
                          {userProfile?.name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-white">{userProfile?.name} (Você)</span>
                      </div>
                    </div>
                    {members.map((member) => (
                      <div key={member.id} className="p-3 flex items-center justify-between hover:bg-zinc-800/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-xs">
                            {member.name.charAt(0)}
                          </div>
                          <span className="text-sm text-zinc-300">{member.name}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteMember(member.id)}
                          className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {members.length === 0 && (
                      <div className="p-8 text-center text-zinc-500 text-sm">
                        Nenhum membro adicional cadastrado.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-zinc-800/50 border-t border-zinc-800">
                <button
                  onClick={() => setIsMemberModalOpen(false)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-300 px-4 py-2 rounded-xl font-medium hover:bg-zinc-700 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

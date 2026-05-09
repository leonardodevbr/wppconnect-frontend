import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import {
  PlusIcon,
  PlayIcon,
  StopIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  HomeIcon,
  ServerIcon,
  ShieldCheckIcon,
  CogIcon,
  ChartBarIcon,
  DocumentTextIcon,
  BellIcon,
  QuestionMarkCircleIcon,
  ExclamationTriangleIcon,
  QrCodeIcon,
} from '@heroicons/react/24/outline';

// Tipos inline para evitar problemas de importação
interface Instance {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'connecting';
  token: string;
  createdAt: string;
  messages: {
    sent: number;
    received: number;
  };
  webhook?: string;
}

interface Stats {
  totalInstances: number;
  connectedInstances: number;
  disconnectedInstances: number;
  totalMessagesSent: number;
  totalMessagesReceived: number;
}

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalInstances: 0,
    connectedInstances: 0,
    disconnectedInstances: 0,
    totalMessagesSent: 0,
    totalMessagesReceived: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [newInstanceWebhook, setNewInstanceWebhook] = useState('');
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [showInstanceDetails, setShowInstanceDetails] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [loadingInstances, setLoadingInstances] = useState<Record<string, boolean>>({});
  const [qrPollingInstance, setQrPollingInstance] = useState<string | null>(null);
  const [selectedQrInstance, setSelectedQrInstance] = useState<Instance | null>(null);
  const [qrPollingRef, setQrPollingRef] = useState<ReturnType<typeof setInterval> | null>(null);
  const qrPollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    return () => {
      if (qrPollingIntervalRef.current !== null) {
        clearInterval(qrPollingIntervalRef.current);
      }
    };
  }, []);

  const closeQrModal = () => {
    if (qrPollingIntervalRef.current !== null) {
      clearInterval(qrPollingIntervalRef.current);
      qrPollingIntervalRef.current = null;
    }
    if (qrPollingRef) clearInterval(qrPollingRef);
    setQrPollingRef(null);
    setShowQrCode(false);
    setQrCodeData(null);
    setSelectedQrInstance(null);
    setQrPollingInstance(null);
  };

  const startQrPolling = (instanceId: string) => {
    if (qrPollingIntervalRef.current !== null) {
      clearInterval(qrPollingIntervalRef.current);
      qrPollingIntervalRef.current = null;
    }
    setQrPollingRef(null);
    setQrPollingInstance(instanceId);

    let attempts = 0;
    const maxAttempts = 20;

    const poll = setInterval(async () => {
      attempts += 1;
      try {
        const qrResponse = await apiService.getInstanceQrCode(instanceId, '');

        if (qrResponse.status === 'success' && qrResponse.data?.qrcode) {
          setQrCodeData(qrResponse.data.qrcode);
          clearInterval(poll);
          qrPollingIntervalRef.current = null;
          setQrPollingRef(null);
          return;
        }
        if (
          qrResponse.status === 'success' &&
          (qrResponse.data?.sessionStatus === 'CONNECTED' ||
            qrResponse.data?.status === 'CONNECTED')
        ) {
          clearInterval(poll);
          qrPollingIntervalRef.current = null;
          setQrPollingRef(null);
          setShowQrCode(false);
          setInstances((prev) =>
            prev.map((i) =>
              i.id === instanceId ? { ...i, status: 'connected' } : i
            )
          );
          setSelectedQrInstance(null);
          setQrPollingInstance(null);
          alert('✅ WhatsApp conectado com sucesso!');
        }
      } catch {
        // ignorar erros de polling
      }

      if (attempts >= maxAttempts) {
        clearInterval(poll);
        qrPollingIntervalRef.current = null;
        setQrPollingRef(null);
        setQrCodeData(null);
      }
    }, 3000);

    qrPollingIntervalRef.current = poll;
    setQrPollingRef(poll);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsResponse, instancesResponse] = await Promise.all([
        apiService.getStats(),
        apiService.listInstances(),
      ]);

      if (statsResponse.status === 'success' && statsResponse.data) {
        setStats(statsResponse.data);
      }

          // Converter instâncias reais do backend
          if (instancesResponse.status === 'success' && instancesResponse.data) {
            const realInstances: Instance[] = instancesResponse.data.map((instance: any) => ({
              id: instance.name,
              name: instance.name.replace(/-/g, ' ').toUpperCase(),
              status: instance.status === 'CONNECTED' ? 'connected' : 
                      instance.status === 'QRCODE' ? 'connecting' : 'disconnected',
              token: '***', // Token será gerado quando necessário
              createdAt: new Date(instance.createdAt).toLocaleDateString('pt-BR'),
              messages: { sent: instance.messages?.sent || 0, received: instance.messages?.received || 0 },
              webhook: instance.webhook || '',
            }));
        setInstances(realInstances);
        
        // Atualizar estatísticas baseadas nas instâncias reais
        const totalInstances = realInstances.length;
        const connectedInstances = realInstances.filter(i => i.status === 'connected').length;
        const disconnectedInstances = totalInstances - connectedInstances;
        
        setStats({
          totalInstances,
          connectedInstances,
          disconnectedInstances,
          totalMessagesSent: realInstances.reduce((sum, i) => sum + i.messages.sent, 0),
          totalMessagesReceived: realInstances.reduce((sum, i) => sum + i.messages.received, 0),
        });
      } else {
        // Se não conseguiu buscar instâncias, manter arrays vazios
        setInstances([]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const createInstance = async () => {
    if (!newInstanceName.trim()) return;

    try {
      const response = await apiService.createInstance(newInstanceName.trim(), newInstanceWebhook.trim() || undefined);
      
      if (response.status === 'success') {
        const newInstance: Instance = {
          id: response.data.name,
          name: response.data.name.replace(/-/g, ' ').toUpperCase(),
          status: response.data.status === 'CONNECTED' ? 'connected' : 
                  response.data.status === 'QRCODE' ? 'connecting' : 'disconnected',
          token: response.data.full,
          createdAt: new Date().toLocaleDateString('pt-BR'),
          messages: { sent: 0, received: 0 },
          webhook: newInstanceWebhook.trim(),
        };

        setInstances(prev => [...prev, newInstance]);
        setStats(prev => ({
          ...prev,
          totalInstances: prev.totalInstances + 1,
          disconnectedInstances: prev.disconnectedInstances + 1,
        }));

        setNewInstanceName('');
        setNewInstanceWebhook('');
        setShowCreateModal(false);
        
        // Se tem QR Code, mostrar automaticamente
        if (response.data.qrcode) {
          setQrCodeData(response.data.qrcode);
          setShowQrCode(true);
        }
        
        alert('Instância criada com sucesso!');
      } else {
        alert(`Erro ao criar instância: ${response.message}`);
      }
    } catch (error) {
      console.error('Erro ao criar instância:', error);
      alert('Erro ao criar instância');
    }
  };

  const startInstance = async (instance: Instance) => {
    if (loadingInstances[instance.id]) return;

    setLoadingInstances((prev) => ({ ...prev, [instance.id]: true }));
    setInstances((prev) =>
      prev.map((i) =>
        i.id === instance.id ? { ...i, status: 'connecting' } : i
      )
    );

    try {
      const response = await apiService.startInstance(instance.id, instance.token);

      if (response.status === 'success') {
        setSelectedQrInstance(instance);
        setQrCodeData(null);
        setShowQrCode(true);
        startQrPolling(instance.id);
      } else {
        alert(`Erro ao iniciar instância: ${response.message}`);
        setInstances((prev) =>
          prev.map((i) =>
            i.id === instance.id ? { ...i, status: 'disconnected' } : i
          )
        );
      }
    } catch (error) {
      console.error('Erro ao iniciar instância:', error);
      setInstances((prev) =>
        prev.map((i) =>
          i.id === instance.id ? { ...i, status: 'disconnected' } : i
        )
      );
    } finally {
      setLoadingInstances((prev) => ({ ...prev, [instance.id]: false }));
    }
  };

  const deleteInstance = async (instance: Instance) => {
    if (
      !confirm(
        `Excluir a instância "${instance.name}"? Esta ação não pode ser desfeita.`
      )
    )
      return;

    try {
      const response = await apiService.deleteInstance(instance.id);
      if (response.status === 'success') {
        if (selectedQrInstance?.id === instance.id) {
          closeQrModal();
        }
        setInstances((prev) => prev.filter((i) => i.id !== instance.id));
        setStats((prev) => ({
          ...prev,
          totalInstances: Math.max(0, prev.totalInstances - 1),
          disconnectedInstances:
            instance.status !== 'connected'
              ? Math.max(0, prev.disconnectedInstances - 1)
              : prev.disconnectedInstances,
          connectedInstances:
            instance.status === 'connected'
              ? Math.max(0, prev.connectedInstances - 1)
              : prev.connectedInstances,
        }));
        if (selectedInstance?.id === instance.id) {
          setShowInstanceDetails(false);
          setSelectedInstance(null);
        }
      } else {
        alert(`Erro ao excluir: ${response.message}`);
      }
    } catch (error) {
      alert('Erro ao excluir instância');
    }
  };

  const stopInstance = async (instance: Instance) => {
    try {
      const response = await apiService.stopInstance(instance.id, instance.token);
      
      if (response.status === 'success') {
        setInstances(prev => prev.map(i => 
          i.id === instance.id ? { ...i, status: 'disconnected' } : i
        ));
        alert('Instância parada com sucesso!');
      } else {
        alert(`Erro ao parar instância: ${response.message}`);
      }
    } catch (error) {
      console.error('Erro ao parar instância:', error);
      alert('Erro ao parar instância');
    }
  };

  const showQrCodeForInstance = (instance: Instance) => {
    setSelectedQrInstance(instance);
    setQrCodeData(null);
    setShowQrCode(true);
    startQrPolling(instance.id);
  };

  const openInstanceDetails = async (instance: Instance) => {
    setSelectedInstance(instance);
    setShowInstanceDetails(true);
    
    // Carregar configurações da instância (não precisa de token real)
    try {
      const configResponse = await apiService.getInstanceConfig(instance.id, '');
      if (configResponse.status === 'success' && configResponse.data) {
        setSelectedInstance(prev => prev ? {
          ...prev,
          webhook: configResponse.data.webhook || ''
        } : null);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações da instância:', error);
    }
  };

  const closeInstanceDetails = () => {
    setSelectedInstance(null);
    setShowInstanceDetails(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg">
        <div className="p-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">SIGVSA</h1>
              <p className="text-sm text-gray-500">WhatsApp API</p>
            </div>
          </div>
        </div>

        <nav className="mt-6">
          <div className="px-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Principal</h3>
            <div className="space-y-1">
              <button
                onClick={() => setActiveMenu('dashboard')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeMenu === 'dashboard'
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <HomeIcon className="w-5 h-5 mr-3" />
                Dashboard
              </button>
              <button
                onClick={() => setActiveMenu('instances')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeMenu === 'instances'
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ServerIcon className="w-5 h-5 mr-3" />
                Instâncias Web
              </button>
              <button
                onClick={() => setActiveMenu('messages')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeMenu === 'messages'
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <DocumentTextIcon className="w-5 h-5 mr-3" />
                Mensagens
              </button>
              <button
                onClick={() => setActiveMenu('analytics')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeMenu === 'analytics'
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ChartBarIcon className="w-5 h-5 mr-3" />
                Relatórios
              </button>
            </div>
          </div>

          <div className="px-6 mt-8">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Configurações</h3>
            <div className="space-y-1">
              <button
                onClick={() => setActiveMenu('account')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeMenu === 'account'
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <UserIcon className="w-5 h-5 mr-3" />
                Dados da conta
              </button>
              <button
                onClick={() => setActiveMenu('security')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeMenu === 'security'
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ShieldCheckIcon className="w-5 h-5 mr-3" />
                Segurança
              </button>
              <button
                onClick={() => setActiveMenu('webhooks')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeMenu === 'webhooks'
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <BellIcon className="w-5 h-5 mr-3" />
                Webhooks
              </button>
              <button
                onClick={() => setActiveMenu('settings')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeMenu === 'settings'
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <CogIcon className="w-5 h-5 mr-3" />
                Configurações
              </button>
            </div>
          </div>

          <div className="px-6 mt-8">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Ajuda</h3>
            <div className="space-y-1">
              <button
                onClick={() => setActiveMenu('help')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeMenu === 'help'
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <QuestionMarkCircleIcon className="w-5 h-5 mr-3" />
                Central de Ajuda
              </button>
              <button
                onClick={() => setActiveMenu('status')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeMenu === 'status'
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ExclamationTriangleIcon className="w-5 h-5 mr-3" />
                Status do Sistema
              </button>
            </div>
          </div>
        </nav>

        {/* User Info */}
        <div className="absolute bottom-0 w-64 p-6 border-t border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4">
            <h1 className="text-2xl font-semibold text-gray-900">
              {activeMenu === 'dashboard' && 'Dashboard'}
              {activeMenu === 'instances' && 'Instâncias Web'}
              {activeMenu === 'messages' && 'Mensagens'}
              {activeMenu === 'analytics' && 'Relatórios'}
              {activeMenu === 'account' && 'Dados da conta'}
              {activeMenu === 'security' && 'Segurança'}
              {activeMenu === 'webhooks' && 'Webhooks'}
              {activeMenu === 'settings' && 'Configurações'}
              {activeMenu === 'help' && 'Central de Ajuda'}
              {activeMenu === 'status' && 'Status do Sistema'}
            </h1>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6">
          {activeMenu === 'dashboard' && (
            <div>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="card p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-blue-600 font-semibold">T</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Total de Instâncias</p>
                      <p className="text-2xl font-semibold text-gray-900">{stats.totalInstances}</p>
                    </div>
                  </div>
                </div>

                <div className="card p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <span className="text-green-600 font-semibold">C</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Conectadas</p>
                      <p className="text-2xl font-semibold text-gray-900">{stats.connectedInstances}</p>
                    </div>
                  </div>
                </div>

                <div className="card p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                        <span className="text-red-600 font-semibold">D</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Desconectadas</p>
                      <p className="text-2xl font-semibold text-gray-900">{stats.disconnectedInstances}</p>
                    </div>
                  </div>
                </div>

                <div className="card p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <span className="text-purple-600 font-semibold">M</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Total Mensagens</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {stats.totalMessagesSent + stats.totalMessagesReceived}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity - Placeholder until real activity is implemented */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Atividade Recente</h3>
                <div className="space-y-3">
                  {instances.length === 0 ? (
                    <p className="text-gray-500 text-sm">Nenhuma atividade recente</p>
                  ) : (
                    <p className="text-gray-500 text-sm">Carregando atividades...</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'instances' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Minhas Instâncias Web</h2>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary flex items-center space-x-2"
                >
                  <PlusIcon className="w-5 h-5" />
                  <span>Nova Instância</span>
                </button>
              </div>
              <div className="card">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nome
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Token
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Criado em
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mensagens
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {instances.map((instance) => (
                      <tr key={instance.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openInstanceDetails(instance)}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{instance.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={
                              instance.status === 'connected'
                                ? 'status-connected'
                                : 'status-disconnected'
                            }
                          >
                            {instance.status === 'connected'
                              ? 'Conectada'
                              : instance.status === 'connecting'
                                ? 'Conectando...'
                                : 'Desconectada'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {instance.token.substring(0, 10)}...
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(instance.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>
                            <div>Enviadas: {instance.messages.sent}</div>
                            <div>Recebidas: {instance.messages.received}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            {instance.status === 'connected' ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  stopInstance(instance);
                                }}
                                className="btn-danger flex items-center space-x-1"
                              >
                                <StopIcon className="w-4 h-4" />
                                <span>Parar</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startInstance(instance);
                                }}
                                disabled={loadingInstances[instance.id]}
                                className={`btn-success flex items-center space-x-1 ${
                                  loadingInstances[instance.id]
                                    ? 'opacity-60 cursor-not-allowed'
                                    : ''
                                }`}
                              >
                                {loadingInstances[instance.id] ? (
                                  <>
                                    <svg
                                      className="animate-spin w-4 h-4"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      aria-hidden
                                    >
                                      <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                      />
                                      <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8v8z"
                                      />
                                    </svg>
                                    <span>Iniciando...</span>
                                  </>
                                ) : (
                                  <>
                                    <PlayIcon className="w-4 h-4" />
                                    <span>Iniciar</span>
                                  </>
                                )}
                              </button>
                            )}
                            {(instance.status === 'connecting' || instance.status === 'disconnected') && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showQrCodeForInstance(instance);
                                }}
                                className="btn-secondary flex items-center space-x-1"
                              >
                                <QrCodeIcon className="w-4 h-4" />
                                <span>QR Code</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteInstance(instance);
                              }}
                              className="btn-danger flex items-center space-x-1"
                              title="Excluir instância"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-hidden
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                              <span>Excluir</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Outras páginas */}
          {activeMenu === 'messages' && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Mensagens</h3>
              <p className="text-gray-600">Visualização de mensagens em tempo real em breve...</p>
            </div>
          )}

          {activeMenu === 'analytics' && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Relatórios</h3>
              <p className="text-gray-600">Gráficos e relatórios avançados em breve...</p>
            </div>
          )}

          {activeMenu === 'account' && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Dados da Conta</h3>
              <p className="text-gray-600">Configurações da conta em breve...</p>
            </div>
          )}

          {activeMenu === 'security' && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Segurança</h3>
              <p className="text-gray-600">Configurações de segurança em breve...</p>
            </div>
          )}

          {activeMenu === 'webhooks' && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Webhooks</h3>
              <p className="text-gray-600">Configuração de webhooks em breve...</p>
            </div>
          )}

          {activeMenu === 'settings' && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Configurações</h3>
              <p className="text-gray-600">Configurações gerais em breve...</p>
            </div>
          )}

          {activeMenu === 'help' && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Central de Ajuda</h3>
              <p className="text-gray-600">Documentação e suporte em breve...</p>
            </div>
          )}

          {activeMenu === 'status' && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Status do Sistema</h3>
              <p className="text-gray-600">Monitoramento do sistema em breve...</p>
            </div>
          )}
        </main>
      </div>

      {/* Instance Details Modal */}
      {showInstanceDetails && selectedInstance && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-medium text-gray-900">Detalhes da Instância</h3>
                <button
                  onClick={closeInstanceDetails}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Informações Básicas */}
                <div className="card p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Informações Básicas</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Nome</label>
                      <p className="text-gray-900">{selectedInstance.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">ID</label>
                      <p className="text-gray-900 font-mono text-sm">{selectedInstance.id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Status</label>
                      <span className={selectedInstance.status === 'connected' ? 'status-connected' : 'status-disconnected'}>
                        {selectedInstance.status === 'connected' ? 'Conectada' : 'Desconectada'}
                      </span>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Criado em</label>
                      <p className="text-gray-900">{selectedInstance.createdAt}</p>
                    </div>
                  </div>
                </div>

                {/* Estatísticas */}
                <div className="card p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Estatísticas</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mensagens Enviadas</span>
                      <span className="font-semibold text-blue-600">{selectedInstance.messages.sent}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mensagens Recebidas</span>
                      <span className="font-semibold text-green-600">{selectedInstance.messages.received}</span>
                    </div>
                    <div className="flex justify-between border-t pt-3">
                      <span className="text-gray-600 font-medium">Total</span>
                      <span className="font-bold text-gray-900">{selectedInstance.messages.sent + selectedInstance.messages.received}</span>
                    </div>
                  </div>
                </div>

                {/* Token */}
                <div className="card p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Token de Acesso</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Token Atual</label>
                      <div className="flex items-center space-x-2">
                        <p className="text-gray-900 font-mono text-xs bg-gray-100 p-2 rounded flex-1 overflow-hidden text-ellipsis whitespace-nowrap" style={{ maxWidth: '300px' }}>
                          {selectedInstance.token}
                        </p>
                        <button
                          onClick={async () => {
                            try {
                              // Se o token é apenas asteriscos, gerar um novo
                              let tokenToCopy = selectedInstance.token;
                              if (tokenToCopy === '***' || tokenToCopy.length < 10) {
                                const response = await apiService.generateToken(selectedInstance.id);
                                if (response.status === 'success' && response.data) {
                                  tokenToCopy = response.data.full;
                                  // Atualizar o token na instância selecionada
                                  setSelectedInstance({
                                    ...selectedInstance,
                                    token: response.data.full
                                  });
                                } else {
                                  alert('Erro ao gerar token: ' + response.message);
                                  return;
                                }
                              }
                              
                              navigator.clipboard.writeText(tokenToCopy);
                              alert('Token copiado para a área de transferência!');
                            } catch (error) {
                              console.error('Erro ao copiar token:', error);
                              alert('Erro ao copiar token');
                            }
                          }}
                          className="btn-secondary text-xs"
                        >
                          Copiar
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const response = await apiService.generateToken(selectedInstance.id);
                          if (response.status === 'success' && response.data) {
                            setSelectedInstance({
                              ...selectedInstance,
                              token: response.data.token
                            });
                            alert('Novo token gerado com sucesso!');
                          } else {
                            alert('Erro ao gerar novo token: ' + response.message);
                          }
                        } catch (error) {
                          alert('Erro ao gerar novo token');
                        }
                      }}
                      className="btn-primary w-full"
                    >
                      Gerar Novo Token
                    </button>
                  </div>
                </div>

                {/* Ações */}
                <div className="card p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Ações</h4>
                  <div className="space-y-3">
                    {selectedInstance.status === 'connected' ? (
                      <button
                        onClick={() => {
                          stopInstance(selectedInstance);
                          closeInstanceDetails();
                        }}
                        className="btn-danger w-full flex items-center justify-center space-x-2"
                      >
                        <StopIcon className="w-5 h-5" />
                        <span>Parar Instância</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          startInstance(selectedInstance);
                          closeInstanceDetails();
                        }}
                        className="btn-success w-full flex items-center justify-center space-x-2"
                      >
                        <PlayIcon className="w-5 h-5" />
                        <span>Iniciar Instância</span>
                      </button>
                    )}
                    
                    <button
                      onClick={() => {
                        // Implementar reiniciar instância
                        alert('Funcionalidade de reiniciar em desenvolvimento');
                      }}
                      className="btn-secondary w-full flex items-center justify-center space-x-2"
                    >
                      <CogIcon className="w-5 h-5" />
                      <span>Reiniciar Instância</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Webhook Configuration */}
              <div className="card p-6 mt-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Configuração de Webhook</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      URL do Webhook
                    </label>
                    <input
                      type="url"
                      value={selectedInstance.webhook || ''}
                      onChange={(e) => {
                        setSelectedInstance({
                          ...selectedInstance,
                          webhook: e.target.value
                        });
                      }}
                      className="input-field"
                      placeholder="https://seu-site.com/webhook"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={async () => {
                        if (!selectedInstance) return;
                        
                        try {
                          const response = await apiService.setInstanceWebhook(
                            selectedInstance.id, 
                            selectedInstance.token, 
                            selectedInstance.webhook || ''
                          );
                          
                          if (response.status === 'success') {
                            alert('Webhook salvo com sucesso!');
                          } else {
                            alert('Erro ao salvar webhook: ' + response.message);
                          }
                        } catch (error) {
                          alert('Erro ao salvar webhook');
                        }
                      }}
                      className="btn-primary flex-1"
                    >
                      Salvar Webhook
                    </button>
                    <button
                      onClick={async () => {
                        if (!selectedInstance || !selectedInstance.webhook) {
                          alert('Configure um webhook primeiro!');
                          return;
                        }
                        
                        try {
                          // Fazer um POST para testar o webhook
                          const testResponse = await fetch(selectedInstance.webhook, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                              event: 'test',
                              session: selectedInstance.id,
                              timestamp: new Date().toISOString(),
                              message: 'Este é um teste de webhook da SIGVSA'
                            })
                          });
                          
                          if (testResponse.ok) {
                            alert('✅ Webhook respondeu com sucesso!\nStatus: ' + testResponse.status);
                          } else {
                            alert('⚠️ Webhook respondeu com erro!\nStatus: ' + testResponse.status);
                          }
                        } catch (error) {
                          alert('❌ Erro ao testar webhook. Verifique se a URL está correta e acessível.');
                        }
                      }}
                      className="btn-secondary flex-1"
                    >
                      Testar Webhook
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Activity - Placeholder until real activity is implemented */}
              <div className="card p-6 mt-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Atividade Recente</h4>
                <div className="space-y-3">
                  <p className="text-gray-500 text-sm">Nenhuma atividade recente para esta instância</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Instance Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Nova Instância</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Instância
                </label>
                <input
                  type="text"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  className="input-field"
                  placeholder="ex: minha-instancia"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Webhook (opcional)
                </label>
                <input
                  type="url"
                  value={newInstanceWebhook}
                  onChange={(e) => setNewInstanceWebhook(e.target.value)}
                  className="input-field"
                  placeholder="https://webhook.site/123"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  onClick={createInstance}
                  className="btn-primary"
                >
                  Criar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrCode && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Conectar WhatsApp
                  {selectedQrInstance && (
                    <span className="text-sm text-gray-500 ml-2">
                      — {selectedQrInstance.name}
                    </span>
                  )}
                  {qrPollingInstance ? (
                    <span className="sr-only">Polling ativo</span>
                  ) : null}
                </h3>
                <button
                  type="button"
                  onClick={closeQrModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>

              <div className="text-center mb-4">
                <p className="text-sm text-gray-600 mb-4">
                  Abra o WhatsApp → Menu → Dispositivos Conectados → Conectar
                  dispositivo
                </p>

                {qrCodeData && qrCodeData.length > 100 ? (
                  <div className="flex justify-center">
                    <img
                      src={qrCodeData}
                      alt="QR Code"
                      className="border-2 border-gray-300 rounded-lg shadow-lg mx-auto"
                      style={{ width: '280px', height: '280px' }}
                    />
                  </div>
                ) : (
                  <div
                    className="flex flex-col justify-center items-center bg-gray-100 rounded-lg mx-auto gap-3"
                    style={{
                      width: '280px',
                      height: '280px',
                      border: '2px dashed #ccc',
                    }}
                  >
                    <svg
                      className="animate-spin w-8 h-8 text-blue-500"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                      />
                    </svg>
                    <p className="text-gray-500 text-sm text-center px-4">
                      Aguardando QR Code...
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center mt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedQrInstance) {
                      setQrCodeData(null);
                      startQrPolling(selectedQrInstance.id);
                    }
                  }}
                  className="btn-secondary text-sm"
                >
                  🔄 Atualizar QR
                </button>
                <button type="button" onClick={closeQrModal} className="btn-secondary">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

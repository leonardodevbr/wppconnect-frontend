import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
/** Mesmo valor que SECRET_KEY no backend (Railway). No Vercel: Environment Variables → VITE_SECRET_KEY */
const SECRET_KEY =
  import.meta.env.VITE_SECRET_KEY?.trim() ||
  (import.meta.env.DEV ? 'THISISMYSECURETOKEN' : '');

// Tipos básicos
interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: string;
}

interface Stats {
  totalInstances: number;
  connectedInstances: number;
  disconnectedInstances: number;
  totalMessagesSent: number;
  totalMessagesReceived: number;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface ApiResponse<T = any> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
}

class ApiService {
  private api: any;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
    });
  }

  // Autenticação
  async login(credentials: LoginCredentials): Promise<ApiResponse<User>> {
    try {
      const response = await this.api.post('/auth/login', credentials);
      
      console.log('Resposta completa do login:', response.data);
      
      if (response.data.status === 'success' && response.data.data) {
        // Salvar token no localStorage
        if (response.data.data.token) {
          localStorage.setItem('token', response.data.data.token);
        }
        
        // Retornar o usuário
        const user = response.data.data.user;
        console.log('Usuário retornado:', user);
        
        return {
          status: 'success',
          data: user
        };
      }
      
      return { 
        status: 'error', 
        message: response.data.message || 'Credenciais inválidas' 
      };
    } catch (error: any) {
      console.error('Erro na chamada de login:', error);
      return { 
        status: 'error', 
        message: error.response?.data?.message || 'Erro ao fazer login' 
      };
    }
  }

  // Estatísticas
  async getStats(): Promise<ApiResponse<Stats>> {
    try {
      // Buscar instâncias reais para calcular estatísticas
      const instancesResponse = await this.listInstances();
      if (instancesResponse.status === 'success' && instancesResponse.data) {
        const instances = instancesResponse.data;
        const totalInstances = instances.length;
        const connectedInstances = instances.filter((i: any) => i.status === 'CONNECTED').length;
        const disconnectedInstances = totalInstances - connectedInstances;
        
        const stats: Stats = {
          totalInstances,
          connectedInstances,
          disconnectedInstances,
          totalMessagesSent: instances.reduce((sum: number, i: any) => sum + (i.messages?.sent || 0), 0),
          totalMessagesReceived: instances.reduce((sum: number, i: any) => sum + (i.messages?.received || 0), 0),
        };
        return { status: 'success', data: stats };
      }
      
      // Retornar stats zerados se não conseguir buscar instâncias
      return { 
        status: 'success', 
        data: {
          totalInstances: 0,
          connectedInstances: 0,
          disconnectedInstances: 0,
          totalMessagesSent: 0,
          totalMessagesReceived: 0,
        }
      };
    } catch (error: any) {
      return { status: 'error', message: error.response?.data?.message || 'Erro ao obter estatísticas' };
    }
  }

  // Sessões
  async getAllSessions(): Promise<ApiResponse<string[]>> {
    try {
      const response = await this.api.get(`/${SECRET_KEY}/show-all-sessions`);
      return { status: 'success', data: response.data.response };
    } catch (error: any) {
      return { status: 'error', message: error.response?.data?.message || 'Erro ao obter sessões' };
    }
  }

  // Token
  async generateToken(sessionName: string): Promise<ApiResponse<{ token: string; full: string }>> {
    try {
      const response = await this.api.post(`/${sessionName}/${SECRET_KEY}/generate-token`);
      return {
        status: 'success',
        data: {
          token: response.data.token,
          full: response.data.full
        }
      };
    } catch (error: any) {
      return { status: 'error', message: error.response?.data?.message || 'Erro ao gerar token' };
    }
  }

  // Mensagens
  async sendMessage(sessionName: string, token: string, message: any): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.post(`/${sessionName}/send-message`, message, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error: any) {
      return { status: 'error', message: error.response?.data?.message || 'Erro ao enviar mensagem' };
    }
  }

  // Contatos e Chats
  async getContacts(sessionName: string, token: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.get(`/${sessionName}/all-contacts`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error: any) {
      return { status: 'error', message: error.response?.data?.message || 'Erro ao obter contatos' };
    }
  }

  async getChats(sessionName: string, token: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.get(`/${sessionName}/all-chats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error: any) {
      return { status: 'error', message: error.response?.data?.message || 'Erro ao obter chats' };
    }
  }

  // Configurações de Instância
  async getInstanceConfig(sessionName: string, _token: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.get(`/${sessionName}/config`);
      return response.data;
    } catch (error: any) {
      return { status: 'error', message: error.response?.data?.message || 'Erro ao obter configurações' };
    }
  }

  async saveInstanceConfig(sessionName: string, token: string, config: any): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.post(`/${sessionName}/config`, config, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error: any) {
      return { status: 'error', message: error.response?.data?.message || 'Erro ao salvar configurações' };
    }
  }

  async setInstanceWebhook(sessionName: string, _token: string, webhookUrl: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.post(`/${sessionName}/webhook`, {
        url: webhookUrl
      });
      return response.data;
    } catch (error: any) {
      return { status: 'error', message: error.response?.data?.message || 'Erro ao configurar webhook' };
    }
  }

  // Gerenciamento de Instâncias — create-instance no Mongo + start-session (WPPConnect / QR)
  async createInstance(name: string, webhook?: string): Promise<ApiResponse<any>> {
    const session = name.trim();
    try {
      const createRes = await this.api.post('/create-instance', {
        name: session,
        webhook,
      });
      if (!createRes.data?.success) {
        return {
          status: 'error',
          message: createRes.data?.error || 'Erro ao criar instância',
        };
      }

      const gen = await this.generateToken(session);
      if (gen.status !== 'success' || !gen.data?.token) {
        return {
          status: 'error',
          message: gen.message || 'Erro ao gerar token da sessão',
        };
      }

      const bearerToken = gen.data.token;

      // Disparar start-session sem aguardar (fire and forget)
      this.api
        .post(
          `/${encodeURIComponent(session)}/start-session`,
          { waitQrCode: false, webhook: webhook || '' },
          {
            headers: { Authorization: `Bearer ${bearerToken}` },
            timeout: 10000, // só para enviar a requisição, não aguarda conclusão
          }
        )
        .catch(() => {}); // ignorar timeout — o WPPConnect processa em background

      // Aguardar um pouco para o Chromium inicializar
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Retornar sucesso imediatamente — QR virá via polling
      return {
        status: 'success',
        data: {
          name: session,
          full: gen.data.full,
          status: 'INITIALIZING',
          qrcode: null,
        },
      };
    } catch (error: any) {
      const d = error.response?.data;
      const msg =
        d?.error ||
        d?.message ||
        error.message ||
        'Erro ao criar instância';
      return { status: 'error', message: msg };
    }
  }

  async listInstances(): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.get('/instances');
      return response.data;
    } catch (error: any) {
      return { status: 'error', message: error.response?.data?.message || 'Erro ao listar instâncias' };
    }
  }

  async getInstanceQrCode(sessionName: string, token: string): Promise<ApiResponse<any>> {
    try {
      // Tentar como JSON primeiro
      const response = await this.api.get(`/${sessionName}/qrcode-session`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        responseType: 'arraybuffer',
        timeout: 15000,
      });

      const contentType = response.headers['content-type'] || '';

      if (contentType.includes('image/png') || contentType.includes('image/jpeg')) {
        // É uma imagem — converter para base64
        const base64 = btoa(
          new Uint8Array(response.data as ArrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        );
        return {
          status: 'success',
          data: {
            qrcode: `data:image/png;base64,${base64}`,
            sessionStatus: 'QRCODE',
          },
        };
      }

      // É JSON — decodificar e verificar status
      const text = new TextDecoder().decode(new Uint8Array(response.data as ArrayBuffer));
      const json = JSON.parse(text);

      if (json.qrcode && json.qrcode.startsWith('data:image')) {
        // QR em base64 já embutido no JSON
        return {
          status: 'success',
          data: { qrcode: json.qrcode, sessionStatus: 'QRCODE' },
        };
      }

      return {
        status: 'success',
        data: { status: json.status || json.message, sessionStatus: json.status },
      };
    } catch (error: any) {
      return { status: 'error', message: 'QR Code não disponível ainda' };
    }
  }

  async startInstance(sessionName: string, _token: string): Promise<ApiResponse<any>> {
    try {
      const gen = await this.generateToken(sessionName);
      if (gen.status !== 'success' || !gen.data?.token) {
        return { status: 'error', message: 'Erro ao gerar token da sessão' };
      }

      const bearerToken = gen.data.token;

      // Fire and forget — não aguardar resposta
      this.api
        .post(
          `/${encodeURIComponent(sessionName)}/start-session`,
          { waitQrCode: false, webhook: '' },
          {
            headers: { Authorization: `Bearer ${bearerToken}` },
            timeout: 10000,
          }
        )
        .catch(() => {});

      // Aguardar Chromium inicializar no Railway (~25s)
      await new Promise((resolve) => setTimeout(resolve, 25000));

      return {
        status: 'success',
        data: {
          name: sessionName,
          status: 'INITIALIZING',
          qrcode: null,
          token: bearerToken,
        },
      };
    } catch (error: any) {
      return { status: 'error', message: error.message || 'Erro ao iniciar instância' };
    }
  }

  async stopInstance(sessionName: string, token: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.post(`/${sessionName}/stop`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error: any) {
      return { status: 'error', message: error.response?.data?.message || 'Erro ao parar instância' };
    }
  }

  async deleteInstance(sessionName: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.delete(`/instances/${sessionName}`);
      return response.data;
    } catch (error: any) {
      return {
        status: 'error',
        message: error.response?.data?.message || 'Erro ao excluir instância',
      };
    }
  }
}

export default new ApiService();
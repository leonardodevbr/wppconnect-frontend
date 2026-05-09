import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const SECRET_KEY = 'THISISMYSECURETOKEN';

// Tipos básicos
interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: string;
}

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

interface LoginCredentials {
  email: string;
  password: string;
}

interface CreateInstanceData {
  name: string;
  webhook?: string;
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
  async getInstanceConfig(sessionName: string, token: string): Promise<ApiResponse<any>> {
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

  async setInstanceWebhook(sessionName: string, token: string, webhookUrl: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.post(`/${sessionName}/webhook`, {
        url: webhookUrl
      });
      return response.data;
    } catch (error: any) {
      return { status: 'error', message: error.response?.data?.message || 'Erro ao configurar webhook' };
    }
  }

  // Gerenciamento de Instâncias
  async createInstance(name: string, webhook?: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.post('/create-instance', {
        name: name,
        webhook: webhook
      });
      return response.data;
    } catch (error: any) {
      return { status: 'error', message: error.response?.data?.message || 'Erro ao criar instância' };
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
      // Usar a API oficial do WPPConnect que retorna status real
      const response = await this.api.get(`/${sessionName}/qrcode-session`, {
        responseType: 'arraybuffer' // Para lidar com PNG
      });
      
      // Se retornou imagem PNG, converter para base64
      if (response.headers['content-type'] === 'image/png') {
        const base64 = Buffer.from(response.data, 'binary').toString('base64');
        return {
          status: 'success',
          data: {
            qrcode: `data:image/png;base64,${base64}`,
            sessionStatus: 'QRCODE'
          }
        };
      }
      
      // Se retornou JSON com status
      const jsonData = JSON.parse(Buffer.from(response.data).toString());
      return {
        status: 'success',
        data: {
          status: jsonData.status,
          message: jsonData.message,
          sessionStatus: jsonData.status
        }
      };
    } catch (error: any) {
      // Se o erro tem uma resposta JSON
      if (error.response && error.response.data) {
        try {
          const jsonError = JSON.parse(Buffer.from(error.response.data).toString());
          return { status: 'error', message: jsonError.message || 'Erro ao obter QR Code' };
        } catch {
          return { status: 'error', message: 'QR Code não disponível' };
        }
      }
      return { status: 'error', message: error.response?.data?.message || 'Erro ao obter QR Code' };
    }
  }

  async startInstance(sessionName: string, token: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.post(`/${sessionName}/start`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Resposta raw do backend:', response.data);
      
      // O backend já retorna { status, message, data }
      // Precisamos retornar como está
      return response.data;
    } catch (error: any) {
      console.error('Erro na chamada de startInstance:', error);
      return { status: 'error', message: error.response?.data?.message || 'Erro ao iniciar instância' };
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
}

export default new ApiService();
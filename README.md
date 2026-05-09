# SIGVSA WhatsApp API - Frontend

Frontend moderno para a plataforma SIGVSA WhatsApp API, construído com React + TypeScript + Tailwind CSS.

## 🚀 Tecnologias

- **React 19** - Framework frontend
- **TypeScript** - Tipagem estática
- **Vite** - Build tool moderna
- **Tailwind CSS** - Framework CSS utilitário
- **Headless UI** - Componentes acessíveis
- **Heroicons** - Ícones SVG
- **Axios** - Cliente HTTP

## 📦 Instalação

```bash
cd frontend-react
npm install
```

## 🏃‍♂️ Execução

### Desenvolvimento
```bash
npm run dev
```

### Build para produção
```bash
npm run build
```

### Preview da build
```bash
npm run preview
```

## 🎨 Funcionalidades

### ✅ Implementadas
- **Autenticação** - Login/logout com JWT
- **Dashboard** - Visão geral das instâncias
- **Gerenciamento de Instâncias** - Criar, iniciar, parar
- **Estatísticas** - Métricas em tempo real
- **Design Responsivo** - Mobile-first
- **Interface Moderna** - Inspirada na Z-API

### 🔄 Em Desenvolvimento
- **Configurações de Webhook**
- **Logs de Mensagens**
- **Configurações de Segurança**
- **Relatórios Avançados**

## 🔧 Configuração

### Variáveis de Ambiente
```bash
# Backend API URL
VITE_API_URL=http://localhost:3000/api

# Secret Key para autenticação
VITE_SECRET_KEY=THISISMYSECURETOKEN
```

### Credenciais de Teste
- **Email:** admin@sigvsa.com
- **Senha:** admin123

## 📱 Responsividade

O frontend é totalmente responsivo e funciona em:
- 📱 Mobile (320px+)
- 📱 Tablet (768px+)
- 💻 Desktop (1024px+)
- 🖥️ Large Desktop (1280px+)

## 🎯 Próximos Passos

1. **Integração Real** - Conectar com APIs reais do backend
2. **Webhooks** - Interface para configurar webhooks
3. **Logs** - Visualização de mensagens e eventos
4. **Segurança** - Configurações de IP e 2FA
5. **Relatórios** - Gráficos e métricas avançadas

## 🚀 Deploy

### Build para produção
```bash
npm run build
```

Os arquivos serão gerados em `dist/` e podem ser servidos por qualquer servidor web estático.

### Docker (Opcional)
```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```
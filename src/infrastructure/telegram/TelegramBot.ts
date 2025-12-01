import axios from 'axios';
import { config } from '../../config';
import { ILogger } from '../../core/interfaces/ILogger';
import { IAdRepository } from '../../core/interfaces/IAdRepository';
import { AdDetailsService, AdDetails } from '../../core/services/AdDetailsService';
import { IHttpClient } from '../../core/interfaces/IHttpClient';

interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  date: number;
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export class TelegramBot {
  private lastUpdateId: number = 0;
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly logger: ILogger,
    private readonly adRepository: IAdRepository,
    private readonly adDetailsService: AdDetailsService
  ) {}

  async sendMessage(chatId: string, text: string): Promise<void> {
    try {
      const apiUrl = `https://api.telegram.org/bot${config.telegramToken}/sendMessage`;
      await axios.post(apiUrl, {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      }, { timeout: 5000 });
    } catch (error) {
      this.logger.error(`Erro ao enviar mensagem no Telegram: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getUpdates(): Promise<TelegramUpdate[]> {
    try {
      const apiUrl = `https://api.telegram.org/bot${config.telegramToken}/getUpdates`;
      const response = await axios.get(apiUrl, {
        params: {
          offset: this.lastUpdateId + 1,
          timeout: 30
        },
        timeout: 35000
      });
      return response.data.result || [];
    } catch (error) {
      this.logger.error(`Erro ao buscar updates do Telegram: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private formatAdDetails(ad: any, details: AdDetails | null): string {
    let message = `🚗 <b>${ad.title}</b>\n\n`;
    message += `💰 Preço: R$ ${ad.price.toLocaleString('pt-BR')}\n`;
    message += `🔗 <a href="${ad.url}">Ver anúncio</a>\n\n`;
    
    if (details) {
      message += `📊 <b>Referência de Preço:</b>\n`;
      
      if (details.fipePrice) {
        message += `🏷️ Preço FIPE: R$ ${details.fipePrice.toLocaleString('pt-BR')}\n`;
      }
      
      if (details.averagePrice) {
        message += `📈 Preço Médio OLX: R$ ${details.averagePrice.toLocaleString('pt-BR')}\n`;
      }
      
      if (details.priceMin && details.priceMax) {
        message += `\n📉 Faixa de preços:\n`;
        message += `   Mínimo: R$ ${details.priceMin.toLocaleString('pt-BR')}\n`;
        message += `   Máximo: R$ ${details.priceMax.toLocaleString('pt-BR')}\n`;
      }
      
      if (details.vehicleCount) {
        message += `\n📊 Baseado em ${details.vehicleCount} veículos analisados`;
      }
    } else {
      message += `\n⚠️ Informações de FIPE e Preço Médio não disponíveis para este anúncio.`;
    }
    
    return message;
  }

  private async handleCommand(message: TelegramMessage): Promise<void> {
    const text = message.text || '';
    const chatId = message.chat.id.toString();
    
    // Comando /detalhescarro <id>
    const detalhesMatch = text.match(/^\/detalhescarro\s+(\S+)/i);
    if (detalhesMatch) {
      const adId = detalhesMatch[1];
      
      try {
        await this.sendMessage(chatId, `🔍 Buscando detalhes do anúncio ${adId}...`);
        
        // Busca o anúncio no banco
        const ad = await this.adRepository.getAd(adId);
        
        // Busca os detalhes (FIPE e Preço Médio)
        const details = await this.adDetailsService.getAdDetails(ad.url);
        
        // Formata e envia a mensagem
        const responseMessage = this.formatAdDetails(ad, details);
        await this.sendMessage(chatId, responseMessage);
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('No ad with this ID')) {
          await this.sendMessage(chatId, `❌ Anúncio com ID "${adId}" não encontrado no banco de dados.`);
        } else {
          await this.sendMessage(chatId, `❌ Erro ao buscar detalhes: ${errorMsg}`);
          this.logger.error(`Erro ao processar comando /detalhescarro: ${errorMsg}`);
        }
      }
      return;
    }
    
    // Comando /help
    if (text.match(/^\/help/i)) {
      const helpMessage = `🤖 <b>Comandos disponíveis:</b>\n\n` +
        `<code>/detalhescarro &lt;id&gt;</code> - Busca detalhes de um anúncio (FIPE e Preço Médio OLX)\n` +
        `Exemplo: <code>/detalhescarro 1453983584</code>\n\n` +
        `<code>/help</code> - Mostra esta mensagem de ajuda`;
      await this.sendMessage(chatId, helpMessage);
      return;
    }
    
    // Comando não reconhecido
    if (text.startsWith('/')) {
      await this.sendMessage(chatId, `❌ Comando não reconhecido. Use /help para ver os comandos disponíveis.`);
    }
  }

  async startPolling(): Promise<void> {
    this.logger.info('Iniciando bot do Telegram...');
    
    // Verifica se o bot está configurado
    if (!config.telegramToken) {
      this.logger.error('Token do Telegram não configurado! Bot não será iniciado.');
      return;
    }
    
    // Polling a cada 2 segundos
    this.pollingInterval = setInterval(async () => {
      try {
        const updates = await this.getUpdates();
        
        for (const update of updates) {
          if (update.update_id > this.lastUpdateId) {
            this.lastUpdateId = update.update_id;
            
            if (update.message && update.message.text) {
              this.logger.debug(`Mensagem recebida: ${update.message.text}`);
              await this.handleCommand(update.message);
            }
          }
        }
      } catch (error) {
        this.logger.error(`Erro no polling do Telegram: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, 2000);
    
    this.logger.info('Bot do Telegram iniciado e aguardando comandos...');
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.logger.info('Bot do Telegram parado.');
    }
  }
}


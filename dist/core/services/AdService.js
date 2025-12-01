"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdService = void 0;
// AdService.ts
class AdService {
    constructor(adRepository, logger, notifier, adDetailsService) {
        this.adRepository = adRepository;
        this.logger = logger;
        this.notifier = notifier;
        this.adDetailsService = adDetailsService;
    }
    async process(ad) {
        if (!ad.valid) {
            this.logger.debug(`Ad not valid - ID: ${ad.id}, Price: ${ad.price}, URL: ${ad.url}`);
            return;
        }
        try {
            const saved = await this.adRepository.getAd(ad.id).catch(() => null);
            if (saved) {
                this.logger.debug(`Ad found in database, checking price change - ID: ${ad.id}`);
                await this.checkPriceChange(ad, saved);
            }
            else {
                this.logger.debug(`Ad not found in database, adding new ad - ID: ${ad.id}`);
                await this.addNewAd(ad);
            }
        }
        catch (error) {
            this.logger.error(error instanceof Error ? error : String(error));
        }
    }
    isVehicleAd(ad) {
        // Verifica se é um anúncio de veículo pela URL
        return ad.url.includes('/autos-e-pecas/') ||
            ad.url.includes('/carros-vans-e-utilitarios/') ||
            ad.url.includes('/motos/') ||
            ad.url.includes('/caminhoes/');
    }
    formatMessageWithDetails(ad, details) {
        let msg = `🆕 Novo anúncio encontrado!\n\n${ad.title} - R$ ${ad.price.toLocaleString('pt-BR')}\n\n`;
        if (details) {
            // Quilometragem
            if (details.mileage) {
                msg += `🛣️ Quilometragem: ${details.mileage.toLocaleString('pt-BR')} km\n\n`;
            }
            msg += `📊 Referência de Preço:\n`;
            if (details.fipePrice) {
                msg += `🏷️ Preço FIPE: R$ ${details.fipePrice.toLocaleString('pt-BR')}\n`;
            }
            if (details.averagePrice) {
                msg += `📈 Preço Médio OLX: R$ ${details.averagePrice.toLocaleString('pt-BR')}\n`;
            }
            if (details.priceMin && details.priceMax) {
                msg += `📉 Faixa: R$ ${details.priceMin.toLocaleString('pt-BR')} - R$ ${details.priceMax.toLocaleString('pt-BR')}\n`;
            }
            if (details.vehicleCount) {
                msg += `📊 Baseado em ${details.vehicleCount} veículos\n\n`;
            }
            else {
                msg += `\n`;
            }
        }
        msg += `${ad.url}`;
        return msg;
    }
    async addNewAd(ad) {
        await this.adRepository.createAd(ad);
        this.logger.info(`Ad ${ad.id} added to the database`);
        if (ad.notify) {
            let msg = '';
            // Se for anúncio de veículo e tiver o serviço de detalhes, busca automaticamente
            if (this.isVehicleAd(ad) && this.adDetailsService) {
                try {
                    this.logger.debug(`Buscando detalhes automáticos para anúncio de veículo: ${ad.id}`);
                    const details = await this.adDetailsService.getAdDetails(ad.url);
                    msg = this.formatMessageWithDetails(ad, details);
                }
                catch (error) {
                    this.logger.error(`Erro ao buscar detalhes automáticos: ${error instanceof Error ? error.message : String(error)}`);
                    // Fallback para mensagem sem detalhes
                    msg = `🆕 Novo anúncio encontrado!\n\n${ad.title} - R$ ${ad.price.toLocaleString('pt-BR')}\n\n${ad.url}`;
                }
            }
            else {
                msg = `🆕 Novo anúncio encontrado!\n\n${ad.title} - R$ ${ad.price.toLocaleString('pt-BR')}\n\n${ad.url}`;
            }
            await this.notifier.sendNotification(msg, ad.id);
        }
    }
    async checkPriceChange(ad, saved) {
        // Reactivate silently if previously inactive (suppress noisy notifications)
        if (!saved.isActive) {
            this.logger.info(`Ad ${ad.id} was inactive, reactivating it (no notification)`);
            ad.isActive = true;
            await this.adRepository.updateAd(ad);
        }
        if (ad.price !== saved.price) {
            await this.adRepository.updateAd(ad);
            this.logger.info('Price changed for ad: ' + ad.id);
            if (ad.price < saved.price) {
                const percentage = Math.abs(Math.round(((ad.price - saved.price) / saved.price) * 100));
                let msg = `💰 Redução de preço encontrada! ${percentage}% OFF!\n\nDe R$ ${saved.price.toLocaleString('pt-BR')} para R$ ${ad.price.toLocaleString('pt-BR')}\n\n`;
                // Se for anúncio de veículo, inclui detalhes atualizados
                if (this.isVehicleAd(ad) && this.adDetailsService) {
                    try {
                        const details = await this.adDetailsService.getAdDetails(ad.url);
                        if (details) {
                            // Quilometragem
                            if (details.mileage) {
                                msg += `🛣️ Quilometragem: ${details.mileage.toLocaleString('pt-BR')} km\n\n`;
                            }
                            msg += `📊 Referência de Preço:\n`;
                            if (details.fipePrice) {
                                msg += `🏷️ Preço FIPE: R$ ${details.fipePrice.toLocaleString('pt-BR')}\n`;
                            }
                            if (details.averagePrice) {
                                msg += `📈 Preço Médio OLX: R$ ${details.averagePrice.toLocaleString('pt-BR')}\n`;
                            }
                            msg += `\n`;
                        }
                    }
                    catch (error) {
                        this.logger.debug(`Erro ao buscar detalhes na redução de preço: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
                msg += `${ad.url}`;
                await this.notifier.sendNotification(msg, ad.id);
            }
        }
    }
}
exports.AdService = AdService;

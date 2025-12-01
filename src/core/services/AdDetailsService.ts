import { IHttpClient } from '../interfaces/IHttpClient';
import { ILogger } from '../interfaces/ILogger';
import * as cheerio from 'cheerio';

export interface AdDetails {
  fipePrice?: number;
  averagePrice?: number;
  priceMin?: number;
  priceMax?: number;
  vehicleCount?: number;
  mileage?: number;
}

export class AdDetailsService {
  constructor(
    private readonly httpClient: IHttpClient,
    private readonly logger: ILogger
  ) {}

  async getAdDetails(adUrl: string): Promise<AdDetails | null> {
    try {
      this.logger.debug(`Buscando detalhes do anúncio: ${adUrl}`);
      const html = await this.httpClient.get(adUrl);
      
      // Decodifica HTML entities
      const decodedHtml = html.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
      
      const details: AdDetails = {};
      
      // Extrai Preço FIPE
      const fipeMatch = decodedHtml.match(/"abuyFipePrice":\s*\{[^}]*"fipePrice":\s*(\d+)/);
      if (fipeMatch) {
        details.fipePrice = parseInt(fipeMatch[1]);
        this.logger.debug(`Preço FIPE encontrado: ${details.fipePrice}`);
      }
      
      // Extrai Preço Médio e estatísticas
      const priceRefMatch = decodedHtml.match(/"abuyPriceRef":\s*\{[^}]+\}/);
      if (priceRefMatch) {
        try {
          const priceRefData = JSON.parse(`{${priceRefMatch[0]}}`);
          if (priceRefData.abuyPriceRef) {
            const ref = priceRefData.abuyPriceRef;
            details.averagePrice = ref.price_p50; // Mediana (preço médio)
            details.priceMin = ref.price_min;
            details.priceMax = ref.price_max;
            details.vehicleCount = ref.vehicle_count;
            this.logger.debug(`Preço Médio OLX encontrado: ${details.averagePrice}`);
          }
        } catch (e) {
          this.logger.debug('Erro ao parsear abuyPriceRef');
        }
      }
      
      // Extrai Quilometragem do JSON-LD
      const mileageMatch = decodedHtml.match(/"mileageFromOdometer":\s*"(\d+)"/);
      if (mileageMatch) {
        details.mileage = parseInt(mileageMatch[1]);
        this.logger.debug(`Quilometragem encontrada: ${details.mileage} km`);
      }
      
      return Object.keys(details).length > 0 ? details : null;
    } catch (error) {
      this.logger.error(`Erro ao buscar detalhes do anúncio: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}


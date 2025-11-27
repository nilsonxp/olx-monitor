import { HttpClient } from './src/infrastructure/http/HttpClient';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

async function analyzeJson() {
  const httpClient = new HttpClient();
  
  // Usa a primeira URL do config.json
  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  const url = config.urls[0];
  
  console.log('Analisando URL:', url);
  console.log('Fazendo requisição...\n');
  
  try {
    const html = await httpClient.get(url);
    const $ = cheerio.load(html);
    const script = $('script[id="__NEXT_DATA__"]').text();
    
    if (!script) {
      console.log('❌ Script __NEXT_DATA__ não encontrado!');
      return;
    }
    
    const data = JSON.parse(script);
    const adList = data?.props?.pageProps?.ads;
    
    if (!Array.isArray(adList) || !adList.length) {
      console.log('❌ Lista de anúncios não encontrada!');
      return;
    }
    
    console.log(`✅ Encontrados ${adList.length} anúncios\n`);
    console.log('='.repeat(80));
    console.log('ESTRUTURA COMPLETA DO PRIMEIRO ANÚNCIO:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(adList[0], null, 2));
    
    console.log('\n' + '='.repeat(80));
    console.log('CAMPOS DISPONÍVEIS EM TODOS OS ANÚNCIOS:');
    console.log('='.repeat(80));
    
    // Analisa todos os anúncios para ver quais campos existem
    const allFields = new Set<string>();
    adList.forEach((ad: any) => {
      Object.keys(ad).forEach(key => allFields.add(key));
    });
    
    console.log('\n📋 Campos encontrados:');
    Array.from(allFields).sort().forEach(field => {
      const sampleValue = adList[0][field];
      const type = typeof sampleValue;
      const preview = type === 'string' 
        ? (sampleValue.length > 50 ? sampleValue.substring(0, 50) + '...' : sampleValue)
        : type === 'object' 
        ? JSON.stringify(sampleValue).substring(0, 50) + '...'
        : sampleValue;
      
      console.log(`  • ${field}: ${type} = ${preview}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('CAMPOS ATUALMENTE USADOS:');
    console.log('='.repeat(80));
    console.log('  • listId (id)');
    console.log('  • url');
    console.log('  • subject (title)');
    console.log('  • price');
    
    console.log('\n' + '='.repeat(80));
    console.log('CAMPOS DISPONÍVEIS MAS NÃO USADOS:');
    console.log('='.repeat(80));
    const usedFields = ['listId', 'url', 'subject', 'price'];
    const unusedFields = Array.from(allFields).filter(f => !usedFields.includes(f));
    unusedFields.forEach(field => {
      const sampleValue = adList[0][field];
      const type = typeof sampleValue;
      const preview = type === 'string' 
        ? (sampleValue.length > 100 ? sampleValue.substring(0, 100) + '...' : sampleValue)
        : type === 'object' 
        ? JSON.stringify(sampleValue).substring(0, 100) + '...'
        : sampleValue;
      
      console.log(`\n  📌 ${field} (${type}):`);
      console.log(`     Exemplo: ${preview}`);
    });
    
    // Salva o JSON completo em arquivo para análise
    fs.writeFileSync('./json-analysis.json', JSON.stringify(adList[0], null, 2));
    console.log('\n✅ JSON completo do primeiro anúncio salvo em: json-analysis.json');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
  
  process.exit(0);
}

analyzeJson();


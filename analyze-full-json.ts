import { HttpClient } from './src/infrastructure/http/HttpClient';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

async function analyzeFullJson() {
  const httpClient = new HttpClient();
  
  // Usa a primeira URL do config.json
  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  const url = config.urls[0];
  
  console.log('Analisando estrutura completa do JSON da página de resultados');
  console.log('URL:', url);
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
    
    console.log('='.repeat(80));
    console.log('ESTRUTURA COMPLETA DO JSON __NEXT_DATA__');
    console.log('='.repeat(80));
    console.log('\n📋 Chaves principais do objeto raiz:');
    Object.keys(data).forEach(key => {
      console.log(`  • ${key}: ${typeof data[key]}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('ESTRUTURA DE props:');
    console.log('='.repeat(80));
    if (data.props) {
      console.log('\n📋 Chaves de props:');
      Object.keys(data.props).forEach(key => {
        const value = data.props[key];
        const type = typeof value;
        const preview = type === 'object' && value !== null
          ? `{ ${Object.keys(value).slice(0, 5).join(', ')}${Object.keys(value).length > 5 ? '...' : ''} }`
          : type === 'string' && value.length > 50
          ? value.substring(0, 50) + '...'
          : value;
        console.log(`  • ${key}: ${type} = ${preview}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('ESTRUTURA DE props.pageProps:');
    console.log('='.repeat(80));
    if (data.props?.pageProps) {
      console.log('\n📋 Chaves de pageProps:');
      Object.keys(data.props.pageProps).forEach(key => {
        const value = data.props.pageProps[key];
        const type = typeof value;
        if (type === 'object' && value !== null && !Array.isArray(value)) {
          const keys = Object.keys(value);
          console.log(`  • ${key}: object com ${keys.length} chaves`);
          if (keys.length <= 10) {
            keys.forEach(subKey => {
              console.log(`    - ${subKey}: ${typeof value[subKey]}`);
            });
          } else {
            keys.slice(0, 10).forEach(subKey => {
              console.log(`    - ${subKey}: ${typeof value[subKey]}`);
            });
            console.log(`    ... e mais ${keys.length - 10} chaves`);
          }
        } else if (Array.isArray(value)) {
          console.log(`  • ${key}: array com ${value.length} itens`);
          if (value.length > 0) {
            console.log(`    Primeiro item: ${typeof value[0]}`);
          }
        } else {
          const preview = type === 'string' && value.length > 100
            ? value.substring(0, 100) + '...'
            : value;
          console.log(`  • ${key}: ${type} = ${preview}`);
        }
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('INFORMAÇÕES SOBRE A LISTA DE ANÚNCIOS (ads):');
    console.log('='.repeat(80));
    const adList = data?.props?.pageProps?.ads;
    if (Array.isArray(adList)) {
      console.log(`\n✅ Total de anúncios na lista: ${adList.length}`);
      console.log(`\n📋 Estrutura de cada anúncio (já analisada anteriormente)`);
      console.log(`   Cada anúncio contém: id, url, title, price, location, images, properties, etc.`);
    } else {
      console.log('\n❌ Lista de anúncios não encontrada ou não é um array');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('OUTRAS INFORMAÇÕES DISPONÍVEIS NO pageProps (além de ads):');
    console.log('='.repeat(80));
    const pageProps = data?.props?.pageProps;
    if (pageProps) {
      Object.keys(pageProps).forEach(key => {
        if (key !== 'ads') {
          const value = pageProps[key];
          const type = typeof value;
          if (type === 'object' && value !== null && !Array.isArray(value)) {
            console.log(`\n📌 ${key} (object):`);
            const keys = Object.keys(value);
            keys.slice(0, 10).forEach(subKey => {
              const subValue = value[subKey];
              const subType = typeof subValue;
              const preview = subType === 'string' && subValue.length > 60
                ? subValue.substring(0, 60) + '...'
                : subType === 'object' && subValue !== null
                ? JSON.stringify(subValue).substring(0, 60) + '...'
                : subValue;
              console.log(`   ${subKey}: ${subType} = ${preview}`);
            });
            if (keys.length > 10) {
              console.log(`   ... e mais ${keys.length - 10} campos`);
            }
          } else if (Array.isArray(value)) {
            console.log(`\n📌 ${key} (array com ${value.length} itens)`);
            if (value.length > 0 && typeof value[0] === 'object') {
              console.log(`   Estrutura do primeiro item:`, Object.keys(value[0]).slice(0, 5).join(', '));
            }
          } else {
            const preview = type === 'string' && value.length > 100
              ? value.substring(0, 100) + '...'
              : value;
            console.log(`\n📌 ${key}: ${type} = ${preview}`);
          }
        }
      });
    }
    
    // Salva o JSON completo em arquivo para análise detalhada
    fs.writeFileSync('./full-json-analysis.json', JSON.stringify(data, null, 2));
    console.log('\n✅ JSON completo salvo em: full-json-analysis.json');
    console.log('   Você pode abrir este arquivo para ver toda a estrutura detalhada');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
  
  process.exit(0);
}

analyzeFullJson();

